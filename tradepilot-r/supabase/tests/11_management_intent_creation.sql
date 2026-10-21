-- Validación de la creación atómica de Management Intent — B5 (BUILD 015)
-- contra Postgres real.
--
-- Cubre exclusivamente lo que B5 construye: `crear_intencion_de_gestion` como
-- único punto de escritura del agregado, sus comprobaciones de propiedad bajo
-- SECURITY DEFINER, el congelado del Plan, la aplicación del tope de riesgo,
-- la idempotencia y la atomicidad total.
--
-- **No prueba la caducidad (B6), los contratos de lectura (B7), la
-- reclamación (B8) ni el desenlace (B9)**: no existen todavía.
--
-- La carrera real de dos sesiones simultáneas con la misma clave de
-- idempotencia vive en `11_concurrency_a.sql` / `11_concurrency_b.sql`, que no
-- pueden ejecutarse desde un único psql — ver README.
--
-- UUIDs 8b8b.../9c9c... — distintos de los de 01-10.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', 'trader-x@test.local'),
  ('9c9c9c9c-6060-6060-6060-9c9c9c9c9c9c', 'trader-y@test.local')
on conflict (id) do nothing;

-- ============================================================
-- Sembrado. Todo por los contratos existentes — B5 no toca Funding ni
-- Operations, y estas pruebas tampoco.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);
select crear_empresa('Personal', true);
select id as firm_x_id from public.prop_firms where user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b' \gset

select id as cuenta_libre_id from crear_cuenta(:'firm_x_id'::uuid, 'Cuenta Libre', '10000.0000', 'USD', null) \gset
select id as cuenta_topada_id from crear_cuenta(:'firm_x_id'::uuid, 'Cuenta Topada', '20000.0000', 'USD', null) \gset
select id as cuenta_holgada_id from crear_cuenta(:'firm_x_id'::uuid, 'Cuenta Holgada', '5000.0000', 'USD', null) \gset

-- La Cuenta Topada admite como mucho 1.00%; la Holgada, 5.00%; la Libre, nada.
update public.accounts set max_risk_pct = 1.00 where id = :'cuenta_topada_id';
update public.accounts set max_risk_pct = 5.00 where id = :'cuenta_holgada_id';

-- Un Plan con parciales y otro sin ellos.
select id as plan_x_id from crear_plan_gestion(
  p_name => 'Plan X', p_rr_objective => '3.0000', p_be_trigger => 'AFTER_NTH_PARTIAL',
  p_condiciones_ejecucion => 'solo Londres', p_etiqueta_riesgo => 'conservador',
  p_partials => '[{"sequence":1,"rr_level":"1.0000","pct_close":"50.00"},
                  {"sequence":2,"rr_level":"2.0000","pct_close":"25.00"}]'::jsonb
) \gset
select id as plan_simple_id from crear_plan_gestion(
  p_name => 'Plan Simple', p_rr_objective => '2.0000', p_be_trigger => 'NONE'
) \gset

-- Usuario Y: una Cuenta y un Plan que X nunca debe poder tocar.
select set_config('request.jwt.claim.sub', '9c9c9c9c-6060-6060-6060-9c9c9c9c9c9c', false);
select crear_empresa('Personal', true);
select id as firm_y_id from public.prop_firms where user_id = '9c9c9c9c-6060-6060-6060-9c9c9c9c9c9c' \gset
select id as cuenta_ajena_id from crear_cuenta(:'firm_y_id'::uuid, 'Cuenta Ajena', '1000.0000', 'USD', null) \gset
select id as plan_ajeno_id from crear_plan_gestion(p_name => 'Plan Ajeno', p_rr_objective => '1.5000') \gset

select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);

\echo ''
\echo '============================================================'
\echo ' CREACIÓN CORRECTA'
\echo '============================================================'

\echo '--- [1] una Intención con un destino — esperado: fila creada, contract_version 1 ---'
-- `\gset` no imprime la fila que consume; las aserciones se muestran justo
-- después leyendo la fila ya creada.
select id as intent_1_id from crear_intencion_de_gestion(
    p_side              => 'long',
    p_instrument_key    => 'EURUSD',
    p_decided_at        => now(),
    p_valid_until       => now() + interval '30 minutes',
    p_destinations      => format(
      '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"0.75",
         "risk_transformation":{"kind":"absolute"}}]',
      :'cuenta_libre_id', :'plan_x_id')::jsonb
  ) \gset

