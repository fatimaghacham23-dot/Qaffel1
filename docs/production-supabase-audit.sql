-- Qaffel production Supabase audit (READ ONLY)
--
-- Run only with authorised production read access. This script deliberately
-- returns metadata and aggregate configuration only: do not add customer rows,
-- tokens, emails, phone numbers, storage paths, or full UUID datasets.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- Applied migration ledger.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Exposed public tables and RLS state.
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'storage')
ORDER BY n.nspname, c.relname;

-- RLS policies, including their effective expressions.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- Table privileges granted to anonymous and authenticated API roles.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'authenticated') AND table_schema IN ('public', 'storage')
ORDER BY table_schema, table_name, grantee, privilege_type;

-- SECURITY DEFINER functions, fixed search path configuration, and execute grants.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       COALESCE(array_to_string(p.proconfig, ', '), '') AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, p.proname, arguments;

SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema IN ('public', 'storage') AND grantee IN ('anon', 'authenticated')
ORDER BY routine_schema, routine_name, grantee;

-- Public views and their definitions.
SELECT schemaname, viewname, definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- Storage bucket privacy without object names or paths.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

-- Foreign keys used to validate workspace ownership chains.
SELECT conrelid::regclass::text AS table_name, conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND connamespace IN ('public'::regnamespace, 'storage'::regnamespace)
ORDER BY table_name, constraint_name;

-- Indexes relevant to workspace membership and payment/receipt lookups.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (indexdef ILIKE '%workspace%' OR indexdef ILIKE '%receipt_token%' OR indexdef ILIKE '%payment_proof%')
ORDER BY tablename, indexname;

-- Receipt-token constraints and relevant public RPC definitions.
SELECT conrelid::regclass::text AS table_name, conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND pg_get_constraintdef(oid) ILIKE '%receipt_token%'
ORDER BY table_name, constraint_name;

SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, COALESCE(array_to_string(p.proconfig, ', '), '') AS function_config,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_public_payment_page', 'get_public_payment_history_by_token',
    'get_public_receipt', 'get_client_portal', 'review_payment_proof_atomic',
    'void_payment_proof_atomic', 'record_manual_payment_atomic'
  )
ORDER BY p.proname, arguments;

ROLLBACK;
