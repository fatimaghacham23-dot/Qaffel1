alter table public.profiles
add column if not exists business_address text,
add column if not exists default_currency text default 'USD' not null;
