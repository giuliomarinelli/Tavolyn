# 02 — Actors, roles and authority

## Functional principle

Tavolyn separates identity from authority.

The Identity Provider answers primarily:

> Who is this user?

Tavolyn answers:

> What may this user do, in which tenant, under which kind of authority, and in the current domain state?

Roles are capability presets. The domain must authorize against effective capabilities and contextual rules rather than hard-code role names.

## Tenant actors

### Owner

The Owner is the highest business authority inside a tenant.

Typical responsibilities include:

- managing tenant configuration;
- creating and managing staff;
- assigning roles and capabilities;
- managing catalog and pricing;
- managing CMS content;
- configuring domains and operational settings;
- opening or authorizing collaborative workstations;
- viewing tenant audit information;
- performing owner-only actions such as ownership transfer or other irreversible administrative operations.

`OWNER` does not mean "highest authority in the whole Tavolyn platform". It means highest business authority for that tenant.

### Admin

An Admin is a highly privileged tenant operator delegated by the Owner.

The Admin may be functionally close to the Owner but lacks selected owner-only capabilities. Exact capability differences remain configurable and will be finalized later.

A representative distinction is that an Admin may manage daily restaurant operations and open collaborative workstations while being unable to transfer ownership or perform selected staff/tenant governance operations.

### Operator

An Operator performs restaurant operations within a limited capability set, for example:

- reading incoming orders;
- accepting or rejecting orders when allowed;
- progressing preparation state;
- interacting with the operational workspace.

An Operator may also have an individual session for personal settings or limited management tasks.

### Rider

A Rider is an individually authenticated tenant actor focused on delivery operations.

Typical capabilities include:

- viewing assigned or claimable deliveries;
- claiming a delivery when authorized;
- starting delivery;
- completing delivery;
- reading the operational information required for the assigned order.

The rider experience is mobile-oriented.

## Capability model

Representative capabilities include:

```text
order.read
order.accept
order.reject
order.prepare
order.assign-rider

delivery.read
delivery.claim
delivery.start
delivery.complete

catalog.read
catalog.write
pricing.read
pricing.write

cms.write
staff.read
staff.create
staff.update
staff.remove
roles.manage
stations.open
stations.manage
audit.read
domains.manage
```

The exact taxonomy will evolve, but capability semantics must remain explicit and fine-grained enough to support tenant roles without coupling business rules to role names.

## Delegated technical authority

Tavolyn introduces a distinct tenant-scoped authority called `TECHNICAL_SUPERADMIN`.

This actor is not normal restaurant staff. The authority may be granted to:

- Tavolyn technical personnel;
- an authorized contractor;
- an external IT service provider;
- another centrally approved technical operator.

The Technical Superadmin may receive an effective capability set comparable to the Owner for maintenance, diagnostics, migration, testing, incident response or support.

The source of authority is different:

```text
OWNER
source: tenant ownership

TECHNICAL_SUPERADMIN
source: Tavolyn platform delegation
```

A technical actor should therefore be represented conceptually through an explicit tenant access grant rather than by pretending that the technician is ordinary restaurant staff.

Representative conceptual model:

```text
Platform Identity
    ↓
Tenant Access Grant
    ↓
Technical Superadmin Authority
    ↓
Tenant Context
```

Technical access may later support permanent, temporary, incident-only or time-bounded grants.

## Platform authority

Platform roles exist above tenants and operate in the Tavolyn control plane.

Representative platform capabilities include:

```text
tenant.read
tenant.create
tenant.update
tenant.suspend

tenant.access.grant
tenant.access.revoke

entitlement.manage
platform.audit.read
```

Possible role names include `PLATFORM_SUPERADMIN`, `PLATFORM_SUPPORT` and `PLATFORM_OPERATOR`, but role names are provisional until the platform control-plane use cases are fully specified.

A platform actor must not silently bypass all tenant authorization with a global `isSuperAdmin` rule. When acting inside a tenant, the platform actor should enter an explicit, auditable tenant technical-access context.

## Audit expectations

Delegated technical access has elevated accountability.

Audit records for technical operations should retain, where applicable:

- acting user;
- source of authority;
- tenant;
- access type;
- purpose or support context;
- action and affected resource;
- timestamp;
- correlation/request identifier.

Auditing of Technical Superadmin operations must not be disableable by the tenant.
