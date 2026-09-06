# 08 — Open functional questions

This document records unresolved functional decisions so they remain explicit rather than silently becoming implementation assumptions.

## Authorization and role customization

Open questions:

- Are tenant roles fully customizable or primarily predefined presets?
- Can a membership receive explicit additional grants and explicit revokes beyond its assigned role?
- Which capabilities are permanently Owner-only?
- Which capabilities may be delegated to Admin?
- Which actions require collaborative atomic authorization versus ordinary station interaction?

Current principle: roles are capability presets; effective authorization depends on current Tavolyn state, tenant context and domain invariants.

## Collaborative workstation

Open questions:

- How are eligible operators associated with a collaborative station?
- Does a station maintain an explicit list of currently present operators, or merely expose all authorized tenant members?
- Which operations are protected enough to require atomic acting-principal confirmation?
- What is the fallback when the operator cannot use the normal passkey handoff flow?
- How should the public demo make this feature understandable without introducing unsafe bypasses?

Current invariant: a collaborative station shares the application session but never shares identity or accountability.

## Passkey usage

Open questions:

- Can individual-login and collaborative-action authorization reuse one credential lifecycle cleanly?
- If relying-party boundaries require two WebAuthn credentials, how should enrollment and recovery UX minimize confusion?
- Which parts of passkey lifecycle belong to the Identity Provider and which belong directly to Tavolyn?

Current functional position: separate credentials are acceptable when required; compromising authorization semantics to avoid duplicate enrollment is not.

## Identity Provider integration

Keycloak is the current preferred Identity Provider direction.

Open questions reserved for technical planning:

- exact login ceremony;
- passkey ownership and storage boundaries;
- IdP session coordination with Tavolyn stateful sessions;
- social/federated login support;
- recovery and MFA policy;
- whether any IdP claims beyond identity/authentication assurance are useful.

Current invariant: application capabilities are authoritative in Tavolyn, not in stale IdP access-token scope claims.

## Customer identity

Open questions:

- Can one global Tavolyn user simultaneously be a customer of several tenants and staff of another tenant?
- How should guest orders later be claimed by a verified registered account, if supported?
- Which customer profile data is global and which is tenant-scoped?

Current direction: user identity is global; tenant membership defines staff authority.

## Order lifecycle

The current state model is intentionally indicative.

Open questions:

- Is `SCHEDULED` always a persisted state or sometimes scheduling metadata on an accepted order?
- How does pickup differ from delivery after `READY`?
- What cancellation states and policies are required at each phase?
- What happens when a paid order is rejected?
- How are refunds represented functionally in the case study?

## Kitchen scheduling

Open questions:

- What capacity model is simple enough for the first version while remaining credible?
- Which factors contribute to preparation effort?
- Are delivery workload and kitchen workload evaluated together or sequentially?
- Can an operator override every scheduling suggestion?
- How should the system explain a suggested slot to the operator?

Current principle: scheduling is deterministic, explainable and advisory; the restaurant remains responsible for acceptance.

## Rider assignment

Open questions:

- Can a Rider self-claim every ready delivery or only deliveries exposed as claimable?
- Can restaurant staff pre-assign a Rider before the order is ready?
- What happens if a Rider claims a delivery and then becomes unavailable?
- Which reassignment operations require elevated capability or audit?

## CMS boundary

Payload is the current CMS direction.

Open questions:

- How much of the CMS editing UI should be embedded or integrated into Tavolyn administration?
- Which public-site fields remain structured Tavolyn configuration rather than CMS content?
- How are publication state and preview represented?

Current invariant: products, prices, orders, users, authorization and tenant business state are not generic CMS content.

## Pricing

Open questions:

- Does the first version need multiple active price lists or only architecture that allows them later?
- Are delivery/pickup-specific prices required in the case study?
- Are promotions part of pricing or deferred?
- Which fiscal/tax presentation rules are necessary for the target demo geography?

Current invariant: product definition and price are conceptually separate, and orders retain a historical price/configuration snapshot.

## Notifications

Open questions:

- Which events create persistent in-app notifications?
- Which events also generate email?
- Are notification preferences required in the first version?
- How should duplicate realtime/email notifications be avoided or grouped?

## Tenant custom domains

Open questions:

- Is the first version limited to subdomain CNAME onboarding?
- Is apex-domain support deferred?
- Which party owns DNS verification UX and certificate/proxy state visibility?
- Which domain-management actions belong to tenant Owner/Admin versus Tavolyn platform staff?

## Platform control plane

Open questions:

- Final platform roles and capability taxonomy;
- tenant provisioning lifecycle;
- tenant suspension semantics;
- entitlement-management UX;
- technical-access grant approval and expiration;
- support-case linkage for privileged tenant access;
- platform audit retention and visibility.

## Demo tenants and content

Open questions:

- final fictional tenant names;
- branding identity for each tenant;
- minimum credible menu size;
- which historical orders and operational states should be pre-seeded;
- reset cadence and public write limits.

## Technical decisions intentionally deferred

The following are deliberately not finalized in this functional document set:

- persistence schema and ORM strategy;
- Redis key/cache design;
- reverse-proxy implementation;
- WebSocket scaling implementation;
- outbox/event persistence design;
- exact Keycloak integration;
- exact WebAuthn service boundaries;
- Payload deployment topology;
- feature-management provider integration;
- reusable code/design patterns to be imported or adapted from Mercurion.

These should be addressed through technical architecture and ADRs after the reusable Mercurion patterns are sufficiently stable.
