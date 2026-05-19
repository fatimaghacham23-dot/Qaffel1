-- Create invoice_events table
create table if not exists public.invoice_events (
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
drop policy if exists "Users can select their own invoice events" on public.invoice_events;
create policy "Users can select their own invoice events"
  on public.invoice_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own invoice events" on public.invoice_events;
create policy "Users can insert their own invoice events"
  on public.invoice_events for insert
  with check (auth.uid() = user_id);

-- Index for performance
create index if not exists invoice_events_invoice_id_idx on public.invoice_events(invoice_id);
create index if not exists invoice_events_user_id_idx on public.invoice_events(user_id);
