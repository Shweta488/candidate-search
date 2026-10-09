-- Shortlists and their members (LLD 2.2), with Row Level Security (LLD 2.4).
-- Recruiters reach these tables with their own token, so every row is checked against
-- the caller's company. Another company's rows match nothing, which the API turns into 404.

create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  -- Set by the server from the recruiter lookup; the write rule rejects any other value.
  company_id uuid not null references private.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Names are unique per company, ignoring case.
create unique index shortlists_company_name_idx on public.shortlists (company_id, lower(name));

create table public.shortlist_members (
  shortlist_id uuid not null references public.shortlists (id) on delete cascade,
  candidate_id text not null references private.candidates (id),
  added_at timestamptz not null default now(),
  primary key (shortlist_id, candidate_id) -- adding twice is ON CONFLICT DO NOTHING
);

-- The candidate page asks which of the recruiter's lists a candidate is on.
create index shortlist_members_candidate_id_idx on public.shortlist_members (candidate_id);

alter table public.shortlists enable row level security;
alter table public.shortlist_members enable row level security;

-- "My company", evaluated once per statement.
create policy shortlists_my_company on public.shortlists
  for all to authenticated
  using (company_id = (select company_id from public.recruiters where user_id = (select auth.uid())))
  with check (company_id = (select company_id from public.recruiters where user_id = (select auth.uid())));

-- Members have no company_id: they belong to my company through their shortlist.
create policy shortlist_members_my_company on public.shortlist_members
  for all to authenticated
  using (
    exists (
      select 1 from public.shortlists s
      where s.id = shortlist_id
        and s.company_id = (select company_id from public.recruiters where user_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.shortlists s
      where s.id = shortlist_id
        and s.company_id = (select company_id from public.recruiters where user_id = (select auth.uid()))
    )
  );

-- Only what the API needs; nothing for anon. Only the name of a list can be changed.
grant select, insert, delete on public.shortlists to authenticated;
grant update (name) on public.shortlists to authenticated;
grant select, insert, delete on public.shortlist_members to authenticated;
grant all on public.shortlists, public.shortlist_members to service_role;
