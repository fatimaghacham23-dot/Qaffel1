alter table public.invoices
add column if not exists approval_status text default 'not_required' check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
add column if not exists approved_at timestamp with time zone,
add column if not exists approved_by_name text,
add column if not exists approved_note text;
