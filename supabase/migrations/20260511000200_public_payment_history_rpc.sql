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
as $$
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
  order by p.payment_date desc, p.uploaded_at desc;
end;
$$;

grant execute on function public.get_public_payment_history_by_token(text) to anon, authenticated;
