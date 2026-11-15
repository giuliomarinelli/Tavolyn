import type { RequestEvent } from "@builder.io/qwik-city";
import * as oauth from "oauth4webapi";
import { getRequestTenant } from "../tenants/tenant-service";
import { authConfig, AuthError } from "./config";
import { hash, opaque, seal, unseal, validOpaque } from "./crypto";
import { exchangeIdentity, provider } from "./oidc";
import {
  assertStaffOrigin,
  cookiePolicy,
  createSession,
  revokeSession,
  staffIdentity,
} from "./sessions";

export const authFailure = (event: RequestEvent, error: unknown): never => {
  const safe =
    error instanceof AuthError ? error : new AuthError(503, "AUTH_UNAVAILABLE");
  throw event.json(safe.status, {
    error: {
      code: safe.code,
      message:
        safe.status === 401
          ? "Sessione assente o scaduta."
          : safe.status === 403
            ? "Accesso non autorizzato."
            : "Accesso temporaneamente non disponibile.",
      requestId: crypto.randomUUID(),
    },
  });
};
export const login = async (event: RequestEvent): Promise<void> => {
  let target: string;
  try {
    if (event.url.search) throw new AuthError(400, "INVALID_LOGIN_REQUEST");
    const config = authConfig(
      event.platform.env,
      getRequestTenant(event),
      new URL(event.request.url),
    );
    if (!config) throw new AuthError(503, "AUTH_UNAVAILABLE");
    const { metadata } = await provider(config);
    const state = opaque();
    const browser = opaque();
    const verifier = oauth.generateRandomCodeVerifier();
    const nonce = oauth.generateRandomNonce();
    const stateHash = await hash(state);
    const now = new Date();
    const tenant = getRequestTenant(event);
    const aad = JSON.stringify([
      stateHash,
      tenant.id,
      event.url.origin,
      config.issuer.href,
      config.clientId,
      config.redirectUri,
    ]);
    await event.platform.env.DB.prepare(
      "DELETE FROM oidc_login_transactions WHERE tenant_id=? AND expires_at<=?",
    )
      .bind(tenant.id, now.toISOString())
      .run();
    await event.platform.env.DB.prepare(
      `INSERT INTO oidc_login_transactions
      (state_hash,browser_hash,tenant_id,origin,issuer,client_id,redirect_uri,encrypted_state,created_at,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        stateHash,
        await hash(browser),
        tenant.id,
        event.url.origin,
        config.issuer.href,
        config.clientId,
        config.redirectUri,
        await seal(config.stateKey, JSON.stringify({ verifier, nonce }), aad),
        now.toISOString(),
        new Date(now.getTime() + 300000).toISOString(),
      )
      .run();
    const policy = cookiePolicy(event);
    event.cookie.set(policy.correlation, browser, {
      ...policy.options,
      maxAge: 300,
    });
    const url = new URL(metadata.authorization_endpoint!);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid",
      state,
      nonce,
      code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    target = url.href;
  } catch (error) {
    return authFailure(event, error);
  }
  throw event.redirect(302, target);
};
export const callback = async (event: RequestEvent): Promise<void> => {
  let destination = "/login/";
  let policy;
  try {
    policy = cookiePolicy(event);
  } catch (error) {
    return authFailure(event, error);
  }
  try {
    const config = authConfig(
      event.platform.env,
      getRequestTenant(event),
      new URL(event.request.url),
    );
    if (!config) throw new Error();
    const state = event.url.searchParams.get("state") || "";
    const browser = event.cookie.get(policy.correlation)?.value || "";
    if (
      !validOpaque(state) ||
      !validOpaque(browser) ||
      event.url.searchParams.getAll("state").length !== 1
    )
      throw new Error();
    const stateHash = await hash(state);
    const row = await event.platform.env.DB.prepare(
      `DELETE FROM oidc_login_transactions
      WHERE state_hash=? AND browser_hash=? AND tenant_id=? AND origin=? AND issuer=? AND client_id=? AND redirect_uri=?
      AND expires_at>? RETURNING encrypted_state`,
    )
      .bind(
        stateHash,
        await hash(browser),
        getRequestTenant(event).id,
        event.url.origin,
        config.issuer.href,
        config.clientId,
        config.redirectUri,
        new Date().toISOString(),
      )
      .first<{ encrypted_state: string }>();
    if (!row) throw new Error();
    const aad = JSON.stringify([
      stateHash,
      getRequestTenant(event).id,
      event.url.origin,
      config.issuer.href,
      config.clientId,
      config.redirectUri,
    ]);
    const { verifier, nonce }: { verifier: string; nonce: string } = JSON.parse(
      await unseal(config.stateKey, row.encrypted_state, aad),
    );
    const subject = await exchangeIdentity(
      config,
      event.url,
      state,
      verifier,
      nonce,
    );
    await createSession(event, subject, config.issuer.href);
  } catch (error) {
    destination =
      error instanceof AuthError && error.status === 403
        ? "/login/?result=denied"
        : "/login/?result=failed";
  }
  event.cookie.delete(policy.correlation, policy.options);
  throw event.redirect(303, destination);
};
export const logout = async (event: RequestEvent): Promise<void> => {
  try {
    assertStaffOrigin(event);
    await revokeSession(event);
    const policy = cookiePolicy(event);
    event.cookie.delete(policy.name, policy.options);
    event.cookie.delete(policy.correlation, policy.options);
  } catch (error) {
    return authFailure(event, error);
  }
  if (event.request.headers.get("Accept") === "application/json")
    throw event.json(200, { loggedOut: true });
  throw event.redirect(303, "/login/?result=logged-out");
};
export const me = async (event: RequestEvent): Promise<void> => {
  let identity;
  try {
    identity = await staffIdentity(event);
  } catch (error) {
    return authFailure(event, error);
  }
  throw event.json(200, identity);
};
export const only = (method: "GET" | "POST") => (event: RequestEvent) => {
  if (event.request.method !== method) {
    event.headers.set("Allow", method);
    throw event.json(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `Usa ${method}`,
        requestId: crypto.randomUUID(),
      },
    });
  }
};
