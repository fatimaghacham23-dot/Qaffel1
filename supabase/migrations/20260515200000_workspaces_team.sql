-- =============================================================================
-- Qaffel Team Operations & Enterprise Readiness
-- Multi-user workspaces, roles, audit, approvals
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) WORKSPACES — core workspace table
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workspaces enable row level security;

-- ---------------------------------------------------------------------------
-- 2) WORKSPACE MEMBERS — team membership with roles
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'staff',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamp with time zone default timezone('utc'::text, now()) not null,
  accepted_at timestamp with time zone,
  status text not null default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint workspace_members_role_check check (role in ('owner','admin','finance','operations','reviewer','staff')),
  constraint workspace_members_status_check check (status in ('pending','active','removed')),
  constraint workspace_members_unique unique (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

create index if not exists workspace_members_workspace_id_idx on public.workspace_members(workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);

-- ---------------------------------------------------------------------------
-- 3) WORKSPACE INVITATIONS — for users who don't have accounts yet
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role text not null default 'staff',
  invited_by uuid references auth.users(id) on delete set null,
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamp with time zone default (timezone('utc'::text, now()) + interval '7 days') not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint workspace_invitations_role_check check (role in ('admin','finance','operations','reviewer','staff'))
);

alter table public.workspace_invitations enable row level security;

create index if not exists workspace_invitations_email_idx on public.workspace_invitations(email);
create index if not exists workspace_invitations_token_idx on public.workspace_invitations(token);

-- ---------------------------------------------------------------------------
-- 4) WORKSPACE APPROVALS — lightweight internal approval workflows
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type text not null,
  reference_id uuid,
  reference_type text,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  note text,
  threshold_usd numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone,
  constraint workspace_approvals_type_check check (type in ('payment_void','high_value_invoice','payment_plan','recovery_escalation')),
  constraint workspace_approvals_status_check check (status in ('pending','approved','rejected'))
);

alter table public.workspace_approvals enable row level security;

create index if not exists workspace_approvals_workspace_id_idx on public.workspace_approvals(workspace_id);
create index if not exists workspace_approvals_status_idx on public.workspace_approvals(status);

-- ---------------------------------------------------------------------------
-- 5) ADD workspace_id TO EXISTING TABLES
-- ---------------------------------------------------------------------------
alter table public.clients add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.invoices add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.payment_methods add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.service_presets add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.invoice_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Audit attribution columns on invoice_events
alter table public.invoice_events add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.invoice_events add column if not exists actor_name text;
alter table public.invoice_events add column if not exists actor_role text;

-- Workspace memory tables
alter table public.client_workspace_notes add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.invoice_workspace_notes add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.workspace_message_templates add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists clients_workspace_id_idx on public.clients(workspace_id);
create index if not exists invoices_workspace_id_idx on public.invoices(workspace_id);
create index if not exists payment_methods_workspace_id_idx on public.payment_methods(workspace_id);
create index if not exists service_presets_workspace_id_idx on public.service_presets(workspace_id);
create index if not exists invoice_events_workspace_id_idx on public.invoice_events(workspace_id);

-- ---------------------------------------------------------------------------
-- 6) BACKFILL: Create a workspace for every existing user, assign data
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  ws_id uuid;
begin
  for r in select id, business_name, full_name from public.profiles loop
    -- Create workspace for each existing user
    insert into public.workspaces (id, name, owner_id)
    values (r.id, coalesce(r.business_name, r.full_name, 'My Workspace'), r.id)
    on conflict (id) do nothing
    returning id into ws_id;

    -- Use user id as workspace id for existing users (simple 1:1 mapping)
    ws_id := r.id;

    -- Add owner as workspace member
    insert into public.workspace_members (workspace_id, user_id, role, status, accepted_at)
    values (ws_id, r.id, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do nothing;

    -- Backfill workspace_id on all owned data
    update public.clients set workspace_id = ws_id where user_id = r.id and workspace_id is null;
    update public.invoices set workspace_id = ws_id where user_id = r.id and workspace_id is null;
    update public.payment_methods set workspace_id = ws_id where user_id = r.id and workspace_id is null;
    update public.service_presets set workspace_id = ws_id where user_id = r.id and workspace_id is null;
    update public.invoice_events set workspace_id = ws_id where user_id = r.id and workspace_id is null;
  end loop;

  -- Backfill workspace memory tables
  update public.client_workspace_notes n
  set workspace_id = c.workspace_id
  from public.clients c
  where n.client_id = c.id and n.workspace_id is null;

  update public.invoice_workspace_notes n
  set workspace_id = i.workspace_id
  from public.invoices i
  where n.invoice_id = i.id and n.workspace_id is null;

  update public.workspace_message_templates t
  set workspace_id = p.id
  from public.profiles p
  where t.user_id = p.id and t.workspace_id is null;
end $$;

-- ---------------------------------------------------------------------------
-- 7) HELPER FUNCTION — workspace membership check
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.get_workspace_role(ws_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- Get all workspace IDs the current user belongs to
create or replace function public.my_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.workspace_members
  where user_id = auth.uid()
    and status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- 8) RLS POLICIES — workspace-based access control
