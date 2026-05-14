-- =============================================================================
-- Qaffel schema reconciliation (idempotent)
-- Run after: partial / out-of-order applies, or "schema cache" column drift.
-- Safe: additive columns, constraint widen, CREATE OR REPLACE / DROP+CREATE RPCs.
-- Does NOT: delete data rows, change payment amounts, remove legacy migrations.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) payment_proofs — columns (AI review, void, amounts, receipt)
-- ---------------------------------------------------------------------------
alter table public.payment_proofs
  add column if not exists amount_usd numeric,
  add column if not exists amount_lbp numeric,
  add column if not exists payment_date date,
  add column if not exists receipt_token text,
  add column if not exists voided_at timestamp with time zone,
  add column if not exists void_reason text,
  add column if not exists ai_review_json jsonb,
  add column if not exists ai_review_summary text,
  add column if not exists reviewer_decision_note text,
  add column if not exists ai_analyzed_at timestamp with time zone,
  add column if not exists ai_image_fingerprint text;

-- Allow voided proofs (app sets status = 'voided'); widen legacy check constraint.
alter table public.payment_proofs drop constraint if exists payment_proofs_status_check;

do $c$
begin
  alter table public.payment_proofs
    add constraint payment_proofs_status_check
    check (status = any (array['pending'::text, 'accepted'::text, 'rejected'::text, 'voided'::text]));
exception
  when duplicate_object then null;
end $c$;

update public.payment_proofs
set receipt_token = encode(gen_random_bytes(24), 'hex')
where receipt_token is null;

create unique index if not exists payment_proofs_receipt_token_idx
on public.payment_proofs(receipt_token);

-- ---------------------------------------------------------------------------
-- 2) clients — portal token
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists client_portal_token text;

update public.clients
set client_portal_token = encode(gen_random_bytes(24), 'hex')
where client_portal_token is null;

create unique index if not exists clients_client_portal_token_idx
on public.clients(client_portal_token);

-- ---------------------------------------------------------------------------
-- 3) invoices — validity, approval, deposit, quotes, payment plan
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists valid_until timestamp with time zone,
  add column if not exists exchange_rate_lbp_per_usd numeric,
  add column if not exists rate_note text,
  add column if not exists approval_status text default 'not_required',
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approved_by_name text,
  add column if not exists approved_note text,
  add column if not exists deposit_enabled boolean default false not null,
  add column if not exists deposit_type text,
  add column if not exists deposit_percent numeric,
  add column if not exists deposit_amount_usd numeric,
  add column if not exists deposit_amount_lbp numeric,
  add column if not exists deposit_note text,
  add column if not exists document_type text default 'invoice' not null,
  add column if not exists payment_plan jsonb;

update public.invoices
set document_type = 'invoice'
where document_type is null;

do $d$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_document_type_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_document_type_check
      check (document_type in ('invoice', 'quote'));
  end if;
end $d$;

do $d$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_approval_status_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_approval_status_check
      check (approval_status in ('not_required', 'pending', 'approved', 'rejected'));
  end if;
end $d$;

create index if not exists invoices_user_document_type_idx
on public.invoices(user_id, document_type);

-- deposit_type check (from deposit migration)
do $d$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_deposit_type_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_deposit_type_check
      check (deposit_type is null or deposit_type in ('percent', 'fixed'));
  end if;
end $d$;

-- ---------------------------------------------------------------------------
-- 4) profiles — defaults + branding
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists business_address text,
  add column if not exists default_currency text default 'USD' not null,
  add column if not exists logo_storage_path text,
  add column if not exists brand_color text default '#116466',
  add column if not exists brand_accent text,
  add column if not exists business_tagline text,
  add column if not exists business_website text,
  add column if not exists instagram_handle text,
  add column if not exists whatsapp_phone text,
  add column if not exists support_email text,
  add column if not exists invoice_footer_note text,
  add column if not exists document_theme text default 'professional',
  add column if not exists business_hours text,
  add column if not exists business_city text;

