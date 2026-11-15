# 05 — Verification, deployment, free-tier and demo safety gates

## Local quality gates (each task)
Codex should define real package scripts, then run:
- npm ci (for lockfile or dependency work)
- npm run typecheck / build / lint / test (matching actual scripts)
- Wrangler dev preview with local D1 bindings for server code
- Focused integration tests for changed routes
- No red tests left unexplained, no silently skipped assertions.

Prefer Vitest for business logic and route tests; Playwright E2E for the full customer/staff journey when feasible. Use fake Cognito JWKS/token exchange in isolated tests (not production bypasses), and a deterministic email adapter.

## Mandatory negative tests
- Host unknown -> 404; hostile tenantId in body/query -> ignored/rejected.
- Tenant A membership may not read/order-operate on Tenant B.
- Unknown/sold-out product and forbidden modifiers -> validation error.
- Forged amount -> ignored and recalculated.
- Duplicate order POST (same key and body) -> exactly one order; mismatched replay -> 409.
- Cross-tenant order IDs -> 404.
- Invalid state transition and concurrent accept -> 409 with no duplicated event.
- Tracking token guessed/expired -> safe 404.
- Unauthenticated staff request -> 401, insufficient capability -> 403.
- Tampered session cookie -> 401; revoked session -> 401.
- No access/refresh token in HTML, JSON, browser storage or public logs.
- Mock card failure -> no new successful paid order.
- Email provider failure -> no duplicate processing, visible pending/failed state.

## Deployment checklist — requires human confirmation
1. Validate actual Cloudflare Free plan limitations for CPU, request count, database operations/storage, Workers routes, cron and custom hosts.
2. Build preview on a supported Cloudflare Workers hostname without requiring purchases.
3. Create D1 database and apply migrations explicitly to the intended environment. Verify seed marker before any reset.
4. Configure Cognito user pool/client/managed-login redirect URI(s), sign-in methods, passkey plan entitlements as needed. Do not assume Cognito is automatically cost-free in every configuration.
5. Register environment secrets through supported secret-management commands; never commit secrets.
6. For email, verify sender and anti-abuse protection before enabling live submission emails.
7. Configure custom domain mappings only if user owns them and approves DNS changes.
8. Verify page loading, tenant isolation, order creation, staff login, action, tracking, logout on the actual deployment.
9. Check free-tier consumption and error metrics; if exceeded, return a blocker instead of enabling paid resources.

## Demo public write safeguards
- No real payment-card details and no monetary charges.
- No real businesses or actual customer data in seeds.
- Public order creation guarded by Turnstile/rate limits; cap order quantity and body size.
- Demo order/contact retention is short; expose a clear demo-data notice.
- Seed/reset scripts may delete ONLY explicitly marked demo tenants and ONLY after deliberate human selection of the environment. Do not cron-reset an unmarked production table.
- Do not email arbitrary recipient addresses from a public demo without anti-abuse controls and sender verification.

## Case study deliverables
- One paragraph explaining the original MyPizza capstone and evolution to Tavolyn.
- Architecture diagram: Qwik Worker + D1 + Cognito + email adapter.
- 2 fictional restaurant screenshots (mobile + desktop).
- API/domain command summary and tenancy guarantees.
- A short walkthrough for guest order -> staff acceptance -> tracking.
- What is intentionally omitted and why.
- Automated test report and limitations.
- Reproducible local startup; manual cloud setup checklist.

## Cost position
This specification targets **no recurring paid application infrastructure** for the public portfolio demo. Free-tier plans have finite quotas and may have abuse/overage restrictions; make limits observable rather than asserting unlimited cost-free operation. Optional custom domains, verified emails and AWS plan features may have external constraints.
