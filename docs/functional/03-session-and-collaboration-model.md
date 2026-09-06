# 03 — Session and collaboration model

## Two session modes

Tavolyn distinguishes between an individual session and a collaborative operational session.

This distinction exists because a restaurant may use a shared workstation during service without accepting the security and audit problems of a shared user account.

## Individual session

In an individual session, the authenticated session principal and the acting user are the same person.

Examples include:

- Owner administration;
- Admin administration;
- Operator personal access;
- Rider mobile access.

Conceptually:

```text
User
  ↓
Authentication
  ↓
Individual Session
  ↓
Tenant Membership
  ↓
Effective Capabilities
  ↓
Domain Operation
```

For ordinary operations inside an individual session, the user does not need to repeat passkey verification for every action because the session already establishes the acting identity.

A Rider, for example, may authenticate using a passkey and then progress an assigned delivery without performing a new passkey ceremony for each state transition, unless a future explicit step-up policy requires it.

## Collaborative operational session

A collaborative session represents a shared restaurant workstation used by multiple known operators during service.

Only a sufficiently privileged tenant actor, such as the Owner or an Admin with the required capability, may open or authorize such a workstation.

The user who authenticates and opens the station is the **session principal**.

Other approved restaurant members may already appear as available operators in the workspace without individually logging into the workstation.

The workstation session itself is shared. Identity is not.

## Session principal vs acting principal

Collaborative mode introduces two distinct principals:

```text
Session Principal
= user who authenticated and opened the collaborative workstation

Acting Principal
= user who personally authorizes a specific protected operation
```

Example:

```text
Anna (Admin) opens the station

Marco presses "Accept Order #153"

Session Principal = Anna
Acting Principal  = Marco
```

Anna's session does not cause Marco's operation to be attributed to Anna.

## Atomic operation authorization

For protected operations in collaborative mode, the acting operator must personally authorize the individual operation.

The authorization is atomic and single-use. It does not create a temporary login session for that operator.

Representative flow:

```text
Operator selects protected action
        ↓
Tavolyn creates action challenge
        ↓
Shared workstation displays QR / handoff mechanism
        ↓
Operator uses own device
        ↓
Passkey / biometric user verification
        ↓
Tavolyn verifies acting user
        ↓
Current capability + domain checks
        ↓
Single domain operation executes
        ↓
Authorization is consumed
```

If the same user immediately performs another protected action, a new atomic authorization is required.

## Action-bound authorization

The authorization proof should be semantically bound to the operation being confirmed.

Conceptually it identifies at least:

```text
actor
operation
resource
tenant
challenge / nonce
expiration
single-use state
```

For example, authorizing `order.accept` for Order `#153` must not implicitly authorize `order.reject` for Order `#154`.

## Passkey semantics

Passkeys have at least two distinct functional uses in Tavolyn:

1. **Individual authentication** — establish a user session.
2. **Collaborative action authorization** — confirm the acting user for one specific operation.

The implementation should prefer minimizing duplicate credential enrollment where practical, but separate WebAuthn credentials are functionally acceptable when relying-party or Identity Provider boundaries require them.

The collaborative authorization mechanism must remain conceptually independent from the choice of Identity Provider.

## Identity Provider boundary

The Identity Provider is authoritative for identity and authentication.

Tavolyn is authoritative for application authorization, including:

- tenant memberships;
- roles;
- capabilities;
- explicit grants/revokes;
- delegated technical access;
- domain authorization.

Application capabilities do not need to be authoritative claims in the IdP access token. Tavolyn is stateful and should evaluate current authorization state so that grants and revocations can become effective without waiting for access-token renewal.

## Audit

Collaborative actions must preserve both the acting identity and the station context.

Representative audit information:

```text
actor: Marco Bianchi
session principal: Anna Rossi
station: Front Desk #1
tenant: Trattoria Aurora
action: order.accept
resource: Order #153
authorization assurance: passkey-confirmed
timestamp: ...
correlationId: ...
```

The purpose is individual accountability without forcing account switching on a shared restaurant workstation.
