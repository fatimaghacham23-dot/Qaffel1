-- Atomic Stripe webhook claiming and replay-safe billing audit events.

alter table public.workspace_subscriptions
  add column if not exists stripe_last_event_created_at timestamp with time zone;

alter table public.workspace_billing_invoices
  add column if not exists stripe_last_event_created_at timestamp with time zone;

create unique index if not exists workspace_billing_audit_stripe_event_uidx
  on public.workspace_billing_audit_events (
    event_type,
    ((next_state ->> 'stripe_event_id'))
  )
  where next_state ->> 'stripe_event_id' is not null;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_object_id text
)
returns table (claimed boolean, current_status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.stripe_webhook_events (
    stripe_event_id,
    event_type,
    object_id,
    status,
    processed_at,
    error_message
  )
  values (
    p_event_id,
    p_event_type,
    p_object_id,
    'processing',
    null,
    null
  )
  on conflict (stripe_event_id) do nothing;

  if found then
    return query select true, 'processing'::text;
    return;
  end if;

  update public.stripe_webhook_events
  set
    status = 'processing',
    processed_at = null,
    error_message = null,
    received_at = timezone('utc'::text, now())
  where stripe_event_id = p_event_id
    and (
      status = 'failed'
      or (
        status = 'processing'
        and received_at < timezone('utc'::text, now()) - interval '15 minutes'
      )
    );

  if found then
    return query select true, 'processing'::text;
    return;
  end if;

  return query
    select false, e.status
    from public.stripe_webhook_events e
    where e.stripe_event_id = p_event_id;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, text) from public;
grant execute on function public.claim_stripe_webhook_event(text, text, text) to service_role;
