-- Validación de Operations Engine + Management Plans (BUILD 004) contra un
-- Postgres real, conectado como el rol "authenticated" (ver
-- 00_local_test_setup.sql). Cubre: resolución de Plan de Gestión (guardado y
-- anónimo), idempotencia de registrar_operacion, la máquina de estados
-- aplicada a nivel de trigger (incluida la inmutabilidad de account_id),
-- la cascada de capital (abrir es neutral, cerrar mueve capital, editar
-- mueve el delta, la reversión "fantasma" revierte exactamente lo que había),
-- audit_log, y aislamiento RLS — incluyendo el propio trigger de auditoría,
-- que es SECURITY DEFINER a propósito (mismo patrón de hallazgo que
-- risk_engine_apply_accumulator_update en BUILD 003).
--
-- Todas las llamadas usan notación con nombre (`p_x => valor`), nunca
-- posicional — hallazgo real de esta build: una llamada posicional a
-- aplicar_edicion_operacion escribió silenciosamente los valores en las
-- columnas equivocadas tras añadir un parámetro nuevo a la función, sin
-- ningún error de Postgres (ver el comentario junto a esa función en
-- operations.sql). Named args son inmunes a ese reordenamiento.
--
-- UUIDs 7777.../8888... — distintos de 01 (1111/2222) y 02 (3333/4444) por
-- la misma razón documentada en el README: los tres scripts corren contra la
-- misma base de datos, uno detrás del otro.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'trader-g@test.local'),
  ('88888888-8888-8888-8888-888888888888', 'trader-h@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);

select crear_empresa('Personal', true);
select id as cuenta_g_id from crear_cuenta(
  (select id from public.prop_firms where user_id = '77777777-7777-7777-7777-777777777777'),
  'Cuenta G', '10000.0000', 'USD', null
) \gset

\echo '--- [1] crear_plan_gestion (guardado, con nombre) ---'
select id as plan_id from crear_plan_gestion(
  p_name => 'Agresivo 5R', p_rr_objective => '5.0000', p_be_trigger => 'AFTER_NTH_PARTIAL',
  p_condiciones_ejecucion => 'Solo Londres/NY', p_etiqueta_riesgo => 'Agresivo', p_lambda_risk_aversion => '0.5000',
  p_partials => '[{"sequence":1,"rr_level":"1.0000","pct_close":"30.00"}]'::jsonb
) \gset

\echo '--- [2] registrar_operacion reutilizando el Plan guardado — esperado: management_plan_id = plan_id ---'
select id as trade_g_id, management_plan_id from registrar_operacion(
  p_account_id => :'cuenta_g_id'::uuid, p_symbol => 'EURUSD', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_idempotency_key => 'aaaaaaaa-0000-0000-0000-00000000e1e1'::uuid,
  p_management_plan_id => :'plan_id'::uuid
) \gset

\echo '--- [3] reintento con la MISMA idempotency_key — esperado: mismo trade_g_id, sin fila duplicada ---'
select id from registrar_operacion(
  p_account_id => :'cuenta_g_id'::uuid, p_symbol => 'EURUSD', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_idempotency_key => 'aaaaaaaa-0000-0000-0000-00000000e1e1'::uuid,
  p_management_plan_id => :'plan_id'::uuid
);
select count(*) as total_trades_g from trades where account_id = :'cuenta_g_id'::uuid;

\echo '--- [4] Plan anónimo (sin management_plan_id) — esperado: crea su propio management_plans, NO aparece en listar_planes_gestion ---'
select id as trade_g2_id from registrar_operacion(
  p_account_id => :'cuenta_g_id'::uuid, p_symbol => 'XAUUSD', p_side => 'short', p_opened_at => now(),
  p_risk_pct => '0.50', p_idempotency_key => 'aaaaaaaa-0000-0000-0000-00000000e2e2'::uuid,
  p_rr_objective => '2.0000', p_be_trigger => 'NONE', p_partials => '[]'::jsonb
) \gset
select count(*) as planes_guardados from listar_planes_gestion();

\echo '--- [5] capital tras abrir dos Operaciones — esperado: SIN cambios (10000.0000, capital-neutral) ---'
select current_capital from accounts where id = :'cuenta_g_id'::uuid;

-- BUILD 018 corrigió este fixture, no la aserción. Hasta 018 declaraba
-- `TAKE_PROFIT_FULL` con `r_max` 3.0000 sobre un Plan de `rr_objective`
-- 5.0000: un desenlace **imposible** — el precio nunca alcanzó el objetivo,
-- así que el take-profit no pudo ejecutarse entero. Nadie lo detectaba porque
-- nadie comprobaba la coherencia del desenlace. El trigger de 018 sí, y este
-- fixture fue el primero en caer.
--
-- El desenlace real que describen estos números es otro: sin parciales
-- ejecutados (k=0) y sin cierre manual, la fórmula congelada da R_final = −1,
-- no 1.5. Para que R_final valga 1.5000 el cierre tiene que ser **manual** a
-- 1.5R (prioridad 1 de `R_cierre_resto`), con 1.5 ≤ r_max = 3.0.
--
-- La aserción de dominio —la cascada de capital: 10000 → 10150— se conserva
-- intacta; lo que cambia es que ahora los números cuentan una historia que
-- pudo ocurrir.
\echo '--- [6] aplicar_cierre_operacion (simula lo que packages/operations-engine escribiría tras invocar Risk Engine) — esperado: capital 10150.0000 ---'
select aplicar_cierre_operacion(
  p_trade_id => :'trade_g_id'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.5000', p_r_max => '3.0000', p_r_final => '1.5000', p_pnl_amount => '150.0000'
);
select current_capital from accounts where id = :'cuenta_g_id'::uuid;

-- BUILD 016B cerró la superficie: `authenticated` ya no tiene UPDATE sobre
-- `trades`. Estas dos sondas se ejecutan ahora en **dos niveles**, y los dos
-- prueban cosas distintas — la aserción de dominio original no se pierde, se
-- ejecuta donde sigue siendo alcanzable:
--   nivel A · como authenticated  → la puerta pública está cerrada;
--   nivel B · como propietario    → el trigger sigue siendo la frontera real,
--                                   incluso para quien salta RLS.
\set ON_ERROR_STOP off
\echo '--- [7a] reabrir por UPDATE crudo como authenticated — esperado: ERROR permission denied ---'
update trades set status = 'open' where id = :'trade_g_id'::uuid;
\echo '--- [8a] mover account_id por UPDATE crudo como authenticated — esperado: ERROR permission denied ---'
update trades set account_id = gen_random_uuid() where id = :'trade_g_id'::uuid;

reset role;
\echo '--- [7b] reabrir por UPDATE crudo como PROPIETARIO — esperado: ERROR INVALID_STATE_TRANSITION ---'
update trades set status = 'open' where id = :'trade_g_id'::uuid;
\echo '--- [8b] mover account_id por UPDATE crudo como PROPIETARIO — esperado: ERROR IMMUTABLE_ACCOUNT_ID ---'
update trades set account_id = gen_random_uuid() where id = :'trade_g_id'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\set ON_ERROR_STOP on

-- La corrección lleva el cierre manual de 1.5R a 2.0R: por eso se corrigen a
-- la vez `cierre_manual_rr`, `r_final` y `pnl_amount`. Corregir sólo `r_final`
-- dejaría la Operación diciendo "cerré a mano en 1.5R" y "acabé en 2.0R" a la
-- vez. La aserción de dominio —delta +50, capital 10200.0000— no cambia.
\echo '--- [9] aplicar_edicion_operacion con corrección de r_final/pnl (delta +50) — esperado: capital 10200.0000 ---'
select r_final, pnl_amount, cierre_manual_rr from aplicar_edicion_operacion(
  p_trade_id => :'trade_g_id'::uuid, p_cierre_manual_rr => '2.0000',
  p_r_final => '2.0000', p_pnl_amount => '200.0000'
);
select current_capital from accounts where id = :'cuenta_g_id'::uuid;

\echo '--- [10] audit_log registró la edición — esperado: >= 1 ---'
select count(*) as entradas_auditoria from audit_log where entity_type = 'trade' and entity_id = :'trade_g_id'::uuid;

\echo '--- [11] cancelar_operacion_fantasma SIN confirmación — esperado: ERROR CONFIRMATION_REQUIRED ---'
\set ON_ERROR_STOP off
select cancelar_operacion_fantasma(p_trade_id => :'trade_g_id'::uuid, p_motivo => 'nunca ocurrió', p_confirmacion => false);
\set ON_ERROR_STOP on

\echo '--- [12] cancelar_operacion_fantasma CON confirmación — esperado: capital revertido exactamente a 10000.0000 ---'
select cancelar_operacion_fantasma(p_trade_id => :'trade_g_id'::uuid, p_motivo => 'nunca ocurrió', p_confirmacion => true);
select current_capital from accounts where id = :'cuenta_g_id'::uuid;

\echo '--- [13] cancelación simple sobre la Operación abierta sin parciales ejecutados — esperado: status=cancelled ---'
select id, status from cancelar_operacion(p_trade_id => :'trade_g2_id'::uuid, p_motivo => 'entrada duplicada por error');

\echo '--- [14] registrar_parcial_ejecutado + intento de cancelación simple CON parcial ejecutado — esperado: ERROR (0 parciales exigido) ---'
select id as trade_g3_id from registrar_operacion(
  p_account_id => :'cuenta_g_id'::uuid, p_symbol => 'US30', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_idempotency_key => 'aaaaaaaa-0000-0000-0000-00000000e3e3'::uuid,
  p_rr_objective => '3.0000', p_be_trigger => 'NONE', p_partials => '[]'::jsonb
) \gset
select registrar_parcial_ejecutado(
  p_trade_id => :'trade_g3_id'::uuid, p_sequence => 1, p_rr_level => '1.0000', p_pct_close => '50.00', p_executed_at => now()
);
\set ON_ERROR_STOP off
select cancelar_operacion(p_trade_id => :'trade_g3_id'::uuid, p_motivo => 'intento inválido');
\set ON_ERROR_STOP on

select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);

