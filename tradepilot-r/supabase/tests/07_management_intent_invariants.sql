-- Validación de Management Intent — B2, integridad e inmutabilidad (BUILD 011)
-- contra Postgres real. Cubre exclusivamente lo que B2 construye: la
-- inmutabilidad de una Intención emitida (MI-2), la inmutabilidad de la
-- declaración de un destino, y la máquina de estados con todas sus
-- transiciones válidas e inválidas.
--
-- **No prueba eventos, creación, caducidad programada, lectura, reclamación
-- ni desenlace**: pertenecen a B3-B9 y no existen todavía.
--
-- Metodología de BUILD 003, en dos capas: primero como `authenticated`, donde
-- RLS bloquea antes de que ningún trigger llegue a correr; después tras
-- `reset role`, donde RLS no protege y el trigger es la única defensa. Una
-- sola capa daría falsa seguridad frente a un superusuario o un service_role.
--
-- UUIDs ffff.../aaaa-9... — distintos de los de 01-06.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('ffffffff-6666-6666-6666-666666666666', 'trader-p@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-6666-6666-6666-666666666666', false);

select crear_empresa('Personal', true);
select id as firm_p_id from public.prop_firms where user_id = 'ffffffff-6666-6666-6666-666666666666' \gset
select id as cuenta_p1_id from crear_cuenta(:'firm_p_id'::uuid, 'Cuenta P1', '10000.0000', 'USD', null) \gset
select id as cuenta_p2_id from crear_cuenta(:'firm_p_id'::uuid, 'Cuenta P2', '20000.0000', 'USD', null) \gset
select id as cuenta_p3_id from crear_cuenta(:'firm_p_id'::uuid, 'Cuenta P3', '30000.0000', 'USD', null) \gset
select id as cuenta_p4_id from crear_cuenta(:'firm_p_id'::uuid, 'Cuenta P4', '40000.0000', 'USD', null) \gset
-- Dos Cuentas más para [17] y [19]: MI-6 impide reutilizar una Cuenta que ya
-- tiene destino en esta misma Intención, y esos dos casos necesitan destinos
-- nuevos con estado de partida distinto.
select id as cuenta_p5_id from crear_cuenta(:'firm_p_id'::uuid, 'Cuenta P5', '50000.0000', 'USD', null) \gset
select id as cuenta_p6_id from crear_cuenta(:'firm_p_id'::uuid, 'Cuenta P6', '60000.0000', 'USD', null) \gset
select id as plan_p_id from crear_plan_gestion('Plan P', '3.0000', 'NONE') \gset
select id as trade_p_id from registrar_operacion(
  :'cuenta_p1_id'::uuid, 'EURUSD', 'long', now(), '1.00', null, :'plan_p_id'::uuid, '3.0000'
) \gset

reset role;

-- Sembrado: una Intención con cuatro destinos, uno por cada camino que la
-- máquina de estados debe recorrer.
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('aaaa9999-ffff-ffff-ffff-aaaa99999999',
        'ffffffff-6666-6666-6666-666666666666',
        now(), 'long', 'EURUSD', now(), now() + interval '30 minutes');

insert into public.management_intent_destinations
  (id, intent_id, account_id, frozen_plan, risk_transformation)
values
  ('d0000001-ffff-ffff-ffff-d00000000001', 'aaaa9999-ffff-ffff-ffff-aaaa99999999',
   :'cuenta_p1_id'::uuid, '{"rr_objective":"3.0000"}'::jsonb, '{"kind":"ratio","operand":"1.0000"}'::jsonb),
  ('d0000002-ffff-ffff-ffff-d00000000002', 'aaaa9999-ffff-ffff-ffff-aaaa99999999',
   :'cuenta_p2_id'::uuid, '{"rr_objective":"3.0000"}'::jsonb, '{"kind":"ratio","operand":"0.5000"}'::jsonb),
  ('d0000003-ffff-ffff-ffff-d00000000003', 'aaaa9999-ffff-ffff-ffff-aaaa99999999',
   :'cuenta_p3_id'::uuid, '{"rr_objective":"3.0000"}'::jsonb, '{"kind":"ratio","operand":"2.0000"}'::jsonb),
  ('d0000004-ffff-ffff-ffff-d00000000004', 'aaaa9999-ffff-ffff-ffff-aaaa99999999',
   :'cuenta_p4_id'::uuid, '{"rr_objective":"3.0000"}'::jsonb, '{"kind":"own","operand":"0.5000"}'::jsonb);

