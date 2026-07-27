-- Qaffel production metadata audit for the Supabase SQL Editor.
-- This script is read-only and makes no changes. Do not add customer data, tokens,
-- proof paths, or secrets to its saved output.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- Applied migration ledger.
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- Application tables that do not have RLS enabled.
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public' AND NOT c.relrowsecurity
ORDER BY c.relname;

-- Policy coverage, including command and check expression.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- API table grants.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'storage') AND grantee IN ('anon', 'authenticated')
ORDER BY table_schema, table_name, grantee, privilege_type;

-- Definer functions, fixed search path configuration, and execution grants.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       COALESCE(array_to_string(p.proconfig, ', '), '') AS function_config
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'storage') ORDER BY schema_name, function_name, arguments;

SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema IN ('public', 'storage') AND grantee IN ('anon', 'authenticated')
ORDER BY routine_schema, routine_name, grantee;

-- Public views and storage privacy/policy coverage.
SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;

-- Critical RPC presence only; definitions are reviewed in the fuller audit script.
SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, COALESCE(array_to_string(p.proconfig, ', '), '') AS function_config
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'get_public_payment_page', 'get_public_payment_history_by_token', 'get_public_receipt',
  'get_client_portal', 'review_payment_proof_atomic', 'void_payment_proof_atomic',
  'record_manual_payment_atomic'
) ORDER BY function_name, arguments;

ROLLBACK;