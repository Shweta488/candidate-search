-- Subscriptions and the derived plan (LLD 2.2, 2.5, 4.6). The plan is never stored:
-- a company is paid while any of its subscriptions is active or trialing.

create table private.subscriptions (
  id text primary key, -- Stripe subscription id
  company_id uuid not null references private.companies (id) on delete cascade,
  status text not null,
  last_event_created bigint not null,
  last_event_id text not null,
  updated_at timestamptz not null default now()
);

create index subscriptions_company_id_idx on private.subscriptions (company_id);

alter table private.subscriptions enable row level security; -- no policies: server only
grant all on private.subscriptions to service_role;

create function private.is_paid(p_company_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from private.subscriptions
    where company_id = p_company_id
      and status in ('active', 'trialing')
  );
$$;

-- The free plan allows 1 search in total.
create function private.get_plan(p_company_id uuid)
returns table (plan text, searches_remaining int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case when private.is_paid(c.id) then 'paid' else 'free' end,
    case when private.is_paid(c.id) then null else greatest(1 - c.searches_used, 0) end
  from private.companies c
  where c.id = p_company_id;
$$;

revoke execute on function private.is_paid(uuid), private.get_plan(uuid) from public, anon, authenticated;
grant execute on function private.is_paid(uuid), private.get_plan(uuid) to service_role;
