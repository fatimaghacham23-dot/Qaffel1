alter table public.invoices
add column if not exists deposit_enabled boolean default false not null,
add column if not exists deposit_type text check (deposit_type in ('percent', 'fixed')),
add column if not exists deposit_percent numeric,
add column if not exists deposit_amount_usd numeric,
add column if not exists deposit_amount_lbp numeric,
add column if not exists deposit_note text;
