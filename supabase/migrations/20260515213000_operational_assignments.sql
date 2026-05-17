-- =============================================================================
-- Qaffel Operational Collaboration & Assignment System
-- Workspace-scoped, internal-only ownership layer.
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) OPERATIONAL ASSIGNMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.operational_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  target_type text not null,
  target_id uuid not null,
  assignment_type text not null,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  assigned_to_role text,
  assigned_by uuid references auth.users(id) on delete set null,
  status text not null default 'open',
  priority text not null default 'normal',
  due_at timestamp with time zone,
  context text,
  last_action_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint operational_assignments_target_type_check
    check (target_type in ('invoice','proof','recovery','approval','payment_plan','client_follow_up')),
  constraint operational_assignments_assignment_type_check
    check (assignment_type in ('reviewer','recovery_owner','finance_owner','operations_owner','follow_up_owner','approval_owner','payment_plan_owner')),
  constraint operational_assignments_status_check
    check (status in ('open','in_progress','waiting','completed','cancelled')),
  constraint operational_assignments_priority_check
    check (priority in ('low','normal','high','urgent')),
  constraint operational_assignments_assignee_check
    check (assigned_to_user_id is not null or assigned_to_role is not null)
);

create index if not exists operational_assignments_workspace_idx
  on public.operational_assignments(workspace_id);

create index if not exists operational_assignments_target_idx
  on public.operational_assignments(workspace_id, target_type, target_id);

create index if not exists operational_assignments_user_queue_idx
  on public.operational_assignments(workspace_id, assigned_to_user_id, status, due_at);

create index if not exists operational_assignments_role_queue_idx
  on public.operational_assignments(workspace_id, assigned_to_role, status, due_at);

create index if not exists operational_assignments_status_age_idx
  on public.operational_assignments(workspace_id, status, last_action_at);

create unique index if not exists operational_assignments_open_unique_idx
  on public.operational_assignments(workspace_id, target_type, target_id, assignment_type)
  where status in ('open', 'in_progress', 'waiting');

alter table public.operational_assignments enable row level security;

drop policy if exists "workspace members can view operational assignments" on public.operational_assignments;
create policy "workspace members can view operational assignments"
  on public.operational_assignments for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "workspace members can create operational assignments" on public.operational_assignments;
create policy "workspace members can create operational assignments"
  on public.operational_assignments for insert
  to authenticated
  with check (
    workspace_id in (select public.my_workspace_ids())
    and (
      assigned_to_user_id is null
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = operational_assignments.workspace_id
          and wm.user_id = operational_assignments.assigned_to_user_id
          and wm.status = 'active'
      )
    )
  );

drop policy if exists "workspace members can update operational assignments" on public.operational_assignments;
create policy "workspace members can update operational assignments"
  on public.operational_assignments for update
  using (workspace_id in (select public.my_workspace_ids()))
  with check (
    workspace_id in (select public.my_workspace_ids())
    and (
      assigned_to_user_id is null
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = operational_assignments.workspace_id
          and wm.user_id = operational_assignments.assigned_to_user_id
          and wm.status = 'active'
      )
    )
  );

drop policy if exists "admins can delete operational assignments" on public.operational_assignments;
create policy "admins can delete operational assignments"
  on public.operational_assignments for delete
  using (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin')
  );

-- ---------------------------------------------------------------------------
-- 2) ASSIGNMENT NOTES
-- ---------------------------------------------------------------------------
create table if not exists public.assignment_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  assignment_id uuid references public.operational_assignments(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete set null,
  note_type text not null default 'assignment',
  body text not null,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(body, ''))) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint assignment_notes_note_type_check
    check (note_type in ('assignment','handoff','finance','recovery','context'))
);

create index if not exists assignment_notes_workspace_idx
  on public.assignment_notes(workspace_id, created_at desc);

create index if not exists assignment_notes_assignment_idx
  on public.assignment_notes(assignment_id, created_at desc);

create index if not exists assignment_notes_search_idx
  on public.assignment_notes using gin(search_vector);

alter table public.assignment_notes enable row level security;

drop policy if exists "workspace members can view assignment notes" on public.assignment_notes;
create policy "workspace members can view assignment notes"
  on public.assignment_notes for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "workspace members can create assignment notes" on public.assignment_notes;
create policy "workspace members can create assignment notes"
  on public.assignment_notes for insert
  to authenticated
  with check (
    workspace_id in (select public.my_workspace_ids())
    and exists (
      select 1
      from public.operational_assignments oa
      where oa.id = assignment_notes.assignment_id
        and oa.workspace_id = assignment_notes.workspace_id
    )
  );

