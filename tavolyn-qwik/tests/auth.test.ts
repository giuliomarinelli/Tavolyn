import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createTestHarness, unstable_splitSqlQuery } from "wrangler";
import { startProvider, type Fault } from "./oidc/provider";
import { hash, opaque } from "../src/lib/server/auth/crypto";
import {
  cookiePolicy,
  requireStaffMutation,
} from "../src/lib/server/auth/sessions";
import { authConfig } from "../src/lib/server/auth/config";

const aurora = "http://aurora.localhost:8788";
const nodo = "http://nodo.localhost:8788";
const tenantA = "bbf324b9-0aab-4e61-9001-4ed11d0e05b1";
let idp: Awaited<ReturnType<typeof startProvider>>;
let harness: ReturnType<typeof createTestHarness>;
let db: D1Database;
const request = (
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
  origin = aurora,
) =>
  harness
    .getWorker()
    .fetch(`${origin}${path}`, { ...init, redirect: "manual" });
const cookies = (res: { headers: { getSetCookie(): string[] } }) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
const sql = async (source: string) => {
  await db.batch(unstable_splitSqlQuery(source).map((s) => db.prepare(s)));
};
const begin = async (origin = aurora) => {
  const res = await request("/api/auth/login", {}, origin);
  expect(res.status).toBe(302);
  return {
    authorization: new URL(res.headers.get("Location")!),
    browser: cookies(res),
    origin,
  };
};
const approve = async (
  flow: Awaited<ReturnType<typeof begin>>,
  subject = "fixture-aurora-owner",
) => {
  const res = await fetch(flow.authorization, { redirect: "manual" });
  expect(res.status).toBe(200);
  const html = await res.text();
  const handle = html.match(/name="request" value="([^"]+)"/)![1];
  const approved = await fetch(`${idp.issuer}/authorize`, {
    method: "POST",
    body: new URLSearchParams({ request: handle, subject }),
    redirect: "manual",
  });
  expect(approved.status).toBe(303);
  return new URL(approved.headers.get("Location")!);
};
const finish = (
  flow: Awaited<ReturnType<typeof begin>>,
  callback: URL,
  cookie = flow.browser,
) =>
  request(
    callback.pathname + callback.search,
    { headers: { Cookie: cookie } },
    flow.origin,
  );
const signin = async (subject = "fixture-aurora-owner", origin = aurora) => {
  const flow = await begin(origin);
  const url = await approve(flow, subject);
  const res = await finish(flow, url);
  return {
    flow,
    url,
    res,
    cookie: cookies(res)
      .split("; ")
      .filter((c) => c.startsWith("tavolyn-local-session="))
      .join(""),
  };
};
const me = (cookie: string, origin = aurora) =>
  request("/api/staff/me", { headers: { Cookie: cookie } }, origin);

beforeAll(async () => {
  idp = await startProvider([aurora, nodo]);
  harness = createTestHarness({
    workers: [
      {
        configPath: "wrangler.jsonc",
        vars: {
          LOCAL_DEMO_MODE: "true",
          OIDC_ISSUER: idp.issuer,
          OIDC_CLIENT_ID: "local-fixture-client",
          OIDC_ALLOWED_ORIGINS: JSON.stringify([aurora, nodo]),
          AUTH_STATE_KEY: crypto
            .getRandomValues(new Uint8Array(32))
            .reduce((s, n) => s + n.toString(16).padStart(2, "0"), ""),
        },
      },
    ],
  });
  await harness.listen();
  const environment = await harness
    .getWorker<Env & { AUTH_STATE_KEY: string }>()
    .getEnv();
  expect(typeof environment.AUTH_STATE_KEY).toBe("string");
  db = environment.DB;
  for (const path of [
    "migrations/0001_tenants.sql",
    "seeds/demo-tenants.sql",
    "migrations/0002_catalog.sql",
    "seeds/demo-catalog.sql",
    "migrations/0003_checkout.sql",
    "seeds/demo-checkout.sql",
    "migrations/0004_tracking_outbox.sql",
    "migrations/0005_staff_auth.sql",
    "seeds/demo-staff.sql",
  ])
    await sql(await readFile(path, "utf8"));
});
beforeEach(() => {
  idp.control.fault = "none";
});
afterAll(async () => {
  await harness?.close();
  await idp?.close();
});

