# 06 — Functional API map

## Purpose

This document maps product surfaces and user actions to a preliminary API shape.

It is intentionally functional rather than implementation-specific. Exact transport details, DTO schemas, module boundaries and persistence choices remain open until the technical architecture is finalized.

## API design principle

Tavolyn distinguishes three broad API interaction types:

### Read projections

Read endpoints may return page-oriented or workflow-oriented projections when that reduces unnecessary client orchestration.

Examples:

```text
GET /api/public/site
GET /api/public/menu
GET /api/dashboard/summary
GET /api/kitchen/queue
```

### Administrative CRUD

CRUD is appropriate for configuration and administratively managed resources.

Examples:

```text
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
```

### Domain commands

Business transitions should be explicit commands rather than generic status patches.

Examples:

```text
POST /api/orders/:id/accept
POST /api/orders/:id/reject
POST /api/orders/:id/start-preparation
POST /api/orders/:id/mark-ready
POST /api/orders/:id/assign-rider
POST /api/deliveries/:id/claim
POST /api/deliveries/:id/start
POST /api/deliveries/:id/complete
```

The API should speak the language of the domain.

## Tenant resolution

The tenant is resolved from trusted hostname context.

Client-supplied tenant identifiers may be used as ordinary resource data where explicitly needed, but must not override the authoritative current tenant context.

## Public website

Representative routes:

```text
/
/menu
/menu/:slug
/checkout
/order/:trackingToken
```

Representative API reads:

```text
GET /api/public/site
GET /api/public/menu
GET /api/public/products/:slug
GET /api/public/fulfillment-options
GET /api/public/time-slots
```

## Cart and checkout

Representative interactions:

```text
POST /api/checkout/quote
POST /api/checkouts
POST /api/checkouts/:id/payment
```

`/checkout/quote` returns an authoritative server-side commercial calculation and current availability result.

## Order tracking

Representative read:

```text
GET /api/public/orders/:trackingToken
```

The tracking identifier should not require exposing the internal persistence identifier.

Realtime events may update the tracking UI after committed state transitions.

## Customer account

Representative routes:

```text
/account
/account/orders
/account/orders/:id
/account/profile
```

Representative APIs:

```text
GET   /api/me
GET   /api/me/orders
GET   /api/me/orders/:id
PATCH /api/me/profile
```

## Restaurant dashboard

Representative route:

```text
/app
```

Representative projection:

```text
GET /api/dashboard/summary
```

The summary may expose operational counts, alerts, current load and recent orders.

## Orders

Representative routes:

```text
/app/orders
/app/orders/:id
```

Representative reads:

```text
GET /api/orders
GET /api/orders/:id
```

Representative commands:

```text
POST /api/orders/:id/accept
POST /api/orders/:id/reject
POST /api/orders/:id/cancel
POST /api/orders/:id/start-preparation
POST /api/orders/:id/mark-ready
POST /api/orders/:id/assign-rider
```

## Kitchen

Representative route:

```text
/app/kitchen
```

Representative read:

```text
GET /api/kitchen/queue
```

Kitchen actions reuse semantic order commands rather than introducing arbitrary direct status updates.

## Delivery management

Restaurant-side route:

```text
/app/deliveries
```

Representative APIs:

```text
GET  /api/deliveries
GET  /api/riders/available
POST /api/orders/:id/assign-rider
```

Rider-side routes:

```text
/rider
/rider/claim
/rider/deliveries/:id
```

Representative Rider APIs:

```text
GET  /api/me/deliveries
GET  /api/me/deliveries/:id
POST /api/deliveries/:id/claim
POST /api/deliveries/:id/start
POST /api/deliveries/:id/complete
```

The authenticated Rider identity is derived from session context rather than trusted from a client-supplied `riderId`.

## Catalog

Representative routes:

```text
/app/catalog
/app/catalog/products
/app/catalog/categories
/app/catalog/modifiers
```

Representative APIs:

```text
GET    /api/products
POST   /api/products
GET    /api/products/:id
PATCH  /api/products/:id
DELETE /api/products/:id

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id

GET    /api/modifier-groups
POST   /api/modifier-groups
```

## Pricing

Representative route:

```text
/app/pricing
```

Representative APIs:

```text
GET   /api/price-lists
POST  /api/price-lists
GET   /api/price-lists/:id
PATCH /api/price-lists/:id
```

Pricing remains conceptually separate from product identity.

## Staff and roles

Representative routes:

```text
/app/staff
/app/staff/:membershipId
/app/settings/roles
```

Representative APIs:

```text
GET    /api/staff
POST   /api/staff/invitations
GET    /api/staff/:membershipId
PATCH  /api/staff/:membershipId
DELETE /api/staff/:membershipId

GET   /api/roles
GET   /api/capabilities
POST  /api/roles
PATCH /api/roles/:id
```

The exact support for custom roles, additional grants and explicit revokes remains to be finalized.

## Collaborative stations

Representative routes:

```text
/app/stations
/app/stations/:id
/app/operations
```

Functional API needs include:

- open/close collaborative station;
- list operators eligible for the current tenant/station;
- create atomic action-authorization challenge;
- confirm acting user;
- consume single-use authorization with the requested domain command.

Exact endpoint shapes are intentionally deferred until the collaborative authorization protocol is designed.

## Audit

Representative route:

```text
/app/audit
```

Representative APIs:

```text
GET /api/audit-events
GET /api/audit-events/:id
```

Common filters may include actor, action, resource, date range and correlation identifier.

Audit is read-only through ordinary tenant UI.

## Notifications

Representative APIs:

```text
GET  /api/notifications
GET  /api/notifications/unread-count
POST /api/notifications/:id/read
POST /api/notifications/read-all
```

Realtime may publish a `notification.created`-style event after persistent creation.

## Tenant settings and domains

Representative routes:

```text
/app/settings
/app/settings/domains
```

Representative APIs:

```text
GET   /api/tenant/settings
PATCH /api/tenant/settings

GET    /api/tenant/domains
POST   /api/tenant/domains
DELETE /api/tenant/domains/:id
```

A custom-domain lifecycle may include states such as:

```text
requested
↓
waiting_dns
↓
verifying
↓
active
```

## Platform control plane

The Tavolyn platform control plane is logically distinct from tenant operations.

Representative capabilities include tenant provisioning, suspension, entitlement management and delegated technical-access grants.

Its API surface will be specified separately after platform roles and operational requirements are finalized.
