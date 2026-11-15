# Codex execution contract — Tavolyn

## Mission
Build a lean, publicly navigable **portfolio demo**, NOT a production SaaS or an enterprise reimplementation. Prefer a complete customer-to-restaurant flow over feature breadth.

Read in this order:
1. docs/mvp/README.md
2. docs/mvp/01-runtime-and-security.md
3. docs/mvp/02-data-and-http-contracts.md
4. docs/mvp/03-ux-and-acceptance.md
5. docs/mvp/04-work-orders.md
6. docs/functional/ only for product intent where the MVP docs are silent.

For the demo, docs/mvp/ is authoritative when older documents conflict.

## Locked decisions
- Qwik 1.20 / Qwik City frontend, preserving the existing tavolyn-qwik workspace.
- Cloudflare Workers as the only application runtime. Use Qwik City API/server handlers in the same deployment; avoid a second backend deployment.
- Cloudflare D1 for relational persistence, one shared database with tenant_id boundaries.
- AWS Cognito for STAFF authentication; customers may check out as guests.
- Mock card payment only, with an explicit demo label, and cash on delivery/pickup where applicable.
- Transactional email summary through a configurable adapter; no fiscal receipt generation.
- First release uses small-interval polling instead of WebSocket/Socket.IO; realtime enhancement is post-MVP.
- No NestJS, Spring, MongoDB, Keycloak, Redis, Payload, Unleash, microservices, custom-domain provisioning, or native mobile app in the MVP.
- Do not create a second database/schema per tenant.
- No infrastructure with a recurring paid requirement. Never automatically upgrade Cloudflare/AWS/add paid integrations.

## Working rules
- Execute ONLY the specified TAV-MVP task. Do not opportunistically complete adjacent tasks.
- Inspect actual code and dependency versions before editing; prefer official documentation for integration details.
- Keep the diff small. Use domain-oriented names and TypeScript strict types; arrow functions use parentheses even for one parameter.
- Treat identity, tenant, capabilities and order state as server-authoritative. Never trust a client-sent tenant ID, price, role or status.
- Never expose Cognito access/refresh tokens or secrets to the browser, source control, logs or error messages.
- No mock-only API bypass. Seed fictional restaurants but persist actual orders and state transitions.
- Every task must add/update tests for its behavior, update documentation affected by the change, and run available typecheck/lint/test/build commands.
- In a task report include changed files, tests run/results, unresolved issues, blockers, and any external manual setup.
- Do not deploy to public endpoints, configure billing, provision third-party resources, or send live email until a human expressly authorizes the action.
- Do not silently change architecture to bypass a failing test or a free-tier quota. Stop with a concise blocker report.
- No long exploratory PowerShell scripts or repetitive manual-passphrase loops. Prefer reproducible checked-in commands and documented setup.

## Completion definition
A task is complete only when its documented acceptance criteria pass. A screenshot is not a substitute for a working service; conversely, API success is not a substitute for a usable mobile-responsive UI.

## Agent handoff prompt
"Read AGENTS.md and docs/mvp/*.md. Implement only TAV-MVP-XX, preserve all locked decisions, run required tests, update docs, and provide a concise file-by-file change summary. Do not deploy or provision paid services."