drop policy if exists "authors and admins can update assignment notes" on public.assignment_notes;
create policy "authors and admins can update assignment notes"
  on public.assignment_notes for update
  using (
    workspace_id in (select public.my_workspace_ids())
    and (author_id = auth.uid() or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and (author_id = auth.uid() or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  );

drop policy if exists "authors and admins can delete assignment notes" on public.assignment_notes;
create policy "authors and admins can delete assignment notes"
  on public.assignment_notes for delete
  using (
    workspace_id in (select public.my_workspace_ids())
    and (author_id = auth.uid() or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  );

-- ---------------------------------------------------------------------------
-- 3) PROOF REVIEW ATTRIBUTION
-- ---------------------------------------------------------------------------
alter table public.payment_proofs
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists reviewer_name text,
  add column if not exists reviewer_role text;

create index if not exists payment_proofs_reviewed_by_idx
  on public.payment_proofs(reviewed_by);

create index if not exists payment_proofs_reviewed_at_idx
  on public.payment_proofs(reviewed_at);

-- Team members need proof queues through invoice workspace membership.
-- Public proof upload policy remains unchanged.
drop policy if exists "payment proofs are managed by owner" on public.payment_proofs;
drop policy if exists "workspace members can view payment proofs" on public.payment_proofs;
create policy "workspace members can view payment proofs"
  on public.payment_proofs for select
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = payment_proofs.invoice_id
        and (
          i.workspace_id in (select public.my_workspace_ids())
          or i.user_id = auth.uid()
        )
    )
  );

drop policy if exists "workspace reviewers can update payment proofs" on public.payment_proofs;
create policy "workspace reviewers can update payment proofs"
  on public.payment_proofs for update
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = payment_proofs.invoice_id
        and (
          i.workspace_id in (select public.my_workspace_ids())
          or i.user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = payment_proofs.invoice_id
        and (
          i.workspace_id in (select public.my_workspace_ids())
          or i.user_id = auth.uid()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) WORKSPACE MEMORY: operational note categories + workspace access
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'invoice_workspace_notes_category_check'
      and conrelid = 'public.invoice_workspace_notes'::regclass
  ) then
    alter table public.invoice_workspace_notes drop constraint invoice_workspace_notes_category_check;
  end if;

  alter table public.invoice_workspace_notes
    add constraint invoice_workspace_notes_category_check
    check (category in ('project','delivery','revision','milestone','handoff','assignment','finance','recovery','operational','general'));
end $$;

create index if not exists client_workspace_notes_workspace_idx
  on public.client_workspace_notes(workspace_id, created_at desc);

create index if not exists invoice_workspace_notes_workspace_idx
  on public.invoice_workspace_notes(workspace_id, created_at desc);

drop policy if exists "client_workspace_notes_select_workspace" on public.client_workspace_notes;
create policy "client_workspace_notes_select_workspace"
  on public.client_workspace_notes for select
  using (workspace_id in (select public.my_workspace_ids()) or auth.uid() = user_id);

drop policy if exists "client_workspace_notes_insert_workspace" on public.client_workspace_notes;
create policy "client_workspace_notes_insert_workspace"
  on public.client_workspace_notes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and workspace_id in (select public.my_workspace_ids())
    and exists (
      select 1
      from public.clients c
      where c.id = client_id
        and (c.workspace_id = client_workspace_notes.workspace_id or c.user_id = auth.uid())
    )
  );

drop policy if exists "client_workspace_notes_update_workspace" on public.client_workspace_notes;
create policy "client_workspace_notes_update_workspace"
  on public.client_workspace_notes for update
  using (
    workspace_id in (select public.my_workspace_ids())
    and (auth.uid() = user_id or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and (auth.uid() = user_id or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  );

drop policy if exists "invoice_workspace_notes_select_workspace" on public.invoice_workspace_notes;
create policy "invoice_workspace_notes_select_workspace"
  on public.invoice_workspace_notes for select
  using (workspace_id in (select public.my_workspace_ids()) or auth.uid() = user_id);

drop policy if exists "invoice_workspace_notes_insert_workspace" on public.invoice_workspace_notes;
create policy "invoice_workspace_notes_insert_workspace"
  on public.invoice_workspace_notes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and workspace_id in (select public.my_workspace_ids())
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and (i.workspace_id = invoice_workspace_notes.workspace_id or i.user_id = auth.uid())
    )
  );

drop policy if exists "invoice_workspace_notes_update_workspace" on public.invoice_workspace_notes;
create policy "invoice_workspace_notes_update_workspace"
  on public.invoice_workspace_notes for update
  using (
    workspace_id in (select public.my_workspace_ids())
    and (auth.uid() = user_id or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and (auth.uid() = user_id or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  );

-- Members need names/initials for calm ownership indicators.
drop policy if exists "workspace members can view member profiles" on public.profiles;
create policy "workspace members can view member profiles"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = profiles.id
        and wm.status = 'active'
        and wm.workspace_id in (select public.my_workspace_ids())
    )
  );
