import type { ResolvedTenant } from "../tenants/tenant-service";

// Optional secrets supplied at runtime; never copied into public vars or DTOs.
export type AuthEnv = Env & {
  AUTH_STATE_KEY?: string;
  OIDC_CLIENT_SECRET?: string;
};
export class AuthError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 503,
    public code: string,
  ) {
    super(code);
  }
}
export interface AuthConfig {
  issuer: URL;
  clientId: string;
  clientSecret?: string;
  stateKey: string;
  redirectUri: string;
  local: boolean;
}
export const loopback = (url: URL): boolean =>
  url.hostname === "127.0.0.1" ||
  url.hostname === "localhost" ||
  /^(?:aurora|nodo)\.localhost$/.test(url.hostname);

export const authConfig = (
  env: AuthEnv,
  tenant: ResolvedTenant,
  url: URL,
): AuthConfig | null => {
  if (!env.OIDC_ISSUER && !env.OIDC_CLIENT_ID) return null;
  try {
    const issuer = new URL(env.OIDC_ISSUER);
    const local =
      tenant.localPreview && loopback(url) && url.protocol === "http:";
    if (
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash ||
      !(
        issuer.protocol === "https:" ||
        (local && issuer.protocol === "http:" && loopback(issuer))
      )
    )
      throw new Error();
    const origins: unknown = JSON.parse(env.OIDC_ALLOWED_ORIGINS);
    if (
      !Array.isArray(origins) ||
      !origins.every((o) => typeof o === "string" && new URL(o).origin === o) ||
      !origins.includes(url.origin) ||
      !(url.protocol === "https:" || local) ||
      !env.OIDC_CLIENT_ID ||
      !/^[0-9a-f]{64}$/i.test(env.AUTH_STATE_KEY || "")
    )
      throw new Error();
    return {
      issuer,
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET || undefined,
      stateKey: env.AUTH_STATE_KEY!,
      redirectUri: `${url.origin}/api/auth/callback`,
      local,
    };
  } catch {
    throw new AuthError(503, "AUTH_UNAVAILABLE");
  }
};
