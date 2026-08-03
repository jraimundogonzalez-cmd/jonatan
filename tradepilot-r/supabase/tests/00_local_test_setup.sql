-- Stub mínimo del esquema `auth` de Supabase + rol "authenticated" — permite
-- validar las migraciones contra un Postgres local real, sin un proyecto
-- Supabase disponible.
--
-- **Hallazgo metodológico real de BUILD 003**: ejecutar estos scripts como
-- el superusuario `postgres` (p.ej. `sudo -u postgres psql`) sin cambiar de
-- rol NO prueba nada sobre RLS — Postgres exime a los superusuarios (y al
-- propietario de la tabla) de toda política de row-level security sin
-- excepción. La primera vez que se ejecutó la validación de Risk Engine sin
-- `SET ROLE authenticated`, dos comprobaciones de aislamiento "pasaron" con
-- un resultado que en realidad significaba fallo total de RLS: el
-- Usuario B podía leer y escribir sobre la Cuenta del Usuario A sin
-- restricción. Cualquier validación de RLS contra un Postgres real DEBE
-- conectarse como un rol no-superusuario que tampoco sea propietario de las
-- tablas — exactamente lo que este script prepara.
--
-- Uso:
--   createdb tradepilot_test
--   psql -d tradepilot_test -f 00_local_test_setup.sql
--   for f in ../migrations/*.sql; do psql -d tradepilot_test -f "$f"; done
--   psql -d tradepilot_test -f ../functions/sql/funding.sql
--   psql -d tradepilot_test -f 01_funding_management_rls.sql
--   psql -d tradepilot_test -f 02_risk_engine.sql

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- auth.uid() real lee un claim JWT — aquí se simula con una variable de
-- sesión que cada test fija explícitamente con set_config(...).
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema auth to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- `grant ... on all tables in schema public` solo alcanza a las tablas que
-- YA EXISTEN en el momento en que se ejecuta este script. Este script corre
-- antes que las migraciones (ver orden de ejecución arriba), así que en una
-- base de datos recién creada no hay ninguna tabla todavía y el grant de
-- arriba no tiene nada a lo que aplicarse — las tablas que crean las
-- migraciones (prop_firms, accounts, account_risk_state, ...) quedarían sin
-- privilegios para "authenticated", produciendo "permission denied" (no un
-- fallo de RLS) en el primer INSERT/UPDATE real. `alter default privileges`
-- resuelve esto: aplica automáticamente a cualquier tabla que el mismo rol
-- que ejecuta este script (normalmente el superusuario que también corre las
-- migraciones) cree después, sin importar el orden.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
