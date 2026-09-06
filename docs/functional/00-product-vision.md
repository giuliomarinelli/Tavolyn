# 00 — Product vision

## Purpose

Tavolyn is a multi-tenant, white-label SaaS platform for independent restaurants, pizzerias and similar food-service businesses that want to manage their digital presence, direct ordering and part of their operational workflow without depending on a consumer marketplace.

Tavolyn is not a restaurant aggregator. The customer-facing identity belongs to the restaurant. Tavolyn provides the infrastructure behind it.

A useful product principle is:

> The customer sees the restaurant. Tavolyn stays behind the scenes.

The SaaS provider may appear only through discreet attribution such as `Powered by Tavolyn` where appropriate.

## Origin and case-study goal

Tavolyn evolves the original MyPizza capstone concept into a production-like case study focused on professional system design rather than preserving historical implementation choices.

The case study should demonstrate:

- real SaaS multi-tenancy;
- tenant isolation;
- white-label public experiences;
- direct ordering;
- structured catalog and pricing;
- explicit order state transitions;
- human-assisted order acceptance and scheduling;
- realtime restaurant operations;
- shared workstations without shared identities;
- granular authorization;
- rider workflow;
- persistent notifications and audit;
- production-like demo behavior.

## Product boundaries

Tavolyn should remain focused enough to be completed and maintained. It is not intended to become, in the first version:

- a national delivery marketplace;
- a fiscal POS or accounting ERP;
- a complete inventory management system;
- a GPS fleet-tracking platform;
- an industrial kitchen optimization suite;
- a generic website builder;
- a generic IAM platform.

The objective is a coherent Restaurant Operating System slice, not commercial completeness.

## Primary surfaces

Tavolyn exposes four main functional surfaces:

1. **Restaurant public experience** — website, menu, cart, checkout, order tracking and customer account.
2. **Restaurant administration** — catalog, pricing, CMS content, staff, roles, settings, domains and audit.
3. **Restaurant operational workspace** — incoming orders, acceptance, scheduling, kitchen state and delivery handoff.
4. **Platform control plane** — tenant provisioning, platform-level authority, technical access delegation and platform administration.

The rider experience is a dedicated mobile-oriented branch of the tenant application.

## Core product principle

The system must model real operations rather than expose database tables as UI.

Where an action has business meaning, the product should express a business operation such as:

- accept order;
- reject order;
- start preparation;
- mark ready;
- claim delivery;
- start delivery;
- complete delivery.

These actions must be subject to current tenant context, actor authority and domain state.