\echo '        esperado: long / EURUSD / 1 / t / t'
select side, instrument_key, contract_version,
       (user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b') as propietario_ok,
       (valid_from = decided_at) as valid_from_por_defecto_ok
  from public.management_intents where id = :'intent_1_id';

\echo '--- [2] el destino existe, nace en pending y sin Operación — esperado: 1 / pending / t ---'
select count(*) as destinos, min(state) as estado, bool_and(trade_id is null) as sin_operacion
  from public.management_intent_destinations where intent_id = :'intent_1_id';

\echo '--- [3] el evento de B3 se emitió a través de la función — esperado: 1 ---'
select count(*) as eventos from public.domain_events
  where event_type = 'IntencionDeGestionEmitida' and payload->>'intent_id' = :'intent_1_id';

\echo ''
\echo '--- [4] MÚLTIPLES DESTINOS: tres Cuentas en una sola decisión — esperado: 3 ---'
select id as intent_3_id from crear_intencion_de_gestion(
    p_side           => 'short',
    p_instrument_key => 'NAS100',
    p_decided_at     => now(),
    p_valid_until    => now() + interval '15 minutes',
    p_destinations   => format(
      '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"2.00",
         "risk_transformation":{"kind":"absolute"}},
        {"account_id":"%s","management_plan_id":"%s","risk_pct":"2.00",
         "risk_transformation":{"kind":"ratio","operand":"1.0000"}},
        {"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
         "risk_transformation":{"kind":"ratio","operand":"0.5000"}}]',
      :'cuenta_libre_id',   :'plan_x_id',
      :'cuenta_topada_id',  :'plan_simple_id',
      :'cuenta_holgada_id', :'plan_x_id')::jsonb
  ) \gset

select count(*) as destinos,
       count(distinct account_id) as cuentas_distintas,
       bool_and(intent_id = :'intent_3_id') as todos_de_la_misma_intencion
  from public.management_intent_destinations where intent_id = :'intent_3_id';

\echo '        un solo evento pese a los tres destinos — esperado: 1'
select count(*) as eventos from public.domain_events
  where event_type = 'IntencionDeGestionEmitida' and payload->>'intent_id' = :'intent_3_id';

\echo ''
\echo '============================================================'
\echo ' TOPE DE RIESGO (A4) — se recorta y se explica, nunca en silencio'
\echo '============================================================'

\echo '--- [5] Cuenta SIN tope: 2.00% pedido = 2.00% resuelto — esperado: f / null / 2.00 / 2.00 ---'
select risk_cap_applied, coalesce(risk_cap_reason, '(null)') as motivo,
       risk_transformation->>'requested_risk_pct' as pedido,
       risk_transformation->>'resolved_risk_pct'  as resuelto
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_libre_id';

\echo '--- [6] Cuenta CON tope 1.00% y 2.00% pedido: recorte — esperado: t / motivo / 2.00 / 1.00 ---'
select risk_cap_applied, risk_cap_reason,
       risk_transformation->>'requested_risk_pct' as pedido,
       risk_transformation->>'resolved_risk_pct'  as resuelto
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_topada_id';

\echo '--- [7] Cuenta CON tope 5.00% y 1.00% pedido: NO se toca — esperado: f / null / 1.00 / 1.00 ---'
select risk_cap_applied, coalesce(risk_cap_reason, '(null)') as motivo,
       risk_transformation->>'requested_risk_pct' as pedido,
       risk_transformation->>'resolved_risk_pct'  as resuelto
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_holgada_id';

\echo '--- [8] I13: la FORMA declarada sobrevive intacta junto al resultado ---'
\echo '        "0.5x la máster" sigue siendo legible como decisión — esperado: ratio / 0.5000'
select risk_transformation->>'kind' as forma, risk_transformation->>'operand' as operando
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_holgada_id';

