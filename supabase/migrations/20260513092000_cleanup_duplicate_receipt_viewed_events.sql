-- Cleanup historical duplicate receipt_viewed timeline events.
-- Keep the earliest event per:
--   invoice_id + metadata.receipt_token + created_at day bucket
-- Delete the rest.
-- Safe and idempotent: reruns delete zero rows after first pass.

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
