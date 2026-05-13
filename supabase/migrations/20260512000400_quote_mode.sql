alter table public.invoices
add column if not exists document_type text default 'invoice' not null;

update public.invoices
set document_type = 'invoice'
where document_type is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_document_type_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
    add constraint invoices_document_type_check
    check (document_type in ('invoice', 'quote'));
  end if;
end $$;

create index if not exists invoices_user_document_type_idx
on public.invoices(user_id, document_type);

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

drop function if exists public.get_public_client_portal_invoices(text);

create function public.get_public_client_portal_invoices(p_token text)
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
as $$
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
    coalesce((select sum(p.amount_usd) from public.payment_proofs p where p.invoice_id = i.id and p.status = 'accepted'), 0) as paid_usd,
    coalesce((select sum(p.amount_lbp) from public.payment_proofs p where p.invoice_id = i.id and p.status = 'accepted'), 0) as paid_lbp
  from public.clients c
  join public.invoices i on i.client_id = c.id
  where c.client_portal_token = p_token
  order by i.created_at desc;
$$;

grant execute on function public.get_public_client_portal_invoices(text) to anon, authenticated;

drop function if exists public.get_public_client_portal_activity(text);

create function public.get_public_client_portal_activity(p_token text)
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
as $$
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
$$;

grant execute on function public.get_public_client_portal_activity(text) to anon, authenticated;
