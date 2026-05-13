-- Add optional metadata fields for Whish Money and OMT Pay.
-- These are used for public payment cards and readiness checks.

alter table public.payment_methods
add column if not exists receiver_name text,
add column if not exists receiver_phone text,
add column if not exists account_reference text,
add column if not exists qr_image_path text,
add column if not exists external_link text;

