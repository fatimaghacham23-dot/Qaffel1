-- Deduplicate receipt view timeline events.
-- Keep at most one "receipt_viewed" event per receipt token every 24 hours.

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
$$;

grant execute on function public.record_receipt_view(text) to anon, authenticated;
