# Pending production SQL inventory

Repository-only assessment on branch `production-hardening` at `a14116c565cac875c0e111e43d49b5e42b4b2831`. No Supabase connection, SQL execution, migration repair, or production change was performed.

## Scope and comparison

All 36 files in `supabase/migrations` were inspected. The current branch has **no migration-file difference after checkpoint `1bf4fbf`**. However, the production-hardening SQL set consists of the four migrations below, introduced before or at that checkpoint:

| Migration | Introducing commit | Relative to `1bf4fbf` |
|---|---|---|
| `20260725090000_public_payment_security_hardening.sql` | `e9a2faa` | already present |
| `20260725093000_stripe_webhook_concurrency.sql` | `617eb6b` | already present |
| `20260725100000_workspace_role_rls_hardening.sql` | `1bf4fbf` | added by checkpoint |
| `20260725101500_financial_payment_atomicity.sql` | `1bf4fbf` | added by checkpoint |

“Pending” below means *potentially absent from the hosted migration ledger*. That cannot be confirmed without the authorised read-only audit. These migrations are not pending merely because the current Git branch is newer than `1bf4fbf`.

## Exact object totals in the hardening set

| Object category | Exact count | Notes |
|---|---:|---|
| CREATE TABLE | 0 | No new application table is introduced. |
| ALTER TABLE statements | 5 | Two add nullable event-ordering columns; three explicitly enable RLS. |
| Tables with added columns | 2 | `workspace_subscriptions`, `workspace_billing_invoices`. |
| Removed columns | 0 | None. |
| CREATE OR REPLACE FUNCTION | 5 | Public payment projection, webhook claim, review, void, manual payment. |
| CREATE POLICY | 18 | 4 proof/storage policies plus 14 role policies. |
| DROP POLICY | 30 | Replaces legacy public/owner policies and legacy workspace-role policies. |
| CREATE INDEX | 4 | Three workspace/payment access indexes; one webhook audit uniqueness index. |
| GRANT / REVOKE statements | 10 | RPC grants are narrowed explicitly. |
| Storage changes | 5 | One bucket privacy update, three storage-policy drops, one storage-policy create. |
| VIEW | 0 | None. |
| TRIGGER | 0 | None. |
| OTHER | 1 | `UPDATE storage.buckets SET public = false` for `payment-proofs`; counted above as storage. |

## NEW TABLES

**0 actual `CREATE TABLE` statements.** Consequently there are no new-table names, purposes, or current-schema-existence assertions to report. All hardening changes operate on tables created by earlier migrations.

## Migration inventory

### `20260725090000_public_payment_security_hardening.sql`

- **Affected tables:** `storage.buckets`, `public.invoices`, `public.profiles`, `public.clients`, `public.payment_methods`, `public.payment_proofs`, `storage.objects`, `public.workspace_members`.
- **Classification:** CREATE OR REPLACE FUNCTION (1); DROP POLICY (13); CREATE POLICY (4); CREATE INDEX (3); GRANT / REVOKE (2); STORAGE BUCKET OR STORAGE POLICY (5).
- **New table / columns:** no new table; no column addition or removal.
- **Functions/RPCs:** creates or replaces `public.get_public_payment_page(text)`, a `SECURITY DEFINER`, fixed-search-path token-scoped JSON projection. It revokes `PUBLIC` execution and grants only `anon` and `authenticated`.
- **RLS/storage:** removes broad anonymous table reads/uploads and legacy proof policies; creates authenticated workspace-member proof read/review/manual-insert policies. Changes `payment-proofs` bucket to private and replaces storage read policy with workspace/invoice-folder authorization. There is deliberately no anonymous storage-object policy.
- **Indexes/constraints:** `workspace_members_user_status_workspace_idx`, `invoices_workspace_id_id_idx`, `payment_proofs_invoice_status_uploaded_idx`.
- **Code dependency:** `/pay/[token]` calls `get_public_payment_page`; proof review UI and signed private proof access depend on the new proof/storage model.
- **If missing:** the current public payment page can receive RPC function-not-found or null projection errors; private-proof access may be inconsistent; upload flow can fail if deployed server code expects the private bucket/server upload model. Applying only newer atomic functions does not restore this projection.
- **Additive/destructive:** schema-additive for function/indexes, but **access-breaking by design** because it removes broad public policies and makes a bucket private. No row deletion.
- **Production risk:** high security/access risk. A code/DB version mismatch can produce public-page or proof-upload failures.
- **Rollback:** deploy compatible prior application code first; then use a reviewed forward migration that restores only the documented prior policies/bucket visibility if required. Do not re-run old migrations or hand-edit policies.
- **Independently safe?:** no. Requires prior workspace schema (`workspace_id`, `workspace_members`) from `20260515200000_workspaces_team.sql`, existing proof storage from `20260510221400_private_storage.sql`, and server-side upload code.

