-- Paste into the Supabase SQL Editor only with authorised production read access.
-- This script returns catalog metadata and aggregate counts only. It makes no changes.
BEGIN;
SET TRANSACTION READ ONLY;

WITH target_tables(schema_name, table_name) AS (
  VALUES
    ('public','workspace_members'), ('public','clients'), ('public','invoices'),
    ('public','payment_methods'), ('public','payment_proofs'), ('public','invoice_events'),
    ('public','workspace_subscriptions'), ('public','workspace_billing_invoices'),
    ('public','workspace_billing_audit_events')
), expected_columns(schema_name, table_name, column_name, expected_type, expected_nullable) AS (
  VALUES
    ('public','workspace_members','workspace_id','uuid','NO'), ('public','workspace_members','user_id','uuid','NO'), ('public','workspace_members','role','text','NO'), ('public','workspace_members','status','text','NO'),
    ('public','clients','id','uuid','NO'), ('public','clients','user_id','uuid','NO'), ('public','clients','workspace_id','uuid','NO'), ('public','clients','name','text','NO'),
    ('public','invoices','id','uuid','NO'), ('public','invoices','user_id','uuid','NO'), ('public','invoices','workspace_id','uuid','NO'), ('public','invoices','client_id','uuid','YES'), ('public','invoices','public_token','text','NO'), ('public','invoices','status','text','NO'), ('public','invoices','amount_usd','numeric','YES'), ('public','invoices','amount_lbp','numeric','YES'),
    ('public','payment_methods','id','uuid','NO'), ('public','payment_methods','user_id','uuid','NO'), ('public','payment_methods','workspace_id','uuid','NO'), ('public','payment_methods','type','text','NO'), ('public','payment_methods','is_active','boolean','NO'),
    ('public','payment_proofs','id','uuid','NO'), ('public','payment_proofs','invoice_id','uuid','NO'), ('public','payment_proofs','user_id','uuid','NO'), ('public','payment_proofs','status','text','NO'), ('public','payment_proofs','amount_usd','numeric','YES'), ('public','payment_proofs','amount_lbp','numeric','YES'), ('public','payment_proofs','receipt_token','text','YES'), ('public','payment_proofs','voided_at','timestamp with time zone','YES'),
    ('public','invoice_events','id','uuid','NO'), ('public','invoice_events','invoice_id','uuid','NO'), ('public','invoice_events','workspace_id','uuid','NO'), ('public','invoice_events','event_type','text','NO'), ('public','invoice_events','metadata','jsonb','YES'),
    ('public','workspace_subscriptions','workspace_id','uuid','NO'), ('public','workspace_subscriptions','stripe_last_event_created_at','timestamp with time zone','YES'),
    ('public','workspace_billing_invoices','workspace_id','uuid','NO'), ('public','workspace_billing_invoices','stripe_last_event_created_at','timestamp with time zone','YES'),
    ('public','workspace_billing_audit_events','workspace_id','uuid','NO'), ('public','workspace_billing_audit_events','event_type','text','NO'), ('public','workspace_billing_audit_events','next_state','jsonb','YES')
), expected_indexes(index_name, table_name, signature_hint) AS (
  VALUES
    ('workspace_members_user_status_workspace_idx','workspace_members','user_id, status, workspace_id'),
    ('invoices_workspace_id_id_idx','invoices','workspace_id, id'),
    ('payment_proofs_invoice_status_uploaded_idx','payment_proofs','invoice_id, status, uploaded_at'),
    ('workspace_billing_audit_stripe_event_uidx','workspace_billing_audit_events','event_type, stripe_event_id')
), expected_rpcs(function_name, argument_signature) AS (
  VALUES
    ('get_public_payment_page','p_token text'),
    ('claim_stripe_webhook_event','p_event_id text, p_event_type text, p_object_id text'),
    ('review_payment_proof_atomic','p_proof_id uuid, p_invoice_id uuid, p_decision text, p_requested_invoice_status text'),
    ('void_payment_proof_atomic','p_proof_id uuid, p_reason text'),
    ('record_manual_payment_atomic','p_invoice_id uuid, p_amount_usd numeric, p_amount_lbp numeric, p_payment_date date, p_method text, p_note text, p_allow_duplicate boolean')
), function_snapshot_names(function_name) AS (
  VALUES
    ('get_public_payment_page'), ('get_public_payment_history_by_token'), ('get_public_merchant_proof_review_stats'),
    ('claim_stripe_webhook_event'), ('review_payment_proof_atomic'), ('record_manual_payment_atomic'), ('void_payment_proof_atomic'),
    ('get_public_receipt_data'), ('record_receipt_view'), ('get_public_client_portal_header'),
    ('get_public_client_portal_invoices'), ('get_public_client_portal_payments'), ('get_public_client_portal_activity'),
    ('record_client_portal_view'), ('get_public_shared_report')
), dependency_tables(function_name, schema_name, table_name) AS (
  VALUES
    ('get_public_payment_page','public','invoices'), ('get_public_payment_page','public','profiles'), ('get_public_payment_page','public','clients'), ('get_public_payment_page','public','payment_methods'), ('get_public_payment_page','public','payment_proofs'),
    ('claim_stripe_webhook_event','public','stripe_webhook_events'),
    ('review_payment_proof_atomic','public','invoices'), ('review_payment_proof_atomic','public','payment_proofs'), ('review_payment_proof_atomic','public','workspace_members'), ('review_payment_proof_atomic','public','profiles'),
    ('void_payment_proof_atomic','public','invoices'), ('void_payment_proof_atomic','public','payment_proofs'), ('void_payment_proof_atomic','public','workspace_members'),
    ('record_manual_payment_atomic','public','invoices'), ('record_manual_payment_atomic','public','payment_proofs'), ('record_manual_payment_atomic','public','workspace_members'), ('record_manual_payment_atomic','public','profiles'), ('record_manual_payment_atomic','public','invoice_events')
), dependency_columns(function_name, schema_name, table_name, column_name) AS (
  VALUES
    ('get_public_payment_page','public','invoices','public_token'), ('get_public_payment_page','public','invoices','workspace_id'), ('get_public_payment_page','public','payment_proofs','status'),
    ('claim_stripe_webhook_event','public','stripe_webhook_events','stripe_event_id'), ('claim_stripe_webhook_event','public','stripe_webhook_events','received_at'), ('claim_stripe_webhook_event','public','stripe_webhook_events','status'),
    ('review_payment_proof_atomic','public','payment_proofs','receipt_token'), ('review_payment_proof_atomic','public','payment_proofs','voided_at'), ('review_payment_proof_atomic','public','invoices','workspace_id'),
    ('void_payment_proof_atomic','public','payment_proofs','voided_at'), ('void_payment_proof_atomic','public','payment_proofs','void_reason'), ('void_payment_proof_atomic','public','invoices','workspace_id'),
    ('record_manual_payment_atomic','public','invoice_events','workspace_id'), ('record_manual_payment_atomic','public','invoice_events','metadata'), ('record_manual_payment_atomic','public','payment_proofs','receipt_token')
), legacy_objects(object_type, schema_name, table_name, object_name, risk) AS (
  VALUES
    ('FUNCTION','public',NULL,'get_public_payment_history_by_token','public payment history can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'get_public_receipt_data','public receipt links can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'record_receipt_view','receipt-view telemetry can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'get_public_client_portal_header','client portal can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'get_public_client_portal_invoices','client portal can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'get_public_client_portal_payments','client portal can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'get_public_client_portal_activity','client portal can fail if changed without compatible replacement'),
    ('FUNCTION','public',NULL,'get_public_shared_report','shared reports can fail if changed without compatible replacement'),
    ('POLICY','public','invoices','public invoice pages can read invoices by token','removal before token RPC deployment can break the current public page'),
    ('POLICY','public','payment_proofs','public can upload invoice proofs','removal before server upload deployment can break public proof upload'),
    ('POLICY','storage','objects','public can upload payment proof files','removal before server upload deployment can break proof file upload')
), actual_columns AS (
  SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable, COALESCE(c.column_default,'none') AS column_default
  FROM information_schema.columns c JOIN target_tables t ON t.schema_name = c.table_schema AND t.table_name = c.table_name
), actual_indexes AS (
  SELECT n.nspname AS schema_name, t.relname AS table_name, i.relname AS index_name, ix.indisunique, ix.indisvalid, ix.indisready,
    pg_get_indexdef(i.oid) AS index_definition, pg_get_expr(ix.indpred, ix.indrelid) AS predicate
  FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_class t ON t.oid = ix.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
), result_rows AS (
  SELECT 'TABLE_COLUMN' AS check_group, e.schema_name || '.' || e.table_name || '.' || e.column_name AS object_name,
    e.expected_type || '; nullable=' || e.expected_nullable AS expected_state,
    COALESCE(a.data_type || '; nullable=' || a.is_nullable || '; default=' || a.column_default, 'TABLE OR COLUMN ABSENT') AS observed_state,
    CASE WHEN a.column_name IS NULL THEN 'MISSING' WHEN a.data_type = e.expected_type AND a.is_nullable = e.expected_nullable THEN 'READY' ELSE 'MISMATCH' END AS result,
    'HIGH' AS risk, 'Compatibility prerequisite' AS notes
  FROM expected_columns e LEFT JOIN actual_columns a ON a.table_schema=e.schema_name AND a.table_name=e.table_name AND a.column_name=e.column_name

  UNION ALL
  SELECT 'TABLE', t.schema_name || '.' || t.table_name, 'table exists', CASE WHEN c.oid IS NULL THEN 'TABLE ABSENT' ELSE 'TABLE PRESENT' END,
    CASE WHEN c.oid IS NULL THEN 'MISSING' ELSE 'READY' END, 'HIGH', 'RLS and constraint target'
  FROM target_tables t LEFT JOIN pg_namespace n ON n.nspname=t.schema_name LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.table_name AND c.relkind='r'

  UNION ALL
  SELECT 'CONSTRAINT', conrelid::regclass::text || '.' || conname, contype || '; ' || pg_get_constraintdef(oid), contype || '; ' || pg_get_constraintdef(oid), 'REVIEW', 'MEDIUM', 'Primary, unique, and foreign-key snapshot'
  FROM pg_constraint WHERE conrelid IN (SELECT to_regclass(schema_name || '.' || table_name) FROM target_tables) AND contype IN ('p','u','f')

  UNION ALL
  SELECT 'RLS', t.schema_name || '.' || t.table_name, 'enabled', COALESCE(c.relrowsecurity::text,'TABLE ABSENT'),
    CASE WHEN c.oid IS NULL THEN 'MISSING' WHEN c.relrowsecurity THEN 'READY' ELSE 'MISMATCH' END, 'HIGH', 'RLS state'
  FROM target_tables t LEFT JOIN pg_namespace n ON n.nspname=t.schema_name LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.table_name

  UNION ALL
  SELECT 'BACKFILL', 'clients.workspace_id null count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Workspace RLS requires backfill' FROM public.clients WHERE workspace_id IS NULL
  UNION ALL SELECT 'BACKFILL', 'invoices.workspace_id null count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Workspace RLS requires backfill' FROM public.invoices WHERE workspace_id IS NULL
  UNION ALL SELECT 'BACKFILL', 'payment_methods.workspace_id null count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Workspace RLS requires backfill' FROM public.payment_methods WHERE workspace_id IS NULL
  UNION ALL SELECT 'BACKFILL', 'payment_proofs missing invoice count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Proof parent integrity' FROM public.payment_proofs pp LEFT JOIN public.invoices i ON i.id=pp.invoice_id WHERE i.id IS NULL
  UNION ALL SELECT 'BACKFILL', 'payment_proofs parent null workspace count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Proof parent workspace integrity' FROM public.payment_proofs pp JOIN public.invoices i ON i.id=pp.invoice_id WHERE i.workspace_id IS NULL
  UNION ALL SELECT 'BACKFILL', 'workspace_members inactive or unexpected status count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'REVIEW' END, 'MEDIUM', 'Statuses outside active, pending, removed' FROM public.workspace_members WHERE status IS NULL OR status NOT IN ('active','pending','removed') OR status <> 'active'
  UNION ALL SELECT 'BACKFILL', 'workspaces without active owner membership count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Owner membership required' FROM public.workspaces w WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id=w.id AND wm.status='active' AND wm.role='owner')
  UNION ALL SELECT 'BACKFILL', 'invoice/client workspace mismatch count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Parent workspace mismatch' FROM public.invoices i JOIN public.clients c ON c.id=i.client_id WHERE i.workspace_id IS DISTINCT FROM c.workspace_id
  UNION ALL SELECT 'BACKFILL', 'proof/invoice workspace mismatch count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Parent workspace mismatch' FROM public.payment_proofs pp JOIN public.invoices i ON i.id=pp.invoice_id WHERE pp.user_id IS DISTINCT FROM i.user_id
  UNION ALL SELECT 'BACKFILL', 'invoice_event/invoice workspace mismatch count', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Parent workspace mismatch' FROM public.invoice_events e JOIN public.invoices i ON i.id=e.invoice_id WHERE e.workspace_id IS DISTINCT FROM i.workspace_id

  UNION ALL
  SELECT 'POLICY', p.schemaname || '.' || p.tablename || '.' || p.policyname, 'current definition snapshot',
    'roles=' || array_to_string(p.roles, ',') || '; command=' || p.cmd || '; permissive=' || p.permissive || '; using=' || COALESCE(p.qual,'none') || '; check=' || COALESCE(p.with_check,'none'),
    'REVIEW', 'HIGH', 'Current policy definition'
  FROM pg_policies p WHERE (p.schemaname='public' AND p.tablename IN ('clients','invoices','payment_methods','payment_proofs')) OR (p.schemaname='storage' AND p.tablename='objects')

  UNION ALL
  SELECT 'RPC', 'public.' || r.function_name || '(' || r.argument_signature || ')', 'exact signature present',
    CASE WHEN p.oid IS NULL THEN 'absent' ELSE 'present; security_definer=' || p.prosecdef::text || '; search_path=' || COALESCE(array_to_string(p.proconfig, ', '),'none') END,
    CASE WHEN p.oid IS NULL THEN 'MISSING' ELSE 'READY' END, 'HIGH', 'Proposed RPC presence and signature'
  FROM expected_rpcs r
  LEFT JOIN pg_proc p ON p.proname=r.function_name AND pg_get_function_identity_arguments(p.oid)=r.argument_signature
  LEFT JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
  WHERE n.nspname='public' OR p.oid IS NULL

  UNION ALL
  SELECT 'FUNCTION', 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'function snapshot',
    'returns=' || pg_get_function_result(p.oid) || '; security_definer=' || p.prosecdef::text || '; search_path=' || COALESCE(array_to_string(p.proconfig, ', '),'none') || '; owner=' || pg_get_userbyid(p.proowner) || '; definition_md5=' || md5(pg_get_functiondef(p.oid)),
    'REVIEW', 'HIGH', 'Current function metadata; grants are separate rows'
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN function_snapshot_names f ON f.function_name=p.proname WHERE n.nspname='public'

  UNION ALL
  SELECT 'FUNCTION_GRANT', 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'execution grants snapshot',
    COALESCE((SELECT string_agg(rp.grantee || ':' || rp.privilege_type, ', ' ORDER BY rp.grantee) FROM information_schema.routine_privileges rp WHERE rp.routine_schema='public' AND rp.routine_name=p.proname),'no grants visible'),
    'REVIEW', 'HIGH', 'Current execution grants'
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN function_snapshot_names f ON f.function_name=p.proname WHERE n.nspname='public'

  UNION ALL
  SELECT 'STRIPE_PREFLIGHT', 'duplicate stripe event ID groups', '0', count(*)::text, CASE WHEN count(*)=0 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Unique index precondition'
  FROM (SELECT 1 FROM public.workspace_billing_audit_events WHERE next_state->>'stripe_event_id' IS NOT NULL GROUP BY event_type, next_state->>'stripe_event_id' HAVING count(*)>1) d
  UNION ALL SELECT 'STRIPE_PREFLIGHT', 'maximum duplicates in one group', '1', COALESCE(max(duplicate_count),0)::text, CASE WHEN COALESCE(max(duplicate_count),0)<=1 THEN 'READY' ELSE 'BLOCKED' END, 'HIGH', 'Unique index precondition' FROM (SELECT count(*) AS duplicate_count FROM public.workspace_billing_audit_events WHERE next_state->>'stripe_event_id' IS NOT NULL GROUP BY event_type, next_state->>'stripe_event_id') d
  UNION ALL SELECT 'STRIPE_PREFLIGHT', 'rows with missing stripe event ID', 'aggregate count', count(*)::text, 'REVIEW', 'MEDIUM', 'Historical audit data completeness' FROM public.workspace_billing_audit_events WHERE next_state->>'stripe_event_id' IS NULL
  UNION ALL SELECT 'STRIPE_PREFLIGHT', 'workspace_billing_audit_stripe_event_uidx', 'index absent before compatibility rollout', CASE WHEN EXISTS(SELECT 1 FROM actual_indexes WHERE index_name='workspace_billing_audit_stripe_event_uidx') THEN 'present' ELSE 'absent' END, CASE WHEN EXISTS(SELECT 1 FROM actual_indexes WHERE index_name='workspace_billing_audit_stripe_event_uidx') THEN 'REVIEW' ELSE 'READY' END, 'MEDIUM', 'Exact-name precondition'

  UNION ALL
  SELECT 'INDEX', 'public.' || e.index_name, 'columns: ' || e.signature_hint,
    COALESCE(a.index_definition || '; unique=' || a.indisunique::text || '; predicate=' || COALESCE(a.predicate,'none') || '; valid=' || a.indisvalid::text || '; ready=' || a.indisready::text,'absent'),
    CASE WHEN a.index_name IS NOT NULL THEN 'REVIEW' WHEN EXISTS(SELECT 1 FROM actual_indexes x WHERE x.table_name=e.table_name AND x.index_definition ILIKE '%' || split_part(e.signature_hint, ',', 1) || '%') THEN 'REVIEW' ELSE 'MISSING' END,
    'MEDIUM', 'Exact name or possible equivalent index'
  FROM expected_indexes e LEFT JOIN actual_indexes a ON a.index_name=e.index_name

  UNION ALL
  SELECT 'STORAGE', 'storage.buckets.payment-proofs', 'exists; private; aggregate metadata only',
    CASE WHEN b.id IS NULL THEN 'absent' ELSE 'public=' || b.public::text || '; size_limit=' || COALESCE(b.file_size_limit::text,'none') || '; mime_types=' || COALESCE(array_to_string(b.allowed_mime_types, ','),'none') END,
    CASE WHEN b.id IS NULL THEN 'MISSING' WHEN b.public THEN 'MISMATCH' ELSE 'READY' END, 'HIGH', 'Bucket configuration'
  FROM (SELECT 1) s LEFT JOIN storage.buckets b ON b.id='payment-proofs'
  UNION ALL SELECT 'STORAGE', 'payment-proofs object aggregates', 'aggregate only', 'object_count=' || count(*)::text || '; min_depth=' || COALESCE(min(array_length(string_to_array(name,'/'),1)),0)::text || '; max_depth=' || COALESCE(max(array_length(string_to_array(name,'/'),1)),0)::text, 'REVIEW', 'MEDIUM', 'No object names returned' FROM storage.objects WHERE bucket_id='payment-proofs'
  UNION ALL SELECT 'STORAGE_GRANT', 'storage.objects anon/authenticated grants', 'grant snapshot', COALESCE(string_agg(grantee || ':' || privilege_type, ', ' ORDER BY grantee, privilege_type),'none'), 'REVIEW', 'HIGH', 'Table privileges only; policy snapshot is separate' FROM information_schema.role_table_grants WHERE table_schema='storage' AND table_name='objects' AND grantee IN ('anon','authenticated')

  UNION ALL
  SELECT 'RPC_DEPENDENCY_TABLE', d.function_name || ' -> ' || d.schema_name || '.' || d.table_name, 'table exists', CASE WHEN to_regclass(d.schema_name || '.' || d.table_name) IS NULL THEN 'absent' ELSE 'present' END, CASE WHEN to_regclass(d.schema_name || '.' || d.table_name) IS NULL THEN 'MISSING' ELSE 'READY' END, 'HIGH', 'Referenced table prerequisite'
  FROM dependency_tables d
  UNION ALL SELECT 'RPC_DEPENDENCY_COLUMN', d.function_name || ' -> ' || d.schema_name || '.' || d.table_name || '.' || d.column_name, 'column exists', CASE WHEN c.column_name IS NULL THEN 'absent' ELSE c.data_type END, CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'READY' END, 'HIGH', 'Referenced column prerequisite' FROM dependency_columns d LEFT JOIN information_schema.columns c ON c.table_schema=d.schema_name AND c.table_name=d.table_name AND c.column_name=d.column_name
  UNION ALL SELECT 'RPC_DEPENDENCY_EXTENSION', 'pgcrypto', 'installed', CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN 'installed' ELSE 'absent' END, CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN 'READY' ELSE 'MISSING' END, 'HIGH', 'Required by receipt-token generation'
  UNION ALL SELECT 'RPC_DEPENDENCY_STATUS', 'payment_proofs accepted/pending/rejected/voided', 'status constraint supports values', COALESCE((SELECT string_agg(pg_get_constraintdef(c.oid), ' | ') FROM pg_constraint c WHERE c.conrelid='public.payment_proofs'::regclass AND c.contype='c'),'no check constraint'), 'REVIEW', 'HIGH', 'Review current status constraint before atomic functions'

  UNION ALL
  SELECT 'LEGACY_COMPATIBILITY', l.object_type || ':' || COALESCE(l.schema_name || '.' || l.table_name || '.', l.schema_name || '.') || l.object_name, 'retain or provide compatible replacement',
    CASE WHEN l.object_type='FUNCTION' AND EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=l.schema_name AND p.proname=l.object_name) THEN 'present'
         WHEN l.object_type='POLICY' AND EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname=l.schema_name AND p.tablename=l.table_name AND p.policyname=l.object_name) THEN 'present'
         ELSE 'absent' END,
    'REVIEW', 'HIGH', l.risk
  FROM legacy_objects l
)
SELECT check_group, object_name, expected_state, observed_state, result, risk, notes
FROM result_rows
ORDER BY check_group, object_name;

ROLLBACK;