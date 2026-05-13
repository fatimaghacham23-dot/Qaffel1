# Supabase migrations (apply in order)

Run these with the Supabase CLI (`supabase db push`) or paste each file in order in the SQL editor. The initial schema must run before all dated migrations.

| Order | File | Summary |
|------:|------|---------|
| 1 | `supabase/migrations/0001_initial_schema.sql` | Core tables: profiles, clients, invoices, payment proofs, RLS baseline |
| 2 | `supabase/migrations/20260510195100_add_profile_fields.sql` | Profile display fields |
| 3 | `supabase/migrations/20260510221400_private_storage.sql` | Private `payment-proofs` storage policies |
| 4 | `supabase/migrations/20260510223000_add_payment_amounts.sql` | Payment amount columns |
| 5 | `supabase/migrations/20260510224700_add_approval_fields.sql` | Client approval fields on invoices |
| 6 | `supabase/migrations/20260510225900_fix_public_approval_rpc.sql` | Public approval RPC fixes |
| 7 | `supabase/migrations/20260510233600_add_validity_and_rates.sql` | Invoice validity and FX rate fields |
| 8 | `supabase/migrations/20260510234500_create_service_presets.sql` | Service presets table |
| 9 | `supabase/migrations/20260511000200_public_payment_history_rpc.sql` | `get_public_payment_history_by_token` |
| 10 | `supabase/migrations/20260511000300_invoice_events.sql` | Invoice events / activity log |
| 11 | `supabase/migrations/20260511000400_void_payments.sql` | Void payment flows |
| 12 | `supabase/migrations/20260512000100_client_portal.sql` | Client portal token + public RPCs |
| 13 | `supabase/migrations/20260512000200_receipt_system.sql` | Receipt tokens + `get_public_receipt_data` |
| 14 | `supabase/migrations/20260512000300_deposit_requests.sql` | Deposit request fields |
| 15 | `supabase/migrations/20260512000400_quote_mode.sql` | Quotes, portal/activity RPC updates |
| 16 | `supabase/migrations/20260513091600_dedupe_receipt_view_events.sql` | Receipt view event dedupe |
| 17 | `supabase/migrations/20260513092000_cleanup_duplicate_receipt_viewed_events.sql` | Cleanup duplicate receipt viewed events |
| 18 | `supabase/migrations/20260513093000_add_whish_omt_metadata.sql` | Whish/OMT payment method metadata |
| 19 | `supabase/migrations/20260514010000_ai_proof_review.sql` | AI proof review columns / helpers |

After migrations, create the **`payment-proofs`** storage bucket (private) as described in `README.md`.
