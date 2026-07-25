# Database release and migration runbook

This runbook governs Qaffel Supabase schema releases. It does not authorize a production change.

## Owners and evidence

Assign one release owner, one database migration owner, and one verifier. Record the intended commit, migration list, maintenance window, backup identifier, rollback decision, and all command output in the release record.

## 1. Prepare a disposable local stack

Prerequisites:

- Supabase CLI version recorded in the release evidence;
- Docker Desktop running Linux containers;
- repository working tree clean;
- no production credentials in local files or command history.

From the repository root:

```powershell
supabase --version
docker version
supabase stop --no-backup
supabase start
```

If Docker or Supabase is unavailable, the rehearsal is blocked. Do not replace it with a remote production test.

## 2. Apply the complete migration chain

```powershell
supabase db reset
supabase migration list --local
```

The reset must apply every file in `MIGRATIONS.md` in order. Save complete output. Any syntax, dependency, policy, seed, or function failure blocks release.

## 3. Verify schema and security

Run the repository database checks and inspect:

- all application tables have RLS enabled;
- role policies are workspace-scoped;
- security-definer functions set a safe search path and enforce authorization;
- public token RPCs return only their documented projection;
- `payment-proofs` is private and object policies match canonical paths;
- uniqueness, foreign keys, check constraints, and financial indexes exist;
- anonymous access is limited to intended token-scoped functions.

Use only disposable fixtures containing no customer information.

## 4. Run application integration tests

Configure the application against the local stack, then run:

```powershell
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

Run Playwright and Stripe test-mode suites when present. Retain logs, traces, screenshots, and webhook event identifiers.

## 5. Compare local and remote history

After an authorized operator links the CLI to the intended project using protected credentials:

```powershell
supabase migration list --local
supabase migration list --linked
```

Export both outputs and compare version-by-version. Do not run `supabase migration repair` automatically. Stop if production contains an unknown migration, an expected migration is absent in the middle of the chain, names differ for the same version, or ordering is inconsistent.

## 6. Production execution gate

Before applying a migration, verify:

- reviewed release commit and manifest;
- successful clean-database rehearsal;
- exact history reconciliation;
- current verified backup and tested restore procedure;
- estimated lock/runtime impact;
- named approvers and operators;
- application deployment order;
- monitoring and support coverage.

Only the migration owner may execute the reviewed command during the approved window. Capture the output and immediately verify schema, RLS, storage, functions, and critical financial workflows.

## 7. Failure and recovery

On failure:

1. stop application promotion;
2. stop further migrations and preserve logs;
3. assess whether writes must be paused;
4. prefer a reviewed forward-fix for compatible schema defects;
5. never rewrite applied history;
6. restore only under the approved backup procedure when integrity is at risk;
7. validate row counts, balances, memberships, proof access, receipts, and webhook state after recovery;
8. record the incident, data-loss window, and follow-up controls.

Application rollback does not automatically roll back the database. A prior application build may be redeployed only when it remains schema-compatible.
