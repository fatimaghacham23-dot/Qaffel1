create table if not exists public.shared_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  report_type text not null check (
    report_type in (
      'monthly_collections',
      'overdue_summary',
      'client_payment_history',
      'proof_review_summary',
      'recovery_progress',
      'payment_summary',
      'invoice_summary'
    )
  ),
  title text not null,
  description text,
  filters jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shared_reports enable row level security;

drop policy if exists "shared reports are owner managed" on public.shared_reports;
create policy "shared reports are owner managed"
on public.shared_reports
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists shared_reports_user_created_idx
on public.shared_reports(user_id, created_at desc);

create index if not exists shared_reports_public_token_idx
on public.shared_reports(token)
where revoked_at is null;

create or replace function public.get_public_shared_report(p_token text)
returns table (
  report_type text,
  title text,
  description text,
  created_at timestamptz,
  expires_at timestamptz,
  business_name text,
  business_tagline text,
  business_city text,
  support_email text,
  brand_color text,
  brand_accent text,
  document_theme text,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_report public.shared_reports%rowtype;
  v_from date;
  v_to date;
  v_month text;
begin
  select *
  into v_report
  from public.shared_reports sr
  where sr.token = p_token
    and sr.revoked_at is null
    and (sr.expires_at is null or sr.expires_at > now())
  limit 1;

  if not found then
    return;
  end if;

  if coalesce(v_report.filters ->> 'from', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_from := (v_report.filters ->> 'from')::date;
  end if;

  if coalesce(v_report.filters ->> 'to', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_to := (v_report.filters ->> 'to')::date;
  end if;

  if coalesce(v_report.filters ->> 'month', '') ~ '^\d{4}-\d{2}$' then
    v_month := v_report.filters ->> 'month';
    v_from := (v_month || '-01')::date;
    v_to := ((v_month || '-01')::date + interval '1 month - 1 day')::date;
  end if;

  return query
  with invoice_base as (
    select
      i.id,
      i.invoice_number,
      i.title,
      i.status,
      i.currency,
      i.amount_usd,
      i.amount_lbp,
      i.due_date,
      i.created_at,
      coalesce(c.name, '') as client_name,
      coalesce(sum(p.amount_usd) filter (where p.status = 'accepted'), 0) as paid_usd,
      coalesce(sum(p.amount_lbp) filter (where p.status = 'accepted'), 0) as paid_lbp,
      count(p.id) filter (where p.status = 'pending') as pending_proofs
    from public.invoices i
    left join public.clients c on c.id = i.client_id
    left join public.payment_proofs p on p.invoice_id = i.id
    where i.user_id = v_report.user_id
      and coalesce(i.document_type, 'invoice') <> 'quote'
      and (v_from is null or i.created_at::date >= v_from)
      and (v_to is null or i.created_at::date <= v_to)
    group by i.id, c.name
  ),
  payment_base as (
    select
      p.status,
      coalesce(nullif(p.method, ''), 'Unspecified') as method,
      p.amount_usd,
      p.amount_lbp,
      p.uploaded_at,
      p.confirmed_at,
      p.payment_date,
      i.invoice_number,
      i.title,
      coalesce(c.name, '') as client_name
    from public.payment_proofs p
    join public.invoices i on i.id = p.invoice_id
    left join public.clients c on c.id = i.client_id
    where i.user_id = v_report.user_id
      and (v_from is null or coalesce(p.confirmed_at, p.uploaded_at)::date >= v_from)
      and (v_to is null or coalesce(p.confirmed_at, p.uploaded_at)::date <= v_to)
  ),
  reminder_base as (
    select
      e.created_at,
      e.message,
      coalesce(e.metadata ->> 'channel', '') as channel,
      coalesce(e.metadata ->> 'stage', '') as stage,
      i.invoice_number,
      i.title,
      coalesce(c.name, '') as client_name
    from public.invoice_events e
    join public.invoices i on i.id = e.invoice_id
    left join public.clients c on c.id = i.client_id
    where e.user_id = v_report.user_id
      and e.event_type = 'reminder_copied'
      and (v_from is null or e.created_at::date >= v_from)
      and (v_to is null or e.created_at::date <= v_to)
  ),
  profile_row as (
    select
      coalesce(p.business_name, p.full_name, 'Business report') as business_name,
      p.business_tagline,
      p.business_city,
      p.support_email,
      p.brand_color,
      p.brand_accent,
      p.document_theme
    from public.profiles p
    where p.id = v_report.user_id
  ),
  metrics as (
    select jsonb_build_object(
      'invoice_count', (select count(*) from invoice_base),
      'accepted_payments', (select count(*) from payment_base where status = 'accepted'),
      'pending_proofs', (select count(*) from payment_base where status = 'pending'),
      'voided_payments', (select count(*) from payment_base where status = 'voided'),
      'collected_usd', coalesce((select sum(amount_usd) from payment_base where status = 'accepted'), 0),
      'collected_lbp', coalesce((select sum(amount_lbp) from payment_base where status = 'accepted'), 0),
      'open_usd', coalesce((select sum(greatest(coalesce(amount_usd, 0) - coalesce(paid_usd, 0), 0)) from invoice_base where status <> 'paid'), 0),
      'open_lbp', coalesce((select sum(greatest(coalesce(amount_lbp, 0) - coalesce(paid_lbp, 0), 0)) from invoice_base where status <> 'paid'), 0),
      'overdue_count', (select count(*) from invoice_base where due_date < current_date and status <> 'paid'),
      'reminders_copied', (select count(*) from reminder_base)
    ) as data
  ),
  rows_payload as (
    select
      case v_report.report_type
        when 'proof_review_summary' then
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'status', status,
                'method', method,
                'count', count,
                'amount_usd', amount_usd,
                'amount_lbp', amount_lbp
              )
              order by status, method
            )
            from (
              select
                status,
                method,
                count(*) as count,
                coalesce(sum(amount_usd), 0) as amount_usd,
                coalesce(sum(amount_lbp), 0) as amount_lbp
              from payment_base
              group by status, method
            ) grouped
          ), '[]'::jsonb)
        when 'recovery_progress' then
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'invoice_number', invoice_number,
                'client_name', client_name,
                'title', title,
                'status', status,
                'due_date', due_date,
                'remaining_usd', greatest(coalesce(amount_usd, 0) - coalesce(paid_usd, 0), 0),
                'remaining_lbp', greatest(coalesce(amount_lbp, 0) - coalesce(paid_lbp, 0), 0),
                'pending_proofs', pending_proofs
              )
              order by due_date nulls last, invoice_number
            )
            from invoice_base
            where status <> 'paid'
              and (due_date < current_date or status in ('partial', 'overdue', 'unpaid', 'sent'))
          ), '[]'::jsonb)
        when 'overdue_summary' then
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'invoice_number', invoice_number,
                'client_name', client_name,
                'title', title,
                'due_date', due_date,
                'remaining_usd', greatest(coalesce(amount_usd, 0) - coalesce(paid_usd, 0), 0),
                'remaining_lbp', greatest(coalesce(amount_lbp, 0) - coalesce(paid_lbp, 0), 0)
              )
              order by due_date nulls last, invoice_number
            )
            from invoice_base
            where due_date < current_date
              and status <> 'paid'
          ), '[]'::jsonb)
        else
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'invoice_number', invoice_number,
                'client_name', client_name,
                'title', title,
                'status', status,
                'currency', currency,
                'amount_usd', amount_usd,
                'amount_lbp', amount_lbp,
                'paid_usd', paid_usd,
                'paid_lbp', paid_lbp,
                'remaining_usd', greatest(coalesce(amount_usd, 0) - coalesce(paid_usd, 0), 0),
                'remaining_lbp', greatest(coalesce(amount_lbp, 0) - coalesce(paid_lbp, 0), 0),
                'due_date', due_date
              )
              order by created_at desc
            )
            from invoice_base
          ), '[]'::jsonb)
      end as rows
  )
  select
    v_report.report_type,
    v_report.title,
    coalesce(v_report.description, ''),
    v_report.created_at,
    v_report.expires_at,
    pr.business_name,
    pr.business_tagline,
    pr.business_city,
    pr.support_email,
    pr.brand_color,
    pr.brand_accent,
    pr.document_theme,
    jsonb_build_object(
      'metrics', metrics.data,
      'rows', rows_payload.rows,
      'filters', v_report.filters,
      'generated_at', now()
    ) as payload
  from profile_row pr, metrics, rows_payload;
end;
$fn$;

grant execute on function public.get_public_shared_report(text) to anon, authenticated;
