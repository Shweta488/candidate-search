-- Closer matches first (LLD 3.6). Same signature as before, so the API is unchanged;
-- create or replace keeps the existing grants (EXECUTE for service_role only).
-- Every result still matches every filter: this only changes who comes first.

create or replace function private.run_search(
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

  -- Ranking: closer matches first, then open to work, then most experienced, then id so
  -- ties are stable. "Closer" counts the brief's values a candidate matches in the fields
  -- where one person can match several; a field not in the brief adds 0 (any(null) never
  -- matches).
  insert into private.search_results (search_id, rank, candidate_id)
  select
    v_search_id,
    row_number() over (
      order by
        (select count(*) from unnest(c.past_companies) v where v = any (p_companies))
          + (select count(*) from unnest(c.past_company_types) v where v = any (p_company_types))
          + (select count(*) from unnest(c.schools) v where v = any (p_schools))
          + (select count(*) from unnest(c.degrees) v where v = any (p_degrees))
          + (select count(*) from unnest(c.fields_of_study) v where v = any (p_fields)) desc,
        c.open_to_work desc,
        c.years_experience desc,
        c.id
    ),
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