-- ============================================================
-- CAPA 1 — como `authenticated`: RLS bloquea antes del trigger
-- ============================================================
\echo '=========== CAPA 1 · authenticated (RLS antes que el trigger) ==========='
set role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-6666-6666-6666-666666666666', false);

\echo '--- [1] MI-2 desde authenticated: UPDATE de una Intención — esperado: UPDATE 0, sin error ---'
\echo '        RLS no tiene política de UPDATE, así que el trigger ni se evalúa.'
\set ON_ERROR_STOP off
update public.management_intents set side = 'short'
  where id = 'aaaa9999-ffff-ffff-ffff-aaaa99999999';
\set ON_ERROR_STOP on

\echo '--- [2] añadir un destino desde authenticated — esperado: ERROR de RLS ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation)
values ('aaaa9999-ffff-ffff-ffff-aaaa99999999', :'cuenta_p1_id'::uuid, '{}'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [3] eliminar un destino desde authenticated — esperado: DELETE 0 ---'
\set ON_ERROR_STOP off
delete from public.management_intent_destinations
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [4] transicionar un destino desde authenticated — esperado: UPDATE 0 ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'sent'
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [5] los cuatro destinos siguen intactos y en pending — esperado: 4 ---'
select count(*) as destinos_en_pending from public.management_intent_destinations
  where intent_id = 'aaaa9999-ffff-ffff-ffff-aaaa99999999' and state = 'pending';

-- ============================================================
-- CAPA 2 — tras `reset role`: RLS no protege, el trigger es la única defensa
-- ============================================================
\echo ''
\echo '=========== CAPA 2 · reset role (el trigger es la única defensa) ==========='
reset role;

\echo '--- [6] MI-2 · UPDATE de una Intención saltándose RLS — esperado: ERROR IMMUTABLE_INTENT ---'
\set ON_ERROR_STOP off
update public.management_intents set side = 'short'
  where id = 'aaaa9999-ffff-ffff-ffff-aaaa99999999';
\set ON_ERROR_STOP on

\echo '--- [7] MI-2 · ni siquiera un campo aparentemente inocuo — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intents set instrument_key = 'GBPUSD'
  where id = 'aaaa9999-ffff-ffff-ffff-aaaa99999999';
\set ON_ERROR_STOP on

\echo '--- [8] declaración de un destino: cambiar la Cuenta — esperado: ERROR IMMUTABLE_DECLARATION ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set account_id = :'cuenta_p2_id'::uuid
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [9] declaración: cambiar el Plan congelado — esperado: ERROR ---'
\echo '        Es la protección que impide ejecutar algo distinto de lo aprobado.'
\set ON_ERROR_STOP off
update public.management_intent_destinations set frozen_plan = '{"rr_objective":"99.0000"}'::jsonb
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [10] declaración: cambiar la transformación de riesgo — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set risk_transformation = '{"kind":"ratio","operand":"9.0000"}'::jsonb
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [11] declaración: cambiar el registro del tope aplicado — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set risk_cap_applied = true, risk_cap_reason = 'inventado'
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo ''
\echo '--- TRANSICIONES VÁLIDAS ---'

\echo '--- [12] pending → sent — esperado: UPDATE 1 ---'
update public.management_intent_destinations set state = 'sent'
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';

\echo '--- [13] sent → materialized, con su Operación — esperado: UPDATE 1 ---'
update public.management_intent_destinations set state = 'materialized', trade_id = :'trade_p_id'::uuid
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';

\echo '--- [14] pending → sent → rejected — esperado: UPDATE 1 y UPDATE 1 ---'
update public.management_intent_destinations set state = 'sent'
  where id = 'd0000002-ffff-ffff-ffff-d00000000002';
update public.management_intent_destinations set state = 'rejected'
  where id = 'd0000002-ffff-ffff-ffff-d00000000002';

\echo '--- [15] pending → expired — esperado: UPDATE 1 ---'
update public.management_intent_destinations set state = 'expired'
  where id = 'd0000003-ffff-ffff-ffff-d00000000003';

\echo '--- [16] pending → discarded — esperado: UPDATE 1 ---'
update public.management_intent_destinations set state = 'discarded'
  where id = 'd0000004-ffff-ffff-ffff-d00000000004';

\echo ''
\echo '--- TRANSICIONES INVÁLIDAS ---'

\echo '--- [17] LA REGLA CENTRAL: sent → expired está PROHIBIDO ---'
\echo '        Un destino cuya orden ya salió no puede caducar: un fill tardío'
\echo '        llegaría a una Operación real —que I14 obliga a registrar— sin'
\echo '        destino al que vincularla. Esperado: ERROR INVALID_STATE_TRANSITION'
insert into public.management_intent_destinations
  (id, intent_id, account_id, frozen_plan, risk_transformation, state)
values ('d0000005-ffff-ffff-ffff-d00000000005', 'aaaa9999-ffff-ffff-ffff-aaaa99999999',
        :'cuenta_p5_id'::uuid, '{}'::jsonb, '{}'::jsonb, 'sent');
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'expired'
  where id = 'd0000005-ffff-ffff-ffff-d00000000005';
\set ON_ERROR_STOP on

\echo '--- [18] sent → discarded también prohibido, por el mismo motivo — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'discarded'
  where id = 'd0000005-ffff-ffff-ffff-d00000000005';
\set ON_ERROR_STOP on

\echo '--- [19] pending → materialized sin pasar por sent — esperado: ERROR ---'
insert into public.management_intent_destinations
  (id, intent_id, account_id, frozen_plan, risk_transformation)
values ('d0000006-ffff-ffff-ffff-d00000000006', 'aaaa9999-ffff-ffff-ffff-aaaa99999999',
        :'cuenta_p6_id'::uuid, '{}'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'materialized', trade_id = :'trade_p_id'::uuid
  where id = 'd0000006-ffff-ffff-ffff-d00000000006';
\set ON_ERROR_STOP on

\echo '--- [20] pending → rejected sin pasar por sent — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'rejected'
  where id = 'd0000006-ffff-ffff-ffff-d00000000006';
\set ON_ERROR_STOP on

\echo '--- [21] sent → pending: no se retrocede — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'pending'
  where id = 'd0000005-ffff-ffff-ffff-d00000000005';
\set ON_ERROR_STOP on

\echo ''
\echo '--- ESTADOS TERMINALES: un desenlace no se reabre ---'

\echo '--- [22] materialized → cualquier cosa — esperado: ERROR TERMINAL_STATE ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'rejected'
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [23] ni siquiera cambiar la Operación de un destino materializado — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set trade_id = null
  where id = 'd0000001-ffff-ffff-ffff-d00000000001';
\set ON_ERROR_STOP on

\echo '--- [24] rejected → sent — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'sent'
  where id = 'd0000002-ffff-ffff-ffff-d00000000002';
\set ON_ERROR_STOP on

\echo '--- [25] expired → sent — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'sent'
  where id = 'd0000003-ffff-ffff-ffff-d00000000003';
\set ON_ERROR_STOP on

\echo '--- [26] discarded → sent — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.management_intent_destinations set state = 'sent'
  where id = 'd0000004-ffff-ffff-ffff-d00000000004';
\set ON_ERROR_STOP on

\echo ''
\echo '--- [27] estado final de los seis destinos ---'
\echo '        Esperado: 1 materialized, 1 rejected, 1 expired, 1 discarded, 2 sent/pending'
select state, count(*) as n from public.management_intent_destinations
  where intent_id = 'aaaa9999-ffff-ffff-ffff-aaaa99999999'
  group by state order by state;

\echo '--- [28] la Intención nunca cambió pese a todos los intentos — esperado: long / EURUSD ---'
select side, instrument_key from public.management_intents
  where id = 'aaaa9999-ffff-ffff-ffff-aaaa99999999';

reset role;
