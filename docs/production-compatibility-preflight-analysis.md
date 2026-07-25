# Production compatibility preflight analysis

**Source:** the 194-row export of `production-compatibility-preflight.sql` executed against the main production project. This report uses only aggregate metadata from that export and the repository migrations. It contains no customer, invoice, token, proof-path, email, or phone data.

## Decision summary

Production data repair is required before the production-hardening branch can be merged or its stricter workspace policies enabled. The branch is **not safe to merge into the production deployment today**.

The immediate gate is ownership integrity:

- `54` invoices have `workspace_id IS NULL`.
- `31` invoice/client pairs have different workspace values under the preflight comparison.
- Clients and payment methods are fully assigned (`0` null `workspace_id` in each).
- No payment proof is orphaned and no proof has an invoice with a null workspace (`0` in both checks).

The export is aggregate-only. It proves that repair is needed, but it cannot prove which individual invoices can safely be changed. Therefore the confirmed safe automatic-backfill count is **0** until a second, aggregate-only diagnosis classifies candidates. All `54` invoices require that classification; `31` are known to have a conflicting client relationship and require special resolution.

## Exact result counts

| Result | Count |
| --- | ---: |
| READY | 76 |
| BLOCKED | 7 |
| REVIEW | 82 |
| MISSING | 24 |
| MISMATCH | 4 |
| NOT_APPLICABLE | 1 |
| **Total** | **194** |

## Ownership integrity and deterministic backfill

### Null invoice ownership

The `54` null invoice workspace values are incompatible with workspace-only RLS and the atomic payment RPCs. The current production fallback policies keep many of these rows usable through `invoices.user_id`, but that fallback cannot remain the final authorization boundary.

The repository's workspace migration originally intended to assign a workspace from each invoice owner's user ID. The current production state shows that the intended historical backfill did not complete for all invoices.

### What the 31 mismatches mean

The preflight mismatch query compares an invoice workspace with the linked client's workspace. Because the linked-client join excludes invoices with no client, `31` is not a count of all null invoices. It can contain either or both of these categories:

1. an invoice with a null workspace and a client with a non-null workspace; or
2. an invoice and client with two different non-null workspaces.

The export does not split those categories. It therefore does not establish that client ownership is the correct repair source for any individual invoice.

### Candidate evidence, in priority order

| Candidate source | When it is deterministic | When it is not safe |
| --- | --- | --- |
| Linked `client.workspace_id` | Invoice is linked to a client, the client has one workspace, and the invoice owner is an active member of that same workspace (or the workspace owner is the invoice owner). | Client workspace conflicts with invoice owner membership, invoice has no client, or the owner belongs to multiple plausible workspaces. |
| Invoice `user_id` | Exactly one active owner workspace can be identified for that user, or exactly one workspace is owned by that user. | The user owns or actively belongs to multiple workspaces and no client/proof evidence selects one. |
| Workspace membership | It corroborates a single candidate selected by owner or client evidence. | Membership alone produces more than one active workspace. |
| Related proofs and payment records | It corroborates the invoice candidate through the invoice relationship. The export confirms proof parent integrity. | Proofs have no direct workspace ownership and must not independently determine the invoice workspace. |

No direct proof-to-workspace comparison is applicable: repository schema ownership for `payment_proofs` is through `payment_proofs.invoice_id`, not a direct `workspace_id` or `user_id` column.

### Backfill conclusion

- **Confirmed safely backfillable now:** `0` records. The supplied export has no candidate-resolution counts.
- **Requires diagnosis before any write:** all `54` null-workspace invoices.
- **Known conflicting relationship category:** `31` invoice/client mismatches; these cannot be blindly assigned from the client.
- **Confirmed manual-review count:** not determinable from the aggregate export. It is between `0` and `54`; it must be measured after deterministic rules are evaluated.

## Current application authorization model

Production currently still relies on `user_id` as a compatibility authorization path:

- `clients workspace access`, `invoices workspace access`, and `payment_methods workspace access` allow workspace membership **or** `auth.uid() = user_id`.
- Legacy proof read/review policies authorize via the invoice owner's `user_id`.
- Public active-payment-method and proof-storage policies also refer to owner-based invoice relationships.

