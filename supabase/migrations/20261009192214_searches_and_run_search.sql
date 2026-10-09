-- Stored searches and their ranked results (LLD 2.2), running a search (3.6) and
-- reading one page of it (3.7). Server only: RLS on with no policies.

create table private.searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references private.companies (id) on delete cascade,
  brief text not null,
  filters jsonb not null, -- the validated filters actually used
  unsupported text[] not null default '{}',
  total int not null,
  created_at timestamptz not null default now()
);

create index searches_company_id_created_at_idx on private.searches (company_id, created_at desc);

create table private.search_results (
  search_id uuid not null references private.searches (id) on delete cascade,
  rank int not null,
  candidate_id text not null references private.candidates (id),
  primary key (search_id, rank)
);

alter table private.searches enable row level security;
alter table private.search_results enable row level security;
grant all on private.searches, private.search_results to service_role;

-- Filters, ranks and stores every match in one transaction.
-- Each filter is its own typed parameter; null means "no constraint". p_filters is
-- only stored as a record of what was used, never read for matching.
-- p_return_nobody is true when part of the brief couldn't be filtered on, or nothing
-- could (LLD 3.5): the search is stored with 0 results.
create function private.run_search(
  p_company_id uuid,
  p_brief text,
  p_filters jsonb,
  p_unsupported text[],
  p_return_nobody boolean,
  p_roles text[] default null,
  p_seniorities text[] default null,
  p_cities text[] default null,
  p_states text[] default null,
  p_skills text[] default null,
  p_companies text[] default null,
  p_company_types text[] default null,
  p_schools text[] default null,
  p_degrees text[] default null,
  p_fields text[] default null,
  p_open_to_work boolean default null,
  p_min_years int default null,
  p_max_years int default null
)
returns table (search_id uuid, total int)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_search_id uuid;
  v_total int;
begin
  insert into private.searches (company_id, brief, filters, unsupported, total)
  values (p_company_id, p_brief, p_filters, p_unsupported, 0)
  returning id into v_search_id;

  -- Ranking: open to work first, then most experienced, then id so ties are stable.
  insert into private.search_results (search_id, rank, candidate_id)
  select
    v_search_id,
    row_number() over (order by c.open_to_work desc, c.years_experience desc, c.id),
    c.id
  from private.candidates c
  where not p_return_nobody
    and (p_roles is null or c.role = any (p_roles))
    and (p_seniorities is null or c.seniority = any (p_seniorities))
    and (p_cities is null or c.city = any (p_cities))
    and (p_states is null or c.state = any (p_states))
    and (p_skills is null or c.skills @> p_skills)
    and (p_companies is null or c.past_companies && p_companies)
    and (p_company_types is null or c.past_company_types && p_company_types)
    and (p_schools is null or c.schools && p_schools)
    and (p_degrees is null or c.degrees && p_degrees)
    and (p_fields is null or c.fields_of_study && p_fields)
    and (p_open_to_work is null or c.open_to_work = p_open_to_work)
    and (p_min_years is null or c.years_experience >= p_min_years)
    and (p_max_years is null or c.years_experience <= p_max_years);

  get diagnostics v_total = row_count;

  update private.searches set total = v_total where id = v_search_id;

  return query select v_search_id, v_total;
end;
$$;

-- One page (20 results) of a stored search, only if it belongs to p_company_id.
-- Returns null when there is no such search for this company (the API answers 404),
-- and an empty results list for a page past the end.
create function private.get_search_page(p_company_id uuid, p_search_id uuid, p_page int)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'search_id', s.id,
    'brief', s.brief,
    'filters', s.filters,
    'unsupported', to_jsonb(s.unsupported),
    'total', s.total,
    'results', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'full_name', c.full_name,
          'headline', c.headline,
          'avatar_url', c.avatar_url,
          'current_title', c.current_title,
          'current_company', c.current_company,
          'current_company_logo_url', c.current_company_logo_url,
          'city', c.city,
          'state', c.state,
          'seniority', c.seniority,
          'years_experience', c.years_experience,
          'open_to_work', c.open_to_work,
          'skills', to_jsonb(c.skills)
        )
        order by r.rank
      )
      from private.search_results r
      join private.candidates c on c.id = r.candidate_id
      where r.search_id = s.id
        and r.rank between (greatest(p_page, 1) - 1) * 20 + 1 and greatest(p_page, 1) * 20
    ), '[]'::jsonb)
  )
  from private.searches s
  where s.id = p_search_id
    and s.company_id = p_company_id;
$$;

revoke execute on function
  private.run_search(uuid, text, jsonb, text[], boolean, text[], text[], text[], text[], text[], text[], text[],
                     text[], text[], text[], boolean, int, int),
  private.get_search_page(uuid, uuid, int)
  from public, anon, authenticated;
grant execute on function
  private.run_search(uuid, text, jsonb, text[], boolean, text[], text[], text[], text[], text[], text[], text[],
                     text[], text[], text[], boolean, int, int),
  private.get_search_page(uuid, uuid, int)
  to service_role;
