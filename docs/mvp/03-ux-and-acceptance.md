# 03 — Page-by-page UX, demo scenarios and acceptance

## Design principle
Two restaurants should look like two distinct brands using the same codebase, not two tabs of an admin template. Responsive, accessible, clear typography, coherent spacing, real food visuals where licensed/original, unmistakable demo badges for simulated features. Do not impersonate existing businesses.

## Fictional seeded tenants
- **Trattoria Aurora** — warm, traditional Italian restaurant/pizzeria; 12–18 products; Italian copy.
- **Nodo Pizza Lab** — contemporary darker visual concept; 10–14 products; different pricing, categories, header and imagery.
These names are provisional demo fixtures; never assert trademark clearance. Do not need paid custom domains. Provide documented local/preview selection; public deployed hostnames require explicit DNS mapping.

## Page table
| Route | User | What they see / do | Backend dependencies |
| --- | --- | --- | --- |
| / | visitor | branded hero, restaurant intro, hours, CTA, featured products, Powered by Tavolyn discreet | public site |
| /menu | visitor | categories, prices, products, availability and modifiers | menu |
| /cart | visitor | change quantities, delete items, estimated total, checkout CTA | local cart + quote |
| /checkout | visitor | guest name/email/phone, pickup/delivery, delivery address if needed, cash/mock payment with demo disclosure, confirm | quote + order submit |
| /orders/:trackingToken | guest | number, items, total, status timeline, last update; polling | guest tracking |
| /app | logged staff | restaurant-specific order queue and status buckets | me + staff orders |
| /app/orders/:id | logged staff | order detail, allowed semantic actions, timeline, visible success/error | detail + commands |
| /login | staff | sign in button linking to Cognito managed login | auth |
| /demo | visitor | guide: choose restaurant, order, open staff dashboard with manually provisioned demo credentials, explain reset | public demo config |

Do not ship fake buttons or broken navigation. It is better to omit a section than to render an inert control.

Implemented through TAV-MVP-04: restaurant homepages, `/menu/`, `/cart/` and
`/checkout/`. The cart links to server quotes and a guest checkout with actual D1
orders. TAV-MVP-05 adds a private tracking link, persistent timeline and visible-only
polling every eight seconds. Confirmation cache has no bearer; refresh the tracking
URL directly. Email capture is local only; live sending and staff operations are
deferred. See [tracking acceptance evidence](./TAV-MVP-05.md).
TAV-MVP-06 implements tenant-branded `/login/`, configured-provider redirect,
authorized/denied/expired/error states and logout. Unconfigured normal preview
has no fixture login button; the OIDC provider exists only in the test harness.
See [staff auth acceptance](./TAV-MVP-06.md). Staff order dashboards remain deferred.

## Core end-to-end scenario
1. Open Aurora homepage; see Aurora branding.
2. Open menu, select Margherita, choose permitted modifier, add two to cart.
3. Quote is computed on server. Adjust fulfillment to PICKUP, see recomputed total.
4. Guest provides minimal contact data and chooses MOCK_CARD; clear disclosure says no real payment and no card data.
5. Submit once. App persists order, its immutable items and tracking secret. Refresh confirmation and tracking: state remains.
6. Guest receives an order summary in dev mail sink, or via approved provider if configured. The page clearly indicates whether sending is disabled/queued/sent.
7. Staff logs in via Cognito and enters Aurora order queue. New order appears within polling interval.
8. Staff accepts, begins preparation, marks ready, completes. Customer tracking refreshes each transition.
9. Submit the same order request/idempotency key twice: exactly one order and one summary email job.
10. Open Nodo tenant. No Aurora data, orders, users, pricing or assets leak into Nodo.
11. Reload/toggle mobile viewport, check accessibility, keyboard tab order, loading/empty/error states.

## Guest checkout details
- Guest account creation NEVER required.
- Email is required for order summary. Display its purpose; no marketing opt-in bundled into checkout.
- Registered customer dashboard / preference centre is out of scope.
- For delivery require address and phone; for pickup require practical contact data only.
- On an expired/invalid tracking link display a safe error; never fall back to searching by sequential order number.
- Do not label the email as a fiscal receipt. For cash, payment remains unpaid until settlement outside MVP. For card, mock receipt is clearly simulated.

## Staff UI
- Use individual Cognito sessions only, no collaborative workstation for MVP.
- Show restaurant and active user.
- Order cards feature ID, time, total, fulfillment, current status and action.
- Confirm/reject controls disabled appropriately for invalid status; server remains authority.
- Prevent double-click race through pending UI state and server concurrency guards.
- Error state should allow retry without accidental duplicate operations.

## Accessibility / quality
- Italian demo copy by default.
- Mobile-first navigation, semantic HTML, image alt texts, labelled inputs, focus management, keyboard-accessible dialogs and controls.
- No layout shifts breaking ordering flow; readable contrast.
- Show loading, missing tenant, empty menu, sold-out items, offline/update delay and API errors.
- No artificial splash/login gate before public menu.
- Demonstrate the case study with a clear README or /demo experience and documented test accounts (do NOT put passwords in repo).
