-- `auth.uid()` y `auth.role()` — las funciones que toda política RLS y toda
-- RPC `security definer` del proyecto usan para saber quién llama. Las provee
-- la plataforma Supabase, no GoTrue, así que se crean después de que GoTrue
-- haya construido su esquema.
--
-- Leen `request.jwt.claims`, que es donde PostgREST deposita el JWT ya
-- verificado. Se conserva también la lectura de `request.jwt.claim.sub` porque
-- es la que usan las suites SQL con `set_config`, y así el mismo esquema sirve
-- para la aplicación y para los tests.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$$;

grant usage on schema auth to anon, authenticated, postgres;
grant select on auth.users to anon, authenticated, postgres;
grant execute on function auth.uid(), auth.role() to anon, authenticated, postgres;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated, anon;
alter default privileges in schema public grant usage, select on sequences to authenticated;
