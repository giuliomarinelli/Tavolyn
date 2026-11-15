import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

// Integration tests use the actual adapter output, never a mocked HTTP handler.
const server = createTestHarness({
  workers: [{ configPath: "./wrangler.jsonc" }],
});

beforeAll(async () => {
  await server.listen();
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
    const response = await server.fetch("/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain("Tavolyn");
    expect(html).toContain('lang="it"');
    expect(html).toContain('q:container="paused"');
    expect(html).toContain('href="/api/health"');

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
      const response = await server.fetch(path);
      expect(response.status).toBe(404);
      const body = await response.text();
      expect(body).not.toContain("export default");
      expect(body).not.toContain("createQwikCity");
    },
  );
});
