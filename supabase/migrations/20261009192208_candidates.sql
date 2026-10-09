-- Candidates, their experiences and education (LLD 2.2, 2.3), and the vocabulary of
-- allowed filter values (LLD 3.2). Server only: RLS on with no policies.
-- The array columns marked "derived" are filled by the seed, so every filter is a
-- check on one row with no joins.

create table private.candidates (
  id text primary key, -- cand_0001, from the data
  full_name text not null,
  headline text not null,
  avatar_url text not null,
  current_title text not null,
  current_company text not null,
  current_company_logo_url text not null,
  role text not null,
  seniority text not null check (seniority in ('junior', 'mid', 'senior', 'staff')),
  years_experience int not null check (years_experience between 0 and 60),
  city text not null,
  state text not null,
  country text not null,
  open_to_work boolean not null,
  skills text[] not null,
  past_companies text[] not null, -- derived: every experience's company
  past_company_types text[] not null, -- derived: every experience's company type
  schools text[] not null, -- derived from education
  degrees text[] not null, -- derived from education
  fields_of_study text[] not null -- derived from education
);

create index candidates_skills_idx on private.candidates using gin (skills);
create index candidates_past_company_types_idx on private.candidates using gin (past_company_types);
create index candidates_role_seniority_idx on private.candidates (role, seniority);
create index candidates_city_idx on private.candidates (city);

create table private.experiences (
  id bigint generated always as identity primary key,
  candidate_id text not null references private.candidates (id) on delete cascade,
  position int not null, -- order in the source file; 0 is the current job
  title text,
  company text,
  company_logo_url text,
  company_type text,
  start_year int not null,
  end_year int, -- null means current
  description text,
  unique (candidate_id, position)
);

create table private.educations (
  id bigint generated always as identity primary key,
  candidate_id text not null references private.candidates (id) on delete cascade,
  school text,
  degree text,
  field text,
  graduation_year int
);

create index educations_candidate_id_idx on private.educations (candidate_id);

alter table private.candidates enable row level security;
alter table private.experiences enable row level security;
alter table private.educations enable row level security;
grant all on private.candidates, private.experiences, private.educations to service_role;

-- Every value a filter may use, sorted, plus the range of years of experience.
create function private.get_vocabulary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'roles', (select coalesce(jsonb_agg(distinct role order by role), '[]') from private.candidates),
    'seniorities', (select coalesce(jsonb_agg(distinct seniority order by seniority), '[]') from private.candidates),
    'cities', (select coalesce(jsonb_agg(distinct city order by city), '[]') from private.candidates),
    'states', (select coalesce(jsonb_agg(distinct state order by state), '[]') from private.candidates),
    'skills', (select coalesce(jsonb_agg(distinct v order by v), '[]') from private.candidates, unnest(skills) v),
    'companies', (select coalesce(jsonb_agg(distinct v order by v), '[]') from private.candidates, unnest(past_companies) v),
    'company_types', (select coalesce(jsonb_agg(distinct v order by v), '[]') from private.candidates, unnest(past_company_types) v),
    'schools', (select coalesce(jsonb_agg(distinct v order by v), '[]') from private.candidates, unnest(schools) v),
    'degrees', (select coalesce(jsonb_agg(distinct v order by v), '[]') from private.candidates, unnest(degrees) v),
    'fields_of_study', (select coalesce(jsonb_agg(distinct v order by v), '[]') from private.candidates, unnest(fields_of_study) v),
    'years_experience', (
      select jsonb_build_object('min', coalesce(min(years_experience), 0), 'max', coalesce(max(years_experience), 0))
      from private.candidates
    )
  );
$$;

revoke execute on function private.get_vocabulary() from public, anon, authenticated;
grant execute on function private.get_vocabulary() to service_role;
