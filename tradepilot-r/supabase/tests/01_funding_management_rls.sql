-- Validación de aislamiento RLS de Funding Management (BUILD 001) contra un
-- Postgres real, conectado como el rol "authenticated" (ver 00_local_test_setup.sql
-- para por qué esto importa). Complementa, no sustituye, los tests de
-- integración de mvp-0.1.md §11.2 — aquellos verifican el contrato de la API
-- TypeScript; este verifica que la propia base de datos rechaza el acceso
-- cruzado, incluso saltándose por completo la capa de API.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trader-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'trader-b@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select crear_empresa('Personal', true);
select id as cuenta_a_id from crear_cuenta(
  (select id from public.prop_firms where user_id = '11111111-1111-1111-1111-111111111111'),
  'Cuenta A', '10000.0000', 'USD', null
) \gset

\echo '--- Depósito de 500 sobre la Cuenta de A ---'
select registrar_evento_capital(:'cuenta_a_id'::uuid, 'deposit', '500.0000', 'depósito de prueba');

\echo '--- Capital esperado: 10500.0000 / 10500.0000 ---'
select current_capital, peak_capital from public.accounts where id = :'cuenta_a_id';

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

\echo '--- [1] listar_cuentas() de B — esperado: 0 ---'
select count(*) as cuentas_de_b from listar_cuentas();

\echo '--- [2] SELECT directo de B sobre accounts de A — esperado: 0 ---'
select count(*) as filas from public.accounts where id = :'cuenta_a_id';

\echo '--- [3] SELECT directo de B sobre account_capital_events de A — esperado: 0 ---'
select count(*) as filas from public.account_capital_events where account_id = :'cuenta_a_id';

\echo '--- [4] SELECT directo de B sobre prop_firms de A — esperado: 0 ---'
select count(*) as filas from public.prop_firms where user_id = '11111111-1111-1111-1111-111111111111';

-- Nota: no se usa `do $$ ... $$` aquí porque psql NO interpola `:'variable'`
-- dentro de bloques con dollar-quoting — enviaría el ":'cuenta_a_id'" literal
-- al servidor (error de sintaxis), no el UUID. Se apaga ON_ERROR_STOP en su
-- lugar y se lee el resultado a mano, igual que el resto de este script.
\echo '--- [5] registrar_evento_capital de B sobre la Cuenta de A — esperado: ERROR FUNDING_ERROR:ACCOUNT_NOT_FOUND (no debe tener éxito) ---'
\set ON_ERROR_STOP off
select registrar_evento_capital(:'cuenta_a_id'::uuid, 'withdrawal', '-100.0000', 'intento no autorizado');
\set ON_ERROR_STOP on

reset role;
