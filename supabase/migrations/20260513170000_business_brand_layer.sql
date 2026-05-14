-- Business identity & brand fields (public-safe subset exposed only via existing invoice/receipt/portal RPCs + profiles RLS).
alter table public.profiles
  add column if not exists logo_storage_path text,
  add column if not exists brand_color text default '#116466',
  add column if not exists brand_accent text,
  add column if not exists business_tagline text,
  add column if not exists business_website text,
  add column if not exists instagram_handle text,
  add column if not exists whatsapp_phone text,
  add column if not exists support_email text,
  add column if not exists invoice_footer_note text,
  add column if not exists document_theme text default 'professional',
  add column if not exists business_hours text,
  add column if not exists business_city text;

comment on column public.profiles.logo_storage_path is 'Private storage path in business-brand bucket; never a public URL.';
comment on column public.profiles.document_theme is 'Document theme preset: minimal, professional, soft, modern, executive.';

-- Private bucket for logos only (no listing; reads gated by RLS).
insert into storage.buckets (id, name, public)
values ('business-brand', 'business-brand', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Owners upload business brand files" on storage.objects;
create policy "Owners upload business brand files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners update business brand files" on storage.objects;
create policy "Owners update business brand files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners delete business brand files" on storage.objects;
create policy "Owners delete business brand files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners read own business brand files" on storage.objects;
create policy "Owners read own business brand files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-brand'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow signed URL generation for visitors when the object is the active logo of a business with at least one public invoice.
drop policy if exists "Public read logo path on profile" on storage.objects;
create policy "Public read logo path on profile"
on storage.objects
for select
using (
  bucket_id = 'business-brand'
  and exists (
    select 1
    from public.profiles pr
    where pr.logo_storage_path = name
      and exists (
        select 1 from public.invoices i
        where i.user_id = pr.id
          and i.public_token is not null
      )
  )
);

-- Receipt: include brand fields for public rendering (path only; app signs URL).
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
  status text,
  invoice_public_token text,
  void_reason text,
  business_tagline text,
  brand_color text,
  brand_accent text,
  document_theme text,
  logo_storage_path text,
  support_email text,
  business_website text,
  instagram_handle text,
  whatsapp_phone text,
  business_hours text,
  business_city text,
  invoice_footer_note text
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
    p.void_reason as void_reason,
    prof.business_tagline,
    prof.brand_color,
    prof.brand_accent,
    prof.document_theme,
    prof.logo_storage_path,
    prof.support_email,
    prof.business_website,
    prof.instagram_handle,
    prof.whatsapp_phone,
    prof.business_hours,
    prof.business_city,
    prof.invoice_footer_note
  from public.payment_proofs p
  join public.invoices i on p.invoice_id = i.id
  join public.profiles prof on i.user_id = prof.id
  left join public.clients c on i.client_id = c.id
  where p.receipt_token = p_token
  limit 1;
$$;

grant execute on function public.get_public_receipt_data(text) to anon, authenticated;

-- Client portal header: brand fields for portal shell.
create or replace function public.get_public_client_portal_header(p_token text)
returns table (
  client_name text,
  business_name text,
  full_name text,
  business_phone text,
  business_tagline text,
  brand_color text,
  brand_accent text,
  document_theme text,
  logo_storage_path text,
  support_email text,
  business_website text,
  instagram_handle text,
  whatsapp_phone text,
  business_hours text,
  business_city text,
  invoice_footer_note text
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
    p.full_name,
    p.phone as business_phone,
    p.business_tagline,
    p.brand_color,
    p.brand_accent,
    p.document_theme,
    p.logo_storage_path,
    p.support_email,
    p.business_website,
    p.instagram_handle,
    p.whatsapp_phone,
    p.business_hours,
    p.business_city,
    p.invoice_footer_note
  from public.clients c
  join public.profiles p on p.id = c.user_id
  where c.client_portal_token = p_token
  limit 1;
end;
$$;

grant execute on function public.get_public_client_portal_header(text) to anon, authenticated;

-- Observable trust metric: median hours from proof upload to acceptance for this merchant (all invoices).
create or replace function public.get_public_merchant_proof_review_stats(p_public_invoice_token text)
returns table (median_hours numeric, sample_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with biz as (
    select i.user_id
    from public.invoices i
    where i.public_token = p_public_invoice_token
      and i.public_token is not null
    limit 1
  ),
  samples as (
    select extract(epoch from (p.confirmed_at - p.uploaded_at)) / 3600.0 as hrs
    from public.payment_proofs p
    join public.invoices i on i.id = p.invoice_id
    join biz b on b.user_id = i.user_id
    where p.status = 'accepted'
      and p.confirmed_at is not null
      and p.uploaded_at is not null
      and p.confirmed_at >= p.uploaded_at
  )
  select
    (select percentile_disc(0.5) within group (order by hrs) from samples)::numeric as median_hours,
    (select count(*) from samples)::bigint as sample_count;
$$;

grant execute on function public.get_public_merchant_proof_review_stats(text) to anon, authenticated;
