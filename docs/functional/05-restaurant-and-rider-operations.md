# 05 — Restaurant and rider operations

## Operational principle

Tavolyn is designed around real restaurant workflow rather than generic administration.

The restaurant decides whether to accept an order. Tavolyn assists with scheduling, visibility and coordination.

A typical operational flow is:

```text
Incoming order
    ↓
Restaurant acceptance decision
    ↓
Suggested fulfillment time / scheduling
    ↓
Kitchen preparation
    ↓
Ready
    ↓
Rider handoff or pickup completion
    ↓
Delivery completion
```

## Incoming order queue

Orders awaiting restaurant decision appear in realtime in the operational workspace.

The restaurant may inspect:

- order content;
- fulfillment type;
- requested time;
- customer notes;
- current workload indicators;
- suggested fulfillment time;
- relevant delivery context.

Acceptance remains a human decision in the initial product scope.

Representative domain actions:

```text
AcceptOrder
RejectOrder
CancelOrder
```

## Scheduling and capacity assistance

Tavolyn may suggest a realistic fulfillment time based on factors such as:

- requested time;
- current kitchen workload;
- order size or estimated preparation effort;
- restaurant capacity/configuration;
- fulfillment mode;
- delivery zone;
- current delivery workload.

The first scheduling algorithm should be deterministic, explainable and testable rather than industrially optimized.

The product principle is:

> Tavolyn recommends. The restaurant decides.

The operator may accept the suggested slot or select another allowed time.

## Kitchen workflow

Accepted orders move through explicit preparation states.

Representative actions include:

```text
StartPreparation
MarkReady
```

The kitchen view should prioritize operational clarity rather than administrative density.

It may group orders by current/next preparation window, urgency, requested time or other scheduling projections.

Realtime updates should allow new accepted orders and status changes to appear without manual page refresh.

## Comanda and QR handoff

A kitchen order/comanda may be displayed digitally or printed.

It may contain a QR code or equivalent identifier used during delivery handoff.

The QR identifies the order or handoff challenge. It is not by itself proof of rider identity.

## Rider claim workflow

A Rider uses an individual mobile-oriented session.

When an order becomes ready for delivery, the Rider may claim or receive an assignment through a flow such as:

```text
Authenticated Rider
        +
QR / order identifier
        +
current capability
        +
valid order state
        ↓
ClaimDelivery
```

The system may also offer a manual code-entry fallback when camera scanning is unavailable.

A successful claim transitions the order/delivery into an assigned state and records the acting Rider.

## Rider experience

The Rider surface is deliberately lightweight and mobile-oriented.

It may expose:

- assigned deliveries;
- destination;
- customer contact information relevant to delivery;
- delivery notes;
- current status;
- external navigation link;
- actions to start and complete delivery.

Realtime GPS tracking is explicitly out of scope for the first version.

Representative domain actions include:

```text
ClaimDelivery
StartDelivery
CompleteDelivery
```

## Delivery completion

In an individual Rider session, the authenticated Rider is already the acting principal. Routine delivery transitions do not require a new passkey ceremony for every action unless future step-up policy explicitly requires it.

On completion:

```text
OUT_FOR_DELIVERY
      ↓
CompleteDelivery
      ↓
DELIVERED
```

The resulting committed state change propagates to:

- restaurant operational workspace;
- customer tracking;
- notifications;
- audit where applicable.

## Realtime model

Realtime is transport for committed state changes, not the primary state store.

Representative events include:

```text
order.created
order.accepted
order.rejected
order.scheduled
order.preparation-started
order.ready
delivery.assigned
delivery.started
delivery.completed
```

Clients must be able to reconstruct current state from persistence after reconnection.

## Notifications

Notifications may be delivered through:

- in-app persistence;
- realtime delivery;
- email for selected transactional events.

Persistent notifications remain retrievable when a user was offline. WebSocket delivery is an accelerator, not notification storage.
