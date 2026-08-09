-- Validación del vínculo Intención → Operación — B8 + B7-mín (BUILD 017)
-- contra Postgres real.
--
-- Cubre exclusivamente lo que BUILD 017 construye: `abrir_operacion_desde_intencion`
-- como única vía de materialización, el nacimiento de la Operación desde el
-- Plan **congelado** (nunca el vivo), la ventana de vigencia, la idempotencia
-- por clave y por estado, la atomicidad, el aislamiento entre usuarios, los
-- contratos de lectura mínimos y la inmutabilidad de los hechos heredados.
--
-- **No prueba la caducidad programada (B6) ni el desenlace `rejected` /
-- `discarded` por contrato (B9)**: no existen todavía. Los estados terminales
-- que aquí se preparan se fijan por escritura directa como propietario, que es
-- precisamente lo que ningún usuario puede hacer (comprobación [16]).
--
-- La carrera real de dos sesiones simultáneas sobre el mismo destino vive en
-- `12_concurrency_a.sql` / `12_concurrency_b.sql` — ver README.
--
-- UUIDs ad17.../be17... — distintos de los de 01-11.

\set ON_ERROR_STOP off

insert into auth.users (id, email) values
  ('ad17ad17-1717-1717-1717-ad17ad17ad17', 'binding-a@test.local'),
  ('be17be17-1717-1717-1717-be17be17be17', 'binding-b@test.local')
on conflict (id) do nothing;

-- ============================================================
-- Sembrado. Todo por los contratos existentes.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);
select crear_empresa('Personal', true);
select id as firm_a from public.prop_firms where user_id = 'ad17ad17-1717-1717-1717-ad17ad17ad17' \gset

select id as cta_1 from crear_cuenta(:'firm_a'::uuid, 'Cuenta 1', '10000.0000', 'USD', null) \gset
select id as cta_2 from crear_cuenta(:'firm_a'::uuid, 'Cuenta 2', '20000.0000', 'USD', null) \gset
select id as cta_3 from crear_cuenta(:'firm_a'::uuid, 'Cuenta 3', '30000.0000', 'USD', null) \gset
select id as cta_4 from crear_cuenta(:'firm_a'::uuid, 'Cuenta 4', '40000.0000', 'USD', null) \gset
select id as cta_5 from crear_cuenta(:'firm_a'::uuid, 'Cuenta 5', '50000.0000', 'USD', null) \gset
select id as cta_6 from crear_cuenta(:'firm_a'::uuid, 'Cuenta 6', '60000.0000', 'USD', null) \gset

select id as plan_a from crear_plan_gestion(
  p_name => 'Plan Vinculo', p_rr_objective => '3.0000', p_be_trigger => 'AFTER_NTH_PARTIAL',
  p_partials => '[{"sequence":1,"rr_level":"1.0000","pct_close":"50.00"},
                  {"sequence":2,"rr_level":"2.0000","pct_close":"25.00"}]'::jsonb
) \gset
select id as plan_arch from crear_plan_gestion(
  p_name => 'Plan Archivable', p_rr_objective => '2.0000', p_be_trigger => 'NONE'
) \gset

-- Usuario B: su propia Intención, que A nunca debe poder tocar.
select set_config('request.jwt.claim.sub', 'be17be17-1717-1717-1717-be17be17be17', false);
select crear_empresa('Personal', true);
select id as firm_b from public.prop_firms where user_id = 'be17be17-1717-1717-1717-be17be17be17' \gset
select id as cta_b from crear_cuenta(:'firm_b'::uuid, 'Cuenta Ajena', '5000.0000', 'USD', null) \gset
select id as plan_b from crear_plan_gestion(p_name => 'Plan Ajeno', p_rr_objective => '1.5000') \gset
select id as intent_b from crear_intencion_de_gestion(
  p_side => 'short', p_instrument_key => 'GBPUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_b', :'plan_b')::jsonb
) \gset
select id as dest_b from public.management_intent_destinations where intent_id = :'intent_b'::uuid \gset

select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

