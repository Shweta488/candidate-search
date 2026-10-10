-- Two lists in one company may now have the same name (LLD 1.5): the API contract only
-- asks that creating a list returns its id, and the id, not the name, identifies a list.

drop index public.shortlists_company_name_idx;

-- Lists are read per company, newest first.
create index shortlists_company_created_idx on public.shortlists (company_id, created_at desc);