-- ---------------------------------------------------------------------------

-- ---- WORKSPACES ----
drop policy if exists "workspace members can view workspace" on public.workspaces;
create policy "workspace members can view workspace"
  on public.workspaces for select
  using (id in (select public.my_workspace_ids()));

drop policy if exists "owners can update workspace" on public.workspaces;
create policy "owners can update workspace"
  on public.workspaces for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "authenticated users can create workspaces" on public.workspaces;
create policy "authenticated users can create workspaces"
  on public.workspaces for insert
  to authenticated
  with check (owner_id = auth.uid());

-- ---- WORKSPACE MEMBERS ----
drop policy if exists "workspace members can view members" on public.workspace_members;
create policy "workspace members can view members"
  on public.workspace_members for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "admins can manage members" on public.workspace_members;
create policy "admins can manage members"
  on public.workspace_members for all
  using (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin')
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin')
  );

-- ---- WORKSPACE INVITATIONS ----
drop policy if exists "admins can manage invitations" on public.workspace_invitations;
create policy "admins can manage invitations"
  on public.workspace_invitations for all
  using (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin')
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin')
  );

drop policy if exists "invited users can view their invitations" on public.workspace_invitations;
create policy "invited users can view their invitations"
  on public.workspace_invitations for select
  using (email = (select auth.jwt() ->> 'email'));

-- ---- WORKSPACE APPROVALS ----
drop policy if exists "workspace members can view approvals" on public.workspace_approvals;
create policy "workspace members can view approvals"
  on public.workspace_approvals for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "authorized members can manage approvals" on public.workspace_approvals;
create policy "authorized members can manage approvals"
  on public.workspace_approvals for all
  using (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    and public.get_workspace_role(workspace_id) in ('owner', 'admin', 'finance')
  );

-- ---- CLIENTS — upgrade to workspace-based ----
drop policy if exists "clients are managed by owner" on public.clients;
drop policy if exists "clients workspace access" on public.clients;
create policy "clients workspace access"
  on public.clients for all
  using (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id  -- backward compat for un-migrated rows
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  );

-- Keep public portal read policy unchanged
-- "public invoice pages can read invoice client name" already exists

-- ---- INVOICES — upgrade to workspace-based ----
drop policy if exists "invoices are managed by owner" on public.invoices;
drop policy if exists "invoices workspace access" on public.invoices;
create policy "invoices workspace access"
  on public.invoices for all
  using (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  );
-- "public invoice pages can read invoices by token" remains unchanged

-- ---- PAYMENT METHODS — upgrade to workspace-based ----
drop policy if exists "payment methods are managed by owner" on public.payment_methods;
drop policy if exists "payment_methods workspace access" on public.payment_methods;
create policy "payment_methods workspace access"
  on public.payment_methods for all
  using (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  );
-- "public invoice pages can read active payment methods" remains unchanged

-- ---- SERVICE PRESETS — upgrade to workspace-based ----
drop policy if exists "Users can manage their own service presets" on public.service_presets;
drop policy if exists "service_presets workspace access" on public.service_presets;
create policy "service_presets workspace access"
  on public.service_presets for all
  to authenticated
  using (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  )
  with check (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  );

-- ---- INVOICE EVENTS — upgrade to workspace-based ----
drop policy if exists "Users can select their own invoice events" on public.invoice_events;
drop policy if exists "Users can insert their own invoice events" on public.invoice_events;
drop policy if exists "invoice_events workspace read" on public.invoice_events;
drop policy if exists "invoice_events workspace insert" on public.invoice_events;

create policy "invoice_events workspace read"
  on public.invoice_events for select
  using (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  );

create policy "invoice_events workspace insert"
  on public.invoice_events for insert
  to authenticated
  with check (
    workspace_id in (select public.my_workspace_ids())
    or auth.uid() = user_id
  );

-- ---------------------------------------------------------------------------
-- 9) AUTO-CREATE WORKSPACE ON SIGNUP — update trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ws_id uuid;
begin
  -- Create profile
  insert into public.profiles (id, full_name, business_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'business_name'
  )
  on conflict (id) do nothing;

  -- Create default workspace
  ws_id := new.id;  -- use user ID as workspace ID for simplicity
  insert into public.workspaces (id, name, owner_id)
  values (
    ws_id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'My Workspace'
    ),
    new.id
  )
  on conflict (id) do nothing;

  -- Add as owner member
  insert into public.workspace_members (workspace_id, user_id, role, status, accepted_at)
  values (ws_id, new.id, 'owner', 'active', now())
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

-- Trigger already exists, function is replaced in-place
