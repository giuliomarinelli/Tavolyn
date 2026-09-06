# 07 — Demo strategy

## Principle

The Tavolyn demo is not a simplified application and must not introduce a fake business-domain path.

The demo is a runtime configuration of the same production-grade application.

```text
same code
same domain
same authorization
same persistence rules
same realtime behavior

+

demo tenants
deterministic demo data
mock/sandbox external integrations
specific feature configuration
reset policy
```

Mocking should occur at external boundaries, not by bypassing Tavolyn behavior.

For example, a mock payment provider may simulate payment approval or failure, but the real Tavolyn payment and order workflows still execute.

## Demo tenants

The public case study should contain at least two fictional restaurant tenants.

The primary tenant supports the complete interactive workflow.

A secondary tenant demonstrates that branding, menu, pricing, staff and tenant configuration are genuinely isolated while using the same application.

The tenant names, branding and content are intentionally fictional and should be disclosed as demonstration data.

## Why two tenants matter

A second tenant provides a visual and functional proof of multi-tenancy:

```text
same application
+
different hostname
+
different restaurant identity
+
different data
=
independent tenant experience
```

A reviewer should be able to open two tenant hostnames side-by-side and immediately understand that Tavolyn is not a single-restaurant application.

## Primary demo journey

The principal end-to-end scenario should exercise a real vertical slice:

```text
Customer browses menu
        ↓
Customer configures cart
        ↓
Authoritative checkout quote
        ↓
Mock/sandbox payment
        ↓
Order persisted
        ↓
Restaurant receives order in realtime
        ↓
Authorized operator accepts
        ↓
Kitchen progresses preparation
        ↓
Order becomes ready
        ↓
Rider claims / receives delivery
        ↓
Rider starts delivery
        ↓
Rider completes delivery
        ↓
Customer and restaurant update in realtime
```

The demo should make this workflow discoverable without requiring the reviewer to understand the internal architecture first.

## Demo navigation

A lightweight demo guide or control surface may provide frictionless entry points such as:

- Customer experience;
- Restaurant operations;
- Kitchen view;
- Rider experience.

Demo guidance may prefill credentials or explain how to enter each role, but it must not silently bypass the actual authentication or authorization model when the corresponding mechanism is part of what the case study intends to demonstrate.

## Collaborative-session demo

The collaborative workstation is one of Tavolyn's differentiating features and should be demonstrable.

The demo may expose a predefined operational station with known fictional staff and allow a reviewer to observe the distinction between:

- the user who opened the workstation session;
- the staff member who atomically authorizes a protected action.

The final demo UX for passkey authorization will depend on the technical WebAuthn design and must remain usable for external reviewers.

## Deterministic seed data

Demo data should be reproducible and versioned.

Seed data may create:

- demo tenants;
- branding;
- domains;
- CMS content;
- categories and products;
- variants and modifiers;
- price lists;
- users and memberships;
- roles and capabilities;
- operational station configuration;
- selected historical orders;
- selected notifications/audit history.

Where practical, the same deterministic fixtures should support E2E tests and demo provisioning.

## Reset policy

A public writable demo will inevitably accumulate unusable data unless it can be restored.

The environment should therefore support deterministic reset through an administrative or scheduled process.

The reset strategy must not exist in production tenants unless explicitly enabled for a demo environment.

## Case-study integration

Demo implementation and case-study documentation should reinforce each other.

The case study should explain the same workflow that the reviewer can then execute interactively.

Architecture decisions, screenshots and diagrams should therefore be derived from real Tavolyn behavior rather than a separate presentation-only prototype.
