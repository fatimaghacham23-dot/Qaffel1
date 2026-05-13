-- 1. Update the payment-proofs bucket to be private
update storage.buckets
set public = false
where id = 'payment-proofs';

-- 2. Drop existing overly-public policies for storage.objects
drop policy if exists "anyone can upload payment proof files" on storage.objects;
drop policy if exists "anyone can read payment proof files" on storage.objects;

-- 3. Policy to allow public uploads to the payment-proofs bucket
-- We keep this for public uploads via invoice pages, but we don't allow listing or reading.
create policy "public can upload payment proof files"
on storage.objects
for insert
with check (bucket_id = 'payment-proofs');

-- 4. Policy to allow authenticated owners to read their own payment proof files
-- This is necessary for generating signed URLs server-side with owner context
create policy "owners can read their payment proof files"
on storage.objects
for select
using (
  bucket_id = 'payment-proofs' 
  and (
    exists (
      select 1 from public.invoices
      where invoices.id::text = (storage.foldername(name))[1]
      and invoices.user_id = auth.uid()
    )
  )
);
