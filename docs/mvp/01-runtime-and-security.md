# 01 — Runtime, tenancy, identity and security contract

## One Worker, not two servers
Local commands, actual adapter configuration and verification limits are recorded
in [TAV-MVP-01](./TAV-MVP-01.md) and the [root README](../../README.md).
The implemented D1/hostname policy and local-only preview configuration are
documented in [TAV-MVP-02](./TAV-MVP-02.md).

Keep the Qwik 1.20 / Qwik City application in tavolyn-qwik. Install/configure the **official Cloudflare Workers adapter** for its current versions. The SAME deploy serves restaurant pages, staff pages and /api/* handlers.

Suggested logical layers (adapt to real Qwik City conventions after inspecting the repository):

~~~text
tavolyn-qwik/
  src/routes/           pages and /api/... server routes
  src/lib/server/       tenant, catalog, orders, session, email services
  src/lib/shared/       DTO types and safe validation schemas
  src/components/       reusable Qwik UI
  migrations/           D1 SQL migrations
  scripts/              deterministic seed (local/remote confirmed)
  wrangler.jsonc        Worker binding and assets configuration
~~~

This is a **single application deploy**. Avoid adding a separate Hono Worker or rewriting Qwik unless an actual adapter incompatibility is demonstrated and documented.

Use D1 binding named DB. No direct SQLite file access in production. Local development must use Wrangler's compatible bindings, not a production database connection.

## Tenant resolution
- Seed two tenant records and host-to-tenant mappings; every request has one resolved tenant.
- On the real public host, resolve by lowercased, normalized, trusted request URL hostname. Allowed hostnames must be exact configured entries in D1; unknown host => 404.
- No authority from the JSON body, query tenantId or request-chosen headers.
- For local development/preview ONLY, provide a clearly documented safe demo selector/preview hostname mapping; it must not enable arbitrary host spoofing or a production authorization bypass.
- Two tenant hostnames (e.g. aurora.tavolyn.app and nodo.tavolyn.app) are conceptual targets, not a claim that those domains are already owned/provisioned.
- Custom CNAME onboarding is NOT MVP; manual DNS mapping for two demo hosts may be done by the user later.
- Every tenant-owned query filters tenant_id; updates require tenant_id AND entity_id. Scope uniqueness and indexes by tenant_id.
- Avoid caching private data in shared public caches.

## Qwik + Workers CPU constraint
Cloudflare Workers Free currently limits CPU to 10 ms per invocation; SSR/auth workloads can exceed it. TAV-MVP-01 must benchmark realistic routes before committing to server-heavy rendering. If SSR breaches the free budget, use static/prerendered public assets or another compatible frontend rendering mode **within Workers**, keeping the same API and tenant isolation. Document any UX/SEO tradeoff; never change to a paid hosting plan automatically.

## Staff authentication with AWS Cognito
- Cognito selected, NOT Keycloak. Managed login with OIDC authorization code + PKCE is the preferred browser ceremony.
- Browser is redirected to Cognito for login. Tavolyn Worker performs server-to-server code exchange and token validation (OIDC issuer, audience/client, signature/JWKS, state, nonce, exp, PKCE).
- Browser receives ONLY a Secure, HttpOnly, SameSite=Lax, host-only cookie, preferably __Host-tavolyn-session with Path=/ and no Domain attribute.
- Session identifier: cryptographically random, optional HMAC-SHA-256 envelope. Persist only its secure hash in D1. Cookie theft, fixation and CSRF must be considered.
- App session is server-side; store no access or refresh token in JS-accessible storage. If retained in D1, encrypt each sensitive token with AES-256-GCM using Web Crypto and a secret configured outside Git; nonces unique, key rotation/versioning documented. If short-lived login sessions are selected to avoid refresh in the MVP, explicitly document expiry and do not retain unused refresh tokens.
- Create session on successful callback; revoke on logout, check expiry on every staff request. Use Origin/CSRF validation for state-changing staff routes in addition to SameSite.
- Staff identities are matched by stable Cognito subject; tenant membership + role live in Tavolyn D1, NOT in JWT custom scopes.
- No self-service customer login needed for MVP. Guest checkout is public.
- A single Cognito user pool for demo staff is sufficient. Configured redirect URIs must match actual approved demo hosts; do not invent a multi-host SSO cookie workaround.
- Passkey login via Cognito is optional for this milestone; its plan/feature availability must be verified before enabled.

## Initial authorization
Two seeded staff roles: OWNER and OPERATOR. Use explicit capabilities e.g. order.read and order.manage. The MVP UI only needs staff order operations. Database membership/role is authoritative; never accept role names, actorId or tenantId from client input.
- OWNER may view/manage orders, OPERATOR may view/manage orders for their own tenant.
- The full capability model, staff creation and platform technical grants remain documented in docs/functional but deferred.
- Do not expose staff customer PII to guest tracking responses.

## Public demo security and privacy
- Strong opaque tracking tokens (at least 128 bits entropy; 256 preferred), store only SHA-256 hash and compare in a tenant-scoped lookup. A human-readable order number is not an access credential.
- HTTPS only in production. Deny unrecognized hosts; protect private APIs even if the UI hides links.
- Validate input and enforce limits on quantities, totals, request sizes, email fields, notes and number of line items.
- Avoid collecting real payment-card data. Cash/mock mode needs no card form.
- Inform visitors data/restaurants are fictional and do not invite sensitive personal data.
- To prevent public email abuse, require an anti-bot mechanism (e.g., verified Turnstile token) before enabling real outgoing emails and apply reasonable ordering rate limits/quotas. Until configured, no public outbound email.
- Do not log sessions, token contents, order tracking URLs, email secrets or full personal details.
- Session data and demo guest orders need a documented cleanup/retention policy.

## Secrets / deploy safety
Expected configurable secrets: COGNITO_ISSUER, COGNITO_CLIENT_ID, relevant OIDC secret only if using a confidential client, SESSION_HMAC_KEY, SESSION_ENCRYPTION_KEY (if retaining IdP tokens), EMAIL_API_KEY, TURNSTILE_SECRET. Public vars: site origin(s), demo mode, email sending state; do not put secrets in client bundles or tracked .env files.

Implemented in TAV-MVP-04: `ORDER_TOKEN_KEY`, a private 256-bit HMAC key for
reconstructing tracking tokens during an idempotent retry. Only token hashes and
non-secret nonces are persisted in D1. See [key lifecycle and local setup](./TAV-MVP-04.md).
Public anti-abuse and retention gates still apply before any authorized deploy.

All cloud provisioning, DNS, billing changes, Cognito pool setup and email domain verification are **manual human-approved tasks**, not autonomous agent actions.
