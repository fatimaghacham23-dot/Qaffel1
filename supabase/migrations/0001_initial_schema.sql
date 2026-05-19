create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  label text not null,
  instructions text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text,
  title text not null,
  description text,
  amount_usd numeric,
  amount_lbp numeric,
  currency text default 'USD' not null,
  due_date date,
  status text default 'draft' not null check (status in ('draft', 'sent', 'unpaid', 'partial', 'paid', 'overdue', 'rejected')),
  public_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  method text,
  image_url text,
  note text,
  status text default 'pending' not null check (status in ('pending', 'accepted', 'rejected')),
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null,
  confirmed_at timestamp with time zone
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists payment_methods_user_id_idx on public.payment_methods(user_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_public_token_idx on public.invoices(public_token);
create index if not exists payment_proofs_invoice_id_idx on public.payment_proofs(invoice_id);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.payment_methods enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_proofs enable row level security;

drop policy if exists "profiles are managed by owner" on public.profiles;
create policy "profiles are managed by owner"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "public invoice pages can read business profile" on public.profiles;
create policy "public invoice pages can read business profile"
on public.profiles
for select
using (
  exists (
    select 1 from public.invoices
    where invoices.user_id = profiles.id
    and invoices.public_token is not null
  )
);

drop policy if exists "clients are managed by owner" on public.clients;
create policy "clients are managed by owner"
on public.clients
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public invoice pages can read invoice client name" on public.clients;
create policy "public invoice pages can read invoice client name"
on public.clients
for select
using (
  exists (
    select 1 from public.invoices
    where invoices.client_id = clients.id
    and invoices.public_token is not null
  )
);

drop policy if exists "payment methods are managed by owner" on public.payment_methods;
create policy "payment methods are managed by owner"
on public.payment_methods
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public invoice pages can read active payment methods" on public.payment_methods;
create policy "public invoice pages can read active payment methods"
on public.payment_methods
for select
using (
  is_active = true
  and exists (
    select 1 from public.invoices
    where invoices.user_id = payment_methods.user_id
    and invoices.public_token is not null
  )
);

drop policy if exists "invoices are managed by owner" on public.invoices;
create policy "invoices are managed by owner"
on public.invoices
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public invoice pages can read invoices by token" on public.invoices;
create policy "public invoice pages can read invoices by token"
on public.invoices
for select
using (public_token is not null);

drop policy if exists "proofs are readable by invoice owner" on public.payment_proofs;
create policy "proofs are readable by invoice owner"
on public.payment_proofs
for select
using (
  exists (
    select 1 from public.invoices
    where invoices.id = payment_proofs.invoice_id
    and invoices.user_id = auth.uid()
  )
);

drop policy if exists "proofs are reviewable by invoice owner" on public.payment_proofs;
create policy "proofs are reviewable by invoice owner"
on public.payment_proofs
for update
using (
  exists (
    select 1 from public.invoices
    where invoices.id = payment_proofs.invoice_id
    and invoices.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = payment_proofs.invoice_id
    and invoices.user_id = auth.uid()
  )
);

drop policy if exists "public can upload invoice proofs" on public.payment_proofs;
create policy "public can upload invoice proofs"
on public.payment_proofs
for insert
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = payment_proofs.invoice_id
    and invoices.public_token is not null
  )
);

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "anyone can upload payment proof files" on storage.objects;
create policy "anyone can upload payment proof files"
on storage.objects
for insert
with check (bucket_id = 'payment-proofs');

drop policy if exists "anyone can read payment proof files" on storage.objects;
create policy "anyone can read payment proof files"
on storage.objects
for select
using (bucket_id = 'payment-proofs');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, business_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'business_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
