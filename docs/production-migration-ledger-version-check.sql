-- Run this optional read-only check only after confirming that
-- to_regclass('supabase_migrations.schema_migrations') is not null.
-- It queries the migration ledger and must not be used when that table is absent.
BEGIN;
SET TRANSACTION READ ONLY;

WITH expected(version) AS (
  VALUES ('20260725090000'), ('20260725093000'), ('20260725100000'), ('20260725101500')
)
SELECT
  e.version AS migration,
  'MIGRATION_VERSION' AS object_type,
  'supabase_migrations.schema_migrations.' || e.version AS object_name,
  'APPLIED' AS expected_state,
  CASE WHEN sm.version IS NULL THEN 'ABSENT' ELSE 'APPLIED' END AS observed_state,
  CASE WHEN sm.version IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS result
FROM expected e
LEFT JOIN supabase_migrations.schema_migrations sm ON sm.version = e.version
ORDER BY e.version;

ROLLBACK;