\echo ''
\echo '============================================================'
\echo ' HAPPY PATH — la Intención se convierte en Operación'
\echo '============================================================'

select id as intent_1 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_1', :'plan_a')::jsonb
) \gset
select id as dest_1 from public.management_intent_destinations where intent_id = :'intent_1'::uuid \gset

\echo '--- [1] abrir desde un destino pending — esperado: Operación creada ---'
select id as op_1 from abrir_operacion_desde_intencion(:'dest_1'::uuid, now(), null) \gset
select status, symbol, instrument_key, side, risk_pct, risk_amount, rr_objective, be_trigger
  from public.trades where id = :'op_1'::uuid;

\echo '--- [2] el destino queda materialized y apunta a la Operación — esperado: materialized / t ---'
select state, (trade_id = :'op_1'::uuid) as apunta_a_la_operacion
  from public.management_intent_destinations where id = :'dest_1'::uuid;

\echo '--- [3] management_plan_id = el Plan congelado (linaje I11) — esperado: t ---'
select (t.management_plan_id = (d.frozen_plan->>'plan_id')::uuid) as linaje_correcto
  from public.trades t, public.management_intent_destinations d
 where t.id = :'op_1'::uuid and d.id = :'dest_1'::uuid;

\echo '--- [4] parciales planificados copiados del congelado — esperado: 2 filas, 1.0000/50.00 y 2.0000/25.00 ---'
select sequence, rr_level, pct_close from public.trade_partials_planned
 where trade_id = :'op_1'::uuid order by sequence;

\echo '--- [5] risk_amount = capital vigente x riesgo resuelto — esperado: 100.0000 (10000 x 1%) ---'
select risk_amount from public.trades where id = :'op_1'::uuid;

\echo '--- [6] instrument_key copiado de la Intención, nunca del llamante — esperado: EURUSD / t ---'
select t.instrument_key, (t.instrument_key = i.instrument_key) as coincide_con_la_intencion
  from public.trades t, public.management_intents i
 where t.id = :'op_1'::uuid and i.id = :'intent_1'::uuid;

\echo '--- [7] la RPC no acepta Cuenta, Plan, riesgo, lado ni instrumento — esperado: solo 3 parámetros ---'
select pg_get_function_identity_arguments(p.oid) as firma
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'abrir_operacion_desde_intencion';

\echo '--- [8] se emitió OperacionRegistrada y NINGÚN evento nuevo de destino ---'
select event_type, count(*) from public.domain_events
 where payload->>'trade_id' = :'op_1' group by 1 order by 1;
select count(*) as eventos_de_desenlace_de_destino from public.domain_events
 where event_type ilike '%destino%' or event_type ilike '%Materializ%';

\echo ''
\echo '============================================================'
\echo ' SNAPSHOT — el Plan vivo nunca sustituye al congelado'
\echo '============================================================'

select id as intent_2 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_2', :'plan_a')::jsonb
) \gset
select id as dest_2 from public.management_intent_destinations where intent_id = :'intent_2'::uuid \gset

\echo '--- [9] se EDITA el Plan vivo (3.0000 -> 9.9900, AFTER_NTH_PARTIAL -> NONE, sin parciales) ---'
select (editar_plan_gestion(
  p_id => :'plan_a'::uuid, p_name => 'Plan Vinculo', p_rr_objective => '9.9900',
  p_be_trigger => 'NONE', p_partials => '[]'::jsonb)).id is not null as plan_editado;

\echo '--- [10] la Operación nace del CONGELADO — esperado: 3.0000 / AFTER_NTH_PARTIAL, nunca 9.9900 ---'
select id as op_2 from abrir_operacion_desde_intencion(:'dest_2'::uuid, now(), null) \gset
select rr_objective, be_trigger from public.trades where id = :'op_2'::uuid;
select count(*) as parciales_planificados from public.trade_partials_planned where trade_id = :'op_2'::uuid;

\echo '--- [11] el Plan vivo sigue editado — esperado: 9.9900 / NONE ---'
select rr_objective, be_trigger from public.management_plans where id = :'plan_a'::uuid;

