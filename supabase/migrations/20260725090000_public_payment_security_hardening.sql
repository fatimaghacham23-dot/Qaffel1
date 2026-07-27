-- Production hardening: replace broad anonymous table visibility and storage
-- writes with a narrow token-scoped payment-page projection. Public proof
-- uploads are performed by the server only after validating the invoice token.

update storage.buckets
set public = false
where id = 'payment-proofs';

create or replace function public.get_public_payment_page(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', i.id,
      'user_id', i.user_id,
      'public_token', i.public_token,
      'invoice_number', i.invoice_number,
      'title', i.title,
      'description', i.description,
      'amount_usd', i.amount_usd,
      'amount_lbp', i.amount_lbp,
      'currency', i.currency,
      'due_date', i.due_date,
      'status', i.status,
      'document_type', i.document_type,
      'approval_status', i.approval_status,
      'valid_until', i.valid_until,
      'exchange_rate_lbp_per_usd', i.exchange_rate_lbp_per_usd,
      'rate_note', i.rate_note,
      'approved_at', i.approved_at,
      'approved_by_name', i.approved_by_name,
      'approved_note', i.approved_note,
      'deposit_enabled', i.deposit_enabled,
      'deposit_type', i.deposit_type,
      'deposit_percent', i.deposit_percent,
      'deposit_amount_usd', i.deposit_amount_usd,
      'deposit_amount_lbp', i.deposit_amount_lbp,
      'deposit_note', i.deposit_note,
      'created_at', i.created_at,
      'payment_plan', i.payment_plan,
      'clients', case
        when c.id is null then null
        else jsonb_build_object('name', c.name)
      end
    ),
    'profile', (
      select jsonb_build_object(
        'business_name', p.business_name,
        'full_name', p.full_name,
        'phone', p.phone,
        'logo_storage_path', p.logo_storage_path,
        'brand_color', p.brand_color,
        'brand_accent', p.brand_accent,
        'business_tagline', p.business_tagline,
        'business_website', p.business_website,
        'instagram_handle', p.instagram_handle,
        'whatsapp_phone', p.whatsapp_phone,
        'support_email', p.support_email,
        'invoice_footer_note', p.invoice_footer_note,
        'document_theme', p.document_theme,
        'business_hours', p.business_hours,
        'business_city', p.business_city
      )
      from public.profiles p
      where p.id = i.user_id
    ),
    'proofs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', pp.status,
          'amount_usd', pp.amount_usd,
          'amount_lbp', pp.amount_lbp
        )
        order by pp.uploaded_at desc
      )
      from public.payment_proofs pp
      where pp.invoice_id = i.id
    ), '[]'::jsonb),
    'methods', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', pm.type,
          'label', pm.label,
          'instructions', pm.instructions,
          'receiver_name', pm.receiver_name,
          'receiver_phone', pm.receiver_phone,
          'account_reference', pm.account_reference,
          'qr_image_path', pm.qr_image_path,
          'external_link', pm.external_link
        )
        order by pm.created_at asc
      )
      from public.payment_methods pm
      where pm.user_id = i.user_id
        and pm.is_active = true
    ), '[]'::jsonb)
  )
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  where i.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_public_payment_page(text) from public;
grant execute on function public.get_public_payment_page(text) to anon, authenticated;

-- Public data is now exposed only by explicit token-scoped RPC projections.
drop policy if exists "public invoice pages can read invoices by token" on public.invoices;
drop policy if exists "public invoice pages can read business profile" on public.profiles;
drop policy if exists "public invoice pages can read invoice client name" on public.clients;
drop policy if exists "public invoice pages can read active payment methods" on public.payment_methods;

-- Public uploads no longer write table rows directly.
drop policy if exists "public can upload invoice proofs" on public.payment_proofs;

drop policy if exists "proofs are readable by invoice owner" on public.payment_proofs;
drop policy if exists "proofs are reviewable by invoice owner" on public.payment_proofs;
drop policy if exists "workspace members can view payment proofs" on public.payment_proofs;
drop policy if exists "workspace reviewers can update payment proofs" on public.payment_proofs;
drop policy if exists "workspace finance can insert payment proofs" on public.payment_proofs;

create policy "workspace members can view payment proofs"
on public.payment_proofs
for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

create policy "workspace reviewers can update payment proofs"
on public.payment_proofs
for update
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance', 'operations', 'reviewer')
  )
)
with check (
  exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance', 'operations', 'reviewer')
  )
);

create policy "workspace finance can insert payment proofs"
on public.payment_proofs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance')
  )
);

-- Storage object names use: <invoice UUID>/<random UUID>.<extension>.
drop policy if exists "public can upload payment proof files" on storage.objects;
drop policy if exists "owners can read their payment proof files" on storage.objects;
drop policy if exists "workspace members can read payment proof files" on storage.objects;

create policy "workspace members can read payment proof files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

create index if not exists workspace_members_user_status_workspace_idx
  on public.workspace_members(user_id, status, workspace_id);

create index if not exists invoices_workspace_id_id_idx
  on public.invoices(workspace_id, id);

create index if not exists payment_proofs_invoice_status_uploaded_idx
  on public.payment_proofs(invoice_id, status, uploaded_at desc);
