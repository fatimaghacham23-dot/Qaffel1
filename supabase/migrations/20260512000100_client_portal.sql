-- Client Portal Token + Public RPCs

alter table public.clients
add column if not exists client_portal_token text;

-- Backfill existing clients
update public.clients
set client_portal_token = encode(gen_random_bytes(24), 'hex')
where client_portal_token is null;

-- Enforce uniqueness
create unique index if not exists clients_client_portal_token_idx
on public.clients(client_portal_token);

-- Public RPC: basic portal header (client + business)
create or replace function public.get_public_client_portal_header(p_token text)
returns table (
  client_name text,
  business_name text,
  full_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.name as client_name,
    p.business_name,
    p.full_name
  from public.clients c
  join public.profiles p on p.id = c.user_id
  where c.client_portal_token = p_token
  limit 1;
end;
$$;

grant execute on function public.get_public_client_portal_header(text) to anon, authenticated;

-- Public RPC: invoices for this client (public-safe fields only)
create or replace function public.get_public_client_portal_invoices(p_token text)
returns table (
  public_token text,
  invoice_number text,
  title text,
  status text,
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
as $$
  select
    i.public_token,
    i.invoice_number,
    i.title,
    i.status,
    i.currency,
    i.amount_usd,
    i.amount_lbp,
    i.due_date,
    i.created_at,
    coalesce((select sum(p.amount_usd) from public.payment_proofs p where p.invoice_id = i.id and p.status = 'accepted'), 0) as paid_usd,
    coalesce((select sum(p.amount_lbp) from public.payment_proofs p where p.invoice_id = i.id and p.status = 'accepted'), 0) as paid_lbp
  from public.clients c
  join public.invoices i on i.client_id = c.id
  where c.client_portal_token = p_token
  order by i.created_at desc;
$$;

grant execute on function public.get_public_client_portal_invoices(text) to anon, authenticated;

-- Public RPC: accepted payments only (public-safe fields only)
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
as $$
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
$$;

grant execute on function public.get_public_client_portal_payments(text) to anon, authenticated;

-- Public RPC: recent activity derived from invoice_events (limited fields)
create or replace function public.get_public_client_portal_activity(p_token text)
returns table (
  created_at timestamp with time zone,
  event_type text,
  message text,
  invoice_public_token text,
  invoice_number text
)
language sql
security definer
set search_path = public
as $$
  select
    e.created_at,
    e.event_type,
    e.message,
    i.public_token as invoice_public_token,
    i.invoice_number
  from public.clients c
  join public.invoices i on i.client_id = c.id
  join public.invoice_events e on e.invoice_id = i.id
  where c.client_portal_token = p_token
    and e.event_type in (
      'invoice_created',
      'manual_payment',
      'proof_uploaded',
      'reminder_copied',
      'invoice_validity_extended',
      'client_approved',
      'client_rejected'
    )
  order by e.created_at desc
  limit 25;
$$;

grant execute on function public.get_public_client_portal_activity(text) to anon, authenticated;

-- Public RPC: analytics event
create or replace function public.record_client_portal_view(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.record_client_portal_view(text) to anon, authenticated;