\echo ''
\echo '--- [12] Plan ARCHIVADO — esperado: la apertura FUNCIONA (archivar no borra) ---'
select id as intent_3 from crear_intencion_de_gestion(
  p_side => 'short', p_instrument_key => 'NAS100', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"2.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_3', :'plan_arch')::jsonb
) \gset
select id as dest_3 from public.management_intent_destinations where intent_id = :'intent_3'::uuid \gset
-- `(...).id is not null` y no `... is not null`: un composite con cualquier
-- campo nulo hace falso el `IS NOT NULL` global, y este Plan deja nulos
-- `condiciones_ejecucion` y `etiqueta_riesgo` legítimamente. Mismo error
-- corregido en BUILD 012B y BUILD 015.
select (archivar_plan_gestion(:'plan_arch'::uuid)).id is not null as plan_archivado;
select id as op_3 from abrir_operacion_desde_intencion(:'dest_3'::uuid, now(), null) \gset
select status, instrument_key, side, rr_objective, risk_amount from public.trades where id = :'op_3'::uuid;

\echo ''
\echo '============================================================'
\echo ' VENTANA DE VIGENCIA'
\echo '============================================================'

select id as intent_4 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now() - interval '3 hours',
  p_valid_from => now() - interval '3 hours', p_valid_until => now() - interval '1 hour',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_4', :'plan_arch')::jsonb
) \gset
select id as dest_4 from public.management_intent_destinations where intent_id = :'intent_4'::uuid \gset

\echo '--- [13] ventana ya vencida — esperado: ERROR OUT_OF_WINDOW ---'
select abrir_operacion_desde_intencion(:'dest_4'::uuid, now(), null);

\echo '--- [14] tras el rechazo el destino sigue PENDING — esperado: pending / trade_id vacío ---'
select state, trade_id from public.management_intent_destinations where id = :'dest_4'::uuid;

-- Destino nuevo y PENDING con ventana vigente: usar aquí uno ya materializado
-- devolvería su Operación por la red de idempotencia antes de mirar la ventana,
-- y la comprobación no probaría nada.
select id as intent_15 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_2', :'plan_arch')::jsonb
) \gset
select id as dest_15 from public.management_intent_destinations where intent_id = :'intent_15'::uuid \gset

\echo '--- [15] opened_at ANTERIOR a valid_from — esperado: ERROR OUT_OF_WINDOW ---'
select abrir_operacion_desde_intencion(:'dest_15'::uuid, now() - interval '10 days', null);

\echo '--- [15b] y ese destino sigue PENDING — esperado: pending ---'
select state from public.management_intent_destinations where id = :'dest_15'::uuid;

\echo ''
\echo '============================================================'
\echo ' ESTADOS TERMINALES E IDEMPOTENCIA'
\echo '============================================================'

\echo '--- [16] destino YA materializado, sin clave — esperado: devuelve la MISMA Operación, no crea otra ---'
select id as reintento_1 from abrir_operacion_desde_intencion(:'dest_1'::uuid, now(), null) \gset
select (:'reintento_1' = :'op_1') as misma_operacion,
       (select count(*) from public.trades where account_id = :'cta_1'::uuid) as operaciones_en_la_cuenta;

\echo '--- [17] idempotencia por clave: dos llamadas con la misma clave — esperado: misma Operación, 1 fila ---'
select id as intent_5 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_5', :'plan_arch')::jsonb
) \gset
select id as dest_5 from public.management_intent_destinations where intent_id = :'intent_5'::uuid \gset
select id as op_5a from abrir_operacion_desde_intencion(:'dest_5'::uuid, now(), 'ad171717-0000-0000-0000-000000000001'::uuid) \gset
select id as op_5b from abrir_operacion_desde_intencion(:'dest_5'::uuid, now(), 'ad171717-0000-0000-0000-000000000001'::uuid) \gset
select (:'op_5a' = :'op_5b') as misma_operacion,
       (select count(*) from public.trades where account_id = :'cta_5'::uuid) as operaciones_en_la_cuenta;

