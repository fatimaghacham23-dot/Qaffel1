-- Align row-level write access with the persisted Qaffel role matrix.
-- This intentionally removes the legacy auth.uid() = user_id fallback because
-- every production record must be attached to a backfilled workspace.

alter table public.clients enable row level security;
drop policy if exists "clients workspace access" on public.clients;
drop policy if exists "workspace members can view clients" on public.clients;
drop policy if exists "workspace client creators can insert clients" on public.clients;
drop policy if exists "workspace client editors can update clients" on public.clients;
drop policy if exists "workspace client admins can delete clients" on public.clients;

create policy "workspace members can view clients"
on public.clients for select to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "workspace client creators can insert clients"
on public.clients for insert to authenticated
with check (
  public.get_workspace_role(workspace_id) in ('owner', 'admin', 'operations')
);

create policy "workspace client editors can update clients"
on public.clients for update to authenticated
using (
  public.get_workspace_role(workspace_id) in ('owner', 'admin', 'operations')
)
with check (
  public.get_workspace_role(workspace_id) in ('owner', 'admin', 'operations')
);

create policy "workspace client admins can delete clients"
on public.clients for delete to authenticated
using (
  public.get_workspace_role(workspace_id) in ('owner', 'admin')
);

alter table public.invoices enable row level security;
drop policy if exists "invoices workspace access" on public.invoices;
drop policy if exists "workspace members can view invoices" on public.invoices;
drop policy if exists "workspace invoice creators can insert invoices" on public.invoices;
drop policy if exists "workspace invoice editors can update invoices" on public.invoices;
drop policy if exists "workspace invoice admins can delete invoices" on public.invoices;

create policy "workspace members can view invoices"
on public.invoices for select to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "workspace invoice creators can insert invoices"
on public.invoices for insert to authenticated
with check (
  public.get_workspace_role(workspace_id) in ('owner', 'admin', 'operations')
);

create policy "workspace invoice editors can update invoices"
on public.invoices for update to authenticated
using (
  public.get_workspace_role(workspace_id) in ('owner', 'admin', 'operations')
)
with check (
  public.get_workspace_role(workspace_id) in ('owner', 'admin', 'operations')
);

create policy "workspace invoice admins can delete invoices"
on public.invoices for delete to authenticated
using (
  public.get_workspace_role(workspace_id) in ('owner', 'admin')
);

alter table public.payment_methods enable row level security;
drop policy if exists "payment_methods workspace access" on public.payment_methods;
drop policy if exists "workspace members can view payment methods" on public.payment_methods;
drop policy if exists "workspace settings managers can insert payment methods" on public.payment_methods;
drop policy if exists "workspace settings managers can update payment methods" on public.payment_methods;
drop policy if exists "workspace settings managers can delete payment methods" on public.payment_methods;

create policy "workspace members can view payment methods"
on public.payment_methods for select to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "workspace settings managers can insert payment methods"
on public.payment_methods for insert to authenticated
with check (
  public.get_workspace_role(workspace_id) in ('owner', 'admin')
);

create policy "workspace settings managers can update payment methods"
on public.payment_methods for update to authenticated
using (
  public.get_workspace_role(workspace_id) in ('owner', 'admin')
)
with check (
  public.get_workspace_role(workspace_id) in ('owner', 'admin')
);

create policy "workspace settings managers can delete payment methods"
on public.payment_methods for delete to authenticated
using (
  public.get_workspace_role(workspace_id) in ('owner', 'admin')
);

-- Pending proof metadata, assignment, AI-assistance, and final review share the
-- existing update surface. Reviewers may only update a pending row and may
-- leave it pending or transition it once to accepted/rejected. They cannot
-- mutate an accepted payment or void it.
drop policy if exists "workspace reviewers can update payment proofs" on public.payment_proofs;
drop policy if exists "workspace finance can void payment proofs" on public.payment_proofs;

create policy "workspace reviewers can update payment proofs"
on public.payment_proofs for update to authenticated
using (
  status = 'pending'
  and exists (
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
  status in ('pending', 'accepted', 'rejected')
  and exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance', 'operations', 'reviewer')
  )
);

create policy "workspace finance can void payment proofs"
on public.payment_proofs for update to authenticated
using (
  status = 'accepted'
  and exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance')
  )
)
with check (
  status = 'voided'
  and exists (
    select 1
    from public.invoices i
    join public.workspace_members wm on wm.workspace_id = i.workspace_id
    where i.id = payment_proofs.invoice_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'finance')
  )
);