This explains why the application can continue operating with incomplete workspace assignment. It also means strict workspace-only policies would deny access to records with null or incorrect workspace values.

## RLS and rollout risk

Do not replace the compatibility policies before data repair. A strict role-RLS rollout would risk locking users out of:

- invoices with null or mismatched workspace ownership;
- client and payment-method actions if their backward-compatible `user_id` path is removed before verification;
- payment-proof review and finance actions, which derive access through the parent invoice;
- private proof-file reads when the authorized workspace policy replaces the existing owner-based policy.

The export confirms RLS is enabled on clients, invoices, payment methods, payment proofs, invoice events, and workspace members. The three billing tables expected by the hardening work are absent, so their RLS cannot be enabled or verified.

**A dedicated data-backfill phase must precede policy replacement.**

## Missing and incompatible hardening objects

The current preflight establishes current schema state. The earlier saved presence-check export supplies the exact hardening-object names below; its findings remain consistent with this run's missing RPCs, tables, and indexes.

### Missing tables and columns

- `public.workspace_subscriptions` — absent; expected `workspace_id` and `stripe_last_event_created_at` are absent.
- `public.workspace_billing_invoices` — absent; expected `workspace_id` and `stripe_last_event_created_at` are absent.
- `public.workspace_billing_audit_events` — absent; expected `workspace_id`, `event_type`, and `next_state` are absent.
- `public.stripe_webhook_events` — absent, including `stripe_event_id`, `received_at`, and `status` required by webhook-claim handling.
- `public.payment_proofs.user_id` — absent. This is significant because the current `record_manual_payment_atomic` migration inserts that field, while the repository's base proof model uses invoice-derived ownership. A compatibility migration must resolve this schema/function mismatch deliberately.

The following existing columns are nullable where the hardening target expects non-null: `clients.workspace_id`, `invoices.workspace_id`, `payment_methods.workspace_id`, and `invoice_events.workspace_id`. The first three have no current null rows except invoices; nevertheless, constraints must wait until diagnosis and verification are complete.

### Missing RPCs and execution grants

All five proposed RPCs are absent:

- `get_public_payment_page(p_token text)`; its `anon` and `authenticated` execution grants are also absent.
- `claim_stripe_webhook_event(p_event_id text, p_event_type text, p_object_id text)`; its `service_role` grant is absent.
- `review_payment_proof_atomic(...)`; its `authenticated` grant is absent.
- `void_payment_proof_atomic(...)`; its `authenticated` grant is absent.
- `record_manual_payment_atomic(...)`; its `authenticated` grant is absent.

The table and column dependencies for public payment, proof review, and voiding are otherwise largely present. The status constraint already includes `pending`, `accepted`, `rejected`, and `voided`, but its exact deployment compatibility still needs review.

### Missing indexes

- `invoices_workspace_id_id_idx`
- `payment_proofs_invoice_status_uploaded_idx`
- `workspace_members_user_status_workspace_idx`
- `workspace_billing_audit_stripe_event_uidx` — blocked because its parent billing-audit table is absent.

### Missing policies and storage controls

The earlier presence check reports these expected policies as absent:

- `payment_proofs.workspace finance can insert payment proofs`
- `storage.objects.workspace members can read payment proof files`
- four client role policies (view, create, update, delete)
- four invoice role policies (view, create, update, delete)
- four payment-method role policies (view, create, update, delete)
- `payment_proofs.workspace finance can void payment proofs`

The private `payment-proofs` bucket itself is present and `public=false`; it has 15 objects, with aggregate path depth 2. The present storage policies are legacy owner/public-upload policies, not the intended workspace-authorized proof-read control. Table-level grants for `anon` and `authenticated` are broad and require a separate privilege review; RLS policies remain the immediate enforcement layer.

### Legacy policies and functions that must survive staged rollout

The following public functions are present and must remain available until a compatible replacement has been deployed and smoke-tested: public payment history, public receipt data/view tracking, client-portal header/invoices/payments/activity, and shared reports.

Likewise, do not drop the legacy public invoice-read, public proof-upload, or owner proof-read policies until the public payment RPC and private-storage flow have been deployed and verified together. The presence check also shows legacy workspace-access policies are still active for clients, invoices, and payment methods; they must not be removed before data repair.

