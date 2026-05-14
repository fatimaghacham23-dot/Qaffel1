-- Expose business phone on client portal header for optional WhatsApp / contact UX (same profile.phone as pay page context).
create or replace function public.get_public_client_portal_header(p_token text)
returns table (
  client_name text,
  business_name text,
  full_name text,
  business_phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.name as client_name,
    p.business_name,
    p.full_name,
    p.phone as business_phone
  from public.clients c
  join public.profiles p on p.id = c.user_id
  where c.client_portal_token = p_token
  limit 1;
end;
$$;