\echo '--- [9] I5: TODO número dentro de los dos jsonb es cadena — esperado: t en las 5 ---'
select jsonb_typeof(risk_transformation->'requested_risk_pct') = 'string' as pedido_cadena,
       jsonb_typeof(risk_transformation->'resolved_risk_pct')  = 'string' as resuelto_cadena,
       jsonb_typeof(frozen_plan->'rr_objective')               = 'string' as rr_cadena,
       jsonb_typeof(frozen_plan->'partials'->0->'rr_level')    = 'string' as rr_level_cadena,
       jsonb_typeof(frozen_plan->'partials'->0->'pct_close')   = 'string' as pct_cadena
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_libre_id';

\echo '--- [10] el tope NUNCA se copia al destino: solo consta que se aplicó (A4) ---'
\echo '         Esperado: f — ninguna clave del jsonb contiene el valor del tope.'
select (risk_transformation ? 'max_risk_pct') as tope_duplicado
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_topada_id';

\echo ''
\echo '============================================================'
\echo ' SNAPSHOT DEL PLAN (regla 13)'
\echo '============================================================'

\echo '--- [11] el Plan queda congelado entero: objetivo, BE y los dos parciales ---'
select frozen_plan->>'plan_id' = :'plan_x_id' as plan_id_trazado,
       frozen_plan->>'rr_objective' as rr_objective,
       frozen_plan->>'be_trigger'   as be_trigger,
       jsonb_array_length(frozen_plan->'partials') as parciales
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_libre_id';

\echo '--- [12] se congela el MISMO subconjunto que snapshota `trades`, no más ---'
\echo '         `condiciones_ejecucion` y `etiqueta_riesgo` son metadata descriptiva'
\echo '         que no participa en ningún cálculo de R_final (BUILD 004). Esperado: f / f'
select (frozen_plan ? 'condiciones_ejecucion') as condiciones_congeladas,
       (frozen_plan ? 'etiqueta_riesgo')       as etiqueta_congelada
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_libre_id';

\echo '--- [13] REGLA 13 EN VIVO: editar el Plan NO reescribe ninguna Intención pasada ---'
-- `.id is not null` y no `... is not null` a secas: en SQL, un compuesto
-- `IS NOT NULL` exige que TODOS sus campos lo sean, y este Plan deja
-- `condiciones_ejecucion`/`etiqueta_riesgo` en NULL legítimamente. Mismo
-- tropiezo que corrigió BUILD 012B con `aplicar_cierre_operacion`.
select (editar_plan_gestion(
  p_id => :'plan_x_id'::uuid, p_name => 'Plan X', p_rr_objective => '9.9900',
  p_be_trigger => 'NONE', p_partials => '[]'::jsonb
)).id is not null as plan_editado;

\echo '         el Plan vivo ahora dice 9.9900 y 0 parciales:'
select rr_objective, be_trigger,
       (select count(*) from public.management_plan_partials where plan_id = :'plan_x_id') as parciales_vivos
  from public.management_plans where id = :'plan_x_id';

\echo '         el congelado sigue diciendo 3.0000 / AFTER_NTH_PARTIAL / 2 — esperado: t'
select (frozen_plan->>'rr_objective' = '3.0000') as rr_intacto,
       (frozen_plan->>'be_trigger' = 'AFTER_NTH_PARTIAL') as be_intacto,
       (jsonb_array_length(frozen_plan->'partials') = 2) as parciales_intactos
  from public.management_intent_destinations
  where intent_id = :'intent_3_id' and account_id = :'cuenta_libre_id';

\echo ''
\echo '============================================================'
\echo ' PROPIEDAD BAJO SECURITY DEFINER — lo que RLS deja de proteger'
\echo '============================================================'

select count(*) as intenciones_antes from public.management_intents \gset base_
select count(*) as destinos_antes from public.management_intent_destinations \gset base_
select count(*) as eventos_antes from public.domain_events \gset base_

