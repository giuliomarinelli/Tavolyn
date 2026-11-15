import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createTestHarness, unstable_splitSqlQuery } from "wrangler";
import type { RestaurantSite } from "../src/lib/shared/site";

// Integration tests use the actual adapter output, never a mocked HTTP handler.
const server = createTestHarness({
  workers: [{ configPath: "./wrangler.jsonc" }],
});
let database: D1Database;
let migration: string;
let seed: string;
const auroraOrigin = "https://aurora.tavolyn.test";
const nodoOrigin = "https://nodo.tavolyn.test";
const applySql = async (sql: string) => {
  await database.batch(
    unstable_splitSqlQuery(sql).map((statement) => database.prepare(statement)),
  );
};
const readSite = async (
  origin: string,
  suffix = "",
  headers?: Record<string, string>,
) => {
  const response = await server.fetch(`${origin}/api/public/site${suffix}`, {
    headers,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as RestaurantSite;
};

beforeAll(async () => {
  await server.listen();
  database = (await server.getWorker<Env>().getEnv()).DB;
  migration = await readFile("migrations/0001_tenants.sql", "utf8");
  seed = await readFile("seeds/demo-tenants.sql", "utf8");
  await applySql(migration);
  await applySql(seed);
});

afterAll(async () => {
  await server.close();
});

describe("the single Tavolyn Worker", () => {
  it("serves a JSON liveness response without caching it", async () => {
    const response = await server.fetch("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", service: "tavolyn" });
  });

  it("renders the Qwik page and serves its client bundle on the same origin", async () => {
    const response = await server.fetch(`${auroraOrigin}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain("Tavolyn");
    expect(html).toContain('lang="it"');
    expect(html).toContain('q:container="paused"');
    expect(html).toContain("Powered by");
    expect(html).toContain("Trattoria Aurora");

    const bundlePath = html.match(/(?:src|href)="(\/build\/[^"?]+\.js)/)?.[1];
    expect(bundlePath).toBeDefined();
    const bundle = await server.fetch(bundlePath!);
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get("Content-Type")).toMatch(/javascript/);
    await bundle.body?.cancel();
  });

  it("serves public assets", async () => {
    const response = await server.fetch("/favicon.svg");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  });

  it.each(["/missing-route", "/api/missing", "/_worker.js", "/_routes.json"])(
    "returns 404 for %s without exposing server artifacts",
    async (path) => {
      const response = await server.fetch(`${auroraOrigin}${path}`);
      expect(response.status).toBe(404);
      const body = await response.text();
      expect(body).not.toContain("export default");
      expect(body).not.toContain("createQwikCity");
    },
  );
});

describe("D1 tenants and authorized hostnames", () => {
  it("replays schema and seed without duplicates or changing data", async () => {
    const before = await database
      .prepare("SELECT * FROM tenants ORDER BY id")
      .all();
    await applySql(migration);
    await applySql(seed);
    const after = await database
      .prepare("SELECT * FROM tenants ORDER BY id")
      .all();
    expect(after.results).toEqual(before.results);
    expect(after.results).toHaveLength(2);
    expect(
      await database
        .prepare("SELECT COUNT(*) AS count FROM tenant_domains")
        .first("count"),
    ).toBe(6);
  });

  it("enforces domain uniqueness, foreign keys, one primary domain and JSON validity", async () => {
    await expect(
      database
        .prepare(
          "INSERT INTO tenant_domains VALUES ('missing.test', 'missing', 0, 0)",
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      database
        .prepare(
          "INSERT INTO tenant_domains SELECT hostname, tenant_id, 0, 0 FROM tenant_domains LIMIT 1",
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      database
        .prepare(
          "INSERT INTO tenant_domains SELECT 'second.test', id, 1, 0 FROM tenants WHERE slug = 'aurora'",
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      database
        .prepare(
          "UPDATE tenants SET branding_json = 'invalid' WHERE slug = 'aurora'",
        )
        .run(),
    ).rejects.toThrow();
  });

  it("loads different public configurations and keeps internal identity server-side", async () => {
    const aurora = await readSite(auroraOrigin);
    const nodo = await readSite(nodoOrigin);
    expect(aurora.name).toBe("Trattoria Aurora");
    expect(nodo.name).toBe("Nodo Pizza Lab");
    expect(aurora.branding.theme).toBe("aurora");
    expect(nodo.branding.theme).toBe("nodo");
    expect(aurora.branding.accent).not.toBe(nodo.branding.accent);
    expect(aurora.branding.logoPath).not.toBe(nodo.branding.logoPath);
    expect(aurora.contact.address).not.toBe(nodo.contact.address);
    expect(aurora.contact.email).not.toBe(nodo.contact.email);
    expect(aurora).not.toHaveProperty("id");
    expect(JSON.stringify(aurora)).not.toContain(nodo.contact.email);
    expect(JSON.stringify(nodo)).not.toContain(aurora.contact.email);
  });

  it.each([
    [auroraOrigin, "Trattoria Aurora", "Nodo Pizza Lab", "aurora"],
    [nodoOrigin, "Nodo Pizza Lab", "Trattoria Aurora", "nodo"],
  ])(
    "renders only the resolved restaurant for %s",
    async (origin, name, otherName, theme) => {
      const response = await server.fetch(`${origin}/`);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(html).toContain(name);
      expect(html).not.toContain(otherName);
      expect(html).toContain(`data-brand="${theme}"`);
      expect(html).toContain(`src="/brands/${theme}.svg"`);
      expect(html).not.toContain("aurora.localhost");
      expect(html).not.toContain("nodo.localhost");
    },
  );

  it.each([
    "https://unknown.tavolyn.test/",
    "https://aurora.tavolyn.test.evil.test/",
    "https://unknown.tavolyn.test/api/public/site",
  ])("returns 404 for an unknown hostname: %s", async (url) => {
    const response = await server.fetch(url);
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).not.toContain("Trattoria Aurora");
    expect(body).not.toContain("Nodo Pizza Lab");
  });

  it("normalizes case, a trailing DNS dot and ignores port", async () => {
    expect((await readSite("https://AURORA.tavolyn.test.:8443")).name).toBe(
      "Trattoria Aurora",
    );
  });

  it("ignores tenant query parameters, cookies and forwarded/custom headers", async () => {
    const site = await readSite(
      auroraOrigin,
      "?tenantId=0fb0bff7-67e2-4848-9002-c975c0748af2&tenant=nodo&hostname=nodo.tavolyn.test",
      {
        "X-Tenant-Id": "0fb0bff7-67e2-4848-9002-c975c0748af2",
        "X-Forwarded-Host": "nodo.tavolyn.test",
        Forwarded: "host=nodo.tavolyn.test",
        Cookie: "tenant=nodo; tenantId=0fb0bff7-67e2-4848-9002-c975c0748af2",
      },
    );
    expect(site.name).toBe("Trattoria Aurora");
    const html = await (
      await server.fetch(`${auroraOrigin}/`, {
        headers: {
          "X-Forwarded-Host": "nodo.tavolyn.test",
          "X-Forwarded-Proto": "http",
        },
      })
    ).text();
    expect(html).not.toContain("nodo.tavolyn.test");
    expect(html).not.toContain("0fb0bff7-67e2-4848-9002-c975c0748af2");
    expect(
      (
        await server.fetch("https://unknown.test/?tenantId=aurora", {
          headers: { "X-Forwarded-Host": "aurora.tavolyn.test" },
        })
      ).status,
    ).toBe(404);
  });

  it("rejects a POST body attempting to select another tenant", async () => {
    const response = await server.fetch(`${auroraOrigin}/api/public/site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: "0fb0bff7-67e2-4848-9002-c975c0748af2",
        hostname: "nodo.tavolyn.test",
      }),
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(await response.text()).not.toContain("Nodo Pizza Lab");
  });

  it("reads actual D1 changes and preserves manual demo edits on seed replay", async () => {
    await database
      .prepare("UPDATE tenants SET name = ? WHERE slug = ?")
      .bind("Aurora aggiornata", "aurora")
      .run();
    try {
      await applySql(seed);
      expect((await readSite(auroraOrigin)).name).toBe("Aurora aggiornata");
      expect((await readSite(nodoOrigin)).name).toBe("Nodo Pizza Lab");
    } finally {
      await database
        .prepare("UPDATE tenants SET name = ? WHERE slug = ?")
        .bind("Trattoria Aurora", "aurora")
        .run();
    }
  });

  it("rejects a disabled tenant and keeps health independent of D1", async () => {
    await database
      .prepare("UPDATE tenants SET enabled = 0 WHERE slug = 'aurora'")
      .run();
    try {
      expect((await server.fetch(`${auroraOrigin}/`)).status).toBe(404);
      expect(
        (await server.fetch("https://unknown.test/api/health")).status,
      ).toBe(200);
    } finally {
      await database
        .prepare("UPDATE tenants SET enabled = 1 WHERE slug = 'aurora'")
        .run();
    }
  });

  it("fails safely for invalid branding without exposing configuration", async () => {
    const original = await database
      .prepare("SELECT branding_json FROM tenants WHERE slug = 'aurora'")
      .first<string>("branding_json");
    await database
      .prepare("UPDATE tenants SET branding_json = ? WHERE slug = 'aurora'")
      .bind('{"private":"must-never-leak"}')
      .run();
    try {
      const response = await server.fetch(`${auroraOrigin}/api/public/site`);
      expect(response.status).toBe(503);
      expect(response.headers.get("Content-Type")).toContain(
        "application/json",
      );
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({
        error: { code: "SITE_UNAVAILABLE", requestId: expect.any(String) },
      });
      expect(body).not.toContain("must-never-leak");
      expect(body).not.toContain("SELECT");
    } finally {
      await database
        .prepare("UPDATE tenants SET branding_json = ? WHERE slug = 'aurora'")
        .bind(original)
        .run();
    }
  });

  it.each([
    "http://aurora.localhost/",
    "http://nodo.localhost/",
    "http://127.0.0.1/",
    "http://localhost/",
  ])("disables local aliases in public configuration: %s", async (url) => {
    expect((await server.fetch(url)).status).toBe(404);
  });
});

