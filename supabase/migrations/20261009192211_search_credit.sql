-- Spending and giving back a search credit (LLD 4.6). The free plan allows 1 search.
--
-- spend_search_credit is one conditional UPDATE. Concurrent calls for one company
-- queue on the row lock, and each re-checks searches_used after the one before it
-- commits, so exactly one free search succeeds. No row returned means the limit is
-- reached. searches_remaining is null on the paid plan.

create function private.spend_search_credit(p_company_id uuid)
returns table (searches_remaining int)
language sql
volatile
security invoker
set search_path = ''
as $$
  update private.companies
  set searches_used = searches_used + 1
  where id = p_company_id
    and (private.is_paid(p_company_id) or searches_used < 1)
  returning case when private.is_paid(p_company_id) then null else 1 - searches_used end;
$$;

-- Used when the search could not run (the LLM failed). Never goes below 0.
create function private.refund_search_credit(p_company_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update private.companies
  set searches_used = greatest(searches_used - 1, 0)
  where id = p_company_id;
$$;

revoke execute on function private.spend_search_credit(uuid), private.refund_search_credit(uuid)
  from public, anon, authenticated;
grant execute on function private.spend_search_credit(uuid), private.refund_search_credit(uuid)
  to service_role;