\echo '--- [15] H: SELECT directo sobre trades de G — esperado: 0 ---'
select count(*) as filas_visibles_para_h from public.trades where account_id = :'cuenta_g_id'::uuid;

\echo '--- [16] H: SELECT directo sobre management_plans de G — esperado: 0 ---'
select count(*) as planes_visibles_para_h from public.management_plans where user_id = '77777777-7777-7777-7777-777777777777';

\echo '--- [17] H: SELECT directo sobre audit_log de G — esperado: 0 ---'
select count(*) as auditoria_visible_para_h from public.audit_log where entity_id = :'trade_g_id'::uuid;

\echo '--- [18] H: registrar_operacion sobre la Cuenta de G — esperado: ERROR ACCOUNT_NOT_FOUND ---'
\set ON_ERROR_STOP off
select registrar_operacion(
  p_account_id => :'cuenta_g_id'::uuid, p_symbol => 'EURUSD', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_idempotency_key => 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  p_rr_objective => '3.0000', p_be_trigger => 'NONE', p_partials => '[]'::jsonb
);
\set ON_ERROR_STOP on

\echo '--- [19] H: aplicar_cierre_operacion sobre una Operación de G — esperado: ERROR TRADE_NOT_FOUND (RLS oculta la fila, no ACCOUNT_NOT_FOUND) ---'
\set ON_ERROR_STOP off
select aplicar_cierre_operacion(
  p_trade_id => :'trade_g3_id'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '0.4000', p_r_final => '-1.0000', p_pnl_amount => '-100.0000'
);
\set ON_ERROR_STOP on

reset role;