describe("real OIDC code/PKCE, signed ID tokens and D1 sessions", () => {
  it.each([
    ["fixture-aurora-owner", aurora, "OWNER"],
    ["fixture-aurora-operator", aurora, "OPERATOR"],
    ["fixture-nodo-operator", nodo, "OPERATOR"],
  ])("authorizes %s with server role", async (subject, origin, role) => {
    const { res, cookie, flow } = await signin(subject, origin);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/login/");
    expect(flow.authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(flow.authorization.searchParams.get("scope")).toBe("openid");
    expect(idp.control.verifiers.at(-1)).toHaveLength(43);
    const response = await me(cookie, origin);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role,
      capabilities: ["order.read", "order.manage"],
      tenant: { slug: origin === aurora ? "aurora" : "nodo" },
    });
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(res.headers.get("set-cookie")).toContain("Path=/");
    expect(res.headers.get("set-cookie")).not.toMatch(/Domain=|Secure/);
    const raw = cookie.split("=")[1];
    const session = await db
      .prepare("SELECT * FROM app_sessions WHERE session_hash=?")
      .bind(await hash(raw))
      .first();
    expect(session).toMatchObject({
      cognito_sub: subject,
      revoked_at: null,
      issuer: idp.issuer,
    });
    expect(JSON.stringify(session)).not.toContain(raw);
    expect(
      Date.parse(session!.expires_at as string) -
        Date.parse(session!.created_at as string),
    ).toBe(3600000);
    const html = await (
      await request("/login/", { headers: { Cookie: cookie } }, origin)
    ).text();
    expect(html).toContain("Sessione attiva");
    expect(html).not.toContain(raw);
    expect(html).not.toContain(subject);
  });
  it.each<Fault>([
    "nonce",
    "signature",
    "issuer",
    "audience",
    "expired",
    "future",
    "unknown-key",
    "algorithm",
    "token-error",
    "pkce",
    "denied",
  ])("rejects %s through the application callback", async (fault) => {
    const flow = await begin();
    idp.control.fault = fault;
    const url = await approve(flow);
    const res = await finish(flow, url);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/login/?result=failed");
    expect(cookies(res)).not.toContain("session=");
    expect((await me(cookies(res))).status).toBe(401);
  });
  it.each([
    "missing",
    "altered",
    "expired",
    "missing-browser",
    "altered-browser",
  ])("rejects %s login correlation", async (mode) => {
    const flow = await begin();
    const url = await approve(flow);
    if (mode === "missing") url.searchParams.delete("state");
    if (mode === "altered") url.searchParams.set("state", opaque());
    if (mode === "expired")
      await db
        .prepare(
          "UPDATE oidc_login_transactions SET created_at='2000-01-01T00:00:00.000Z',expires_at=? WHERE state_hash=?",
        )
        .bind(
          new Date(Date.now() - 1000).toISOString(),
          await hash(url.searchParams.get("state")!),
        )
        .run();
    const res = await finish(
      flow,
      url,
      mode === "missing-browser"
        ? ""
        : mode === "altered-browser"
          ? `tavolyn-local-login=${opaque()}`
          : flow.browser,
    );
    expect(res.headers.get("Location")).toBe("/login/?result=failed");
    expect(cookies(res)).not.toContain("session=");
  });
  it("consumes callback once, including simultaneous delivery", async () => {
    const flow = await begin();
    const url = await approve(flow);
    const before = idp.control.tokenCalls;
    const results = await Promise.all([finish(flow, url), finish(flow, url)]);
    expect(results.map((r) => r.headers.get("Location")).sort()).toEqual([
      "/login/",
      "/login/?result=failed",
    ]);
    expect(idp.control.tokenCalls - before).toBe(1);
    expect((await finish(flow, url)).headers.get("Location")).toContain(
      "failed",
    );
  });
  it("encrypts nonce/verifier, hashes state/browser and detects ciphertext tampering", async () => {
    const flow = await begin();
    const url = await approve(flow);
    const state = flow.authorization.searchParams.get("state")!;
    const row = await db
      .prepare("SELECT * FROM oidc_login_transactions WHERE state_hash=?")
      .bind(await hash(state))
      .first();
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(state);
    expect(JSON.stringify(row)).not.toContain(
      flow.authorization.searchParams.get("nonce"),
    );
    expect(JSON.stringify(row)).not.toContain(flow.browser.split("=")[1]);
    await db
      .prepare(
        "UPDATE oidc_login_transactions SET encrypted_state='[]' WHERE state_hash=?",
      )
      .bind(await hash(state))
      .run();
    expect((await finish(flow, url)).headers.get("Location")).toContain(
      "failed",
    );
  });
  it("rejects tenant/origin changes and unauthorized callback hosts", async () => {
    const flow = await begin();
    const url = await approve(flow);
    expect(
      (await finish({ ...flow, origin: nodo }, url)).headers.get("Location"),
    ).toContain("failed");
    expect(
      (
        await request(
          url.pathname + url.search,
          { headers: { Cookie: flow.browser } },
          "http://evil.localhost:8788",
        )
      ).status,
    ).toBe(404);
    expect((await finish(flow, url)).headers.get("Location")).toBe("/login/");
  });
  it.each([
    "?returnUrl=https://evil.invalid",
    "?returnUrl=//evil.invalid",
    "?tenantId=other",
    "?redirect_uri=https://evil.invalid",
  ])("refuses redirect/tenant input %s", async (query) => {
    expect((await request(`/api/auth/login${query}`)).status).toBe(400);
  });
  it.each(["fixture-disabled", "fixture-unassigned", "fixture-nodo-operator"])(
    "does not create a session for %s on Aurora",
    async (subject) => {
      const { res, cookie } = await signin(subject);
      expect(res.headers.get("Location")).toBe("/login/?result=denied");
      expect(cookie).toBe("");
    },
  );
  it("checks membership on every request and loses access immediately", async () => {
    const { cookie } = await signin("fixture-aurora-operator");
    await db
      .prepare(
        "UPDATE staff_memberships SET active=0 WHERE tenant_id=? AND cognito_sub='fixture-aurora-operator'",
      )
      .bind(tenantA)
      .run();
    try {
      expect((await me(cookie)).status).toBe(403);
      expect(
        await (
          await request("/login/", { headers: { Cookie: cookie } })
        ).text(),
      ).toContain("Accesso negato");
    } finally {
      await db
        .prepare(
          "UPDATE staff_memberships SET active=1 WHERE tenant_id=? AND cognito_sub='fixture-aurora-operator'",
        )
        .bind(tenantA)
        .run();
    }
  });
  it("denies a valid session on another tenant or origin", async () => {
    const { cookie } = await signin();
    expect((await me(cookie, nodo)).status).toBe(403);
  });
  it("rejects absent, nonexistent, altered, expired and revoked sessions", async () => {
    for (const cookie of [
      "",
      `tavolyn-local-session=${opaque()}`,
      "tavolyn-local-session=invalid",
    ])
      expect((await me(cookie)).status).toBe(401);
    const { cookie } = await signin();
    const altered = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");
    expect((await me(altered)).status).toBe(401);
    const digest = await hash(cookie.split("=")[1]);
    await db
      .prepare(
        "UPDATE app_sessions SET created_at='2000-01-01T00:00:00.000Z',expires_at='2001-01-01T00:00:00.000Z' WHERE session_hash=?",
      )
      .bind(digest)
      .run();
    expect((await me(cookie)).status).toBe(401);
    const second = await signin();
    await db
      .prepare("UPDATE app_sessions SET revoked_at=? WHERE session_hash=?")
      .bind(new Date().toISOString(), await hash(second.cookie.split("=")[1]))
      .run();
    expect((await me(second.cookie)).status).toBe(401);
  });
  it("rejects logout CSRF, then revokes and prevents reuse", async () => {
    const { cookie } = await signin();
    for (const origin of [undefined, "https://evil.invalid", nodo]) {
      const res = await request("/api/auth/logout", {
        method: "POST",
        headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
      });
      expect(res.status).toBe(403);
      expect((await me(cookie)).status).toBe(200);
    }
    expect(
      (
        await request("/api/auth/logout", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: aurora,
            "Sec-Fetch-Site": "cross-site",
          },
        })
      ).status,
    ).toBe(403);
    const res = await request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie, Origin: aurora },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0|1970/);
    expect((await me(cookie)).status).toBe(401);
  });
  it("rotates the session on a fresh verified login instead of fixing it", async () => {
    const first = await signin();
    const flow = await begin();
    const callback = await approve(flow);
    const res = await finish(
      flow,
      callback,
      `${flow.browser}; ${first.cookie}`,
    );
    expect(cookies(res)).not.toContain(first.cookie);
    expect((await me(first.cookie)).status).toBe(401);
  });
  it("returns a safe JSON logout result to the browser fetch client", async () => {
    const { cookie } = await signin();
    const res = await request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie, Origin: aurora, Accept: "application/json" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ loggedOut: true });
    expect((await me(cookie)).status).toBe(401);
  });
  it("ignores callback return URLs and removes consumed encrypted state", async () => {
    const flow = await begin();
    const url = await approve(flow);
    url.searchParams.set("returnUrl", "https://untrusted.invalid");
    const res = await finish(flow, url);
    expect(res.headers.get("Location")).toBe("/login/");
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM oidc_login_transactions WHERE state_hash=?",
        )
        .bind(await hash(url.searchParams.get("state")!))
        .first("n"),
    ).toBe(0);
  });
  it.each<Fault>(["discovery-error", "timeout"])(
    "handles provider %s without protocol details",
    async (fault) => {
      idp.control.fault = fault;
      const res = await request("/api/auth/login");
      expect(res.status).toBe(503);
      const body = await res.text();
      expect(body).not.toContain(idp.issuer);
      expect(body).not.toContain("SQL");
    },
  );
  it("keeps migrations and local fixtures repeatable and preserves manual revocations", async () => {
    await sql(await readFile("migrations/0005_staff_auth.sql", "utf8"));
    await db
      .prepare(
        "UPDATE staff_memberships SET active=0 WHERE cognito_sub='fixture-aurora-operator'",
      )
      .run();
    try {
      await sql(await readFile("seeds/demo-staff.sql", "utf8"));
      expect(
        await db
          .prepare(
            "SELECT active FROM staff_memberships WHERE cognito_sub='fixture-aurora-operator'",
          )
          .first("active"),
      ).toBe(0);
      expect(
        await db
          .prepare("SELECT COUNT(*) FROM staff_memberships")
          .first("COUNT(*)"),
      ).toBe(4);
    } finally {
      await db
        .prepare(
          "UPDATE staff_memberships SET active=1 WHERE cognito_sub='fixture-aurora-operator'",
        )
        .run();
    }
    await expect(
      db
        .prepare("INSERT INTO staff_memberships VALUES (?, 'bad', 'ADMIN', 1)")
        .bind(tenantA)
        .run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare(
          "INSERT INTO staff_memberships VALUES ('missing', 'bad', 'OWNER', 1)",
        )
        .run(),
    ).rejects.toThrow();
  });
  it("uses strict HTTPS cookie policy and refuses insecure non-preview configuration", async () => {
    const { getRequestTenant, setRequestTenant } = await import(
      "../src/lib/server/tenants/tenant-service"
    );
    const event = {
      request: new Request("https://aurora.tavolyn.test/login/"),
      sharedMap: new Map(),
    } as Parameters<typeof cookiePolicy>[0];
    const env = await harness.getWorker<Env>().getEnv();
    const { resolveTenant } = await import(
      "../src/lib/server/tenants/tenant-service"
    );
    setRequestTenant(
      event,
      (await resolveTenant(new URL(event.request.url), env))!,
    );
    expect(cookiePolicy(event)).toMatchObject({
      name: "__Host-tavolyn-session",
      options: { secure: true, httpOnly: true, sameSite: "lax", path: "/" },
    });
    expect(
      authConfig(
        { ...env, OIDC_ISSUER: "", OIDC_CLIENT_ID: "" },
        getRequestTenant(event),
        new URL(event.request.url),
      ),
    ).toBeNull();
    expect(() =>
      authConfig(env, getRequestTenant(event), new URL(event.request.url)),
    ).toThrow();
    // Mutation helper rejects untrusted origins before touching a session or D1.
    await expect(
      requireStaffMutation(event, "order.manage"),
    ).rejects.toMatchObject({ status: 403 });
  });
});
