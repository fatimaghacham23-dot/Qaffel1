-- =============================================================================
-- Qaffel Stripe Billing Sync
-- Provider identifiers, webhook idempotency, and invoice history.
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) PROVIDER COLUMNS ON WORKSPACE SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
alter table public.workspace_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_item_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_latest_invoice_id text,
  add column if not exists stripe_cancel_at_period_end boolean not null default false,
  add column if not exists stripe_last_event_id text,
  add column if not exists stripe_synced_at timestamp with time zone;

create unique index if not exists workspace_subscriptions_stripe_customer_uidx
  on public.workspace_subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists workspace_subscriptions_stripe_subscription_uidx
  on public.workspace_subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists workspace_subscriptions_stripe_price_idx
  on public.workspace_subscriptions(stripe_price_id)
  where stripe_price_id is not null;

-- ---------------------------------------------------------------------------
-- 2) STRIPE WEBHOOK EVENT DEDUPE
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  object_id text,
  status text not null default 'processing',
  received_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processed_at timestamp with time zone,
  error_message text,
  constraint stripe_webhook_events_status_check check (status in ('processing', 'succeeded', 'failed', 'skipped'))
);

alter table public.stripe_webhook_events enable row level security;

create index if not exists stripe_webhook_events_type_received_idx
  on public.stripe_webhook_events(event_type, received_at desc);

drop policy if exists "stripe webhook events are service role only" on public.stripe_webhook_events;
-- No regular user policies. Webhook processing uses the service role.

-- ---------------------------------------------------------------------------
-- 3) BILLING INVOICE HISTORY
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_billing_invoices (
  stripe_invoice_id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  collection_method text,
  currency text,
  amount_due integer,
  amount_paid integer,
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  invoice_created_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workspace_billing_invoices enable row level security;

create index if not exists workspace_billing_invoices_workspace_created_idx
  on public.workspace_billing_invoices(workspace_id, invoice_created_at desc);

create index if not exists workspace_billing_invoices_subscription_idx
  on public.workspace_billing_invoices(stripe_subscription_id)
  where stripe_subscription_id is not null;

drop policy if exists "billing viewers can read billing invoices" on public.workspace_billing_invoices;
create policy "billing viewers can read billing invoices"
  on public.workspace_billing_invoices for select
  using (public.can_view_workspace_billing(workspace_id));

