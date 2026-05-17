-- =============================================================================
-- Qaffel Operational Attention indexes
-- Deterministic attention center support. No persisted notification feed and no
-- automatic communication side effects.
-- =============================================================================

create index if not exists invoice_events_workspace_event_created_idx
  on public.invoice_events(workspace_id, event_type, created_at desc);

create index if not exists invoice_events_workspace_invoice_created_idx
  on public.invoice_events(workspace_id, invoice_id, created_at desc);

create index if not exists invoices_workspace_due_status_idx
  on public.invoices(workspace_id, due_date, status);

create index if not exists invoices_workspace_valid_status_idx
  on public.invoices(workspace_id, valid_until, status);

create index if not exists workspace_approvals_workspace_status_created_idx
  on public.workspace_approvals(workspace_id, status, created_at desc);

create index if not exists payment_proofs_status_uploaded_idx
  on public.payment_proofs(status, uploaded_at desc);

comment on index invoice_events_workspace_event_created_idx is
  'Supports deterministic attention queries for reminders, assignments, proof review, and continuity events.';

comment on index payment_proofs_status_uploaded_idx is
  'Supports pending proof aging without creating a persisted notification feed.';

