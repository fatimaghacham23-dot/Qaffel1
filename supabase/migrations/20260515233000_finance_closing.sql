-- =============================================================================
-- Qaffel Finance Closing & Accountant Operations Layer
-- Operational close tracking only. This is not an accounting ledger or ERP.
-- =============================================================================

create table if not exists public.finance_close_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  period_month text not null,
  status text not null default 'draft',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  signed_off_by uuid references auth.users(id) on delete set null,
  signed_off_by_name text,
  signed_off_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint finance_close_periods_month_check check (period_month ~ '^\d{4}-\d{2}$'),
  constraint finance_close_periods_status_check check (status in ('draft','in_review','signed_off','reopened')),
  constraint finance_close_periods_unique unique (workspace_id, period_month)
);

create table if not exists public.finance_close_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  period_month text not null,
  task_key text not null,
  status text not null default 'open',
  note text,
  completed_by uuid references auth.users(id) on delete set null,
  completed_by_name text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint finance_close_tasks_month_check check (period_month ~ '^\d{4}-\d{2}$'),
  constraint finance_close_tasks_key_check check (
    task_key in (
      'unresolved_invoices',
      'pending_proofs',
      'stale_recoveries',
      'overdue_balances',
      'payment_plans',
      'void_verification',
      'approval_review',
      'export_package'
    )
  ),
  constraint finance_close_tasks_status_check check (status in ('open','completed','skipped')),
  constraint finance_close_tasks_unique unique (workspace_id, period_month, task_key)
);

create table if not exists public.finance_export_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  period_month text,
  export_type text not null,
  title text not null,
  row_count integer not null default 0,
  generated_by uuid references auth.users(id) on delete set null,
  generated_by_name text,
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint finance_export_runs_month_check check (period_month is null or period_month ~ '^\d{4}-\d{2}$'),
  constraint finance_export_runs_count_check check (row_count >= 0)
);

create index if not exists finance_close_periods_workspace_month_idx
  on public.finance_close_periods(workspace_id, period_month desc);

create index if not exists finance_close_tasks_workspace_month_idx
  on public.finance_close_tasks(workspace_id, period_month, status);

create index if not exists finance_export_runs_workspace_generated_idx
  on public.finance_export_runs(workspace_id, generated_at desc);

alter table public.finance_close_periods enable row level security;
alter table public.finance_close_tasks enable row level security;
alter table public.finance_export_runs enable row level security;

drop policy if exists "workspace members can view finance close periods" on public.finance_close_periods;
create policy "workspace members can view finance close periods"
  on public.finance_close_periods for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "finance roles can manage finance close periods" on public.finance_close_periods;
create policy "finance roles can manage finance close periods"
  on public.finance_close_periods for all
  to authenticated
  using (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  );

drop policy if exists "workspace members can view finance close tasks" on public.finance_close_tasks;
create policy "workspace members can view finance close tasks"
  on public.finance_close_tasks for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "finance roles can manage finance close tasks" on public.finance_close_tasks;
create policy "finance roles can manage finance close tasks"
  on public.finance_close_tasks for all
  to authenticated
  using (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  );

drop policy if exists "workspace members can view finance export runs" on public.finance_export_runs;
create policy "workspace members can view finance export runs"
  on public.finance_export_runs for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "finance roles can record finance export runs" on public.finance_export_runs;
create policy "finance roles can record finance export runs"
  on public.finance_export_runs for insert
  to authenticated
  with check (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  );

comment on table public.finance_close_periods is
  'Operational month-end close signoff state. Not an accounting ledger or tax record.';

comment on table public.finance_close_tasks is
  'Operational close checklist task state for finance review continuity.';

comment on table public.finance_export_runs is
  'Manual export generation history for finance operational traceability.';

