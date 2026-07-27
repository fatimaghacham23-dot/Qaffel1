# Core refactor change log

## Checkpoint 1 — navigation and shell

- Added the shared authenticated information-architecture model.
- Desktop navigation is Home, Invoices, Payments, Clients, Reports, Team, and Settings for owners/admins; limited roles see only authorized categories.
- Mobile navigation uses Home, Invoices, Payments, Clients, and More.
- No legacy route redirects were enabled. Existing `/inbox`, `/recoveries`, `/proofs`, `/connectivity`, `/finance`, `/export`, and deep-analysis routes remain available.

## Checkpoint 2 — Home and collection rules

- Replaced the default dashboard with a focused Home page: outstanding, overdue, awaiting review, and collected-this-month metrics.
- Added shared status/balance semantics in `src/lib/collection.ts`; totals remain separated by currency.
- The action queue is bounded and only links to authorized payment review or invoice destinations.

## Checkpoints 3–6 — preserved and consolidated workflows

- New workspace Home state guides business setup, payment methods, clients, and the first invoice without a second persistence source.
- The existing validated invoice creator remains intact and is not overwritten by this refactor.
- `/payments` is the new primary entry point and safely reuses the existing secure proof-review workflow.
- Centralized the WhatsApp reminder message/phone generation and explicitly states that opening WhatsApp does not mean delivery.

## Checkpoint 7 — pilot surfaces

- Added isolated static `/demo`, plus factual `/privacy`, `/terms`, `/security`, `/support`, and `/pricing` pages.
- Added `.env.example`; public legal/support pages require operator/legal review before unrestricted release.

## Manual deployment work

No migrations, Supabase configuration, Stripe configuration, deployment, push, or commit were performed. Apply all existing migrations in documented order, configure environment values, create/verify the private `payment-proofs` bucket, configure Supabase Auth URLs, and validate Stripe webhooks in test mode before a controlled pilot.

## Definitive validation after first slice

- `npm run lint`: exit code **0** (recorded in `.artifacts/validation/lint.log`).
- `npm run build`: exit code **0** (recorded in `.artifacts/validation/build.log`).
- The environment guard was adjusted to validate at production runtime while allowing Next's `phase-production-build` static generation.
- Validation artifacts remain untracked.
- Checkpoint 7 is frozen; core Checkpoints 3�6 remain the active scope.