\echo '--- [14] Cuenta AJENA como único destino — esperado: ERROR ACCOUNT_NOT_FOUND ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_ajena_id', :'plan_x_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [15] Plan AJENO — esperado: ERROR PLAN_NOT_FOUND ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_ajeno_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [16] ROLLBACK TOTAL: dos destinos válidos y un tercero ajeno ---'
\echo '         Esperado: ERROR, y ni la Intención ni los dos destinos buenos'
\echo '         ni el evento sobreviven. No puede existir estado parcial.'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'short', p_instrument_key => 'GBPUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}},
      {"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}},
      {"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id',  :'plan_simple_id',
    :'cuenta_topada_id', :'plan_simple_id',
    :'cuenta_ajena_id',  :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [17] nada de lo anterior dejó residuo — esperado: t / t / t ---'
select ((select count(*) from public.management_intents) = :base_intenciones_antes) as intenciones_intactas,
       ((select count(*) from public.management_intent_destinations) = :base_destinos_antes) as destinos_intactos,
       ((select count(*) from public.domain_events) = :base_eventos_antes) as eventos_intactos;

\echo '         ninguna Intención de GBPUSD llegó a existir — esperado: 0'
select count(*) as gbpusd from public.management_intents where instrument_key = 'GBPUSD';

\echo ''
\echo '--- [18] SIN SESIÓN: SECURITY DEFINER no puede escribir por su cuenta ---'
\echo '         Esperado: ERROR NOT_AUTHENTICATED (no un NOT NULL crudo)'
select set_config('request.jwt.claim.sub', '', false);
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_x_id')::jsonb);
\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);

\echo ''
\echo '============================================================'
\echo ' VALIDACIONES DE FORMA'
\echo '============================================================'

\echo '--- [19] SIN DESTINOS: array vacío — esperado: ERROR NO_DESTINATIONS ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => '[]'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [20] destinations que no es un array — esperado: ERROR VALIDATION_ERROR ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => '{"account_id":"x"}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [21] MI-6: la misma Cuenta dos veces — esperado: ERROR DUPLICATE_DESTINATION ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}},
      {"account_id":"%s","management_plan_id":"%s","risk_pct":"2.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [22] I13: el llamador NO puede forjar el riesgo resuelto — esperado: ERROR ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"9.00",
       "risk_transformation":{"kind":"absolute","resolved_risk_pct":"0.01"}}]',
    :'cuenta_topada_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [23] I11: destino sin Plan — esperado: ERROR (toda Operación ejecuta un Plan) ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","risk_pct":"1.00","risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [24] risk_pct = 0 — esperado: ERROR (rango (0, 100], igual que trades.risk_pct) ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"0",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [25] risk_transformation ausente — esperado: ERROR ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00"}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [26] side inválido — esperado: ERROR ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'flat', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [27] instrument_key en blanco — esperado: ERROR ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => '   ',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [28] ventana invertida — esperado: ERROR INVALID_WINDOW ---'
\set ON_ERROR_STOP off
select id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD',
  p_decided_at => now(), p_valid_until => now() - interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb);
\set ON_ERROR_STOP on

\echo '--- [29] ninguno de los once rechazos anteriores dejó residuo — esperado: t / t / t ---'
select ((select count(*) from public.management_intents) = :base_intenciones_antes) as intenciones_intactas,
       ((select count(*) from public.management_intent_destinations) = :base_destinos_antes) as destinos_intactos,
       ((select count(*) from public.domain_events) = :base_eventos_antes) as eventos_intactos;

\echo ''
\echo '============================================================'
\echo ' IDEMPOTENCIA'
\echo '============================================================'

\echo '--- [30] misma clave dos veces (reintento secuencial) — esperado: mismo id ---'
select id as idem_1_id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'XAUUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}},
      {"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id',  :'plan_simple_id',
    :'cuenta_topada_id', :'plan_simple_id')::jsonb,
  p_idempotency_key => 'aaaa1111-8b8b-8b8b-8b8b-aaaa11110000'::uuid) \gset

select id as idem_2_id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'XAUUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}},
      {"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id',  :'plan_simple_id',
    :'cuenta_topada_id', :'plan_simple_id')::jsonb,
  p_idempotency_key => 'aaaa1111-8b8b-8b8b-8b8b-aaaa11110000'::uuid) \gset

