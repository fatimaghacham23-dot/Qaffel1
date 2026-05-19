-- =============================================================================
-- Qaffel Workspace Billing Foundation
-- Subscription-ready workspace ownership, authority, safety, and audit.
-- No payment collection or checkout integration.
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) SUBSCRIPTIONS - one lifecycle row per workspace
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan_key text not null default 'solo',
  status text not null default 'trial',
  billing_owner_id uuid references auth.users(id) on delete set null,
  trial_started_at timestamp with time zone default timezone('utc'::text, now()),
  trial_ends_at timestamp with time zone,
  current_period_started_at timestamp with time zone,
  current_period_ends_at timestamp with time zone,
  grace_period_ends_at timestamp with time zone,
  paused_at timestamp with time zone,
  canceled_at timestamp with time zone,
  archived_at timestamp with time zone,
  read_only_at timestamp with time zone,
  seat_limit integer,
  feature_overrides jsonb not null default '{}'::jsonb,
  status_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint workspace_subscriptions_plan_key_present check (length(trim(plan_key)) > 0),
  constraint workspace_subscriptions_status_check check (
    status in ('trial', 'active', 'grace_period', 'past_due', 'paused', 'canceled', 'archived')
  ),
  constraint workspace_subscriptions_seat_limit_positive check (seat_limit is null or seat_limit > 0)
);

alter table public.workspace_subscriptions enable row level security;

create index if not exists workspace_subscriptions_status_idx on public.workspace_subscriptions(status);
create index if not exists workspace_subscriptions_plan_key_idx on public.workspace_subscriptions(plan_key);
create index if not exists workspace_subscriptions_billing_owner_idx on public.workspace_subscriptions(billing_owner_id);

-- ---------------------------------------------------------------------------
-- 2) BILLING ADMINS - explicit billing authority separate from ops roles
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_billing_admins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  removed_at timestamp with time zone,
  status text not null default 'active',
  constraint workspace_billing_admins_status_check check (status in ('active', 'removed')),
  constraint workspace_billing_admins_unique unique (workspace_id, user_id)
);

alter table public.workspace_billing_admins enable row level security;

create index if not exists workspace_billing_admins_workspace_idx on public.workspace_billing_admins(workspace_id);
create index if not exists workspace_billing_admins_user_idx on public.workspace_billing_admins(user_id);
create index if not exists workspace_billing_admins_status_idx on public.workspace_billing_admins(status);

-- ---------------------------------------------------------------------------
-- 3) BILLING AUDIT EVENTS - immutable billing/accountability log
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_billing_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_state jsonb,
  next_state jsonb,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint workspace_billing_audit_event_type_present check (length(trim(event_type)) > 0)
);

alter table public.workspace_billing_audit_events enable row level security;

create index if not exists workspace_billing_audit_workspace_created_idx
  on public.workspace_billing_audit_events(workspace_id, created_at desc);
create index if not exists workspace_billing_audit_event_type_idx
  on public.workspace_billing_audit_events(event_type);

-- ---------------------------------------------------------------------------
-- 4) BACKFILL - create safe default subscription rows
-- ---------------------------------------------------------------------------
insert into public.workspace_subscriptions (
  workspace_id,
  billing_owner_id,
  plan_key,
  status,
  trial_started_at,
  trial_ends_at
)
select
  w.id,
  w.owner_id,
  'solo',
  'trial',
  timezone('utc'::text, now()),
  timezone('utc'::text, now()) + interval '30 days'
from public.workspaces w
on conflict (workspace_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) AUTHORITY HELPERS
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_billing_operator(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    left join public.workspace_subscriptions s on s.workspace_id = w.id
    where w.id = ws_id
      and (
        w.owner_id = auth.uid()
        or (
          exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = ws_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
          and (
            s.billing_owner_id = auth.uid()
            or exists (
              select 1
              from public.workspace_billing_admins ba
              where ba.workspace_id = ws_id
                and ba.user_id = auth.uid()
                and ba.status = 'active'
            )
          )
        )
      )
  );
$$;

create or replace function public.can_view_workspace_billing(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and (
        wm.role in ('owner', 'admin', 'finance')
        or public.is_workspace_billing_operator(ws_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 6) RLS POLICIES
-- ---------------------------------------------------------------------------
drop policy if exists "billing viewers can read subscriptions" on public.workspace_subscriptions;
create policy "billing viewers can read subscriptions"
  on public.workspace_subscriptions for select
  using (public.can_view_workspace_billing(workspace_id));

drop policy if exists "billing operators can insert subscriptions" on public.workspace_subscriptions;
create policy "billing operators can insert subscriptions"
  on public.workspace_subscriptions for insert
  to authenticated
  with check (public.is_workspace_billing_operator(workspace_id));

drop policy if exists "billing operators can update subscriptions" on public.workspace_subscriptions;
create policy "billing operators can update subscriptions"
  on public.workspace_subscriptions for update
  using (public.is_workspace_billing_operator(workspace_id))
  with check (public.is_workspace_billing_operator(workspace_id));

drop policy if exists "billing viewers can read billing admins" on public.workspace_billing_admins;
create policy "billing viewers can read billing admins"
  on public.workspace_billing_admins for select
  using (public.can_view_workspace_billing(workspace_id));

drop policy if exists "billing operators can manage billing admins" on public.workspace_billing_admins;
drop policy if exists "billing operators can insert billing admins" on public.workspace_billing_admins;
create policy "billing operators can insert billing admins"
  on public.workspace_billing_admins for insert
  to authenticated
  with check (public.is_workspace_billing_operator(workspace_id));

drop policy if exists "billing operators can update billing admins" on public.workspace_billing_admins;
create policy "billing operators can update billing admins"
  on public.workspace_billing_admins for update
  using (public.is_workspace_billing_operator(workspace_id))
  with check (public.is_workspace_billing_operator(workspace_id));

drop policy if exists "billing viewers can read audit events" on public.workspace_billing_audit_events;
create policy "billing viewers can read audit events"
  on public.workspace_billing_audit_events for select
  using (public.can_view_workspace_billing(workspace_id));

drop policy if exists "billing operators can create audit events" on public.workspace_billing_audit_events;
create policy "billing operators can create audit events"
  on public.workspace_billing_audit_events for insert
  to authenticated
  with check (public.is_workspace_billing_operator(workspace_id));

-- No update/delete policies for billing audit events. They are append-only.

-- ---------------------------------------------------------------------------
-- 7) SIGNUP CONTINUITY - add subscription row for future workspaces
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, full_name, business_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'business_name'
  )
  on conflict (id) do nothing;

  ws_id := new.id;
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

  insert into public.workspace_members (workspace_id, user_id, role, status, accepted_at)
  values (ws_id, new.id, 'owner', 'active', now())
  on conflict (workspace_id, user_id) do nothing;

  insert into public.workspace_subscriptions (
    workspace_id,
    billing_owner_id,
    plan_key,
    status,
    trial_started_at,
    trial_ends_at
  )
  values (
    ws_id,
    new.id,
    'solo',
    'trial',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()) + interval '30 days'
  )
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;
