import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createTestHarness, unstable_splitSqlQuery } from "wrangler";
import type { RestaurantSite } from "../src/lib/shared/site";
import type { RestaurantMenu } from "../src/lib/shared/catalog";

// Integration tests use the actual adapter output, never a mocked HTTP handler.
const server = createTestHarness({
  workers: [{ configPath: "./wrangler.jsonc" }],
});
let database: D1Database;
let migration: string;
let seed: string;
let catalogSeed: string;
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
  await applySql(await readFile("migrations/0002_catalog.sql", "utf8"));
  catalogSeed = await readFile("seeds/demo-catalog.sql", "utf8");
  await applySql(catalogSeed);
  await applySql(await readFile("migrations/0003_checkout.sql", "utf8"));
  await applySql(await readFile("seeds/demo-checkout.sql", "utf8"));
  await applySql(await readFile("migrations/0004_tracking_outbox.sql", "utf8"));
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
  it.each([auroraOrigin, nodoOrigin])(
    "HEAD returns GET metadata without a body for %s",
    async (origin) => {
      const get = await server.fetch(`${origin}/api/public/site`);
      expect(get.status).toBe(200);
      await get.json();
      const head = await server.fetch(`${origin}/api/public/site`, {
        method: "HEAD",
      });
      expect(head.status).toBe(200);
      expect(head.headers.get("Content-Type")).toBe(
        get.headers.get("Content-Type"),
      );
      expect(head.headers.get("Cache-Control")).toBe(
        get.headers.get("Cache-Control"),
      );
      expect(await head.text()).toBe("");
    },
  );

  it.each(["https://unknown.tavolyn.test", "http://aurora.localhost"])(
    "HEAD preserves tenant rejection for %s",
    async (origin) => {
      const response = await server.fetch(`${origin}/api/public/site`, {
        method: "HEAD",
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    },
  );

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
        (
          await server.fetch(`${auroraOrigin}/api/public/site`, {
            method: "HEAD",
          })
        ).status,
      ).toBe(404);
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

describe("incremental D1 catalog", () => {
  const auroraId = "bbf324b9-0aab-4e61-9001-4ed11d0e05b1";
  const nodoId = "0fb0bff7-67e2-4848-9002-c975c0748af2";
  const menuFor = async (origin: string, suffix = "") => {
    const response = await server.fetch(`${origin}/api/public/menu${suffix}`, {
      headers: {
        "X-Tenant-Id": nodoId,
        "X-Forwarded-Host": "nodo.tavolyn.test",
        Cookie: "tenant=nodo",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    return (await response.json()) as RestaurantMenu;
  };

  it("adds the catalog without altering existing tenants and keeps foreign keys valid", async () => {
    expect(
      await database
        .prepare("SELECT COUNT(*) AS count FROM tenants")
        .first("count"),
    ).toBe(2);
    expect(
      await database
        .prepare("SELECT COUNT(*) AS count FROM tenant_domains")
        .first("count"),
    ).toBe(6);
    expect(
      (await database.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
    expect(
      (
        await database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('categories','products','modifier_groups','modifiers')",
          )
          .all()
      ).results,
    ).toHaveLength(4);
  });

  it("replays catalog seed without duplicates and preserves manual changes", async () => {
    const before = await database
      .prepare("SELECT * FROM products ORDER BY tenant_id, id")
      .all();
    await applySql(catalogSeed);
    expect(
      (
        await database
          .prepare("SELECT * FROM products ORDER BY tenant_id, id")
          .all()
      ).results,
    ).toEqual(before.results);
    const original = await database
      .prepare(
        "SELECT base_price_cents FROM products WHERE tenant_id = ? AND slug = 'margherita'",
      )
      .bind(auroraId)
      .first<number>("base_price_cents");
    await database
      .prepare(
        "UPDATE products SET base_price_cents = 1234 WHERE tenant_id = ? AND slug = 'margherita'",
      )
      .bind(auroraId)
      .run();
    try {
      const snapshot = [];
      for (const table of [
        "categories",
        "products",
        "modifier_groups",
        "modifiers",
      ])
        snapshot.push(
          (
            await database
              .prepare(`SELECT * FROM ${table} ORDER BY tenant_id, id`)
              .all()
          ).results,
        );
      await applySql(catalogSeed);
      const after = [];
      for (const table of [
        "categories",
        "products",
        "modifier_groups",
        "modifiers",
      ])
        after.push(
          (
            await database
              .prepare(`SELECT * FROM ${table} ORDER BY tenant_id, id`)
              .all()
          ).results,
        );
      expect(after).toEqual(snapshot);
      expect(
        (await menuFor(auroraOrigin)).categories
          .flatMap((c) => c.products)
          .find((p) => p.slug === "margherita")?.basePriceCents,
      ).toBe(1234);
    } finally {
      await database
        .prepare(
          "UPDATE products SET base_price_cents = ? WHERE tenant_id = ? AND slug = 'margherita'",
        )
        .bind(original, auroraId)
        .run();
    }
  });

  it.each([
    ["products", "category_id", "categories"],
    ["modifier_groups", "product_id", "products"],
    ["modifiers", "group_id", "modifier_groups"],
  ])("rejects a cross-tenant parent on %s", async (table, column, parent) => {
    const otherId = await database
      .prepare(`SELECT id FROM ${parent} WHERE tenant_id = ? LIMIT 1`)
      .bind(nodoId)
      .first<string>("id");
    const ownId = await database
      .prepare(`SELECT id FROM ${table} WHERE tenant_id = ? LIMIT 1`)
      .bind(auroraId)
      .first<string>("id");
    await expect(
      database
        .prepare(
          `UPDATE ${table} SET ${column} = ? WHERE tenant_id = ? AND id = ?`,
        )
        .bind(otherId, auroraId, ownId)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(
      database
        .prepare(
          `UPDATE ${table} SET ${column} = 'missing' WHERE tenant_id = ? AND id = ?`,
        )
        .bind(auroraId, ownId)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it.each([
    "UPDATE products SET base_price_cents = 2.5",
    "UPDATE products SET base_price_cents = -1",
    "UPDATE modifiers SET delta_price_cents = -1",
    "UPDATE modifiers SET delta_price_cents = 1.5",
    "UPDATE products SET available = 2",
    "UPDATE modifier_groups SET min_select = max_select + 1",
    "UPDATE modifier_groups SET max_select = 0",
    "UPDATE modifier_groups SET max_select = 1.5",
    "UPDATE categories SET tenant_id = 'missing'",
  ])("enforces SQL integrity: %s", async (sql) => {
    await expect(database.prepare(sql).run()).rejects.toThrow();
  });

  it("returns distinct ordered catalogs and ignores hostile tenant/product selectors", async () => {
    const aurora = await menuFor(
      auroraOrigin,
      `?tenantId=${nodoId}&tenant=nodo`,
    );
    const nodo = await menuFor(nodoOrigin);
    const a = aurora.categories.flatMap((c) => c.products);
    const n = nodo.categories.flatMap((c) => c.products);
    expect(a).toHaveLength(15);
    expect(n).toHaveLength(12);
    expect(aurora.categories[0].name).toBe("Antipasti");
    expect(nodo.categories[0].name).toBe("Classici, riletti");
    expect(a.map((p) => p.id).some((id) => n.some((p) => p.id === id))).toBe(
      false,
    );
    const attempted = await menuFor(
      auroraOrigin,
      `?productId=${n[0].id}&tenant_id=${nodoId}`,
    );
    expect(attempted).toEqual(aurora);
    expect(JSON.stringify(aurora)).not.toContain("tenant_id");
    expect(JSON.stringify(aurora)).not.toContain(nodoId);
    expect(JSON.stringify(aurora)).not.toContain("Margherita Lab");
    expect(a.some((p) => !p.available)).toBe(true);
    expect(n.some((p) => !p.available)).toBe(true);
    for (const product of [...a, ...n]) {
      expect(Number.isInteger(product.basePriceCents)).toBe(true);
      for (const group of product.modifierGroups) {
        expect(group.minSelect).toBeLessThanOrEqual(group.maxSelect);
        for (const modifier of group.modifiers)
          expect(Number.isInteger(modifier.deltaPriceCents)).toBe(true);
      }
    }
    expect(
      a
        .flatMap((p) => p.modifierGroups)
        .flatMap((g) => g.modifiers)
        .some((m) => !m.available),
    ).toBe(true);
  });

  it.each([
    [auroraOrigin, "Margherita", "Margherita Lab"],
    [nodoOrigin, "Margherita Lab", "Crostini dell’orto"],
  ])("renders menu and cart for %s", async (origin, own, other) => {
    const response = await server.fetch(`${origin}/menu/`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(own);
    expect(html).not.toContain(other);
    expect(html).toContain("Esaurito per oggi");
    const cart = await server.fetch(`${origin}/cart/`);
    expect(cart.status).toBe(200);
    expect(await cart.text()).toContain("Recuperiamo il tuo carrello");
  });

  it("omits inactive categories and handles an empty menu", async () => {
    await database
      .prepare("UPDATE categories SET active = 0 WHERE tenant_id = ?")
      .bind(auroraId)
      .run();
    try {
      expect((await menuFor(auroraOrigin)).categories).toEqual([]);
      expect((await menuFor(nodoOrigin)).categories).toHaveLength(5);
      const response = await server.fetch(`${auroraOrigin}/menu/`);
      expect(await response.text()).toContain(
        "Il prossimo incontro è in preparazione",
      );
    } finally {
      await database
        .prepare("UPDATE categories SET active = 1 WHERE tenant_id = ?")
        .bind(auroraId)
        .run();
    }
  });

  it("rejects unrecognized hosts and API mutations", async () => {
    expect(
      (await server.fetch("https://unknown.test/api/public/menu")).status,
    ).toBe(404);
    const response = await server.fetch(`${auroraOrigin}/api/public/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: nodoId }),
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(await response.json()).toMatchObject({
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });

  it("returns a safe 503 on catalog storage failure without breaking site/health", async () => {
    await database
      .prepare("ALTER TABLE modifiers RENAME TO modifiers_unavailable")
      .run();
    try {
      const response = await server.fetch(`${auroraOrigin}/api/public/menu`);
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({
        error: { code: "MENU_UNAVAILABLE", requestId: expect.any(String) },
      });
      expect(body).not.toMatch(/SELECT|no such table|modifiers_unavailable/);
      expect(
        (await server.fetch(`${auroraOrigin}/api/public/site`)).status,
      ).toBe(200);
      expect((await server.fetch("/api/health")).status).toBe(200);
    } finally {
      await database
        .prepare("ALTER TABLE modifiers_unavailable RENAME TO modifiers")
        .run();
    }
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

  it.each(["aurora.localhost", "nodo.localhost"])(
    "HEAD resolves the enabled local alias %s",
    async (hostname) => {
      const response = await server.fetch(
        `http://${hostname}/api/public/site`,
        { method: "HEAD" },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain(
        "application/json",
      );
      expect(await response.text()).toBe("");
    },
  );

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
