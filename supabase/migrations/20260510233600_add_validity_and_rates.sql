alter table public.invoices
add column if not exists valid_until timestamp with time zone,
add column if not exists exchange_rate_lbp_per_usd numeric,
add column if not exists rate_note text;
