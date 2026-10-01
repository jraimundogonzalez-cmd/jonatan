-- Validación de Event Backbone (BUILD 006A) contra un Postgres real, como
-- el rol "authenticated". Cubre: emisión de los seis eventos del contrato,
-- secuencia monotónica, inmutabilidad del outbox, payload mínimo,
-- compatibilidad hacia atrás con BUILD 003/004, y aislamiento RLS.
--
-- Todas las llamadas usan notación con nombre, por la misma razón
-- documentada en 03_operations_engine.sql.
--
-- UUIDs 9999.../aaaa... — distintos de los de 01/02/03 porque los cuatro
-- scripts corren contra la misma base de datos, uno detrás del otro.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'trader-i@test.local'),
  ('aaaaaaaa-9999-9999-9999-999999999999', 'trader-j@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);

select crear_empresa('Personal', true);
select id as cuenta_i_id from crear_cuenta(
  (select id from public.prop_firms where user_id = '99999999-9999-9999-9999-999999999999'),
  'Cuenta I', '10000.0000', 'USD', null
) \gset

\echo '--- [1] crear_cuenta ya emitió CapitalRecalculado (evento inicial) — esperado: 1 ---'
select count(*) as capital_recalculado from public.domain_events
  where account_id = :'cuenta_i_id' and event_type = 'CapitalRecalculado';

\echo '--- [2] registrar_operacion emite OperacionRegistrada — esperado: 1 ---'
select id as trade_i_id from registrar_operacion(
  p_account_id => :'cuenta_i_id'::uuid, p_symbol => 'EURUSD', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_idempotency_key => 'cccccccc-0000-0000-0000-00000000a1a1'::uuid,
  p_rr_objective => '3.0000', p_be_trigger => 'NONE', p_partials => '[]'::jsonb
) \gset
select count(*) as operacion_registrada from public.domain_events
  where account_id = :'cuenta_i_id' and event_type = 'OperacionRegistrada';

\echo '--- [3] el reintento idempotente NO emite un segundo evento — esperado: sigue 1 ---'
select registrar_operacion(
  p_account_id => :'cuenta_i_id'::uuid, p_symbol => 'EURUSD', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_idempotency_key => 'cccccccc-0000-0000-0000-00000000a1a1'::uuid,
  p_rr_objective => '3.0000', p_be_trigger => 'NONE', p_partials => '[]'::jsonb
);
select count(*) as operacion_registrada_tras_reintento from public.domain_events
  where account_id = :'cuenta_i_id' and event_type = 'OperacionRegistrada';

\echo '--- [4] registrar_parcial_ejecutado emite ParcialEjecutado con su account_id resuelto — esperado: 1 fila, account_id no nulo ---'
select registrar_parcial_ejecutado(
  p_trade_id => :'trade_i_id'::uuid, p_sequence => 1, p_rr_level => '1.0000',
  p_pct_close => '50.00', p_executed_at => now()
);
select count(*) as parcial_ejecutado, count(account_id) as con_account_id
  from public.domain_events where event_type = 'ParcialEjecutado' and account_id = :'cuenta_i_id';

\echo '--- [5] cierre: emite OperacionCerrada Y CapitalRecalculado (dos hechos distintos) — esperado: 1 y 2 ---'
select aplicar_cierre_operacion(
  p_trade_id => :'trade_i_id'::uuid, p_closed_at => now(), p_closure_reason => 'TAKE_PROFIT_FULL',
  p_cierre_manual_rr => null, p_r_max => '3.0000', p_r_final => '1.5000', p_pnl_amount => '150.0000'
);
select
  (select count(*) from public.domain_events where account_id = :'cuenta_i_id' and event_type = 'OperacionCerrada') as cerrada,
  (select count(*) from public.domain_events where account_id = :'cuenta_i_id' and event_type = 'CapitalRecalculado') as capital;

\echo '--- [6] payload de OperacionCerrada lleva closure_reason, NUNCA copia del estado — esperado: TAKE_PROFIT_FULL, sin r_final ni pnl ---'
select payload->>'closure_reason' as closure_reason,
       (payload ? 'r_final') as copia_r_final,
       (payload ? 'pnl_amount') as copia_pnl
  from public.domain_events where account_id = :'cuenta_i_id' and event_type = 'OperacionCerrada';

\echo '--- [7] edición sin cambio de estado emite OperacionEditada — esperado: 1 ---'
select aplicar_edicion_operacion(p_trade_id => :'trade_i_id'::uuid, p_notes => 'corrección de nota');
select count(*) as operacion_editada from public.domain_events
  where account_id = :'cuenta_i_id' and event_type = 'OperacionEditada';

\echo '--- [8] cancelación fantasma emite OperacionCancelada con previous_status=closed — esperado: closed ---'
select cancelar_operacion_fantasma(p_trade_id => :'trade_i_id'::uuid, p_motivo => 'nunca ocurrió', p_confirmacion => true);
select payload->>'previous_status' as previous_status from public.domain_events
  where account_id = :'cuenta_i_id' and event_type = 'OperacionCancelada';

\echo '--- [9] SECUENCIA MONOTÓNICA: estrictamente creciente y sin nulos — esperado: t / 0 ---'
select
  bool_and(es_creciente) as estrictamente_creciente,
  count(*) filter (where event_sequence is null) as nulos
from (
  select event_sequence > lag(event_sequence) over (order by event_sequence) as es_creciente, event_sequence
  from public.domain_events where account_id = :'cuenta_i_id'
) s
where es_creciente is not null;

\echo '--- [10] el orden por secuencia refleja el orden causal real — esperado: Registrada, Parcial, Cerrada, Editada, Cancelada ---'
select string_agg(event_type, ' → ' order by event_sequence) as orden_causal
  from public.domain_events
  where account_id = :'cuenta_i_id' and event_type <> 'CapitalRecalculado';

\echo '--- [11] listar_eventos_pendientes devuelve en orden de secuencia — esperado: t ---'
select bool_and(ok) as en_orden from (
  select event_sequence >= lag(event_sequence) over () as ok
  from listar_eventos_pendientes(500)
) s where ok is not null;

\echo '--- [12] COMPATIBILIDAD BUILD 003: AcumuladorActualizado sigue emitiéndose y con secuencia ---'
select * from risk_engine_apply_accumulator_update(
  :'cuenta_i_id'::uuid, 'dddddddd-0000-0000-0000-00000000b1b1'::uuid, 'OperacionCerrada', 0, 1, 1.5000, 0.0000
);
select count(*) as acumulador_actualizado, count(event_sequence) as con_secuencia
  from public.domain_events where account_id = :'cuenta_i_id' and event_type = 'AcumuladorActualizado';

\echo '--- [13] INMUTABILIDAD: un UPDATE de contenido sobre un evento ya emitido no forma parte de ninguna vía del sistema ---'
\echo '        (se comprueba que ninguna función del esquema escribe sobre domain_events salvo INSERT)'
select count(*) as funciones_que_actualizan_domain_events
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc ilike '%update public.domain_events%';

select set_config('request.jwt.claim.sub', 'aaaaaaaa-9999-9999-9999-999999999999', false);

\echo '--- [14] RLS: J no ve ningún evento de I — esperado: 0 ---'
select count(*) as eventos_visibles_para_j from public.domain_events where account_id = :'cuenta_i_id';

\echo '--- [15] RLS: listar_eventos_pendientes de J no filtra eventos de I — esperado: 0 ---'
select count(*) as pendientes_de_i_visibles_para_j
  from listar_eventos_pendientes(500) where account_id = :'cuenta_i_id';

reset role;
