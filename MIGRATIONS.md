# Supabase migration manifest

This manifest is the canonical repository order for Qaffel database changes. Apply migrations with the Supabase CLI against a disposable local database first. Never paste selected files into production, edit an already-applied migration, or repair remote migration history without an approved reconciliation record.

| Order | File | Purpose |
|---:|---|---|
| 1 | `0001_initial_schema.sql` | Initial profiles, clients, invoices, proofs, and baseline RLS |
| 2 | `20260510195100_add_profile_fields.sql` | Profile and business fields |
| 3 | `20260510221400_private_storage.sql` | Private proof-storage policies |
| 4 | `20260510223000_add_payment_amounts.sql` | Payment amount fields |
| 5 | `20260510224700_add_approval_fields.sql` | Invoice approval fields |
| 6 | `20260510225900_fix_public_approval_rpc.sql` | Public approval RPC correction |
| 7 | `20260510233600_add_validity_and_rates.sql` | Validity and exchange-rate fields |
| 8 | `20260510234500_create_service_presets.sql` | Service presets |
| 9 | `20260511000200_public_payment_history_rpc.sql` | Token-scoped public payment history |
| 10 | `20260511000300_invoice_events.sql` | Invoice activity events |
| 11 | `20260511000400_void_payments.sql` | Payment voiding |
| 12 | `20260512000100_client_portal.sql` | Client portal tokens and RPCs |
| 13 | `20260512000200_receipt_system.sql` | Receipt tokens and public receipt RPC |
| 14 | `20260512000300_deposit_requests.sql` | Deposit requests |
| 15 | `20260512000400_quote_mode.sql` | Quote workflow |
| 16 | `20260513091600_dedupe_receipt_view_events.sql` | Receipt-view event deduplication |
| 17 | `20260513092000_cleanup_duplicate_receipt_viewed_events.sql` | Historical duplicate receipt cleanup |
| 18 | `20260513093000_add_whish_omt_metadata.sql` | Whish and OMT metadata |
| 19 | `20260513120000_portal_header_business_phone.sql` | Public portal business phone |
| 20 | `20260513140000_invoice_payment_plan.sql` | Invoice payment plans |
| 21 | `20260513170000_business_brand_layer.sql` | Workspace branding |
| 22 | `20260514010000_ai_proof_review.sql` | Existing AI proof-review evidence |
| 23 | `20260514120000_schema_reconciliation.sql` | Schema reconciliation for prior environments |
| 24 | `20260514183000_shared_reports_connectivity.sql` | Shared reports and connectivity |
| 25 | `20260515140000_workspace_memory.sql` | Workspace operational memory |
| 26 | `20260515200000_workspaces_team.sql` | Workspaces, memberships, and roles |
| 27 | `20260515213000_operational_assignments.sql` | Assignments |
| 28 | `20260515223000_operational_attention_indexes.sql` | Operational attention indexes |
| 29 | `20260515233000_finance_closing.sql` | Finance closing |
| 30 | `20260515234500_operational_presence.sql` | Operational presence |
| 31 | `20260518120000_workspace_billing_foundation.sql` | Workspace billing foundation |
| 32 | `20260518133000_stripe_billing_sync.sql` | Stripe billing synchronization |
| 33 | `20260725090000_public_payment_security_hardening.sql` | Token-scoped public payment data and private proof storage |
| 34 | `20260725093000_stripe_webhook_concurrency.sql` | Atomic Stripe webhook claims and replay-safe billing audit |
| 35 | `20260725100000_workspace_role_rls_hardening.sql` | Role-specific workspace write policies and proof transition limits |
| 36 | `20260725101500_financial_payment_atomicity.sql` | Serialized proof review, payment void, and invoice reconciliation RPCs |

## Rehearsal requirement

Before any production release:

1. Start a disposable local Supabase stack.
2. Run `supabase db reset` and retain the complete output.
3. Run the schema, RLS, storage, financial, and application test suites.
4. Record local migration history with `supabase migration list --local`.
5. Obtain remote history with `supabase migration list --linked` using read-only operational credentials.
6. Compare histories exactly; stop on missing, duplicate, reordered, or remote-only versions.
7. Follow [docs/database-release-runbook.md](docs/database-release-runbook.md) for approval, backup, deployment, and recovery.

The `payment-proofs` bucket must remain private. Its policies are schema-managed; do not convert it to a public bucket in the dashboard.
