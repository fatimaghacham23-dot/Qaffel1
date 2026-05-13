-- Payment Receipt System

alter table public.payment_proofs
add column if not exists receipt_token text;

-- Backfill existing payments
update public.payment_proofs
set receipt_token = encode(gen_random_bytes(24), 'hex')
where receipt_token is null;

-- Enforce uniqueness
create unique index if not exists payment_proofs_receipt_token_idx
on public.payment_proofs(receipt_token);

-- Public RPC: get receipt data
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
  status text, -- payment_proof status (accepted, voided, etc)
  invoice_public_token text,
  void_reason text
)
language sql
security definer
set search_path = public
as $$
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
    p.void_reason as void_reason
  from public.payment_proofs p
  join public.invoices i on p.invoice_id = i.id
  join public.profiles prof on i.user_id = prof.id
  left join public.clients c on i.client_id = c.id
  where p.receipt_token = p_token
  limit 1;
$$;

grant execute on function public.get_public_receipt_data(text) to anon, authenticated;

-- Public RPC: record receipt view
create or replace function public.record_receipt_view(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_user_id uuid;
  v_receipt_number text;
begin
  select i.id, i.user_id, 'RCP-' || to_char(coalesce(p.confirmed_at, p.uploaded_at), 'YYYYMMDD') || '-' || upper(left(p.receipt_token, 4))
  into v_invoice_id, v_user_id, v_receipt_number
  from public.payment_proofs p
  join public.invoices i on p.invoice_id = i.id
  where p.receipt_token = p_token
  limit 1;

  if v_invoice_id is null then
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
$$;

grant execute on function public.record_receipt_view(text) to anon, authenticated;