\echo '--- [18] destino DISCARDED (fijado como propietario) — esperado: ERROR TERMINAL_STATE ---'
select id as intent_6 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_6', :'plan_arch')::jsonb
) \gset
select id as dest_6 from public.management_intent_destinations where intent_id = :'intent_6'::uuid \gset
reset role;
update public.management_intent_destinations set state = 'discarded' where id = :'dest_6'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);
select abrir_operacion_desde_intencion(:'dest_6'::uuid, now(), null);

\echo ''
\echo '============================================================'
\echo ' AISLAMIENTO Y ESCRITURA DIRECTA'
\echo '============================================================'

\echo '--- [19] destino inexistente — esperado: ERROR DESTINATION_NOT_FOUND ---'
select abrir_operacion_desde_intencion('00000000-0000-0000-0000-000000000000'::uuid, now(), null);

\echo '--- [20] destino AJENO (de B) — esperado: MISMO error, sin revelar que existe ---'
select abrir_operacion_desde_intencion(:'dest_b'::uuid, now(), null);

\echo '--- [21] B no ve ninguna Intención de A — esperado: 0 ---'
select set_config('request.jwt.claim.sub', 'be17be17-1717-1717-1717-be17be17be17', false);
select count(*) as intenciones_de_a_visibles_para_b from listar_intenciones()
 where instrument_key in ('EURUSD','NAS100');
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

\echo '--- [22] escritura DIRECTA sobre destinos como authenticated — esperado: 0 filas afectadas (RLS) ---'
update public.management_intent_destinations set state = 'materialized' where id = :'dest_4'::uuid;

\echo '--- [23] escritura DIRECTA de la declaración como PROPIETARIO — esperado: ERROR IMMUTABLE_DECLARATION ---'
reset role;
update public.management_intent_destinations set frozen_plan = '{"plan_id":"00000000-0000-0000-0000-000000000000"}'::jsonb
 where id = :'dest_4'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

\echo ''
\echo '============================================================'
\echo ' HECHOS HEREDADOS — inmutables mientras la Operación esté vinculada'
\echo '============================================================'

\echo '--- [24] editar rr_objective de una Operación VINCULADA — esperado: ERROR IMMUTABLE_INHERITED_FACT ---'
select aplicar_edicion_operacion(p_trade_id => :'op_1'::uuid, p_rr_objective => '7.7700');

\echo '--- [25] editar be_trigger de una Operación VINCULADA — esperado: ERROR ---'
select aplicar_edicion_operacion(p_trade_id => :'op_1'::uuid, p_be_trigger => 'NONE');

\echo '--- [26] editar symbol de una Operación VINCULADA — esperado: ERROR ---'
select aplicar_edicion_operacion(p_trade_id => :'op_1'::uuid, p_symbol => 'OTRO');

\echo '--- [27] editar side de una Operación VINCULADA — esperado: ERROR ---'
select aplicar_edicion_operacion(p_trade_id => :'op_1'::uuid, p_side => 'short');

\echo '--- [28] editar risk_pct de una Operación VINCULADA — esperado: ERROR ---'
select aplicar_edicion_operacion(p_trade_id => :'op_1'::uuid, p_risk_pct => '5.00');

\echo '--- [29] los campos de DESENLACE sí se editan — esperado: notes actualizado, sin error ---'
select (aplicar_edicion_operacion(p_trade_id => :'op_1'::uuid, p_notes => 'nota de desenlace')).notes as notes;

\echo '--- [30] cerrar una Operación vinculada sigue funcionando — esperado: closed ---'
select status, r_final, pnl_amount from aplicar_cierre_operacion(
  :'op_1'::uuid, now(), 'TAKE_PROFIT_FULL', null, '2.5000', '0.5000', '50.0000');

