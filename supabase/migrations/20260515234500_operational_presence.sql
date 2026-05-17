-- =============================================================================
-- Qaffel Operational Presence & Live Coordination Layer
-- Ephemeral, workspace-scoped coordination state. This is not chat, typing
-- presence, a social feed, or an automatic notification engine.
-- =============================================================================

create table if not exists public.operational_presence_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_name text,
  user_role text,
  scope text not null,
  presence_key text not null default 'workspace',
  entity_type text,
  entity_id text,
  label text,
  target_href text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint operational_presence_scope_check
    check (scope in ('proofs','recoveries','invoices','exports','finance_close','approvals','assignments')),
  constraint operational_presence_entity_type_check
    check (entity_type is null or entity_type in ('invoice','proof','recovery','approval','export','finance_close','assignment','workspace')),
  constraint operational_presence_user_role_check
    check (user_role is null or user_role in ('owner','admin','finance','operations','reviewer','staff')),
  constraint operational_presence_key_check
    check (length(trim(presence_key)) > 0),
  constraint operational_presence_href_check
    check (target_href is null or left(target_href, 1) = '/'),
  constraint operational_presence_expiry_check
    check (expires_at > last_seen_at)
);

create unique index if not exists operational_presence_sessions_unique_idx
  on public.operational_presence_sessions(workspace_id, user_id, presence_key);

create index if not exists operational_presence_workspace_expiry_idx
  on public.operational_presence_sessions(workspace_id, expires_at desc);

create index if not exists operational_presence_workspace_scope_seen_idx
  on public.operational_presence_sessions(workspace_id, scope, last_seen_at desc);

alter table public.operational_presence_sessions enable row level security;

drop policy if exists "workspace members can view operational presence" on public.operational_presence_sessions;
create policy "workspace members can view operational presence"
  on public.operational_presence_sessions for select
  using (workspace_id in (select public.my_workspace_ids()));

drop policy if exists "members can record their own operational presence" on public.operational_presence_sessions;
create policy "members can record their own operational presence"
  on public.operational_presence_sessions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and workspace_id in (select public.my_workspace_ids())
  );

drop policy if exists "members can update their own operational presence" on public.operational_presence_sessions;
create policy "members can update their own operational presence"
  on public.operational_presence_sessions for update
  using (
    user_id = auth.uid()
    and workspace_id in (select public.my_workspace_ids())
  )
  with check (
    user_id = auth.uid()
    and workspace_id in (select public.my_workspace_ids())
  );

drop policy if exists "members and admins can clear operational presence" on public.operational_presence_sessions;
create policy "members and admins can clear operational presence"
  on public.operational_presence_sessions for delete
  using (
    workspace_id in (select public.my_workspace_ids())
    and (user_id = auth.uid() or public.get_workspace_role(workspace_id) in ('owner', 'admin'))
  );

comment on table public.operational_presence_sessions is
  'Ephemeral workspace-scoped operational coordination state. No chat, typing indicators, or automatic communication side effects.';

comment on index operational_presence_workspace_expiry_idx is
  'Supports bounded presence reads and cleanup of expired operational presence rows.';
