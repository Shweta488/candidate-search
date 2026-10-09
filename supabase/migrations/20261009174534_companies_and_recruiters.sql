-- Companies (private) and the recruiters who belong to them (public, RLS). LLD 2.2, 2.4.

create table private.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- acme, globex; matches metadata.company in Stripe events
  name text not null,
  searches_used int not null default 0 check (searches_used >= 0)
);

alter table private.companies enable row level security; -- no policies: server only
grant all on private.companies to service_role;

create table public.recruiters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references private.companies (id)
);

create index recruiters_company_id_idx on public.recruiters (company_id);

alter table public.recruiters enable row level security;

-- A recruiter sees only their own row. There are no write grants, so the write rule
-- only matters if one is ever added by mistake.
create policy recruiters_own_row on public.recruiters
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.recruiters to authenticated;
grant all on public.recruiters to service_role;
