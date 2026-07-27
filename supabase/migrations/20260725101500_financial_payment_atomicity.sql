-- Serialize proof review/void transitions with invoice reconciliation.
-- SECURITY DEFINER is required because reviewer/finance roles must reconcile an
-- invoice without receiving broad direct UPDATE rights on invoice records.

create or replace function public.review_payment_proof_atomic(
  p_proof_id uuid,
  p_invoice_id uuid,
  p_decision text,
  p_requested_invoice_status text default null
)
returns table (
  old_invoice_status text,
  final_invoice_status text,
  receipt_token text,
  amount_usd numeric,
  amount_lbp numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_proof public.payment_proofs%rowtype;
  v_role text;
  v_reviewer_name text;
  v_total_usd numeric := 0;
  v_total_lbp numeric := 0;
  v_primary_total numeric := 0;
  v_primary_paid numeric := 0;
  v_final_status text;
  v_receipt_token text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected.';
  end if;

  select i.*
  into v_invoice
  from public.invoices i
  where i.id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found or access denied.';
  end if;

  select wm.role, coalesce(nullif(trim(p.full_name), ''), 'Unknown')
  into v_role, v_reviewer_name
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = v_invoice.workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
    and wm.role in ('owner', 'admin', 'finance', 'operations', 'reviewer')
  limit 1;

  if v_role is null then
    raise exception 'You do not have access to review payment proofs.';
  end if;
  if coalesce(v_invoice.document_type, 'invoice') = 'quote' then
    raise exception 'Convert this quote to an invoice before reviewing payments.';
  end if;

  select pp.*
  into v_proof
  from public.payment_proofs pp
  where pp.id = p_proof_id
    and pp.invoice_id = p_invoice_id
  for update;

  if not found then
    raise exception 'Proof not found or access denied.';
  end if;
  if v_proof.status <> 'pending' then
    raise exception 'This proof has already been reviewed.';
  end if;

  select
    coalesce(sum(pp.amount_usd) filter (where pp.status = 'accepted' and pp.voided_at is null), 0),
    coalesce(sum(pp.amount_lbp) filter (where pp.status = 'accepted' and pp.voided_at is null), 0)
  into v_total_usd, v_total_lbp
  from public.payment_proofs pp
  where pp.invoice_id = p_invoice_id;

  if p_decision = 'accepted' then
    v_total_usd := v_total_usd + coalesce(v_proof.amount_usd, 0);
    v_total_lbp := v_total_lbp + coalesce(v_proof.amount_lbp, 0);
    v_receipt_token := encode(gen_random_bytes(24), 'hex');

    if upper(coalesce(v_invoice.currency, 'USD')) = 'LBP' then
      v_primary_total := coalesce(v_invoice.amount_lbp, 0);
      v_primary_paid := v_total_lbp;
      if p_requested_invoice_status = 'paid' and v_proof.amount_lbp is null then
        raise exception 'Add the paid amount before accepting this proof as full payment.';
      end if;
    else
      v_primary_total := coalesce(v_invoice.amount_usd, 0);
      v_primary_paid := v_total_usd;
      if p_requested_invoice_status = 'paid' and v_proof.amount_usd is null then
        raise exception 'Add the paid amount before accepting this proof as full payment.';
      end if;
    end if;

    if p_requested_invoice_status = 'paid' and v_primary_total <= 0 then
      raise exception 'Invoice total is required before accepting full payment.';
    end if;
    if p_requested_invoice_status = 'paid' and v_primary_paid < v_primary_total then
      raise exception 'This proof amount does not cover the remaining balance. Accept it as partial instead.';
    end if;

    v_final_status := case
      when v_primary_total > 0 and v_primary_paid >= v_primary_total then 'paid'
      when v_primary_paid > 0 then 'partial'
      else v_invoice.status
    end;
  else
    v_final_status := v_invoice.status;
    v_receipt_token := null;
  end if;

  update public.payment_proofs
  set
    status = p_decision,
    confirmed_at = case when p_decision = 'accepted' then now() else null end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_name = v_reviewer_name,
    reviewer_role = v_role,
    receipt_token = v_receipt_token
  where id = p_proof_id
    and invoice_id = p_invoice_id
    and status = 'pending';

  if not found then
    raise exception 'This proof was already reviewed.';
  end if;

  update public.invoices
  set status = v_final_status
  where id = p_invoice_id
    and workspace_id = v_invoice.workspace_id;

  return query
  select
    v_invoice.status,
    v_final_status,
    v_receipt_token,
    v_proof.amount_usd,
    v_proof.amount_lbp;
end;
$$;

revoke all on function public.review_payment_proof_atomic(uuid, uuid, text, text) from public;
grant execute on function public.review_payment_proof_atomic(uuid, uuid, text, text) to authenticated;

create or replace function public.void_payment_proof_atomic(
  p_proof_id uuid,
  p_reason text default null
)
returns table (
  invoice_id uuid,
  owner_id uuid,
  final_invoice_status text,
  amount_usd numeric,
  amount_lbp numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_proof public.payment_proofs%rowtype;
  v_total_usd numeric := 0;
  v_total_lbp numeric := 0;
  v_primary_total numeric := 0;
  v_primary_paid numeric := 0;
  v_final_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select pp.*
  into v_proof
  from public.payment_proofs pp
  where pp.id = p_proof_id
  for update;

  if not found then
    raise exception 'Payment record not found or access denied.';
  end if;

  select i.*
  into v_invoice
  from public.invoices i
  where i.id = v_proof.invoice_id
  for update;

  if not found or not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = v_invoice.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance')
  ) then
    raise exception 'Payment record not found or access denied.';
  end if;
  if v_proof.status <> 'accepted' then
    raise exception 'Only accepted payments can be voided.';
  end if;

  update public.payment_proofs
  set
    status = 'voided',
    voided_at = now(),
    void_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_proof_id
    and status = 'accepted';

  if not found then
    raise exception 'This payment was already changed.';
  end if;

  select
    coalesce(sum(pp.amount_usd) filter (where pp.status = 'accepted' and pp.voided_at is null), 0),
    coalesce(sum(pp.amount_lbp) filter (where pp.status = 'accepted' and pp.voided_at is null), 0)
  into v_total_usd, v_total_lbp
  from public.payment_proofs pp
  where pp.invoice_id = v_invoice.id;

  if upper(coalesce(v_invoice.currency, 'USD')) = 'LBP' then
    v_primary_total := coalesce(v_invoice.amount_lbp, 0);
    v_primary_paid := v_total_lbp;
  else
    v_primary_total := coalesce(v_invoice.amount_usd, 0);
    v_primary_paid := v_total_usd;
  end if;

  v_final_status := case
    when v_primary_total > 0 and v_primary_paid >= v_primary_total then 'paid'
    when v_primary_paid > 0 then 'partial'
    else 'unpaid'
  end;

  update public.invoices
  set status = v_final_status
  where id = v_invoice.id
    and workspace_id = v_invoice.workspace_id;

  return query
  select
    v_invoice.id,
    v_invoice.user_id,
    v_final_status,
    v_proof.amount_usd,
    v_proof.amount_lbp;
end;
$$;

revoke all on function public.void_payment_proof_atomic(uuid, text) from public;
grant execute on function public.void_payment_proof_atomic(uuid, text) to authenticated;

create or replace function public.record_manual_payment_atomic(
  p_invoice_id uuid,
  p_amount_usd numeric,
  p_amount_lbp numeric,
  p_payment_date date,
  p_method text,
  p_note text default null,
  p_allow_duplicate boolean default false
)
returns table (
  proof_id uuid,
  old_invoice_status text,
  final_invoice_status text,
  receipt_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_role text;
  v_actor_name text;
  v_proof_id uuid;
  v_receipt_token text;
  v_total_usd numeric := 0;
  v_total_lbp numeric := 0;
  v_primary_total numeric := 0;
  v_primary_paid numeric := 0;
  v_final_status text;
  v_payment_date date := coalesce(p_payment_date, current_date);
  v_method text := nullif(trim(coalesce(p_method, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if coalesce(p_amount_usd, 0) <= 0 and coalesce(p_amount_lbp, 0) <= 0 then
    raise exception 'Enter a payment amount greater than zero.';
  end if;

  select i.* into v_invoice from public.invoices i where i.id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found or access denied.'; end if;

  select wm.role, coalesce(nullif(trim(p.full_name), ''), 'Unknown')
  into v_role, v_actor_name
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = v_invoice.workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
    and wm.role in ('owner', 'admin', 'finance')
  limit 1;

  if v_role is null then raise exception 'You do not have access to record manual payments.'; end if;
  if coalesce(v_invoice.document_type, 'invoice') = 'quote' then
    raise exception 'Convert this quote to an invoice before recording payments.';
  end if;

  if not p_allow_duplicate and exists (
    select 1 from public.payment_proofs pp
    where pp.invoice_id = p_invoice_id
      and pp.status in ('accepted', 'pending')
      and pp.payment_date = v_payment_date
      and lower(trim(coalesce(pp.method, ''))) = lower(coalesce(v_method, ''))
      and ((p_amount_usd is not null and pp.amount_usd = p_amount_usd)
        or (p_amount_lbp is not null and pp.amount_lbp = p_amount_lbp))
  ) then
    raise exception 'This looks like a duplicate payment (same amount/date/method). Confirm to record it anyway.';
  end if;

  v_receipt_token := encode(gen_random_bytes(24), 'hex');
  insert into public.payment_proofs (
    invoice_id, user_id, amount_usd, amount_lbp, payment_date, method, note,
    status, confirmed_at, image_url, receipt_token
  ) values (
    v_invoice.id, v_invoice.user_id, p_amount_usd, p_amount_lbp, v_payment_date,
    v_method, nullif(trim(coalesce(p_note, '')), ''), 'accepted', now(), null, v_receipt_token
  ) returning id into v_proof_id;

  select
    coalesce(sum(pp.amount_usd) filter (where pp.status = 'accepted' and pp.voided_at is null), 0),
    coalesce(sum(pp.amount_lbp) filter (where pp.status = 'accepted' and pp.voided_at is null), 0)
  into v_total_usd, v_total_lbp
  from public.payment_proofs pp where pp.invoice_id = v_invoice.id;

  if upper(coalesce(v_invoice.currency, 'USD')) = 'LBP' then
    v_primary_total := coalesce(v_invoice.amount_lbp, 0); v_primary_paid := v_total_lbp;
  else
    v_primary_total := coalesce(v_invoice.amount_usd, 0); v_primary_paid := v_total_usd;
  end if;

  v_final_status := case
    when v_primary_total > 0 and v_primary_paid >= v_primary_total then 'paid'
    when v_primary_paid > 0 then 'partial'
    else v_invoice.status
  end;

  update public.invoices set status = v_final_status
  where id = v_invoice.id and workspace_id = v_invoice.workspace_id;

  insert into public.invoice_events (
    invoice_id, user_id, workspace_id, actor_id, actor_name, actor_role,
    event_type, message, metadata
  ) values (
    v_invoice.id, v_invoice.user_id, v_invoice.workspace_id, auth.uid(), v_actor_name,
    v_role, 'manual_payment', 'Manual payment recorded',
    jsonb_build_object('proof_id', v_proof_id, 'amount_usd', p_amount_usd,
      'amount_lbp', p_amount_lbp, 'method', v_method, 'receipt_token', v_receipt_token)
  );

  if v_final_status <> v_invoice.status then
    insert into public.invoice_events (
      invoice_id, user_id, workspace_id, actor_id, actor_name, actor_role, event_type, message
    ) values (
      v_invoice.id, v_invoice.user_id, v_invoice.workspace_id, auth.uid(), v_actor_name,
      v_role, 'invoice_' || v_final_status, 'Invoice marked ' || v_final_status
    );
  end if;

  return query select v_proof_id, v_invoice.status, v_final_status, v_receipt_token;
end;
$$;

revoke all on function public.record_manual_payment_atomic(uuid, numeric, numeric, date, text, text, boolean) from public;
grant execute on function public.record_manual_payment_atomic(uuid, numeric, numeric, date, text, text, boolean) to authenticated;