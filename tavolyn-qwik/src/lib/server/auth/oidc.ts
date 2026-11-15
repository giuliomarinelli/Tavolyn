import * as oauth from "oauth4webapi";
import { AuthError, loopback, type AuthConfig } from "./config";

const endpointAllowed = (url: URL, config: AuthConfig) =>
  !url.username &&
  !url.password &&
  !url.hash &&
  (url.protocol === "https:" ||
    (config.local && url.protocol === "http:" && loopback(url)));

export const provider = async (config: AuthConfig) => {
  // Request-local options/cache: no mutable user state or network response crosses requests.
  const deadline = AbortSignal.timeout(5000);
  const options = {
    [oauth.allowInsecureRequests]: config.local,
    [oauth.customFetch]: async (
      input: string,
      init: RequestInit,
    ): Promise<Response> => {
      if (!endpointAllowed(new URL(input), config))
        throw new AuthError(503, "AUTH_UNAVAILABLE");
      const response = await fetch(input, {
        ...init,
        redirect: "manual",
        signal: deadline,
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new Error("OIDC endpoint redirect refused");
      }
      if (Number(response.headers.get("Content-Length")) > 65536) {
        await response.body?.cancel();
        throw new Error();
      }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 65536) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return new Response(bytes, {
        status: response.status,
        headers: response.headers,
      });
    },
  };
  const metadata = await oauth.processDiscoveryResponse(
    config.issuer,
    await oauth.discoveryRequest(config.issuer, options),
  );
  for (const name of [
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
  ] as const) {
    const value = metadata[name];
    if (typeof value !== "string" || !endpointAllowed(new URL(value), config))
      throw new Error();
  }
  const client: oauth.Client = {
    client_id: config.clientId,
    id_token_signed_response_alg: "RS256",
    [oauth.clockTolerance]: 0,
  };
  return { metadata, client, options };
};

export const exchangeIdentity = async (
  config: AuthConfig,
  callback: URL,
  state: string,
  verifier: string,
  nonce: string,
): Promise<string> => {
  const { metadata, client, options } = await provider(config);
  const params = oauth.validateAuthResponse(metadata, client, callback, state);
  const response = await oauth.authorizationCodeGrantRequest(
    metadata,
    client,
    config.clientSecret
      ? oauth.ClientSecretBasic(config.clientSecret)
      : oauth.None(),
    params,
    config.redirectUri,
    verifier,
    options,
  );
  const result = await oauth.processAuthorizationCodeResponse(
    metadata,
    client,
    response,
    { expectedNonce: nonce, requireIdToken: true },
  );
  await oauth.validateApplicationLevelSignature(metadata, response, options);
  const claims = oauth.getValidatedIdTokenClaims(result)!;
  const now = Math.floor(Date.now() / 1000);
  if (
    !claims.sub ||
    claims.sub.length > 255 ||
    claims.iat > now ||
    now - claims.iat > 300
  )
    throw new Error();
  // No provider token is persisted or returned to the browser.
  return claims.sub;
};
