# 01 — Tenancy and white-label model

## Tenant as the primary business boundary

Each restaurant is a Tavolyn tenant. A tenant is logically independent and owns its own business configuration and data.

Tenant-owned areas include, at minimum:

- branding and public identity;
- public website content;
- menu and catalog;
- variants and modifiers;
- price lists;
- customers and orders;
- staff memberships;
- role assignments and effective capabilities;
- restaurant notifications;
- restaurant audit events;
- operational configuration;
- feature and entitlement context.

Tenant isolation is a structural property of the system, not a convention that individual features may choose to respect.

## Hostname-driven tenant context

Every tenant has a Tavolyn-provided hostname, for example:

```text
aurora.tavolyn.app
```

A tenant may optionally connect a custom hostname using DNS/CNAME, for example:

```text
ordina.trattoriaaurora.it
```

Both hostnames resolve to the same logical tenant.

The authoritative tenant context comes from the request hostname and trusted server-side resolution. A client-provided `tenantId` must never be treated as authoritative for tenant selection.

Conceptually:

```text
Request Host
   ↓
Tenant Resolution
   ↓
Tenant Context
   ↓
Session / Actor Context
   ↓
Authorization + Domain Operation
```

## White-label behavior

The tenant public surface uses the restaurant identity as the primary brand:

- restaurant name;
- restaurant logo;
- tenant-specific colors and imagery;
- tenant-specific content;
- tenant-specific menu and pricing;
- tenant-specific contact and fulfillment information.

Tavolyn branding should remain discreet. When a custom domain is configured, the public customer may interact with the entire restaurant experience without encountering a Tavolyn hostname.

## Public and administrative surfaces

The same tenant may expose multiple logical areas under the same hostname, including:

- public website;
- menu and checkout;
- customer order tracking;
- authenticated customer account;
- restaurant administration;
- restaurant operational workspace;
- rider experience.

The exact routing topology is an implementation decision, but the product should preserve a coherent tenant context across these surfaces.

## Tenant control plane vs platform control plane

Tenant administration and platform administration are different authority domains.

The tenant control plane governs one restaurant and is used by tenant actors such as Owner and Admin.

The platform control plane governs Tavolyn itself and may create, suspend, configure or grant technical access to tenants.

A platform actor does not automatically become the Owner of every tenant. Access into a tenant must be explicit and auditable.