### `20260725093000_stripe_webhook_concurrency.sql`

- **Affected tables:** `public.workspace_subscriptions`, `public.workspace_billing_invoices`, `public.workspace_billing_audit_events`, `public.stripe_webhook_events`.
- **Classification:** ALTER TABLE (2); CREATE INDEX (1); CREATE OR REPLACE FUNCTION (1); GRANT / REVOKE (2).
- **New table / columns:** no new table. Adds nullable `stripe_last_event_created_at timestamptz` to subscriptions and billing invoices; removes no column.
- **Functions/RPCs:** creates or replaces `public.claim_stripe_webhook_event(text, text, text)`, security-definer with a fixed search path, executable by `service_role` only.
- **RLS/storage:** no policy or storage change.
- **Indexes/constraints:** partial unique `workspace_billing_audit_stripe_event_uidx` over `(event_type, next_state->>'stripe_event_id')` when an event ID exists.
- **Code dependency:** `src/lib/stripe-webhook.ts` invokes `claim_stripe_webhook_event` before processing webhook work.
- **If missing:** Stripe webhook handling returns function-not-found; replay/idempotency and stale-processing recovery are absent. The unique index can reject pre-existing duplicate audit data when applied.
- **Additive/destructive:** additive columns/index/function; it changes webhook processing semantics but does not delete rows.
- **Production risk:** medium-high. Requires Stripe code and DB migration to ship together; index build and duplicate detection must be rehearsed.
- **Rollback:** application rollback can stop calling the RPC; use a reviewed forward migration to remove the grant/function/index only after proving no event processor needs it. Preserve webhook history.
- **Independently safe?:** only after `20260518120000_workspace_billing_foundation.sql` and `20260518133000_stripe_billing_sync.sql`. Safe from customer-payment flows, but not independently safe from the Stripe webhook deployment.

### `20260725100000_workspace_role_rls_hardening.sql`

- **Affected tables:** `public.clients`, `public.invoices`, `public.payment_methods`, `public.payment_proofs`.
- **Classification:** ALTER TABLE (3, each `ENABLE ROW LEVEL SECURITY`); DROP POLICY (17); CREATE POLICY (14).
- **New table / columns:** no new table; no column addition/removal.
- **Functions/RPCs:** no new RPC. Policies depend on pre-existing `public.is_workspace_member(uuid)` and `public.get_workspace_role(uuid)`.
- **RLS/storage:** replaces client/invoice/payment-method policies with role-specific read/create/update/delete policies. Replaces payment-proof update policies so reviewer-capable roles can transition only pending proofs and finance-capable roles can void only accepted proofs.
- **Indexes/constraints:** none.
- **Code dependency:** all authenticated Clients, Invoices, Payment Methods, Payments, and direct server actions rely on these workspace-scoped reads/writes.
- **If missing:** current application code may fail authorization or retain legacy `user_id` behavior; role-specific payment actions can be denied or broader than intended. It does not itself explain a missing RPC error.
- **Additive/destructive:** no data deletion, but **permission-replacing** and potentially disruptive. It explicitly removes the legacy ownership fallback and requires workspace backfill.
- **Production risk:** high. Incomplete `workspace_id` data or missing active membership can lock users out and can plausibly surface as failed page queries/actions.
- **Rollback:** deploy compatible code; apply a reviewed forward migration restoring prior named policies only after assessing access impact. Do not disable RLS globally.
- **Independently safe?:** no. Depends on `20260515200000_workspaces_team.sql`, all prior workspace-id/backfill work, and the preceding public-proof policy migration.

### `20260725101500_financial_payment_atomicity.sql`

