# Tavolyn Documentation

This directory contains the canonical project documentation for Tavolyn.

Tavolyn is currently in a design-first phase. During the September 2026 Code Red, implementation is expected to make aggressive use of automation and human-assisted agentic development. For this reason, the primary human effort is intentionally concentrated on functional and architectural design before large-scale implementation begins.

The documents in `docs/functional/` describe what Tavolyn must do independently from the final internal implementation. Technical architecture decisions, ADRs and implementation-specific constraints will be added only when they are sufficiently stable.

## Functional documentation

- [`00-product-vision.md`](./functional/00-product-vision.md) — product vision, positioning, scope and design principles.
- [`01-tenancy-and-white-label.md`](./functional/01-tenancy-and-white-label.md) — tenant model, domains, white-label behavior and tenant context.
- [`02-actors-roles-and-authority.md`](./functional/02-actors-roles-and-authority.md) — tenant actors, platform actors, capabilities and delegated technical authority.
- [`03-session-and-collaboration-model.md`](./functional/03-session-and-collaboration-model.md) — individual sessions, collaborative workstations and atomic operation authorization.
- [`04-customer-and-order-journey.md`](./functional/04-customer-and-order-journey.md) — public customer journey from menu browsing to order tracking.
- [`05-restaurant-and-rider-operations.md`](./functional/05-restaurant-and-rider-operations.md) — restaurant operations, kitchen scheduling, rider handoff and delivery workflow.
- [`06-functional-api-map.md`](./functional/06-functional-api-map.md) — page-by-page functional API surface and domain command model.
- [`07-demo-strategy.md`](./functional/07-demo-strategy.md) — production-like demo behavior, fictional tenants and deterministic data.
- [`08-open-functional-questions.md`](./functional/08-open-functional-questions.md) — unresolved functional choices that must remain explicit until decided.

## Documentation rules

1. Functional requirements are documented before implementation details whenever possible.
2. Domain behavior must not depend on the demo environment. Demo mode is configuration of the same application, not a parallel implementation.
3. Identity, tenancy, authorization, entitlements, feature management and domain validity are separate concerns.
4. Domain operations should be expressed semantically rather than reduced to generic CRUD when the action has business meaning.
5. Decisions that are still provisional must be recorded as such rather than silently becoming architecture.

## Current implementation direction

The current target stack includes Qwik 1.20 for the frontend and NestJS 12 for the backend. Keycloak is the current Identity Provider direction, and Payload is the current CMS direction. These choices will be documented in technical ADRs after the reusable patterns emerging from Mercurion are sufficiently stable.
