import type { RequestEventCommon } from "@builder.io/qwik-city";
import type { Capability, StaffIdentity, StaffRole } from "../../shared/staff";
import { getRequestTenant } from "../tenants/tenant-service";
import { AuthError } from "./config";
import { hash, opaque, validOpaque } from "./crypto";

export const SESSION_SECONDS = 3600;
export const cookiePolicy = (event: RequestEventCommon) => {
  const local = getRequestTenant(event).localPreview;
  if (!local && new URL(event.request.url).protocol !== "https:")
    throw new AuthError(503, "AUTH_UNAVAILABLE");
  return {
    name: local ? "tavolyn-local-session" : "__Host-tavolyn-session",
    correlation: local ? "tavolyn-local-login" : "__Host-tavolyn-login",
    options: {
      httpOnly: true,
      secure: !local,
      sameSite: "lax" as const,
      path: "/",
    },
  };
};
export const capabilities = (role: StaffRole): Capability[] => {
  const grants: Record<StaffRole, Capability[]> = {
    OWNER: ["order.read", "order.manage"],
    OPERATOR: ["order.read", "order.manage"],
  };
  return [...grants[role]];
};
export const assertStaffOrigin = (event: RequestEventCommon): void => {
  if (
    event.request.headers.get("Origin") !== new URL(event.request.url).origin ||
    event.request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    throw new AuthError(403, "CSRF_REJECTED");
};
export const sessionId = (event: RequestEventCommon): string =>
  event.cookie.get(cookiePolicy(event).name)?.value || "";

export interface StaffContext {
  subject: string;
  tenantId: string;
  identity: StaffIdentity;
}
export const requireStaff = async (
  event: RequestEventCommon,
  required?: Capability,
): Promise<StaffContext> => {
  const id = sessionId(event);
  if (!validOpaque(id)) throw new AuthError(401, "SESSION_REQUIRED");
  const tenant = getRequestTenant(event);
  const row = await event.platform.env.DB.prepare(
    `SELECT s.tenant_id,s.cognito_sub,s.origin,s.issuer,s.expires_at,s.revoked_at,
      m.role,m.active FROM app_sessions s LEFT JOIN staff_memberships m
      ON m.tenant_id=s.tenant_id AND m.cognito_sub=s.cognito_sub WHERE s.session_hash=?`,
  )
    .bind(await hash(id))
    .first<{
      tenant_id: string;
      cognito_sub: string;
      origin: string;
      issuer: string;
      expires_at: string;
      revoked_at: string | null;
      role: StaffRole | null;
      active: number | null;
    }>();
  if (
    !row ||
    row.revoked_at ||
    row.expires_at <= new Date().toISOString() ||
    !event.platform.env.OIDC_ISSUER ||
    row.issuer !== new URL(event.platform.env.OIDC_ISSUER).href
  )
    throw new AuthError(401, "SESSION_EXPIRED");
  if (
    row.tenant_id !== tenant.id ||
    row.origin !== new URL(event.request.url).origin ||
    row.active !== 1 ||
    !row.role
  )
    throw new AuthError(403, "STAFF_FORBIDDEN");
  const grants = capabilities(row.role);
  if (required && !grants.includes(required))
    throw new AuthError(403, "STAFF_FORBIDDEN");
  return {
    subject: row.cognito_sub,
    tenantId: tenant.id,
    identity: {
      identity: { label: row.role === "OWNER" ? "Titolare" : "Operatore" },
      tenant: { slug: tenant.site.slug, name: tenant.site.name },
      role: row.role,
      capabilities: grants,
      expiresAt: row.expires_at,
    },
  };
};
export const staffIdentity = async (
  event: RequestEventCommon,
): Promise<StaffIdentity> => (await requireStaff(event)).identity;
export const requireStaffMutation = async (
  event: RequestEventCommon,
  capability: Capability,
) => {
  assertStaffOrigin(event);
  return requireStaff(event, capability);
};
export const createSession = async (
  event: RequestEventCommon,
  subject: string,
  issuer: string,
): Promise<void> => {
  const tenant = getRequestTenant(event);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000);
  const id = opaque();
  const policy = cookiePolicy(event);
  const oldId = sessionId(event);
  // Membership condition also guards a revocation racing the token exchange.
  const result = await event.platform.env.DB.prepare(
    `INSERT INTO app_sessions
      (session_hash,tenant_id,cognito_sub,issuer,origin,created_at,expires_at)
      SELECT ?,tenant_id,cognito_sub,?,?,?,? FROM staff_memberships
      WHERE tenant_id=? AND cognito_sub=? AND active=1`,
  )
    .bind(
      await hash(id),
      issuer,
      new URL(event.request.url).origin,
      now.toISOString(),
      expires.toISOString(),
      tenant.id,
      subject,
    )
    .run();
  if (result.meta.changes !== 1) throw new AuthError(403, "STAFF_FORBIDDEN");
  if (validOpaque(oldId)) await revokeSession(event, oldId);
  event.cookie.set(policy.name, id, {
    ...policy.options,
    maxAge: SESSION_SECONDS,
    expires,
  });
};
export const revokeSession = async (
  event: RequestEventCommon,
  id = sessionId(event),
): Promise<void> => {
  if (!validOpaque(id)) return;
  await event.platform.env.DB.prepare(
    `UPDATE app_sessions SET revoked_at=COALESCE(revoked_at,?)
    WHERE session_hash=? AND tenant_id=? AND origin=?`,
  )
    .bind(
      new Date().toISOString(),
      await hash(id),
      getRequestTenant(event).id,
      new URL(event.request.url).origin,
    )
    .run();
};
