-- Workspace memory: internal client notes, per-invoice work notes, message templates.
-- Operational only; no public exposure. RLS ties rows to auth.uid() and owned clients/invoices.

create table public.client_workspace_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  category text not null check (category in (
    'operational', 'payment', 'communication', 'recovery', 'general'
  )),
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 8000),
  is_pinned boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.invoice_workspace_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  category text not null check (category in (
    'project', 'delivery', 'revision', 'milestone', 'handoff', 'general'
  )),
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 8000),
  is_pinned boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.workspace_message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in (
    'reminder', 'recovery', 'thank_you', 'follow_up', 'other'
  )),
  label text not null check (char_length(trim(label)) > 0 and char_length(label) <= 160),
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 12000),
  is_favorite boolean default false not null,
  use_count integer default 0 not null check (use_count >= 0),
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index client_workspace_notes_client_id_idx on public.client_workspace_notes(client_id);
create index client_workspace_notes_user_id_idx on public.client_workspace_notes(user_id);
create index client_workspace_notes_created_at_idx on public.client_workspace_notes(created_at desc);

create index invoice_workspace_notes_invoice_id_idx on public.invoice_workspace_notes(invoice_id);
create index invoice_workspace_notes_user_id_idx on public.invoice_workspace_notes(user_id);
create index invoice_workspace_notes_created_at_idx on public.invoice_workspace_notes(created_at desc);

create index workspace_message_templates_user_id_idx on public.workspace_message_templates(user_id);
create index workspace_message_templates_favorite_idx on public.workspace_message_templates(user_id, is_favorite desc);

alter table public.client_workspace_notes enable row level security;
alter table public.invoice_workspace_notes enable row level security;
alter table public.workspace_message_templates enable row level security;

create policy "client_workspace_notes_select_own"
  on public.client_workspace_notes for select
  using (auth.uid() = user_id);

create policy "client_workspace_notes_insert_own"
  on public.client_workspace_notes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "client_workspace_notes_update_own"
  on public.client_workspace_notes for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "client_workspace_notes_delete_own"
  on public.client_workspace_notes for delete
  using (auth.uid() = user_id);

create policy "invoice_workspace_notes_select_own"
  on public.invoice_workspace_notes for select
  using (auth.uid() = user_id);

create policy "invoice_workspace_notes_insert_own"
  on public.invoice_workspace_notes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

create policy "invoice_workspace_notes_update_own"
  on public.invoice_workspace_notes for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

create policy "invoice_workspace_notes_delete_own"
  on public.invoice_workspace_notes for delete
  using (auth.uid() = user_id);

create policy "workspace_message_templates_select_own"
  on public.workspace_message_templates for select
  using (auth.uid() = user_id);

create policy "workspace_message_templates_insert_own"
  on public.workspace_message_templates for insert
  with check (auth.uid() = user_id);

create policy "workspace_message_templates_update_own"
  on public.workspace_message_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workspace_message_templates_delete_own"
  on public.workspace_message_templates for delete
  using (auth.uid() = user_id);
