-- 001_serving_schema.sql
-- Serving layer for the Air Quality dashboard.
-- Gold marts are mirrored here from DuckDB by 04_sync_gold.py.
-- A read-only role (dashboard_reader) is granted SELECT so the Shiny app is
-- locked down to reads and cannot modify pipeline data.

create schema if not exists serving;

grant usage on schema serving to anon, authenticated;

-- Read-only role used by Shiny / dashboard.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dashboard_reader') then
    create role dashboard_reader nologin;
  end if;
end
$$;

grant usage on schema serving to dashboard_reader;

-- Tables are created dynamically by 04_sync_gold.py; apply grants to the
-- schema so future tables inherit read access.
alter default privileges in schema serving
  grant select on tables to dashboard_reader, anon, authenticated;