## Stripe, storage, and financial readiness

### Stripe

Stripe hardening is not ready. The expected billing audit table is absent under its exact name, and `stripe_webhook_events` is also absent. The export cannot determine whether an equivalent differently named legacy table exists; it only proves the required names are unavailable. Duplicate-event and index preconditions are therefore blocked, not passed.

### Storage

The bucket configuration is compatible with private proof storage, but the authorization policy is not yet aligned with the workspace model. Existing public upload behavior must be preserved through a server-authorized replacement before legacy policy removal.

### Atomic payment RPCs

Atomic review, void, and manual-payment RPCs are not deployed. They cannot be enabled safely yet because they depend on repaired invoice workspace ownership, workspace-role checks, and—specifically for manual payments—a resolved `payment_proofs.user_id` compatibility decision. The original hardening migration should not be applied verbatim to this partial database.

## Feasibility and required staged order

A compatibility migration is feasible **after** data repair and schema confirmation. It should be an idempotent, staged compatibility migration, not a blind replay of the original four migrations.

1. **Data diagnosis:** run an aggregate-only candidate-classification query for the 54 invoices; discover any differently named Stripe/billing tables through catalog metadata.
2. **Deterministic backfill:** update only invoices with one corroborated workspace candidate; record aggregate before/after counts and leave ambiguous records untouched.
3. **Verification:** prove zero null invoice workspaces, zero unresolved invoice/client mismatches, valid owner memberships, and preserved public/payment workflows.
4. **Indexes:** add validated workspace and proof indexes after data shape is stable; use an operationally appropriate online/index-maintenance method.
5. **Public payment and storage security:** deploy the public-payment RPC, grants, and workspace-bound private proof-read policy while retaining validated public upload behavior.
6. **Stripe compatibility:** create or reconcile the billing/webhook tables, run duplicate-event preflight, then add idempotency indexing and the service-role claim RPC.
7. **Role RLS:** replace compatibility policies only after workspace data and public paths are verified.
8. **Atomic payment functions:** deploy corrected review, void, and manual-payment RPCs only after the proof ownership schema decision and role checks pass.

## Backup, maintenance, and rollback

Before any write phase, take a production point-in-time recovery checkpoint and an approved schema/policy/function metadata snapshot. Preserve a secure, access-controlled mapping of each proposed invoice update and its selection reason. Run data repair in bounded batches during a maintenance window, monitor row counts and application errors, and stop on the first unexpected category.

Rollback must restore only changes made by the compatibility rollout: use the saved mapping to reverse confirmed backfill updates, retain legacy policies/functions until replacement smoke tests pass, and roll back newly created functions/policies/indexes in reverse dependency order. Index operations and policy swaps can affect availability; schedule them separately from data backfill and validate the public payment, receipt, proof upload, and review paths after each stage.

## Required next read-only query

Run an aggregate-only ownership-classification query before producing any write SQL. It must return counts—not invoice IDs or customer fields—for these mutually exclusive groups:

1. null-workspace invoices with one linked client workspace and invoice-owner membership in that workspace;
2. null-workspace invoices whose owner has exactly one active owner workspace;
3. null-workspace invoices with no client;
4. null-workspace invoices with multiple candidate workspaces;
5. non-null invoice/client workspace conflicts;
6. null-workspace invoices with linked proofs or invoice events, grouped only by whether those records corroborate the same candidate;
7. workspaces without an active owner membership; and
8. catalog counts of tables whose names contain `stripe`, `billing`, or `webhook`.

This query is the minimum evidence needed to turn the current `0` confirmed automatic updates into a defensible deterministic-backfill count and a precise manual-review count.

## Final release decision

| Question | Answer |
| --- | --- |
| Is production data repair required? | **Yes.** |
| Can production-hardening be merged safely now? | **No.** |
| Records confirmed safely backfillable from this export alone | **0** |
| Records requiring ownership diagnosis | **54** |
| Known conflicting invoice/client relationships | **31** |
| Next action | Run the aggregate-only ownership and Stripe-catalog diagnosis query. |
