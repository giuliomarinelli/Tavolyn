# 04 — Codex work orders: serial synchronous execution

Execute assigned work orders in order. Dependencies are hard gates. Use one executing agent and one active task at a time, in serial synchronous mode. No subagents, parallel delegation or early start of subsequent tasks. Each task changes only its intended domain and must provide pertinent verification and documentation. Reuse valid evidence for unchanged code; do not repeat costly tests without a reason.

## Git delivery gate
After checks and documentation, create a descriptive commit on `develop` with GPG signing disabled for that command, then run `git push origin develop`, unless a blocker or an explicit contrary instruction prevents delivery. Protect unrelated/unpublished local changes. Verify that the pushed commit is reachable from `origin/develop` and that the SHA returned by the remote matches the local HEAD; include both in the report.

Git push is part of delivery and is separate from Cloudflare deployment. Force-push, history rewriting, public deployments, cloud provisioning and billing changes require specific authorization. Do not bypass synchronization blockers, create incidental branches/merges or start the next task automatically. See [AGENTS.md](../../AGENTS.md) for the exact Git checks and commands.

## TAV-MVP-01 — Clean bootstrap + validate Workers runtime
**Depends on:** none.
**Scope:** inspect current npm workspaces. Preserve Qwik 1.20; remove unused Nest starter `tavolyn-node` ONLY after documenting its status and updating npm workspace/package-lock correctly. Configure official Qwik Workers adapter, Wrangler, TypeScript, lint/test scripts, local preview. No live deployment.
**Deliverables:** one-worker build, local dev/preview commands, CI-check command, minimal health/API test, free-tier SSR CPU feasibility note.
**Accept:** clean install + typecheck + lint + tests + build; Worker serves HTML and GET /api/health locally; no Nest dependency or broken npm lock.

## TAV-MVP-02 — Tenant resolution + seed brand shells
**Depends on:** 01.
**Scope:** initial D1 migrations, two fictional tenant seeds and domain mappings, trusted hostname resolver, local preview selector.
**Accept:** Aurora/Nodo display different names/colors/logo; unknown hostname -> 404; tenantId input cannot switch tenants; both work in local development.

## TAV-MVP-03 — Catalog and customer menu
**Depends on:** 02.
**Scope:** categories/products/modifiers D1 schema+seed, site/menu/product views, cart selection and local persistence.
**Accept:** valid modifier constraints, sold-out handling, each tenant's catalog differs; mobile navigation; tests for tenant isolation.

## TAV-MVP-04 — Authoritative quote + guest checkout
**Depends on:** 03.
**Scope:** server quote calculation, guest checkout form, pickup/delivery, fixed fee, cash and simulated card success/failure, immutable order/order_items creation, opaque tracking access, idempotency.
**Accept:** price tampering impossible; duplicates do not produce extra orders; payment failure handled clearly; persisted order after refresh; tenant isolation; guest doesn't register.

## TAV-MVP-05 — Order tracking + summary outbox
**Depends on:** 04.
**Scope:** tracking page with token+timeline, order_events, transactional summary template, durable email_outbox, local/dev sink. External provider only behind opt-in configuration.
**Accept:** invalid token leaks nothing, same order timeline after reload, outbox one entry per order, deterministic email snapshot; email labeled as order summary, not tax receipt.

## TAV-MVP-06 — Cognito staff auth + server sessions
**Depends on:** 02; integrate after 04, serially and only when explicitly assigned.
**Scope:** Cognito managed login OIDC code/PKCE, safe callback, server session D1, cookie, logout, seeded subject-to-tenant membership, minimal OWNER/OPERATOR caps.
**Accept:** forged/replayed callback rejected, cookie host-only HttpOnly Secure on HTTPS, tokens never exposed; staff API 401/403 without authority; logout revokes; documented Cognito manual prerequisites and callback host configuration.
**Important:** requires human-supplied Cognito pool/client/redirect setup; Codex must implement and validate with mocks until authorized.

## TAV-MVP-07 — Staff operations dashboard
**Depends on:** 04, 05, 06.
**Scope:** /app orders, detail, NEW -> ACCEPTED/REJECTED -> PREPARING -> READY -> COMPLETED, responsive status UI, 5–10s polling.
**Accept:** owner/operator of Aurora can see/transition Aurora orders only; no cross-tenant ID access; concurrent accepts cause exactly one winner; tracking reflects operations on refresh/poll; audit events persist.

## TAV-MVP-08 — Email adapter + abuse protections
**Depends on:** 05.
**Scope:** optional approved Resend adapter, verified sender config, Turnstile validation, per-origin/order/email protection, outbox processing/retry, telemetry with no PII logging.
**Accept:** sending disabled without verification/config; no duplicate outgoing mail on retry; tests for provider timeout, rate limit and no credentials leakage. Human approves provider and DNS.
**Option:** if mail verification is unavailable, ship a transparent preview mail sink and document real sending as a blocked optional enhancement; do not mark public email delivery as successful.

## TAV-MVP-09 — Polish, public demo and verification
**Depends on:** 01–08 (or explicit mail adapter exception).
**Scope:** demo guide, fictional brand visual polish, onboarding without exposing credentials, deterministic reset, local and preview test suite, accessibility and responsive QA, case-study README, manual deployment guide.
**Accept:** a visitor can reproduce scenario 03 end-to-end on two tenant contexts; CI green; no secrets in repo; public routes usable without account; cost/billing guardrails documented; human-controlled deploy.

## Workstream policy
- Human reviewer owns architecture and product scope. Codex implements and proves acceptance criteria.
- Every task ends with a concise handoff including actual checks, residual risks and verified local/remote commit SHA.
- Serial synchronous execution is mandatory: one executing agent, one active task, no subagents or parallel delegation.
- Commit and push to `develop` are part of delivery unless blocked or explicitly forbidden. Git push does not authorize a Cloudflare deployment.
- Do not batch adjacent work orders or anticipate a subsequent task without explicit instruction.
- No task may invent a payment integration, a second runtime, a new IdP, a CMS or a feature-flag control plane.