describe("explicit local preview", () => {
  beforeAll(async () => {
    await server.update({
      workers: [
        { configPath: "./wrangler.jsonc", vars: { LOCAL_DEMO_MODE: "true" } },
      ],
    });
  });

  it.each([
    ["aurora.localhost", "Trattoria Aurora"],
    ["nodo.localhost", "Nodo Pizza Lab"],
    ["127.0.0.1", "Trattoria Aurora"],
    ["localhost", "Trattoria Aurora"],
  ])("resolves the configured local host %s", async (hostname, name) => {
    const site = await readSite(`http://${hostname}`);
    expect(site.name).toBe(name);
  });

  it("renders the local navigation with fixed host links", async () => {
    const response = await server.fetch("http://nodo.localhost:8787/");
    const html = await response.text();
    expect(html).toContain('href="http://aurora.localhost:8787/"');
    expect(html).toContain('href="http://nodo.localhost:8787/"');
    expect(html).toContain("Nodo Pizza Lab");
    expect(html).not.toContain("Trattoria Aurora");
  });

  it.each([
    "http://unknown.localhost/",
    "https://aurora.localhost/",
    "https://unknown.test/?tenant=aurora",
    "http://aurora.localhost.evil.test/",
  ])(
    "does not turn local mode into an arbitrary tenant bypass: %s",
    async (url) => {
      // Dispatch directly to workerd: the dev HTTP proxy normalizes protocol.
      expect((await server.getWorker().fetch(url)).status).toBe(404);
    },
  );
});