- **Affected tables:** `public.invoices`, `public.payment_proofs`, `public.workspace_members`, `public.profiles`, `public.invoice_events`.
- **Classification:** CREATE OR REPLACE FUNCTION (3); GRANT / REVOKE (6); OTHER (transactional row locks, inserts, and updates inside the three functions).
- **New table / columns:** no new table; no column addition/removal.
- **Functions/RPCs:** creates or replaces `review_payment_proof_atomic(uuid, uuid, text, text)`, `void_payment_proof_atomic(uuid, text)`, and `record_manual_payment_atomic(uuid, numeric, numeric, date, text, text, boolean)`. All require authentication, check active workspace membership/role, lock relevant rows, update balances/statuses, and issue receipt tokens where applicable.
- **RLS/storage:** no direct policy or storage change; functions use `SECURITY DEFINER` because permitted roles reconcile invoices without broad invoice updates.
- **Indexes/constraints:** none added.
- **Code dependency:** `src/app/actions.ts` calls all three RPCs for proof review, manual payment, and voiding.
- **If missing:** any current payment action invoking those RPCs fails with function-not-found. Manual payment, approval/rejection, and void flows cannot complete; receipts created through those paths are unavailable.
- **Additive/destructive:** additive function deployment with financial behavior changes; no direct table destruction. Functions insert canonical payment/event rows and update existing invoice/proof rows when invoked.
- **Production risk:** high financial-integrity risk. Must be tested against actual constraints, grants, status values, and concurrent reviewers before use.
- **Rollback:** deploy compatible action code first; replace functions in a reviewed forward migration with the prior implementation only if it preserves financial history. Never delete accepted/voided payment rows as rollback.
- **Independently safe?:** no. Depends on payment amounts/void/receipt/event/workspace migrations: `20260510223000`, `20260511000300`, `20260511000400`, `20260512000200`, `20260515200000`, plus role RLS hardening immediately before it.

## Could the reported live failures be missing-schema failures?

| Symptom | Repository evidence | Can one of the four hardening migrations cause it if missing? | Highest-value read-only check |
|---|---|---|---|
| `/inbox` returns HTTP 500 | Inbox queries `payment_proofs`, `invoices`, `invoice_events`, `workspace_approvals`, `clients`, and `operational_presence_sessions`. The last two workspace/operational tables originate in `20260515200000` and `20260515234500`, before the four hardening files. | **Not directly likely.** None of the four creates those inbox tables. Missing role/RLS migration can cause authorization/query failures, but a missing pre-hardening workspace/operational migration is a more direct candidate. | Check migration ledger and table/RLS presence for `workspace_approvals`, `operational_presence_sessions`, `invoice_events`, and their columns. |
| Payment action reports function-not-found | Current actions call the three atomic payment RPCs. | **Yes.** Missing `20260725101500_financial_payment_atomicity.sql` directly explains this. | Check `pg_proc` signatures and `routine_privileges`. |
| Payment-proof upload fails | Current public page uses `get_public_payment_page`; hardening makes proof storage private and removes direct anonymous table/storage writes. | **Possibly.** Missing `20260725090000` can create code/schema mismatch; however malformed request, server upload credentials, or old storage policy are also plausible. | Check RPC presence, `payment-proofs.public`, storage policies, and server error logs. |
| Receipt fails | Receipt page uses older `get_public_receipt_data` and `record_receipt_view`; atomic functions issue receipt tokens for new accepted/manual paths. | **Possibly for newly reviewed/manual payments.** Missing atomic functions prevents receipt-token issuance through current actions, but an existing receipt page failure more directly implicates `20260512000200` or later receipt-function replacements. | Check receipt RPCs and `payment_proofs.receipt_token`/unique index. |
| Role or RLS failure | The role matrix is encoded by the 20260725100000 policies and assumes active workspace membership. | **Yes.** Its absence means the intended policies are missing; its incomplete prerequisites/backfill can also deny legitimate access after application. | Check `pg_policies`, active memberships, workspace IDs, and helper-function definitions. |

## Production application order

Do not create a combined SQL script. If the live ledger lacks any of these files, reconcile the exact ledger first. The safe order is their existing timestamp order: `20260725090000`, `20260725093000`, `20260725100000`, `20260725101500`. They require a disposable rehearsal, backup/rollback approval, and a read-only catalog comparison before any production decision.