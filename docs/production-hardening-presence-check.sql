-- Paste into the Supabase SQL Editor only with authorised read access.
-- This script reads catalog metadata and makes no changes.
BEGIN;
SET TRANSACTION READ ONLY;

WITH expected_columns(migration, table_schema, table_name, column_name, expected_type) AS (
  VALUES
    ('20260725093000', 'public', 'workspace_subscriptions', 'stripe_last_event_created_at', 'timestamp with time zone'),
    ('20260725093000', 'public', 'workspace_billing_invoices', 'stripe_last_event_created_at', 'timestamp with time zone')
), expected_functions(migration, function_name, expected_arguments, expected_search_path) AS (
  VALUES
    ('20260725090000', 'get_public_payment_page', 'p_token text', 'search_path=pg_catalog, public'),
    ('20260725093000', 'claim_stripe_webhook_event', 'p_event_id text, p_event_type text, p_object_id text', 'search_path=pg_catalog, public'),
    ('20260725101500', 'review_payment_proof_atomic', 'p_proof_id uuid, p_invoice_id uuid, p_decision text, p_requested_invoice_status text', 'search_path=public, extensions'),
    ('20260725101500', 'void_payment_proof_atomic', 'p_proof_id uuid, p_reason text', 'search_path=public, extensions'),
    ('20260725101500', 'record_manual_payment_atomic', 'p_invoice_id uuid, p_amount_usd numeric, p_amount_lbp numeric, p_payment_date date, p_method text, p_note text, p_allow_duplicate boolean', 'search_path=public, extensions')
), expected_indexes(migration, index_name) AS (
  VALUES
    ('20260725090000', 'workspace_members_user_status_workspace_idx'),
    ('20260725090000', 'invoices_workspace_id_id_idx'),
    ('20260725090000', 'payment_proofs_invoice_status_uploaded_idx'),
    ('20260725093000', 'workspace_billing_audit_stripe_event_uidx')
), expected_policies(migration, schema_name, table_name, policy_name) AS (
  VALUES
    ('20260725090000', 'public', 'payment_proofs', 'workspace members can view payment proofs'),
    ('20260725090000', 'public', 'payment_proofs', 'workspace reviewers can update payment proofs'),
    ('20260725090000', 'public', 'payment_proofs', 'workspace finance can insert payment proofs'),
    ('20260725090000', 'storage', 'objects', 'workspace members can read payment proof files'),
    ('20260725100000', 'public', 'clients', 'workspace members can view clients'),
    ('20260725100000', 'public', 'clients', 'workspace client creators can insert clients'),
    ('20260725100000', 'public', 'clients', 'workspace client editors can update clients'),
    ('20260725100000', 'public', 'clients', 'workspace client admins can delete clients'),
    ('20260725100000', 'public', 'invoices', 'workspace members can view invoices'),
    ('20260725100000', 'public', 'invoices', 'workspace invoice creators can insert invoices'),
    ('20260725100000', 'public', 'invoices', 'workspace invoice editors can update invoices'),
    ('20260725100000', 'public', 'invoices', 'workspace invoice admins can delete invoices'),
    ('20260725100000', 'public', 'payment_methods', 'workspace members can view payment methods'),
    ('20260725100000', 'public', 'payment_methods', 'workspace settings managers can insert payment methods'),
    ('20260725100000', 'public', 'payment_methods', 'workspace settings managers can update payment methods'),
    ('20260725100000', 'public', 'payment_methods', 'workspace settings managers can delete payment methods'),
    ('20260725100000', 'public', 'payment_proofs', 'workspace reviewers can update payment proofs'),
    ('20260725100000', 'public', 'payment_proofs', 'workspace finance can void payment proofs')
), retired_policies(migration, schema_name, table_name, policy_name) AS (
  VALUES
    ('20260725090000', 'public', 'invoices', 'public invoice pages can read invoices by token'),
    ('20260725090000', 'public', 'profiles', 'public invoice pages can read business profile'),
    ('20260725090000', 'public', 'clients', 'public invoice pages can read invoice client name'),
    ('20260725090000', 'public', 'payment_methods', 'public invoice pages can read active payment methods'),
    ('20260725090000', 'public', 'payment_proofs', 'public can upload invoice proofs'),
    ('20260725090000', 'public', 'payment_proofs', 'proofs are readable by invoice owner'),
    ('20260725090000', 'public', 'payment_proofs', 'proofs are reviewable by invoice owner'),
    ('20260725090000', 'public', 'payment_proofs', 'workspace finance can insert payment proofs'),
    ('20260725090000', 'storage', 'objects', 'public can upload payment proof files'),
    ('20260725090000', 'storage', 'objects', 'owners can read their payment proof files'),
    ('20260725100000', 'public', 'clients', 'clients workspace access'),
    ('20260725100000', 'public', 'invoices', 'invoices workspace access'),
    ('20260725100000', 'public', 'payment_methods', 'payment_methods workspace access')
), expected_rls(migration, schema_name, table_name) AS (
  VALUES
    ('20260725100000', 'public', 'clients'),
    ('20260725100000', 'public', 'invoices'),
    ('20260725100000', 'public', 'payment_methods'),
    ('20260725100000', 'public', 'payment_proofs')
), expected_grants(migration, function_name, expected_arguments, grantee) AS (
  VALUES
    ('20260725090000', 'get_public_payment_page', 'p_token text', 'anon'),
    ('20260725090000', 'get_public_payment_page', 'p_token text', 'authenticated'),
    ('20260725093000', 'claim_stripe_webhook_event', 'p_event_id text, p_event_type text, p_object_id text', 'service_role'),
    ('20260725101500', 'review_payment_proof_atomic', 'p_proof_id uuid, p_invoice_id uuid, p_decision text, p_requested_invoice_status text', 'authenticated'),
    ('20260725101500', 'void_payment_proof_atomic', 'p_proof_id uuid, p_reason text', 'authenticated'),
    ('20260725101500', 'record_manual_payment_atomic', 'p_invoice_id uuid, p_amount_usd numeric, p_amount_lbp numeric, p_payment_date date, p_method text, p_note text, p_allow_duplicate boolean', 'authenticated')
)

