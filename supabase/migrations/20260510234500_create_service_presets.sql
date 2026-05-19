-- Create service_presets table
create table if not exists public.service_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  amount_usd numeric,
  amount_lbp numeric,
  currency text default 'USD' not null check (currency in ('USD', 'LBP')),
  default_validity_days integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.service_presets enable row level security;

-- Policies
drop policy if exists "Users can manage their own service presets" on public.service_presets;
create policy "Users can manage their own service presets"
  on public.service_presets
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
