create or replace function public.approve_invoice_by_token(
  p_token text,
  p_approved_by_name text,
  p_approved_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.reject_invoice_by_token(
  p_token text,
  p_rejected_by_name text,
  p_rejected_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.approve_invoice_by_token(text, text, text) to anon, authenticated;
grant execute on function public.reject_invoice_by_token(text, text, text) to anon, authenticated;
