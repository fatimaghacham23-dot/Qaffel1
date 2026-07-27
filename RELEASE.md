# Qaffel release procedure

Qaffel releases must be reproducible, reviewed, migration-aware, and manually promoted. A successful local build is not authorization to deploy.

## Release prerequisites

- Work from a reviewed release branch, never from an uncommitted working tree.
- Confirm the intended commit is present in the remote repository.
- Confirm `MIGRATIONS.md` matches every SQL file under `supabase/migrations`.
- Obtain the current production Supabase migration history without repairing it.
- Confirm a verified backup and restore point exists before applying migrations.
- Use Stripe test mode for billing verification.
- Configure required environment variables through the hosting environment, not committed files.
- Obtain manual approval from the release owner and migration owner.

## Required production variables

Core:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Stripe workspace billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SOLO`
- `STRIPE_PRICE_BUSINESS`
- `STRIPE_PRICE_TEAM`
- `STRIPE_PRICE_ENTERPRISE`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` when a non-default portal configuration is required

Optional:

- `GITHUB_MODELS_API_KEY`
- `AI_VERIFICATION_ENABLED`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_SUPPORT_WHATSAPP`

Never put a service-role key, Stripe secret, webhook secret, or private API key in a `NEXT_PUBLIC_` variable.

## Build and release check

Run from a clean working tree with the production variables present in the process environment:

```powershell
npm ci
npm run release:check
```

The release check validates:

- clean Git state;
- required variables;
- public-variable secret naming;
- migration filename/version uniqueness and ordering;
- migration documentation parity;
- TypeScript;
- ESLint;
- all Vitest tests;
- production build.

On success it writes `.release/release-manifest.json` with the commit SHA, application version, build time, Node version, and migration list. `.release/` is intentionally ignored because the manifest is build output. Preserve the manifest with deployment artifacts and change records.

## Database rehearsal

Follow `docs/database-release-runbook.md`. The minimum acceptable evidence is:

1. clean local Supabase start;
2. clean database reset applying all migrations;
3. schema and policy verification;
4. application integration tests against that database;
5. recorded local migration history;
6. comparison with production migration history;
7. reviewed deployment order and rollback/restore decision.

Do not run `supabase migration repair` automatically. Do not edit or squash migrations that may already be present in production.

## Deployment sequence

1. Freeze the reviewed commit and release manifest.
2. Put the deployment window and owners in the change record.
3. Verify production backup completion.
4. Compare local and remote migration histories.
5. Stop if histories disagree.
6. Have one migration owner apply the reviewed pending migrations.
7. Verify schema, RLS, functions, indexes, and storage policies.
8. Deploy the application from the exact release commit.
9. Verify runtime environment variables and HTTPS domain.
10. Run the production smoke checklist without exposing secrets or customer data.
11. Run authenticated owner, finance, reviewer, and staff acceptance.
12. Verify Stripe test events before enabling or changing live billing.
13. Monitor errors, webhook failures, database utilization, and support reports.

## Post-deployment verification

- `/`, `/login`, and legal/support pages load.
- Logged-out access to workspace pages redirects safely.
- Invalid pay, client, receipt, and shared-report tokens fail safely.
- Owner can complete the invoice-to-receipt workflow.
- Finance/reviewer permissions behave as documented.
- Staff cannot mutate records by direct action or URL.
- Payment proof upload, signed access, approval/rejection, partial payment, manual payment, void, balance, and receipt invariants hold.
- CSV export is workspace-scoped.
- Stripe webhook signature, dedupe, and failure logging work.
- No new high-severity application, database, storage, or billing alerts appear.

## Rollback

Application rollback:

1. Stop promotion.
2. Redeploy the previous known-good application commit and its environment configuration.
3. Do not reverse database migrations by editing migration history.

Database rollback:

- Prefer forward-fix migrations for compatible defects.
- If data or schema integrity is at risk, stop writes and follow the approved restore procedure.
- Restore only from a verified backup under a named database owner.
- Record the restore point, data-loss window, commands, and validation results.

Stripe rollback:

- Do not delete production customers or subscriptions as an application rollback.
- Revert application behavior, disable the affected plan/entry point if necessary, and reconcile Stripe through approved operator actions.

## Release evidence to retain

- reviewed commit and tag;
- release manifest;
- CI logs;
- clean database rehearsal logs;
- migration history comparison;
- backup identifier and restore verification;
- deployment log;
- smoke and authenticated acceptance results;
- Playwright report/traces;
- Stripe test event IDs and outcomes;
- approval and incident/change record.
