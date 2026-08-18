-- Validación de Risk Engine (BUILD 003) contra un Postgres real, conectado
-- como el rol "authenticated" (ver 00_local_test_setup.sql). Cubre:
-- provisión automática, actualización incremental, idempotencia,
-- concurrencia optimista, el outbox de eventos, y aislamiento RLS —
-- incluyendo el propio INSERT interno de la función atómica, que es donde
-- este build encontró un fallo real de RLS la primera vez que se ejecutó
-- esto contra un Postgres de verdad (ver comentarios en la migración
-- 20260803120400_risk_engine.sql).

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'trader-c@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'trader-d@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);

select crear_empresa('Personal', true);
select id as cuenta_a_id from crear_cuenta(
  (select id from public.prop_firms where user_id = '33333333-3333-3333-3333-333333333333'),
  'Cuenta A', '10000.0000', 'USD', null
) \gset

\echo '--- [1] Provisión automática — esperado: n=0 mean=0.0000 m2=0.0000 version=0 ---'
select n, mean, m2, version from public.account_risk_state where account_id = :'cuenta_a_id';

\echo '--- [2] Primera actualización incremental (R_final=1.5000) — esperado: applied=t version=1 ---'
select * from risk_engine_apply_accumulator_update(
  :'cuenta_a_id'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'OperacionCerrada', 0, 1, 1.5000, 0.0000
);

\echo '--- [3] Reintento del MISMO event_id — esperado: applied=f, estado SIN cambios (idempotencia) ---'
select * from risk_engine_apply_accumulator_update(
  :'cuenta_a_id'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'OperacionCerrada', 0, 1, 1.5000, 0.0000
);

\echo '--- [4] Versión obsoleta con event_id NUEVO — esperado: applied=f (conflicto de concurrencia, no se pierde la escritura en silencio) ---'
select * from risk_engine_apply_accumulator_update(
  :'cuenta_a_id'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'OperacionCerrada', 0, 2, 2.0000, 0.5000
);

\echo '--- [5] Reintento con la versión correcta (1) — esperado: applied=t version=2 ---'
select * from risk_engine_apply_accumulator_update(
  :'cuenta_a_id'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'OperacionCerrada', 1, 2, 2.0000, 0.5000
);

\echo '--- [6] Outbox — esperado: 2 eventos AcumuladorActualizado (uno por cada aplicación real) ---'
select count(*) as eventos_outbox from public.domain_events where account_id = :'cuenta_a_id' and event_type = 'AcumuladorActualizado';

\echo '--- [7] Ledger de idempotencia — esperado: 2 filas (el duplicado del paso 3 no insertó una segunda) ---'
select count(*) as eventos_procesados from public.risk_engine_processed_events where account_id = :'cuenta_a_id';

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);

\echo '--- [8] SELECT directo de B sobre account_risk_state de A — esperado: 0 ---'
select count(*) as filas_visibles_para_b from public.account_risk_state where account_id = :'cuenta_a_id';

-- BUILD 016B endureció esta comprobación y a la vez la hizo más legible. Hasta
-- 016B la función era `SECURITY INVOKER` **sin ninguna comprobación de
-- propiedad**: el aislamiento lo daba RLS, y el intento de B se saldaba con un
-- silencioso "0 filas". Al pasar a `SECURITY DEFINER` —necesario para poder
-- revocar el UPDATE directo sobre la tabla— RLS deja de filtrar dentro de la
-- función, así que la propiedad se comprueba explícitamente y el intento
-- ajeno recibe ahora un error tipado. La aserción no se pierde: se refuerza.
\echo '--- [9] Escritura de B sobre el acumulador de A — esperado: ERROR ACCOUNT_NOT_FOUND ---'
\set ON_ERROR_STOP off
select * from risk_engine_apply_accumulator_update(
  :'cuenta_a_id'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'OperacionCerrada', 2, 99, 99.0000, 99.0000
);
\set ON_ERROR_STOP on

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);

\echo '--- [10] Estado final de A, releído como A — esperado: SIN cambios del intento de B (n=2 mean=2.0000 m2=0.5000 version=2) ---'
select n, mean, m2, version from public.account_risk_state where account_id = :'cuenta_a_id';

reset role;
