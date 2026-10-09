-- Saved searches (LLD 2.2), with Row Level Security (LLD 2.4).
-- Recruiters reach this table with their own token, so every row is checked against
-- the caller's company. Another company's rows match nothing, which the API turns into 404.

create table public.saved_briefs (
  id uuid primary key default gen_random_uuid(),
  -- Set by the server from the recruiter lookup; the write rule rejects any other value.
  company_id uuid not null references private.companies (id) on delete cascade,
  brief text not null check (char_length(brief) between 1 and 500),
  filters jsonb not null, -- validated against the vocabulary by the API before insert
  created_at timestamptz not null default now()
);

-- The saved searches page lists a company's searches newest first.
create index saved_briefs_company_created_idx on public.saved_briefs (company_id, created_at desc);

alter table public.saved_briefs enable row level security;

-- "My company", evaluated once per statement.
create policy saved_briefs_my_company on public.saved_briefs
  for all to authenticated
  using (company_id = (select company_id from public.recruiters where user_id = (select auth.uid())))
  with check (company_id = (select company_id from public.recruiters where user_id = (select auth.uid())));

-- Only what the API needs; nothing for anon. No update: a saved search is never edited.
grant select, insert, delete on public.saved_briefs to authenticated;
grant all on public.saved_briefs to service_role;
