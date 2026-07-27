# Static authorization review

Status: repository-only review completed on 2026-07-25. This is not proof that hosted RLS is active; the production metadata audit remains unexecuted.

## Scope and result

The review traced authenticated server actions and payment paths to the shared authenticated-user and workspace-context helpers, then checked that payment review, manual recording, voiding, receipt access, proof signing, and workspace assignment retain server-side checks. Existing unit coverage includes workspace authorization, public-token boundaries, payment-view role visibility, payment-history/manual linkage, collection calculations, Stripe replay handling, and the hosted test-safety gate.

## Findings

- The hosted Playwright legacy fixture setup previously imported but did not execute its safety helper. It now executes the helper before reading credentials or calling Supabase admin APIs, and refuses hosted execution entirely.
- Public payment routes use token-scoped RPC projections and do not expose private proof paths in their page data. Signed access remains an authorized workspace action.
- The UI is not treated as an authorization boundary: Payments role tabs are derived from the existing permission matrix, while server actions remain independently guarded.
- No new production database policy or migration was created from this static review.

## Evidence still required

An authorized operator must run `docs/production-supabase-audit.sql` and isolated QA-browser flows to verify live RLS policies, function grants/search paths, storage policy behavior, signed-proof isolation, and direct-action rejection across separate QA workspaces.