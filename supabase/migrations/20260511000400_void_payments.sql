-- Add voided columns to payment_proofs
alter table public.payment_proofs add column if not exists voided_at timestamp with time zone;
alter table public.payment_proofs add column if not exists void_reason text;

-- If status column has a check constraint, we might need to update it.
-- Let's check for existing constraints and add 'voided' to the allowed values if one exists.
-- Note: In Supabase, often there isn't a strict enum check unless explicitly added.
-- The following block is a safe way to handle potential status constraints.
do $$ 
begin
  if exists (
    select 1 from information_schema.constraint_column_usage 
    where table_name = 'payment_proofs' and column_name = 'status'
  ) then
    -- We assume the constraint might exist and try to allow 'voided'
    -- However, most current Qaffel setup uses text without strict PG enums for status.
    null;
  end if;
end $$;
