# Tavolyn — Project documentation

Tavolyn is a white-label, multi-tenant restaurant ordering and operations platform. The repository currently contains the historical functional vision and the **accelerated Cloudflare Workers portfolio demo specification**.

## Start here: implementation (Codex)
- [Codex instructions](../AGENTS.md)
- **[MVP implementation index](./mvp/README.md)** — **authoritative for the current portfolio implementation**
- [Runtime, tenant resolution, Cognito and security](./mvp/01-runtime-and-security.md)
- [D1 data model and HTTP API contracts](./mvp/02-data-and-http-contracts.md)
- [Screens, user flows, test acceptance](./mvp/03-ux-and-acceptance.md)
- [Ordered Codex work orders](./mvp/04-work-orders.md)
- [Delivery, quality and zero-paid-infrastructure checks](./mvp/05-delivery-qa-and-costs.md)

## Complete functional vision (post-MVP reference)
The following documents describe the full product concept, including capabilities explicitly deferred from the portfolio demo:
- [00 — Product vision](./functional/00-product-vision.md)
- [01 — Tenancy and white-label](./functional/01-tenancy-and-white-label.md)
- [02 — Actors, roles and authority](./functional/02-actors-roles-and-authority.md)
- [03 — Sessions and collaboration](./functional/03-session-and-collaboration-model.md)
- [04 — Customer ordering journey](./functional/04-customer-and-order-journey.md)
- [05 — Restaurant and rider operations](./functional/05-restaurant-and-rider-operations.md)
- [06 — Functional API map](./functional/06-functional-api-map.md)
- [07 — Demo strategy](./functional/07-demo-strategy.md)
- [08 — Open functional questions](./functional/08-open-functional-questions.md)

## Scope and precedence
**MVP: Qwik 1.20/Qwik City, Cloudflare Workers + D1, AWS Cognito for staff, mock payments, simple email adapter, polling.** Keycloak, NestJS, Spring and MongoDB are **not** part of the current MVP implementation target.

The old technical references in functional documents are historical context, not implementation directives. **docs/mvp/** takes precedence when there is a conflict. No enterprise feature should be added merely because it appears in the full vision.

The objective is to deliver a coherent, navigable demonstration with actual domain persistence, tenant isolation and server-verified state transitions. External provisioning, paid services, public deployment and sending live email require the human owner's approval.
