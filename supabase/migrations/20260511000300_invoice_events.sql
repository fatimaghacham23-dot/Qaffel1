-- Create invoice_events table
create table public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null,
  message text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.invoice_events enable row level security;

-- Policies
create policy "Users can select their own invoice events"
  on public.invoice_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own invoice events"
  on public.invoice_events for insert
  with check (auth.uid() = user_id);

-- Index for performance
create index invoice_events_invoice_id_idx on public.invoice_events(invoice_id);
create index invoice_events_user_id_idx on public.invoice_events(user_id);