SELECT * FROM (
  SELECT c.migration, 'COLUMN' AS object_type,
    c.table_schema || '.' || c.table_name || '.' || c.column_name AS object_name,
    c.expected_type AS expected_state,
    COALESCE(i.data_type, 'absent') AS observed_state,
    CASE WHEN i.column_name IS NULL THEN 'MISSING' WHEN i.data_type = c.expected_type THEN 'PRESENT' ELSE 'MISMATCH' END AS result
  FROM expected_columns c
  LEFT JOIN information_schema.columns i ON i.table_schema = c.table_schema AND i.table_name = c.table_name AND i.column_name = c.column_name

  UNION ALL
  SELECT f.migration, 'FUNCTION', 'public.' || f.function_name || '(' || f.expected_arguments || ')',
    'security definer; ' || f.expected_search_path,
    COALESCE('security definer=' || p.prosecdef::text || '; ' || COALESCE(array_to_string(p.proconfig, ', '), 'no configuration'), 'absent'),
    CASE WHEN p.oid IS NULL THEN 'MISSING'
         WHEN p.prosecdef AND COALESCE(array_to_string(p.proconfig, ', '), '') ILIKE '%' || f.expected_search_path || '%' THEN 'PRESENT'
         ELSE 'MISMATCH' END
  FROM expected_functions f
  LEFT JOIN pg_proc p ON p.proname = f.function_name AND pg_get_function_identity_arguments(p.oid) = f.expected_arguments
  LEFT JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  WHERE n.nspname = 'public' OR p.oid IS NULL

  UNION ALL
  SELECT x.migration, 'INDEX', 'public.' || x.index_name, 'present', COALESCE(ix.indexname, 'absent'),
    CASE WHEN ix.indexname IS NULL THEN 'MISSING' ELSE 'PRESENT' END
  FROM expected_indexes x LEFT JOIN pg_indexes ix ON ix.schemaname = 'public' AND ix.indexname = x.index_name

  UNION ALL
  SELECT q.migration, 'POLICY', q.schema_name || '.' || q.table_name || '.' || q.policy_name, 'present',
    COALESCE(p.policyname, 'absent'), CASE WHEN p.policyname IS NULL THEN 'MISSING' ELSE 'PRESENT' END
  FROM expected_policies q LEFT JOIN pg_policies p ON p.schemaname = q.schema_name AND p.tablename = q.table_name AND p.policyname = q.policy_name

  UNION ALL
  SELECT q.migration, 'RETIRED POLICY', q.schema_name || '.' || q.table_name || '.' || q.policy_name, 'absent',
    CASE WHEN p.policyname IS NULL THEN 'absent' ELSE 'present' END,
    CASE WHEN p.policyname IS NULL THEN 'PRESENT' ELSE 'MISMATCH' END
  FROM retired_policies q LEFT JOIN pg_policies p ON p.schemaname = q.schema_name AND p.tablename = q.table_name AND p.policyname = q.policy_name

  UNION ALL
  SELECT r.migration, 'RLS', r.schema_name || '.' || r.table_name, 'enabled',
    COALESCE(c.relrowsecurity::text, 'absent'),
    CASE WHEN c.oid IS NULL THEN 'MISSING' WHEN c.relrowsecurity THEN 'PRESENT' ELSE 'MISMATCH' END
  FROM expected_rls r LEFT JOIN pg_namespace n ON n.nspname = r.schema_name LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = r.table_name

  UNION ALL
  SELECT '20260725090000', 'STORAGE BUCKET', 'storage.buckets.payment-proofs', 'exists; public=false',
    COALESCE('exists; public=' || b.public::text, 'absent'),
    CASE WHEN b.id IS NULL THEN 'MISSING' WHEN b.public = false THEN 'PRESENT' ELSE 'MISMATCH' END
  FROM (SELECT 1) s LEFT JOIN storage.buckets b ON b.id = 'payment-proofs'

  UNION ALL
  SELECT g.migration, 'EXECUTE PRIVILEGE', 'public.' || g.function_name || '(' || g.expected_arguments || ') -> ' || g.grantee,
    'EXECUTE', CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges rp
      WHERE rp.routine_schema = 'public' AND rp.routine_name = g.function_name AND rp.grantee = g.grantee AND rp.privilege_type = 'EXECUTE'
    ) THEN 'EXECUTE' ELSE 'absent' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges rp
      WHERE rp.routine_schema = 'public' AND rp.routine_name = g.function_name AND rp.grantee = g.grantee AND rp.privilege_type = 'EXECUTE'
    ) THEN 'PRESENT' ELSE 'MISSING' END
  FROM expected_grants g

  UNION ALL
  SELECT 'HARDENING SET', 'MIGRATION_LEDGER', 'supabase_migrations.schema_migrations',
    'EXISTS WITH HARDENING VERSIONS',
    CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
      THEN 'TABLE ABSENT' ELSE 'TABLE PRESENT; VERSIONS NOT QUERIED' END,
    CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
      THEN 'MISSING' ELSE 'PRESENT' END
  FROM (SELECT 1) ledger
) checks
ORDER BY migration, object_type, object_name;

ROLLBACK;