select (:'idem_1_id' = :'idem_2_id') as mismo_id;

\echo '--- [31] el reintento no duplicó NADA — esperado: 1 Intención / 2 destinos / 1 evento ---'
select (select count(*) from public.management_intents
          where idempotency_key = 'aaaa1111-8b8b-8b8b-8b8b-aaaa11110000') as intenciones,
       (select count(*) from public.management_intent_destinations
          where intent_id = :'idem_1_id') as destinos,
       (select count(*) from public.domain_events
          where payload->>'intent_id' = :'idem_1_id') as eventos;

\echo '--- [32] un reintento con destinos DISTINTOS devuelve la original, no la reescribe ---'
\echo '         MI-2: una Intención es inmutable desde su emisión. Esperado: t / 2'
select (id = :'idem_1_id') as mismo_id_pese_a_payload_distinto
  from crear_intencion_de_gestion(
    p_side => 'short', p_instrument_key => 'OTRO',
    p_decided_at => now(), p_valid_until => now() + interval '99 minutes',
    p_destinations => format(
      '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"3.00",
         "risk_transformation":{"kind":"absolute"}}]',
      :'cuenta_holgada_id', :'plan_simple_id')::jsonb,
    p_idempotency_key => 'aaaa1111-8b8b-8b8b-8b8b-aaaa11110000'::uuid);
select count(*) as destinos_sin_cambio from public.management_intent_destinations
  where intent_id = :'idem_1_id';

\echo '--- [33] la clave es por USUARIO, no global: Y puede usar la misma clave ---'
\echo '         Esperado: Intención creada para Y, distinta de la de X'
select set_config('request.jwt.claim.sub', '9c9c9c9c-6060-6060-6060-9c9c9c9c9c9c', false);
select id as idem_y_id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'XAUUSD',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_ajena_id', :'plan_ajeno_id')::jsonb,
  p_idempotency_key => 'aaaa1111-8b8b-8b8b-8b8b-aaaa11110000'::uuid) \gset
select (:'idem_y_id' <> :'idem_1_id') as intencion_propia_de_y;
select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);

\echo '--- [34] SIN clave: dos llamadas idénticas son dos decisiones — esperado: f ---'
select id as libre_1_id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'USDJPY',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb) \gset
select id as libre_2_id from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'USDJPY',
  p_decided_at => now(), p_valid_until => now() + interval '10 minutes',
  p_destinations => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_libre_id', :'plan_simple_id')::jsonb) \gset
select (:'libre_1_id' = :'libre_2_id') as mismo_id;

\echo ''
\echo '============================================================'
\echo ' LA FUNCIÓN ES LA ÚNICA VÍA'
\echo '============================================================'

\echo '--- [35] INSERT directo en management_intents — esperado: ERROR de RLS ---'
\set ON_ERROR_STOP off
insert into public.management_intents (user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', now(), 'long', 'EURUSD', now(), now() + interval '1 hour');
\set ON_ERROR_STOP on

\echo '--- [36] INSERT directo de un destino — esperado: ERROR de RLS ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations (intent_id, account_id, frozen_plan, risk_transformation)
values (:'intent_1_id'::uuid, :'cuenta_libre_id'::uuid, '{}'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [37] MI-2 sigue vigente sobre lo que creó la función — esperado: UPDATE 0 ---'
\echo '         Capa 1 (RLS): sin política de UPDATE, ni siquiera llega al trigger de B2.'
update public.management_intents set instrument_key = 'HACKEADO' where id = :'intent_1_id';

\echo '--- [38] Y no ve ninguna Intención de X — esperado: 0 ---'
select set_config('request.jwt.claim.sub', '9c9c9c9c-6060-6060-6060-9c9c9c9c9c9c', false);
select count(*) as intenciones_de_x_visibles_para_y from public.management_intents
  where user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b';
select count(*) as destinos_de_x_visibles_para_y from public.management_intent_destinations
  where intent_id = :'intent_3_id';

\echo '--- [39] la Intención de [1] sigue exactamente como nació — esperado: EURUSD / long ---'
select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);
select instrument_key, side from public.management_intents where id = :'intent_1_id';

reset role;