\echo '--- [31] una Operación NO vinculada sí admite editar rr_objective — esperado: 4.4400 ---'
select id as op_libre from registrar_operacion(
  p_account_id => :'cta_4'::uuid, p_symbol => 'LIBRE', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan_arch'::uuid) \gset
select (aplicar_edicion_operacion(p_trade_id => :'op_libre'::uuid, p_rr_objective => '4.4400')).rr_objective;

\echo '--- [32] esa Operación libre tiene instrument_key NULO — esperado: t (aditiva, sin retrospectiva) ---'
select (instrument_key is null) as instrument_key_nulo, symbol from public.trades where id = :'op_libre'::uuid;

\echo ''
\echo '============================================================'
\echo ' ATOMICIDAD — fallo forzado a mitad de la materialización'
\echo '============================================================'

select id as intent_7 from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_4', :'plan_arch')::jsonb
) \gset
select id as dest_7 from public.management_intent_destinations where intent_id = :'intent_7'::uuid \gset

-- Inyección de fallo: un trigger temporal que revienta el INSERT en `trades`,
-- justo DESPUÉS de que el destino haya pasado a `sent`. Es la única forma
-- honesta de comprobar que la transición no sobrevive al fallo.
reset role;
create or replace function public.__test_fallo_insert() returns trigger language plpgsql as $$
begin raise exception 'FALLO_INYECTADO_DE_PRUEBA'; end; $$;
create trigger __test_fallo before insert on public.trades for each row execute function public.__test_fallo_insert();
set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

\echo '--- [33] fallo inyectado durante la creación — esperado: ERROR FALLO_INYECTADO_DE_PRUEBA ---'
select abrir_operacion_desde_intencion(:'dest_7'::uuid, now(), null);

reset role;
drop trigger __test_fallo on public.trades;
drop function public.__test_fallo_insert();
set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

\echo '--- [34] ROLLBACK TOTAL: el destino sigue PENDING y no hay Operación — esperado: pending / vacío / 0 ---'
select state, trade_id from public.management_intent_destinations where id = :'dest_7'::uuid;
select count(*) as operaciones_creadas_por_el_intento_fallido
  from public.trades where account_id = :'cta_4'::uuid and symbol = 'EURUSD';

\echo '--- [35] y el destino sigue pudiendo materializarse después — esperado: Operación creada ---'
select id as op_7 from abrir_operacion_desde_intencion(:'dest_7'::uuid, now(), null) \gset
select state, (trade_id = :'op_7'::uuid) as vinculada
  from public.management_intent_destinations where id = :'dest_7'::uuid;

\echo ''
\echo '============================================================'
\echo ' CONTRATOS DE LECTURA (B7-mín)'
\echo '============================================================'

\echo '--- [36] listar_intenciones devuelve, para un destino materializado, su Operación ---'
select i.instrument_key, d->>'state' as estado, (d->>'trade_id' is not null) as tiene_operacion
  from listar_intenciones() i, jsonb_array_elements(i.destinos) d
 where i.id = :'intent_1'::uuid;

\echo '--- [37] obtener_intencion devuelve la misma Intención — esperado: 1 fila, EURUSD ---'
select id = :'intent_1'::uuid as es_la_intencion_pedida, instrument_key from obtener_intencion(:'intent_1'::uuid);

\echo '--- [38] listar_destinos_disponibles NO ofrece destinos ya materializados ni caducados ---'
select count(*) filter (where destination_id = :'dest_1'::uuid) as materializado_ofrecido,
       count(*) filter (where destination_id = :'dest_4'::uuid) as caducado_ofrecido
  from listar_destinos_disponibles();

\echo '--- [39] el destino caducado aparece marcado como tal en la lectura — esperado: t ---'
select d->>'caducada' as caducada from listar_intenciones() i, jsonb_array_elements(i.destinos) d
 where i.id = :'intent_4'::uuid;

\echo ''
\echo '--- [40] sembrado para la carrera de dos sesiones (12_concurrency_a/b) ---'
select id as intent_carrera from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'CARRERA017', p_decided_at => now(),
  p_valid_until => now() + interval '6 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta_6', :'plan_arch')::jsonb
) \gset
select state, instrument_key from public.management_intent_destinations d
  join public.management_intents i on i.id = d.intent_id
 where i.id = :'intent_carrera'::uuid;

reset role;
