# 02 — D1 schema and HTTP contract (MVP)

Status: stable MVP implementation contract. Names/types may be refined if justified by SQLite/Qwik runtime constraints and documented in the task report.

Implemented in TAV-MVP-02: `tenants`, `tenant_domains`, and `GET`/`HEAD /api/public/site`.
The schema adds `tenants.is_demo` and `tenant_domains.local_only` to mark fictional
fixtures and constrain loopback aliases. See [schema and runbook](./TAV-MVP-02.md).
Implemented in TAV-MVP-03: `categories`, `products`, `modifier_groups`, `modifiers`,
`GET /api/public/menu`, `/menu/` and client-side `/cart/`. See the
[catalog model and public DTO](./TAV-MVP-03.md). The menu includes unavailable
items/options with explicit availability. Quote, checkout, orders and all other
entities/routes below remain contracts for subsequent tasks.

## General rules
- One shared D1 database (SQLite); every restaurant-owned row has tenant_id.
- Primary IDs are opaque text UUIDs/ULIDs, never public authorization tokens.
- Foreign keys and unique indexes must preserve tenant isolation; use composite (tenant_id, id) foreign keys where relationships cross tenant-owned tables.
- Amounts are integer minor units (EUR cents), NOT JavaScript floats. Store ISO currency.
- All times UTC ISO-8601 and server-generated, with tenant timezone for display.
- Migrations and deterministic fictional seed must be reproducible locally.
- Queries must be parameterized. Never trust browser-provided amounts or tenant identity.

## Minimal relational entities

| Table | Purpose | Required attributes |
| --- | --- | --- |
| tenants | Restaurant identities | id, slug, name, branding_json, currency, timezone, contact_json, enabled |
| tenant_domains | Exact hostname mapping | hostname unique, tenant_id, primary_flag |
| categories | Menu grouping | tenant_id, id, name, sort_order, active |
| products | Sellable products | tenant_id, id, category_id, slug, name, description, image_url, base_price_cents, available, sort_order |
| modifier_groups | Required/optional selections | tenant_id, id, product_id, title, min_select, max_select |
| modifiers | Price increments | tenant_id, id, group_id, label, delta_price_cents, available |
| orders | Checkout state and immutable commercial record | tenant_id, id, order_number, status, fulfillment_type, payment_method, payment_status, currency, subtotal_cents, delivery_fee_cents, total_cents, contact_snapshot_json, address_snapshot_json, notes, created_at, updated_at |
| order_items | Item price/config snapshots | tenant_id, id, order_id, product_id nullable, name_snapshot, qty, unit_price_cents, modifiers_snapshot_json, line_total_cents |
| order_access | Guest tracking bearer secret hash | tenant_id, order_id, tracking_hash unique, created_at |
| staff_memberships | Local authorization | tenant_id, cognito_sub, role, active |
| app_sessions | Individual logged-in session | session_hash unique, cognito_sub, tenant_id, expires_at, created_at, revoked_at, encrypted_token_blob nullable |
| order_events | Order timeline and auditable staff actions | tenant_id, id, order_id, actor_subject nullable, event_type, from_status nullable, to_status, created_at |
| email_outbox | Durable request to send transactional order summary | tenant_id, id, order_id, type, status, attempts, created_at, sent_at nullable |
| idempotency_records | Duplicate-order command protection | tenant_id, key_hash, operation, request_hash, response_json, created_at |

### Simplifications
- Single base price per product for first release; modifier groups provide simple customizations. Multiple price lists are a documented post-MVP feature.
- Branding and static homepage content live in tenants JSON/config; no CMS editor for MVP.
- Only two pre-seeded staff roles: OWNER and OPERATOR; no staff management UI.
- Menu data for fictional restaurants is intentionally curated (approx. 10–20 items each) rather than huge.
- Delivery fee can be a fixed tenant configuration; no complex delivery zones.
- Orders keep immutable snapshots so later edits do not change old customer history.
- D1 supports relational transactions, but use supported D1 atomic batch/transaction mechanisms carefully; test concurrency for transition/idempotency.

## Order state machine MVP
Keep state simple, with payment status separate from fulfillment status:

~~~text
NEW -> ACCEPTED -> PREPARING -> READY -> COMPLETED
  \-> REJECTED
~~~

- For payment mock, success moves payment_status to PAID_SIMULATED and order can enter NEW. Failure must not produce an accepted order; explicitly return a payment failure or persist failed checkout separately.
- Cash orders use payment_status = UNPAID and payment_method = CASH. Never imply that they are prepaid.
- Pickup and delivery both can complete from READY in the MVP, with display copy appropriate to fulfillment. Rider workflow deferred.
- Valid transitions are server-side, with audit order_events.
- The full product's richer order lifecycle is documented under ../functional/ but must not be forced into MVP state machine.

