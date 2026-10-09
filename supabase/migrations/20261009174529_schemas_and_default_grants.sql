-- Start from zero (LLD 2.1, 2.4).
-- Supabase gives anon and authenticated full access to new objects in public by default.
-- Revoke that so every table grants only what it needs, in its own migration.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

-- The private schema: everything recruiters must never reach (candidates, companies,
-- searches, billing, SQL functions). Only the server's secret key (service_role) can use it.
create schema private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

alter default privileges for role postgres in schema private revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private grant all on tables to service_role;
alter default privileges for role postgres in schema private grant all on sequences to service_role;
alter default privileges for role postgres in schema private grant execute on functions to service_role;
