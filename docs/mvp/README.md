# Tavolyn — accelerated portfolio demo implementation specification

Status: **implementation target / 2026-11-15**.
Audience: Codex and the human reviewer.
Goal: the smallest convincing, safely explorable **multi-tenant restaurant ordering demo**.

This is NOT a commercial SaaS release. Earlier functional documentation under ../functional/ remains the full product vision; this directory defines the reduced, time-boxed MVP. In case of scope/stack conflict, these MVP specifications take precedence for implementation.

## The demo promise
A visitor opens a fictional restaurant site, browses a menu, configures products, checks out without creating an account, sees a simulated payment clearly labeled as such, receives an order-summary email when transactional email is configured, and tracks an actual persisted order. Authorized restaurant staff sign in through Cognito, see the order, accept it and progress preparation. A second fictional restaurant demonstrates actual tenant separation.

## Fixed MVP stack
| Concern | Choice |
| --- | --- |
| Frontend | existing Qwik 1.20 + Qwik City workspace |
| Server/API | Qwik City routes on **the same Cloudflare Worker** |
| Persistence | Cloudflare D1 (SQLite), shared database |
| Staff identity | AWS Cognito managed login, authorization code + PKCE |
| Application sessions | opaque HttpOnly cookie + D1 state |
| Payments | deterministic local mock, never a real charge |
| Transactional mail | configurable provider adapter (Resend candidate), dev capture |
| State visibility | GET polling with conditional update support |
| Deployment | Workers Free where limits allow; no additional paid runtime |

## MVP definition of done
1. Both seeded demo tenants render their own logos, menus, prices, colors and contact details.
2. Requests resolve tenant from trusted hostname mapping; no cross-tenant reads or mutations.
3. A guest can add products, get server-authoritative totals, place one idempotent order, and track it with an opaque secret link.
4. Demo payment success/failure is explicit, no card data requested or stored.
5. A transactional **order summary** (not a fiscal receipt or Stripe receipt) is generated for all customers, subject to verified provider configuration.
6. A Cognito-authenticated staff member can view/accept/reject/start/finish the tenant's orders, with server-enforced permissions.
7. UI is credible on desktop and phone and explains that restaurants, payments and operations are fictional.
8. Fully reproducible local D1 migration + seed + tests + preview deployment instructions.
9. No paid infrastructure is required to keep the demo online, subject to documented vendor quotas and optional existing domain costs.

## Explicitly deferred (do not implement)
Collaborative workstations, atomic WebAuthn approval, rider QR handoff, advanced role editor, technical superadmin, platform admin console, real Stripe checkout, tax receipt issuance, Payload CMS, custom CNAME onboarding, tenant billing, scheduling optimization, Socket.IO, Durable Objects/WebSockets, operational feature flags/Unleash, marketing notifications, production-grade email deliverability dashboards, complex customer registration.

Some of these are important long-term Tavolyn requirements; they are **not failures of the portfolio demo**.

## Navigation
- [01 — Runtime and security](./01-runtime-and-security.md)
- [02 — D1 model and HTTP contracts](./02-data-and-http-contracts.md)
- [03 — UX and acceptance](./03-ux-and-acceptance.md)
- [04 — Codex work orders](./04-work-orders.md)
- [05 — Delivery, QA and cost gates](./05-delivery-qa-and-costs.md)

## Repo baseline
TAV-MVP-01 preserves `tavolyn-qwik` (Qwik/Qwik City 1.20.0) as the only npm
workspace and removes the unused Nest starter completely. Pages and API route
handlers run in one Cloudflare Worker. See the [local setup](../../README.md)
and [TAV-MVP-01 implementation report](./TAV-MVP-01.md).

TAV-MVP-02 adds the local shared D1 binding, hostname-based tenant resolution,
and distinct restaurant homepages. See the [TAV-MVP-02 runbook](./TAV-MVP-02.md)
for local aliases, migrations, seed and automated browser acceptance.

TAV-MVP-03 adds the incremental catalog schema, two distinct D1 menus, native
`GET /api/public/menu`, `/menu/` and a tenant-local persistent `/cart/`.
See the [catalog and cart runbook](./TAV-MVP-03.md). Quote, checkout and orders
are implemented in TAV-MVP-04; cart totals remain indicative until checkout.

TAV-MVP-04 adds server-authoritative quotes, guest checkout, delivery fees,
cash/mock payment and atomic idempotent D1 orders. See the [checkout runbook](./TAV-MVP-04.md), including the
local private signing-key setup required for secure replay.

TAV-MVP-05 adds bearer-protected tracking pages/API, persistent order events and
an atomic email outbox. Only an explicit local capture adapter exists; no real
email is sent, and historical requests are suppressed. See [tracking and local
email capture](./TAV-MVP-05.md). Staff authentication/operations remain deferred.

## Source references
- Qwik Workers adapter: https://qwik.dev/docs/deployments/cloudflare-workers/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 limits/pricing: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/platform/pricing/
- Cognito PKCE: https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html
- Cognito managed login: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html
- Email provider candidate: https://resend.com/pricing

Service prices, quotas and free entitlements can change. Check them immediately before provisioning; provision only with human permission.
