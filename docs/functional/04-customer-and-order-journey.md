# 04 — Customer and order journey

## Public customer experience

The restaurant public experience belongs visually and functionally to the tenant.

A customer may reach the restaurant through a Tavolyn-provided hostname such as:

```text
aurora.tavolyn.app
```

or through a restaurant-owned custom hostname such as:

```text
ordina.trattoriaaurora.it
```

The customer-facing header, visual identity and content use the restaurant brand. Tavolyn attribution, when present, remains discreet.

## Public website

The public website may expose:

- homepage;
- restaurant description;
- hero and gallery content;
- opening hours;
- contact information;
- fulfillment information;
- delivery areas;
- promotions;
- essential editorial pages;
- menu entry points.

The CMS is intentionally lightweight and focused on restaurant presence. Structured commerce data such as products, modifiers and price lists remains outside generic CMS content.

## Menu browsing

The customer can browse the menu without authentication.

The menu is structured around concepts such as:

```text
Category
Product
Variant
Modifier Group
Modifier
Availability
Price List
Price List Item
```

A product is conceptually separate from its price so the system can later support different price lists, validity periods, fulfillment channels or promotional contexts.

A product configuration may affect the displayed total through selected variants and modifiers.

The frontend may calculate a provisional total for user experience, but the browser is never authoritative for final pricing.

## Cart

The customer can:

- add products;
- select variants;
- select allowed modifiers;
- change quantities;
- remove items;
- view an estimated total.

The cart may remain client-side until checkout, provided that all economically relevant values are revalidated server-side before an order is created.

## Checkout quote

Before payment or final order creation, Tavolyn calculates an authoritative quote from the selected cart and fulfillment context.

The quote may include:

- item subtotal;
- modifier/variant adjustments;
- delivery fee;
- discounts when supported;
- applicable taxes or fiscal display values where required;
- final total;
- current item availability;
- warnings;
- expiration or validity information.

Any client-side calculation is advisory only.

## Guest and registered checkout

Tavolyn supports both:

- guest checkout;
- authenticated customer checkout.

A customer account is not required to place an order.

A registered customer may retain an order history and profile information. Guest orders may use contact data and a secure tracking mechanism without creating a permanent account.

## Fulfillment

The checkout may support at least:

- pickup;
- restaurant-managed delivery.

The customer provides the information required by the selected fulfillment mode, including contact information, destination where relevant and requested fulfillment time when supported.

## Payment

Payment is abstracted from the domain through a provider-independent workflow.

The case-study environment may use a mock or sandbox provider, but mock payment must exercise the same real Tavolyn workflow as a production provider.

The domain must still exercise:

- payment creation;
- payment state transitions;
- callbacks/webhooks when applicable;
- retry behavior;
- idempotency;
- error handling;
- correlation between order and payment.

A mock integration may simulate the external boundary. It must not bypass Tavolyn order state, persistence, audit or realtime behavior.

## Order lifecycle

The exact lifecycle may evolve during detailed design, but the current functional model includes states comparable to:

```text
DRAFT
↓
AWAITING_PAYMENT
↓
PAID
↓
AWAITING_ACCEPTANCE
↓
ACCEPTED
↓
SCHEDULED
↓
IN_PREPARATION
↓
READY
↓
ASSIGNED_TO_RIDER
↓
OUT_FOR_DELIVERY
↓
DELIVERED
```

Alternative or terminal states include:

```text
PAYMENT_FAILED
REJECTED
CANCELLED
```

State changes happen through explicit domain actions rather than arbitrary status mutation.

## Historical order snapshot

When an order is created, Tavolyn preserves the commercial snapshot required to keep history stable even when the menu changes later.

The snapshot includes, where relevant:

- product name;
- selected variant;
- modifiers;
- quantities;
- unit prices;
- modifier prices;
- totals;
- fulfillment-related charges.

Changing a future price list must not mutate completed or pending historical orders.

## Order confirmation and tracking

After checkout, the customer receives an order-tracking experience that exposes the current state and a human-readable timeline.

Representative progression:

```text
Order received
↓
Accepted by restaurant
↓
Scheduled / In preparation
↓
Ready
↓
Out for delivery
↓
Delivered
```

The customer may receive realtime state updates while connected and persistent notifications where appropriate.

The database remains the source of truth. Realtime delivery accelerates state visibility but does not replace persistence.
