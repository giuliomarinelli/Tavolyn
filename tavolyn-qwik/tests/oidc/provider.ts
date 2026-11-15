// Test harness ONLY. Not imported by src/, the Worker or its build configuration.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  generateKeyPairSync,
  randomBytes,
  createHash,
  sign,
} from "node:crypto";
export const fixtureSubjects = [
  "fixture-aurora-owner",
  "fixture-aurora-operator",
  "fixture-nodo-operator",
  "fixture-unassigned",
  "fixture-disabled",
];
export type Fault =
  | "none"
  | "nonce"
  | "signature"
  | "issuer"
  | "audience"
  | "expired"
  | "future"
  | "unknown-key"
  | "algorithm"
  | "token-error"
  | "discovery-error"
  | "denied"
  | "pkce"
  | "timeout";
const opaque = () => randomBytes(32).toString("base64url");
export const startProvider = async (origins: string[]) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "ephemeral-test-key",
    alg: "RS256",
    use: "sig",
  };
  const pending = new Map<string, URLSearchParams>();
  const codes = new Map<
    string,
    { params: URLSearchParams; subject: string; expires: number; fault: Fault }
  >();
  const control = {
    fault: "none" as Fault,
    tokenCalls: 0,
    verifiers: [] as string[],
  };
  let issuer = "";
  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    res.end(JSON.stringify(value));
  };
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, issuer);
    if (url.pathname === "/oidc/.well-known/openid-configuration") {
      if (control.fault === "discovery-error")
        return send(res, 503, { error: "temporarily_unavailable" });
      if (control.fault === "timeout") {
        setTimeout(() => {
          if (!res.destroyed) send(res, 503, {});
        }, 5500).unref();
        return;
      }
      return send(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    }
    if (url.pathname === "/oidc/jwks") return send(res, 200, { keys: [jwk] });
    if (url.pathname === "/oidc/authorize" && req.method === "GET") {
      const p = url.searchParams;
      if (
        p.get("client_id") !== "local-fixture-client" ||
        !origins.some(
          (o) => `${o}/api/auth/callback` === p.get("redirect_uri"),
        ) ||
        p.get("response_type") !== "code" ||
        p.get("scope") !== "openid" ||
        p.get("code_challenge_method") !== "S256" ||
        !p.get("code_challenge") ||
        !p.get("state") ||
        !p.get("nonce")
      )
        return send(res, 400, { error: "invalid_request" });
      const handle = opaque();
      pending.set(handle, new URLSearchParams(p));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
      res.end(
        `<!doctype html><html lang="it"><title>Provider OIDC locale di test</title><h1>Provider OIDC locale di test</h1><p>Solo fixture, nessun account reale.</p><form method="post" action="/oidc/authorize"><input type="hidden" name="request" value="${handle}"><label>Identità fixture <select name="subject">${fixtureSubjects.map((s) => `<option>${s}</option>`).join("")}</select></label><button>Autorizza fixture</button></form></html>`,
      );
      return;
    }
    if (req.method !== "POST") return send(res, 404, {});
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) return send(res, 413, {});
      chunks.push(chunk);
    }
    const body = new URLSearchParams(Buffer.concat(chunks).toString());
    if (url.pathname === "/oidc/authorize") {
      const handle = body.get("request") || "";
      const p = pending.get(handle);
      pending.delete(handle);
      const subject = body.get("subject") || "";
      if (!p || !fixtureSubjects.includes(subject)) return send(res, 400, {});
      const callback = new URL(p.get("redirect_uri")!);
      callback.searchParams.set("state", p.get("state")!);
      if (control.fault === "denied")
        callback.searchParams.set("error", "access_denied");
      else {
        const code = opaque();
        codes.set(code, {
          params: p,
          subject,
          expires: Date.now() + 60000,
          fault: control.fault,
        });
        callback.searchParams.set("code", code);
      }
      res.writeHead(303, {
        Location: callback.href,
        "Cache-Control": "no-store",
      });
      res.end();
      return;
    }
    if (url.pathname === "/oidc/token") {
      control.tokenCalls++;
      const code = body.get("code") || "";
      const item = codes.get(code);
      codes.delete(code);
      const verifier = body.get("code_verifier") || "";
      control.verifiers.push(verifier);
      if (
        !item ||
        item.expires < Date.now() ||
        item.fault === "token-error" ||
        item.fault === "pkce" ||
        body.get("grant_type") !== "authorization_code" ||
        body.get("client_id") !== "local-fixture-client" ||
        body.get("redirect_uri") !== item.params.get("redirect_uri") ||
        createHash("sha256").update(verifier).digest("base64url") !==
          item.params.get("code_challenge")
      )
        return send(res, 400, { error: "invalid_grant" });
      const now = Math.floor(Date.now() / 1000);
      const fault = item.fault;
      const header = {
        alg: fault === "algorithm" ? "PS256" : "RS256",
        kid: fault === "unknown-key" ? "unknown" : "ephemeral-test-key",
        typ: "JWT",
      };
      const claims = {
        iss: fault === "issuer" ? "https://untrusted.invalid" : issuer,
        aud: fault === "audience" ? "wrong-client" : "local-fixture-client",
        sub: item.subject,
        iat: now,
        exp: fault === "expired" ? now - 5 : now + 300,
        nbf: fault === "future" ? now + 300 : now - 1,
        nonce: fault === "nonce" ? opaque() : item.params.get("nonce"),
        "cognito:groups": ["OWNER"],
        role: "OWNER",
      };
      const payload = [header, claims]
        .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
        .join(".");
      const jwt = `${payload}.${sign("RSA-SHA256", Buffer.from(payload), fault === "signature" ? other.privateKey : privateKey).toString("base64url")}`;
      return send(res, 200, {
        access_token: `fixture-access-${opaque()}`,
        refresh_token: `fixture-refresh-${opaque()}`,
        token_type: "Bearer",
        expires_in: 300,
        id_token: jwt,
      });
    }
    send(res, 404, {});
  };
  const server = createServer((req, res) => {
    handler(req, res).catch(() => send(res, 500, {}));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error();
  issuer = `http://127.0.0.1:${address.port}/oidc`;
  return {
    issuer,
    control,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
};
