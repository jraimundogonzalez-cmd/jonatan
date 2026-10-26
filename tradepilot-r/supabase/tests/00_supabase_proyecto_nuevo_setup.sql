-- Réplica mínima de un proyecto Supabase NUEVO, creado con «exponer
-- automáticamente nuevas tablas» desactivado (el defecto desde 2026). Solo la
-- usa la suite 17, en una base PROPIA: no mezclar con 00_local_test_setup.sql.
--
-- La diferencia con 00_local_test_setup.sql es exactamente lo que se quiere
-- probar: aquel concede select/insert/update/delete sobre todo `public` a
-- `authenticated` (con `alter default privileges`), y eso esconde cualquier
-- permiso que falte. Aquí NO se concede ningún permiso de lectura ni escritura
-- de tablas: los únicos que tendrá `authenticated` son los que concedan las
-- migraciones.
--
-- Lo que sí se reproduce, según la documentación de Supabase («Hardening the
-- Data API»), porque sobrevive a esa opción y podría cambiar el resultado:
--   · tablas: truncate, references y trigger siguen concedidos a los tres
--     roles (y maintain en PostgreSQL 17, que la API no usa y aquí se omite);
--   · secuencias: update;
--   · funciones: EXECUTE a los tres roles (el peor caso: no está documentado
--     si la opción lo retira; además PUBLIC conserva EXECUTE por el defecto
--     global de PostgreSQL).
-- Ninguno de ellos da SELECT/INSERT/UPDATE/DELETE, así que no esconde un
-- permiso de tabla que falte.
--
-- `public`: USAGE para PUBLIC es el defecto de PostgreSQL 15+ y no se toca.
--
-- Uso (base desechable, nunca la de la aplicación):
--   createdb tradepilot_permisos
--   psql -d tradepilot_permisos -f 00_supabase_proyecto_nuevo_setup.sql
--   for f in ../migrations/*.sql; do psql -d tradepilot_permisos -v ON_ERROR_STOP=1 -f "$f"; done
--   psql -d tradepilot_permisos -v ON_ERROR_STOP=1 -f ../functions/sql/funding.sql   (y los otros tres, en el orden de config.toml)
--   psql -d tradepilot_permisos -f 17_permisos_y_aislamiento.sql

\set ON_ERROR_STOP on

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- auth.uid() real lee un claim JWT; aquí, una variable de sesión.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Lo que el proyecto conserva con la opción desactivada (ver cabecera).
alter default privileges in schema public
  grant truncate, references, trigger on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant update on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
