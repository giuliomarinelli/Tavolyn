import type { RequestHandler } from "@builder.io/qwik-city";
import {
  resolveTenant,
  setRequestTenant,
  type ResolvedTenant,
} from "../lib/server/tenants/tenant-service";

export const onRequest: RequestHandler = async (event) => {
  event.headers.set("Cache-Control", "no-store");
  event.headers.set("X-Content-Type-Options", "nosniff");
  if (/^\/(?:api\/public\/)?orders\//.test(event.pathname)) {
    event.headers.set("Referrer-Policy", "no-referrer");
    event.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  // Operational liveness is deliberately independent of tenancy and D1.
  if (/^\/api\/health\/?$/.test(event.pathname)) return;

  const fail = (status: 404 | 503, code: string, message: string): never => {
    if (event.pathname.startsWith("/api/")) {
      throw event.json(status, {
        error: { code, message, requestId: crypto.randomUUID() },
      });
    }
    throw event.error(status, message);
  };

  let tenant: ResolvedTenant | null = null;
  try {
    tenant = await resolveTenant(
      new URL(event.request.url),
      event.platform.env,
    );
  } catch {
    // Never send SQL, raw configuration or binding errors to the client.
    fail(
      503,
      "SITE_UNAVAILABLE",
      "Configurazione del ristorante temporaneamente non disponibile",
    );
  }
  if (!tenant)
    return fail(404, "TENANT_NOT_FOUND", "Ristorante non disponibile");
  setRequestTenant(event, tenant);
};