-- ---------------------------------------------------------------------------
-- 5) payment_methods — Whish / OMT metadata
-- ---------------------------------------------------------------------------
alter table public.payment_methods
  add column if not exists receiver_name text,
  add column if not exists receiver_phone text,
  add column if not exists account_reference text,
  add column if not exists qr_image_path text,
  add column if not exists external_link text;

-- ---------------------------------------------------------------------------
-- 6) invoice_events (recovery / reminders / receipts / portal)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null,
  message text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.invoice_events enable row level security;

create index if not exists invoice_events_invoice_id_idx on public.invoice_events(invoice_id);
create index if not exists invoice_events_user_id_idx on public.invoice_events(user_id);

drop policy if exists "Users can select their own invoice events" on public.invoice_events;
create policy "Users can select their own invoice events"
  on public.invoice_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own invoice events" on public.invoice_events;
create policy "Users can insert their own invoice events"
  on public.invoice_events for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7) service_presets
-- ---------------------------------------------------------------------------
create table if not exists public.service_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  amount_usd numeric,
  amount_lbp numeric,
  currency text default 'USD' not null,
  default_validity_days integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $s$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_presets_currency_check'
      and conrelid = 'public.service_presets'::regclass
  ) then
    alter table public.service_presets
      add constraint service_presets_currency_check
      check (currency in ('USD', 'LBP'));
  end if;
end $s$;

alter table public.service_presets enable row level security;

drop policy if exists "Users can manage their own service presets" on public.service_presets;
create policy "Users can manage their own service presets"
  on public.service_presets
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8) Storage — payment-proofs private + business-brand bucket
-- ---------------------------------------------------------------------------
update storage.buckets
set public = false
where id = 'payment-proofs';

drop policy if exists "anyone can upload payment proof files" on storage.objects;
drop policy if exists "anyone can read payment proof files" on storage.objects;
drop policy if exists "public can upload payment proof files" on storage.objects;
drop policy if exists "owners can read their payment proof files" on storage.objects;

create policy "public can upload payment proof files"
on storage.objects
for insert
with check (bucket_id = 'payment-proofs');

create policy "owners can read their payment proof files"
on storage.objects
for select
using (
  bucket_id = 'payment-proofs'
  and (
    exists (
      select 1 from public.invoices
      where invoices.id::text = (storage.foldername(name))[1]
      and invoices.user_id = auth.uid()
    )
  )
);

insert into storage.buckets (id, name, public)
values ('business-brand', 'business-brand', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Owners upload business brand files" on storage.objects;
create policy "Owners upload business brand files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners update business brand files" on storage.objects;
create policy "Owners update business brand files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners delete business brand files" on storage.objects;
create policy "Owners delete business brand files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners read own business brand files" on storage.objects;
create policy "Owners read own business brand files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public read logo path on profile" on storage.objects;
create policy "Public read logo path on profile"
on storage.objects
for select
using (
  bucket_id = 'business-brand'
  and exists (
    select 1
    from public.profiles pr
    where pr.logo_storage_path = name
      and exists (
        select 1 from public.invoices i
        where i.user_id = pr.id
          and i.public_token is not null
      )
  )
);

-- Public proof upload only for invoice documents (quote migration)
drop policy if exists "public can upload invoice proofs" on public.payment_proofs;
create policy "public can upload invoice proofs"
on public.payment_proofs
for insert
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = payment_proofs.invoice_id
    and invoices.public_token is not null
    and invoices.document_type = 'invoice'
  )
);

-- ---------------------------------------------------------------------------
-- 9) RPCs — drop where return shape changed, then recreate (latest codebase)
-- ---------------------------------------------------------------------------

drop function if exists public.get_public_client_portal_header(text);
drop function if exists public.get_public_client_portal_invoices(text);
drop function if exists public.get_public_client_portal_activity(text);
drop function if exists public.get_public_receipt_data(text);

