-- Paste into the Supabase SQL Editor only with authorised production read access.
-- Returns aggregate counts only. It does not return identifiers, customer data,
-- invoice content, public/receipt tokens, or storage paths.
-- Prerequisite: the compatibility preflight has confirmed public.invoices,
-- public.clients, public.workspaces, and public.workspace_members exist.
BEGIN;
SET TRANSACTION READ ONLY;

WITH schema_columns AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('invoices', 'clients', 'workspaces', 'workspace_members', 'payment_proofs', 'invoice_events')
), schema_state AS (
  SELECT
    to_regclass('public.invoices') IS NOT NULL AS invoices_table,
    to_regclass('public.clients') IS NOT NULL AS clients_table,
    to_regclass('public.workspaces') IS NOT NULL AS workspaces_table,
    to_regclass('public.workspace_members') IS NOT NULL AS members_table,
    to_regclass('public.payment_proofs') IS NOT NULL AS proofs_table,
    to_regclass('public.invoice_events') IS NOT NULL AS events_table,
    to_regclass('public.operational_assignments') IS NOT NULL AS assignments_table,
    to_regclass('public.shared_reports') IS NOT NULL AS shared_reports_table,
    count(*) filter (where table_name='invoices' and column_name in ('id','user_id','client_id','workspace_id','public_token')) = 5 AS invoices_columns,
    count(*) filter (where table_name='clients' and column_name in ('id','workspace_id')) = 2 AS clients_columns,
    count(*) filter (where table_name='workspaces' and column_name='id') = 1 AS workspaces_columns,
    count(*) filter (where table_name='workspace_members' and column_name in ('user_id','workspace_id','status')) = 3 AS members_columns
  FROM schema_columns
), invoice_context AS (
  -- JSON extraction is deliberate: optional legacy columns become NULL rather
  -- than causing a column-not-found error.
  SELECT
    to_jsonb(i)->>'id' AS invoice_key,
    to_jsonb(i)->>'user_id' AS invoice_user_key,
    to_jsonb(i)->>'client_id' AS client_key,
    to_jsonb(i)->>'workspace_id' AS invoice_workspace_key,
    (to_jsonb(i)->>'public_token') IS NOT NULL AS has_public_token
  FROM public.invoices i
), client_context AS (
  SELECT
    ic.*,
    to_jsonb(c)->>'id' AS resolved_client_key,
    to_jsonb(c)->>'workspace_id' AS client_workspace_key,
    to_jsonb(cw)->>'id' AS resolved_client_workspace_key
  FROM invoice_context ic
  LEFT JOIN public.clients c
    ON to_jsonb(c)->>'id' = ic.client_key
  LEFT JOIN public.workspaces cw
    ON to_jsonb(cw)->>'id' = to_jsonb(c)->>'workspace_id'
), active_member_candidates AS (
  SELECT DISTINCT
    ic.invoice_key,
    to_jsonb(wm)->>'workspace_id' AS workspace_key,
    true AS from_active_membership,
    false AS from_workspace_owner
  FROM invoice_context ic
  JOIN public.workspace_members wm
    ON to_jsonb(wm)->>'user_id' = ic.invoice_user_key
   AND to_jsonb(wm)->>'status' = 'active'
  JOIN public.workspaces w
    ON to_jsonb(w)->>'id' = to_jsonb(wm)->>'workspace_id'
), workspace_owner_candidates AS (
  SELECT DISTINCT
    ic.invoice_key,
    to_jsonb(w)->>'id' AS workspace_key,
    false AS from_active_membership,
    true AS from_workspace_owner
  FROM invoice_context ic
  JOIN public.workspaces w
    ON to_jsonb(w)->>'owner_id' = ic.invoice_user_key
), user_candidates AS (
  SELECT * FROM active_member_candidates
  UNION
  SELECT * FROM workspace_owner_candidates
), user_candidate_summary AS (
  SELECT
    invoice_key,
    count(distinct workspace_key)::integer AS workspace_count,
    max(workspace_key) AS unique_workspace_key,
    bool_or(from_active_membership) AS has_active_membership,
    bool_or(from_workspace_owner) AS has_workspace_owner_relation
  FROM user_candidates
  GROUP BY invoice_key
), null_workspace_invoices AS (
  SELECT cc.*, coalesce(ucs.workspace_count, 0) AS user_workspace_count,
    ucs.unique_workspace_key AS user_workspace_key,
    coalesce(ucs.has_active_membership, false) AS has_active_membership,
    coalesce(ucs.has_workspace_owner_relation, false) AS has_workspace_owner_relation
  FROM client_context cc
  LEFT JOIN user_candidate_summary ucs ON ucs.invoice_key=cc.invoice_key
  WHERE cc.invoice_workspace_key IS NULL
), null_classification AS (
  SELECT
    CASE
      WHEN NOT (s.invoices_table AND s.clients_table AND s.workspaces_table AND s.members_table AND s.invoices_columns AND s.clients_columns AND s.workspaces_columns AND s.members_columns) THEN 'SCHEMA_BLOCKED'
      WHEN n.client_key IS NULL OR n.resolved_client_key IS NULL THEN 'CLIENT_MISSING_OR_ORPHANED'
      WHEN n.user_workspace_count > 1 THEN 'USER_MULTIPLE_WORKSPACES'
      WHEN n.resolved_client_workspace_key IS NOT NULL AND n.invoice_user_key IS NULL THEN 'CLIENT_ONLY_UNIQUE'
      WHEN n.resolved_client_workspace_key IS NOT NULL AND n.user_workspace_count = 0 THEN 'OWNER_MEMBERSHIP_MISSING'
      WHEN n.resolved_client_workspace_key IS NOT NULL AND n.user_workspace_count = 1 AND n.client_workspace_key = n.user_workspace_key THEN 'CLIENT_AND_USER_AGREE'
      WHEN n.resolved_client_workspace_key IS NOT NULL AND n.user_workspace_count = 1 AND n.client_workspace_key IS DISTINCT FROM n.user_workspace_key THEN 'CLIENT_AND_USER_CONFLICT'
      WHEN n.resolved_client_workspace_key IS NULL AND n.user_workspace_count = 1 THEN 'USER_ONLY_UNIQUE'
      ELSE 'NO_CANDIDATE'
    END AS classification,
    n.*
  FROM null_workspace_invoices n
  CROSS JOIN schema_state s
), existing_client_conflicts AS (
  SELECT cc.*, coalesce(ucs.workspace_count, 0) AS user_workspace_count,
    ucs.unique_workspace_key AS user_workspace_key,
    coalesce(ucs.has_active_membership, false) AS has_active_membership,
    coalesce(ucs.has_workspace_owner_relation, false) AS has_workspace_owner_relation
  FROM client_context cc
  LEFT JOIN user_candidate_summary ucs ON ucs.invoice_key=cc.invoice_key
  WHERE cc.invoice_workspace_key IS NOT NULL
    AND cc.resolved_client_workspace_key IS NOT NULL
    AND cc.invoice_workspace_key IS DISTINCT FROM cc.client_workspace_key
), conflict_classification AS (
  SELECT
    CASE
      WHEN NOT (s.invoices_table AND s.clients_table AND s.workspaces_table AND s.members_table AND s.invoices_columns AND s.clients_columns AND s.workspaces_columns AND s.members_columns) THEN 'SCHEMA_BLOCKED'
      WHEN c.user_workspace_count > 1 THEN 'MULTIPLE_USER_WORKSPACES'
      WHEN c.user_workspace_count = 0 THEN 'NO_USER_WORKSPACE_EVIDENCE'
      WHEN c.user_workspace_key = c.invoice_workspace_key AND c.user_workspace_key IS DISTINCT FROM c.client_workspace_key THEN 'EXISTING_MATCHES_USER_CLIENT_DIFFERS'
      -- The two requested client/user-agreement labels overlap. This split is
      -- deterministic: owner-derived agreement is reported separately; active
      -- membership-only agreement uses CLIENT_MATCHES_USER_EXISTING_DIFFERS.
      WHEN c.user_workspace_key = c.client_workspace_key AND c.has_workspace_owner_relation THEN 'CLIENT_AND_USER_AGREE_EXISTING_DIFFERS'
      WHEN c.user_workspace_key = c.client_workspace_key THEN 'CLIENT_MATCHES_USER_EXISTING_DIFFERS'
      WHEN c.user_workspace_key IS DISTINCT FROM c.invoice_workspace_key AND c.user_workspace_key IS DISTINCT FROM c.client_workspace_key THEN 'USER_MATCHES_NEITHER'
      ELSE 'NO_USER_WORKSPACE_EVIDENCE'
    END AS classification,
    c.*
  FROM existing_client_conflicts c
  CROSS JOIN schema_state s
), proof_evidence AS (
  SELECT
    n.invoice_key,
    count(p.*) > 0 AS has_payment_proofs,
    count(p.*) filter (where to_jsonb(p)->>'status' = 'accepted') > 0 AS has_accepted_payment,
    count(p.*) filter (where (to_jsonb(p)->>'receipt_token') IS NOT NULL) > 0 AS has_receipt
  FROM null_workspace_invoices n
  LEFT JOIN public.payment_proofs p ON to_jsonb(p)->>'invoice_id'=n.invoice_key
  GROUP BY n.invoice_key
), event_evidence AS (
  SELECT n.invoice_key, count(e.*) > 0 AS has_invoice_events
  FROM null_workspace_invoices n
  LEFT JOIN public.invoice_events e ON to_jsonb(e)->>'invoice_id'=n.invoice_key
  GROUP BY n.invoice_key
), classification_rows AS (
  SELECT
    classification,
    count(*)::bigint AS invoice_count,
    CASE classification
      WHEN 'CLIENT_AND_USER_AGREE' THEN 'Backfill only after a final aggregate verification confirms no access change.'
      WHEN 'USER_ONLY_UNIQUE' THEN 'Backfill only after a final aggregate verification confirms no client candidate exists.'
      WHEN 'CLIENT_ONLY_UNIQUE' THEN 'Do not write until the missing invoice owner relationship is reviewed.'
      WHEN 'SCHEMA_BLOCKED' THEN 'Repair or verify schema before any data decision.'
      ELSE 'Manual ownership review; do not backfill automatically.'
    END AS proposed_action,
    CASE WHEN classification IN ('CLIENT_AND_USER_AGREE','USER_ONLY_UNIQUE') THEN 'HIGH'
         WHEN classification='CLIENT_ONLY_UNIQUE' THEN 'MEDIUM'
         ELSE 'NONE' END AS confidence,
    CASE WHEN classification IN ('CLIENT_AND_USER_AGREE','USER_ONLY_UNIQUE') THEN 'AUTO_BACKFILL_CANDIDATE'
         WHEN classification='SCHEMA_BLOCKED' THEN 'BLOCKED'
         ELSE 'MANUAL_REVIEW' END AS result,
    CASE WHEN classification IN ('CLIENT_AND_USER_AGREE','USER_ONLY_UNIQUE') THEN 'MEDIUM' ELSE 'HIGH' END AS risk,
    'Aggregate classification only; no identifiers are returned.' AS notes
  FROM null_classification
  GROUP BY classification
), conflict_rows AS (
  SELECT
    'CONFLICT_' || classification AS classification,
    count(*)::bigint AS invoice_count,
    'Do not change existing ownership until the ownership source is reviewed.' AS proposed_action,
    'NONE' AS confidence,
    CASE WHEN classification='SCHEMA_BLOCKED' THEN 'BLOCKED' ELSE 'MANUAL_REVIEW' END AS result,
    'HIGH' AS risk,
    'Existing invoice workspace differs from its linked client workspace.' AS notes
  FROM conflict_classification
  GROUP BY classification
), evidence_rows AS (
  SELECT 'EVIDENCE_PAYMENT_PROOFS' AS classification, count(*) filter (where p.has_payment_proofs)::bigint AS invoice_count,
    'Preserve payment history during any later migration.' AS proposed_action, 'NONE' AS confidence, 'NO_CHANGE' AS result, 'HIGH' AS risk, 'Invoices with one or more proof records.' AS notes
  FROM proof_evidence p
  UNION ALL SELECT 'EVIDENCE_ACCEPTED_PAYMENTS', count(*) filter (where p.has_accepted_payment)::bigint, 'Preserve accepted balances during any later migration.', 'NONE', 'NO_CHANGE', 'HIGH', 'Invoices with accepted proof payments.' FROM proof_evidence p
  UNION ALL SELECT 'EVIDENCE_RECEIPTS', count(*) filter (where p.has_receipt)::bigint, 'Preserve receipt access during any later migration.', 'NONE', 'NO_CHANGE', 'HIGH', 'Invoices with a stored receipt token.' FROM proof_evidence p
  UNION ALL SELECT 'EVIDENCE_INVOICE_EVENTS', count(*) filter (where e.has_invoice_events)::bigint, 'Preserve event attribution during any later migration.', 'NONE', 'NO_CHANGE', 'MEDIUM', 'Invoices with one or more invoice events.' FROM event_evidence e
  UNION ALL SELECT 'EVIDENCE_PUBLIC_LINKS', count(*) filter (where n.has_public_token)::bigint, 'Preserve public-link behaviour during any later migration.', 'NONE', 'NO_CHANGE', 'HIGH', 'Invoices with a public token; token values are not returned.' FROM null_workspace_invoices n
  UNION ALL SELECT 'EVIDENCE_OPERATIONAL_ASSIGNMENTS', 0::bigint,
    CASE WHEN s.assignments_table THEN 'Run a separate schema-confirmed aggregate assignment check.' ELSE 'Operational assignments table absent; no child query executed.' END,
    'NONE', CASE WHEN s.assignments_table THEN 'NOT_APPLICABLE' ELSE 'BLOCKED' END, 'MEDIUM',
    'Catalog-gated only: this script never directly queries the optional operational_assignments table.'
  FROM schema_state s
  UNION ALL SELECT 'EVIDENCE_SHARED_REPORTS', 0::bigint,
    CASE WHEN s.shared_reports_table THEN 'Run a separate schema-confirmed aggregate shared-report check.' ELSE 'Shared reports table absent; no child query executed.' END,
    'NONE', CASE WHEN s.shared_reports_table THEN 'NOT_APPLICABLE' ELSE 'BLOCKED' END, 'MEDIUM',
    'Catalog-gated only: this script never directly queries the optional shared_reports table.'
  FROM schema_state s
), summary_rows AS (
  SELECT 'TOTAL_NULL_WORKSPACE_INVOICES' AS classification, count(*)::bigint AS invoice_count,
    'Classify before any write SQL.', 'NONE' AS confidence,
    CASE WHEN count(*)=0 THEN 'NO_CHANGE' ELSE 'MANUAL_REVIEW' END AS result,
    'HIGH' AS risk, 'Invoices where workspace_id is null.' AS notes
  FROM null_workspace_invoices
  UNION ALL SELECT 'TOTAL_INVOICE_CLIENT_WORKSPACE_MISMATCHES', count(*)::bigint,
    'Resolve source-of-truth conflict before any write SQL.', 'NONE',
    CASE WHEN count(*)=0 THEN 'NO_CHANGE' ELSE 'MANUAL_REVIEW' END, 'HIGH', 'Existing non-null invoice workspace differs from linked client workspace.'
  FROM existing_client_conflicts
  UNION ALL SELECT 'HIGH_CONFIDENCE_AUTO_BACKFILL_CANDIDATES', count(*) filter (where classification in ('CLIENT_AND_USER_AGREE','USER_ONLY_UNIQUE'))::bigint,
    'Eligible only after final aggregate verification.', 'HIGH', 'AUTO_BACKFILL_CANDIDATE', 'MEDIUM', 'Derived from mutually exclusive null-workspace classifications.'
  FROM null_classification
  UNION ALL SELECT 'MANUAL_REVIEW_CANDIDATES', count(*) filter (where classification not in ('CLIENT_AND_USER_AGREE','USER_ONLY_UNIQUE','SCHEMA_BLOCKED'))::bigint,
    'No automatic update.', 'NONE', 'MANUAL_REVIEW', 'HIGH', 'Null-workspace classifications without deterministic ownership.'
  FROM null_classification
  UNION ALL SELECT 'BLOCKED_OR_UNCLASSIFIABLE', count(*) filter (where classification='SCHEMA_BLOCKED')::bigint,
    'Repair or verify schema before classification.', 'NONE', 'BLOCKED', 'HIGH', 'Required schema prerequisites missing.'
  FROM null_classification
  UNION ALL SELECT 'INVOICES_WITH_FINANCIAL_OR_PAYMENT_HISTORY', count(*)::bigint,
    'Preserve proof and payment history during any later migration.', 'NONE', 'NO_CHANGE', 'HIGH', 'Invoices with one or more proof records.'
  FROM proof_evidence WHERE has_payment_proofs
  UNION ALL SELECT 'INVOICES_WITH_PUBLIC_TOKENS_OR_RECEIPTS', count(*)::bigint,
    'Preserve public-link and receipt behaviour during any later migration.', 'NONE', 'NO_CHANGE', 'HIGH', 'Invoices with a public token or stored receipt token.'
  FROM null_workspace_invoices n LEFT JOIN proof_evidence p ON p.invoice_key=n.invoice_key
  WHERE n.has_public_token OR coalesce(p.has_receipt, false)
  UNION ALL SELECT 'PROPOSED_OWNERSHIP_WOULD_CHANGE_EXISTING_ACCESS', count(*) filter (where classification in ('CLIENT_AND_USER_AGREE','USER_ONLY_UNIQUE'))::bigint,
    'Do not write until role access and public paths are verified.', 'HIGH', 'AUTO_BACKFILL_CANDIDATE', 'HIGH', 'Every proposed assignment would add workspace-member access to a currently null-workspace invoice.'
  FROM null_classification
)
SELECT classification, invoice_count, proposed_action, confidence, result, risk, notes
FROM classification_rows
UNION ALL
SELECT classification, invoice_count, proposed_action, confidence, result, risk, notes FROM conflict_rows
UNION ALL
SELECT classification, invoice_count, proposed_action, confidence, result, risk, notes FROM evidence_rows
UNION ALL
SELECT classification, invoice_count, proposed_action, confidence, result, risk, notes FROM summary_rows
ORDER BY classification;

ROLLBACK;
