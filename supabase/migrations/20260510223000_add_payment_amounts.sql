alter table public.payment_proofs
add column if not exists amount_usd numeric,
add column if not exists amount_lbp numeric,
add column if not exists payment_date date;
