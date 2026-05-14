-- Manual installment milestones (freelancer-defined). Not recurring billing or auto-charge.
alter table public.invoices
add column if not exists payment_plan jsonb;

comment on column public.invoices.payment_plan is 'Optional manual payment plan: milestones with amounts/due dates and optional satisfied_at when marked by owner.';