## Public HTTP contract (same-origin)
All endpoints are illustrative fixed paths for initial implementation; document any justified deviation. JSON request/response use camelCase; errors are structured.

| Method | Route | Purpose |
| --- | --- | --- |
| GET, HEAD | /api/public/site | Resolved tenant branding, hours, contact and demo notice; HEAD returns the same status and representation headers without a body |
| GET | /api/public/menu | Active categories, products/modifiers including unavailable entries, explicit availability and prices (cents) |
| POST | /api/public/quote | Validate cart, compute authoritative amounts, fee and total |
| POST | /api/public/orders | Place guest order with idempotency key, fulfillment and mock/cash payment mode |
| GET | /api/public/orders/:trackingToken | Guest-safe order tracking and timeline |
| GET | /api/auth/login | Start OIDC authorization code+PKCE flow |
| GET | /api/auth/callback | OIDC callback creates host-only session |
| POST | /api/auth/logout | Revoke session and clear cookie |
| GET | /api/staff/me | Staff session + current tenant permissions |
| GET | /api/staff/orders | Tenant-scoped, paged order queue |
| GET | /api/staff/orders/:id | Tenant-scoped operational order detail |
| POST | /api/staff/orders/:id/accept | NEW -> ACCEPTED |
| POST | /api/staff/orders/:id/reject | NEW -> REJECTED |
| POST | /api/staff/orders/:id/start-preparation | ACCEPTED -> PREPARING |
| POST | /api/staff/orders/:id/mark-ready | PREPARING -> READY |
| POST | /api/staff/orders/:id/complete | READY -> COMPLETED |

### Request examples
POST /api/public/quote:
~~~json
{
  "items": [
    {"productId":"prod_margherita","quantity":2,"modifierIds":["mod_bufala"]}
  ],
  "fulfillment":"PICKUP"
}
~~~

Response:
~~~json
{
  "currency":"EUR",
  "items":[{"productId":"prod_margherita","name":"Margherita","quantity":2,"unitPriceCents":1050,"lineTotalCents":2100}],
  "subtotalCents":2100,
  "deliveryFeeCents":0,
  "totalCents":2100
}
~~~

POST /api/public/orders:
~~~json
{
  "idempotencyKey":"c79cbbb6-8c92-48ef-9182-e2a06fd1b42d",
  "cart":{"items":[{"productId":"prod_margherita","quantity":2,"modifierIds":["mod_bufala"]}]},
  "contact":{"name":"Demo Visitor","email":"visitor@example.test","phone":"0000000000"},
  "fulfillment":"PICKUP",
  "paymentMethod":"MOCK_CARD",
  "mockPaymentResult":"SUCCESS",
  "notes":""
}
~~~

Response example:
~~~json
{
  "orderNumber":"A-001",
  "trackingUrl":"/orders/<opaque-secret>",
  "status":"NEW",
  "paymentStatus":"PAID_SIMULATED",
  "totalCents":2100,
  "emailStatus":"QUEUED"
}
~~~

### Critical API behaviors
- Quote ignores client prices, validates selected modifiers belong to products and selection constraints; checks sold-out flags.
- Order create re-quotes on server; client total is never trusted. Different request with reused idempotency key -> conflict, exact retry -> same order result, no duplicated email.
- Use optimistic conditional state update and tenant filter; invalid transitions -> HTTP 409. Missing or other-tenant order -> 404; invalid input -> 400/422; unauthenticated -> 401; insufficient permission -> 403.
- Staff POST routes authenticate via session + tenant membership and reject CSRF. No generic PATCH status endpoint.
- Guest GET returns only status, public order summary, timeline, and fulfillment estimate if present; do not expose staff actors, private customer details, internal ids, payment secrets or raw logs.
- Rate-limit anonymous order submission; Turnstile verification required before public email-enabled writes.
- Tracking secrets are bearer credentials. Use Cache-Control: no-store and Referrer-Policy: no-referrer on tracking views.
- Public error response shape: { "error": { "code": "ORDER_CONFLICT", "message": "Readable message", "requestId": "..." }}.
- Poll staff order list and tracking every 5–10s while page visible; reconnection simply refetches D1 state.

## Email semantic contract
Always generate an **order summary** for guest and authenticated customer (if later supported). It is not a fiscal receipt and does not claim payment settlement for cash.
Example includes restaurant name, order number, item snapshots, amount, fulfillment, payment mode/status, contact-safe details and tracking link.
Persist one outbox record per order/type, retry safely, and have a dev capture/sink adapter. Production sending is disabled until user explicitly configures/approves the provider, verified sender and anti-abuse protections.