create or replace function public.get_public_payment_history_by_token(p_token text)
returns table (
  amount_usd numeric,
  amount_lbp numeric,
  payment_date date,
  method text,
  note text,
  uploaded_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  return query
  select
    p.amount_usd,
    p.amount_lbp,
    p.payment_date,
    p.method,
    p.note,
    p.uploaded_at
  from public.payment_proofs p
  join public.invoices i on p.invoice_id = i.id
  where i.public_token = p_token
    and p.status = 'accepted'
  order by p.payment_date desc nulls last, p.uploaded_at desc;
end;
$fn$;

grant execute on function public.get_public_payment_history_by_token(text) to anon, authenticated;

create or replace function public.approve_invoice_by_token(
  p_token text,
  p_approved_by_name text,
  p_approved_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invoice_id uuid;
begin
  update public.invoices
  set
    approval_status = 'approved',
    approved_at = now(),
    approved_by_name = nullif(trim(p_approved_by_name), ''),
    approved_note = nullif(trim(p_approved_note), '')
  where public_token = p_token
    and approval_status = 'pending'
  returning id into v_invoice_id;

  if v_invoice_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Invoice not found or approval is no longer pending.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Invoice approved.'
  );
end;
$fn$;

create or replace function public.reject_invoice_by_token(
  p_token text,
  p_rejected_by_name text,
  p_rejected_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invoice_id uuid;
begin
  update public.invoices
  set
    approval_status = 'rejected',
    approved_at = now(),
    approved_by_name = nullif(trim(p_rejected_by_name), ''),
    approved_note = nullif(trim(p_rejected_note), '')
  where public_token = p_token
    and approval_status = 'pending'
  returning id into v_invoice_id;

  if v_invoice_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Invoice not found or approval is no longer pending.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Invoice rejected.'
  );
end;
$fn$;

grant execute on function public.approve_invoice_by_token(text, text, text) to anon, authenticated;
grant execute on function public.reject_invoice_by_token(text, text, text) to anon, authenticated;

create or replace function public.record_receipt_view(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invoice_id uuid;
  v_user_id uuid;
  v_receipt_number text;
  v_recent_exists boolean;
begin
  select
    i.id,
    i.user_id,
    'RCP-' || to_char(coalesce(p.confirmed_at, p.uploaded_at), 'YYYYMMDD') || '-' || upper(left(p.receipt_token, 4))
  into v_invoice_id, v_user_id, v_receipt_number
  from public.payment_proofs p
  join public.invoices i on p.invoice_id = i.id
  where p.receipt_token = p_token
  limit 1;

  if v_invoice_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.invoice_events e
    where e.invoice_id = v_invoice_id
      and e.event_type = 'receipt_viewed'
      and coalesce(e.metadata ->> 'receipt_token', '') = left(p_token, 6)
      and e.created_at >= now() - interval '24 hours'
  )
  into v_recent_exists;

  if v_recent_exists then
    return;
  end if;

  insert into public.invoice_events (invoice_id, user_id, event_type, message, metadata)
  values (
    v_invoice_id,
    v_user_id,
    'receipt_viewed',
    'Payment receipt viewed: ' || v_receipt_number,
    jsonb_build_object('receipt_token', left(p_token, 6))
  );
end;
$fn$;

grant execute on function public.record_receipt_view(text) to anon, authenticated;

create or replace function public.get_public_receipt_data(p_token text)
returns table (
  receipt_number text,
  business_name text,
  client_name text,
  invoice_number text,
  invoice_title text,
  payment_date date,
  confirmed_at timestamp with time zone,
  amount_usd numeric,
  amount_lbp numeric,
  method text,
  note text,
  status text,
  invoice_public_token text,
  void_reason text,
  business_tagline text,
  brand_color text,
  brand_accent text,
  document_theme text,
  logo_storage_path text,
  support_email text,
  business_website text,
  instagram_handle text,
  whatsapp_phone text,
  business_hours text,
  business_city text,
  invoice_footer_note text
)
language sql
security definer
set search_path = public
as $fn$
  select
    'RCP-' || to_char(coalesce(p.confirmed_at, p.uploaded_at), 'YYYYMMDD') || '-' || upper(left(p.receipt_token, 4)) as receipt_number,
    prof.business_name,
    c.name as client_name,
    i.invoice_number,
    i.title as invoice_title,
    p.payment_date,
    p.confirmed_at,
    p.amount_usd,
    p.amount_lbp,
    p.method,
    p.note,
    p.status,
    i.public_token as invoice_public_token,
    p.void_reason as void_reason,
    prof.business_tagline,
    prof.brand_color,
    prof.brand_accent,
    prof.document_theme,
    prof.logo_storage_path,
    prof.support_email,
    prof.business_website,
    prof.instagram_handle,
    prof.whatsapp_phone,
    prof.business_hours,
    prof.business_city,
    prof.invoice_footer_note
  from public.payment_proofs p
  join public.invoices i on p.invoice_id = i.id
  join public.profiles prof on i.user_id = prof.id
  left join public.clients c on i.client_id = c.id
  where p.receipt_token = p_token
  limit 1;
$fn$;

grant execute on function public.get_public_receipt_data(text) to anon, authenticated;

create or replace function public.get_public_client_portal_header(p_token text)
returns table (
  client_name text,
  business_name text,
  full_name text,
  business_phone text,
  business_tagline text,
  brand_color text,
  brand_accent text,
  document_theme text,
  logo_storage_path text,
  support_email text,
  business_website text,
  instagram_handle text,
  whatsapp_phone text,
  business_hours text,
  business_city text,
  invoice_footer_note text
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  return query
  select
    c.name as client_name,
    p.business_name,
    p.full_name,
    p.phone as business_phone,
    p.business_tagline,
    p.brand_color,
    p.brand_accent,
    p.document_theme,
    p.logo_storage_path,
    p.support_email,
    p.business_website,
    p.instagram_handle,
    p.whatsapp_phone,
    p.business_hours,
    p.business_city,
    p.invoice_footer_note
  from public.clients c
  join public.profiles p on p.id = c.user_id
  where c.client_portal_token = p_token
  limit 1;
end;
$fn$;

grant execute on function public.get_public_client_portal_header(text) to anon, authenticated;

create or replace function public.get_public_client_portal_invoices(p_token text)
returns table (
  public_token text,
  invoice_number text,
  title text,
  status text,
  document_type text,
  approval_status text,
  currency text,
  amount_usd numeric,
  amount_lbp numeric,
  due_date date,
  created_at timestamp with time zone,
  paid_usd numeric,
  paid_lbp numeric
)
language sql
security definer
set search_path = public
as $fn$
  select
    i.public_token,
    i.invoice_number,
    i.title,
    i.status,
    i.document_type,
    i.approval_status,
    i.currency,
    i.amount_usd,
    i.amount_lbp,
    i.due_date,
    i.created_at,
    coalesce((select sum(p2.amount_usd) from public.payment_proofs p2 where p2.invoice_id = i.id and p2.status = 'accepted'), 0) as paid_usd,
    coalesce((select sum(p2.amount_lbp) from public.payment_proofs p2 where p2.invoice_id = i.id and p2.status = 'accepted'), 0) as paid_lbp
  from public.clients c
  join public.invoices i on i.client_id = c.id
  where c.client_portal_token = p_token
  order by i.created_at desc;
$fn$;

grant execute on function public.get_public_client_portal_invoices(text) to anon, authenticated;

create or replace function public.get_public_client_portal_payments(p_token text)
returns table (
  invoice_public_token text,
  invoice_number text,
  invoice_title text,
  amount_usd numeric,
  amount_lbp numeric,
  payment_date date,
  method text,
  note text,
  uploaded_at timestamp with time zone,
  receipt_token text
)
language sql
security definer
set search_path = public
as $fn$
  select
    i.public_token as invoice_public_token,
    i.invoice_number,
    i.title as invoice_title,
    p.amount_usd,
    p.amount_lbp,
    p.payment_date,
    p.method,
    p.note,
    p.uploaded_at,
    p.receipt_token
  from public.clients c
  join public.invoices i on i.client_id = c.id
  join public.payment_proofs p on p.invoice_id = i.id
  where c.client_portal_token = p_token
    and p.status = 'accepted'
  order by p.payment_date desc nulls last, p.uploaded_at desc;
$fn$;

grant execute on function public.get_public_client_portal_payments(text) to anon, authenticated;

create or replace function public.get_public_client_portal_activity(p_token text)
returns table (
  created_at timestamp with time zone,
  event_type text,
  message text,
  invoice_public_token text,
  invoice_number text,
  document_type text
)
language sql
security definer
set search_path = public
as $fn$
  select
    e.created_at,
    e.event_type,
    e.message,
    i.public_token as invoice_public_token,
    i.invoice_number,
    i.document_type
  from public.clients c
  join public.invoices i on i.client_id = c.id
  join public.invoice_events e on e.invoice_id = i.id
  where c.client_portal_token = p_token
    and e.event_type in (
      'invoice_created',
      'quote_created',
      'quote_converted',
      'manual_payment',
      'proof_uploaded',
      'reminder_copied',
      'invoice_validity_extended',
      'client_approved',
      'client_rejected'
    )
  order by e.created_at desc
  limit 25;
$fn$;

grant execute on function public.get_public_client_portal_activity(text) to anon, authenticated;

create or replace function public.record_client_portal_view(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invoice_id uuid;
  v_user_id uuid;
begin
  select i.id, i.user_id
  into v_invoice_id, v_user_id
  from public.clients c
  join public.invoices i on i.client_id = c.id
  where c.client_portal_token = p_token
  order by i.created_at desc
  limit 1;

  if v_invoice_id is null then
    return;
  end if;

  insert into public.invoice_events (invoice_id, user_id, event_type, message, metadata)
  values (
    v_invoice_id,
    v_user_id,
    'client_portal_viewed',
    'Client portal viewed',
    jsonb_build_object('client_portal_token', left(p_token, 6))
  );
end;
$fn$;

grant execute on function public.record_client_portal_view(text) to anon, authenticated;

create or replace function public.get_public_merchant_proof_review_stats(p_public_invoice_token text)
returns table (median_hours numeric, sample_count bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  with biz as (
    select i.user_id
    from public.invoices i
    where i.public_token = p_public_invoice_token
      and i.public_token is not null
    limit 1
  ),
  samples as (
    select extract(epoch from (p.confirmed_at - p.uploaded_at)) / 3600.0 as hrs
    from public.payment_proofs p
    join public.invoices i on i.id = p.invoice_id
    join biz b on b.user_id = i.user_id
    where p.status = 'accepted'
      and p.confirmed_at is not null
      and p.uploaded_at is not null
      and p.confirmed_at >= p.uploaded_at
  )
  select
    (select percentile_disc(0.5) within group (order by hrs) from samples)::numeric as median_hours,
    (select count(*) from samples)::bigint as sample_count;
$fn$;

grant execute on function public.get_public_merchant_proof_review_stats(text) to anon, authenticated;

-- Optional one-time cleanup (idempotent after first run) — from 20260513092000
with ranked as (
  select
    id,
    row_number() over (
      partition by
        invoice_id,
        coalesce(metadata->>'receipt_token', ''),
        date_trunc('day', created_at)
      order by created_at asc, id asc
    ) as rn
  from public.invoice_events
  where event_type = 'receipt_viewed'
)
delete from public.invoice_events e
using ranked r
where e.id = r.id
  and r.rn > 1;
