-- Roles y funciones auxiliares que el stack de Supabase da por hechos.
--
-- `supabase start` los crea dentro de sus contenedores; aquí se crean a mano
-- porque el entorno Alpha corre los mismos servicios como procesos nativos
-- (ver scripts/alpha/README.md). El esquema `auth` NO se crea aquí: lo crea
-- GoTrue con sus propias 70 migraciones, igual que en un proyecto real.
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select from pg_roles where rolname='authenticator') then
    create role authenticator login password 'tpalpha' noinherit;
  end if;
  if not exists (select from pg_roles where rolname='supabase_auth_admin') then
    create role supabase_auth_admin login password 'tpalpha' createrole;
  end if;
end $$;

grant anon, authenticated to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
grant all on schema auth to supabase_auth_admin;
grant create, usage on schema public to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth, public;

-- ============================================================
-- Privilegios por omisión — FIELES a cómo los concede Supabase.
--
-- Supabase los concede en el MOMENTO DE CREAR cada objeto (`alter default
-- privileges`). Por eso una migración que después revoca algo —p. ej. el
-- `revoke insert, update, delete` de las tablas del importador, o el `revoke
-- execute` de `crear_operacion_nucleo` que cerró la tercera puerta de creación
-- de Operaciones en BUILD 016B— conserva su efecto.
--
-- Este arnés hacía lo contrario: un `grant ... on all tables/functions`
-- DESPUÉS de las migraciones, que volvía a conceder justo lo revocado. El
-- entorno quedaba más permisivo que el real y daba luces verdes falsas: la
-- suite 16 lo detectó, y `authenticated` podía ejecutar el núcleo de creación
-- de Operaciones.
--
-- Esto se ejecuta ANTES de las migraciones, así que cada objeto nace con sus
-- privilegios y las revocaciones posteriores sobreviven.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
