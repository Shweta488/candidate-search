-- get_plan also returns the company's name, for the header and the Upgrade dialog
-- (LLD 4.6). Its output columns change, so it is dropped and created again; the grants
-- are restated because a dropped function loses them.

drop function private.get_plan(uuid);

-- The free plan allows 1 search in total.
create function private.get_plan(p_company_id uuid)
returns table (plan text, searches_remaining int, company_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case when private.is_paid(c.id) then 'paid' else 'free' end,
    case when private.is_paid(c.id) then null else greatest(1 - c.searches_used, 0) end,
    c.name
  from private.companies c
  where c.id = p_company_id;
$$;

revoke execute on function private.get_plan(uuid) from public, anon, authenticated;
grant execute on function private.get_plan(uuid) to service_role;
