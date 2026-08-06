-- Validación de Management Intent — B1, esquema base (BUILD 010) contra
-- Postgres real. Cubre exclusivamente lo que B1 construye: RLS, CHECK, UNIQUE
-- y comportamiento de claves foráneas.
--
-- **No prueba triggers, funciones ni eventos**: pertenecen a B2 y posteriores
-- y no existen todavía.
--
-- Punto central de este build: las dos tablas son de **solo lectura** para
-- `authenticated` por diseño. Es la capa 1 de MI-2 (una Intención es inmutable
-- desde su emisión) y lo que impide añadir un destino después de la emisión.
-- Por eso todo el sembrado se hace como superusuario, igual que la Library de
-- `rule_definitions` en 05.
--
-- UUIDs dddd.../eeee... — distintos de los de 01-05.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('dddddddd-4444-4444-4444-444444444444', 'trader-m@test.local'),
  ('eeeeeeee-5555-5555-5555-555555555555', 'trader-n@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-4444-4444-4444-444444444444', false);

select crear_empresa('Personal', true);
select id as firm_m_id from public.prop_firms where user_id = 'dddddddd-4444-4444-4444-444444444444' \gset
select id as cuenta_m_id from crear_cuenta(
  :'firm_m_id'::uuid, 'Cuenta M', '10000.0000', 'USD', null
) \gset
select id as plan_m_id from crear_plan_gestion('Plan M', '3.0000', 'NONE') \gset
select id as trade_m_id from registrar_operacion(
  :'cuenta_m_id'::uuid, 'EURUSD', 'long', now(), '1.00',
  null, :'plan_m_id'::uuid, '3.0000'
) \gset

-- Usuario N, con su propia Cuenta, para las comprobaciones de aislamiento.
select set_config('request.jwt.claim.sub', 'eeeeeeee-5555-5555-5555-555555555555', false);
select crear_empresa('Personal', true);
select id as firm_n_id from public.prop_firms where user_id = 'eeeeeeee-5555-5555-5555-555555555555' \gset
select id as cuenta_n_id from crear_cuenta(
  :'firm_n_id'::uuid, 'Cuenta N', '5000.0000', 'USD', null
) \gset

reset role;

\echo '--- [1] sembrar una Intención válida de M — esperado: INSERT 0 1 ---'
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until, idempotency_key)
values
  ('11111111-dddd-dddd-dddd-111111111111',
   'dddddddd-4444-4444-4444-444444444444',
   now(), 'long', 'EURUSD', now(), now() + interval '15 minutes',
   '22222222-dddd-dddd-dddd-222222222222');

\echo '--- [2] CHECK side: solo long/short — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('dddddddd-4444-4444-4444-444444444444', now(), 'sideways', 'EURUSD',
        now(), now() + interval '5 minutes');
\set ON_ERROR_STOP on

\echo '--- [3] CHECK ventana ordenada: valid_until > valid_from — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('dddddddd-4444-4444-4444-444444444444', now(), 'long', 'EURUSD',
        now(), now() - interval '1 minute');
\set ON_ERROR_STOP on

\echo '--- [4] CHECK instrument_key no vacío — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('dddddddd-4444-4444-4444-444444444444', now(), 'long', '   ',
        now(), now() + interval '5 minutes');
\set ON_ERROR_STOP on

\echo '--- [5] CHECK contract_version > 0 — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until, contract_version)
values ('dddddddd-4444-4444-4444-444444444444', now(), 'long', 'EURUSD',
        now(), now() + interval '5 minutes', 0);
\set ON_ERROR_STOP on

\echo '--- [6] UNIQUE idempotencia por Usuario: reintento de "Confirmar" — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until, idempotency_key)
values ('dddddddd-4444-4444-4444-444444444444', now(), 'short', 'GBPUSD',
        now(), now() + interval '5 minutes',
        '22222222-dddd-dddd-dddd-222222222222');
\set ON_ERROR_STOP on

\echo '--- [7] la MISMA clave para OTRO Usuario sí es válida (ámbito por Usuario) — esperado: INSERT 0 1 ---'
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until, idempotency_key)
values ('33333333-eeee-eeee-eeee-333333333333',
        'eeeeeeee-5555-5555-5555-555555555555',
        now(), 'short', 'GBPUSD', now(), now() + interval '5 minutes',
        '22222222-dddd-dddd-dddd-222222222222');

\echo '--- [8] idempotency_key nula no colisiona nunca (índice parcial) — esperado: INSERT 0 2 ---'
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until)
values
  ('dddddddd-4444-4444-4444-444444444444', now(), 'long', 'NAS100', now(), now() + interval '5 minutes'),
  ('dddddddd-4444-4444-4444-444444444444', now(), 'long', 'NAS100', now(), now() + interval '5 minutes');

\echo '--- [9] sembrar un destino válido — esperado: INSERT 0 1 ---'
insert into public.management_intent_destinations
  (id, intent_id, account_id, frozen_plan, risk_transformation)
values
  ('44444444-dddd-dddd-dddd-444444444444',
   '11111111-dddd-dddd-dddd-111111111111',
   :'cuenta_m_id'::uuid,
   '{"rr_objective":"3.0000","be_trigger":"NONE","partials":[]}'::jsonb,
   '{"kind":"ratio","operand":"1.0000"}'::jsonb);

\echo '--- [10] MI-6 · UNIQUE (Intención, Cuenta) — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation)
values ('11111111-dddd-dddd-dddd-111111111111', :'cuenta_m_id'::uuid,
        '{}'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [11] CHECK jsonb debe ser objeto, nunca escalar — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation)
values ('33333333-eeee-eeee-eeee-333333333333', :'cuenta_n_id'::uuid,
        '"no soy un objeto"'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [12] CHECK estado materialized SIN Operación — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation, state)
values ('33333333-eeee-eeee-eeee-333333333333', :'cuenta_n_id'::uuid,
        '{}'::jsonb, '{}'::jsonb, 'materialized');
\set ON_ERROR_STOP on

\echo '--- [13] CHECK Operación SIN estado materialized — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation, state, trade_id)
values ('33333333-eeee-eeee-eeee-333333333333', :'cuenta_n_id'::uuid,
        '{}'::jsonb, '{}'::jsonb, 'pending', :'trade_m_id'::uuid);
\set ON_ERROR_STOP on

\echo '--- [14] A4 · CHECK tope aplicado sin explicación — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation, risk_cap_applied)
values ('33333333-eeee-eeee-eeee-333333333333', :'cuenta_n_id'::uuid,
        '{}'::jsonb, '{}'::jsonb, true);
\set ON_ERROR_STOP on

\echo '--- [15] CHECK estado fuera del catálogo — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation, state)
values ('33333333-eeee-eeee-eeee-333333333333', :'cuenta_n_id'::uuid,
        '{}'::jsonb, '{}'::jsonb, 'enviado_al_broker');
\set ON_ERROR_STOP on

\echo '--- [16] FK: Cuenta inexistente — esperado: ERROR ---'
\set ON_ERROR_STOP off
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation)
values ('33333333-eeee-eeee-eeee-333333333333',
        '00000000-0000-0000-0000-000000000000', '{}'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [17] combinación materialized + Operación real — esperado: INSERT 0 1 ---'
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation, state, trade_id)
values ('11111111-dddd-dddd-dddd-111111111111', :'cuenta_n_id'::uuid,
        '{}'::jsonb, '{}'::jsonb, 'materialized', :'trade_m_id'::uuid);

\echo '--- [18] IMPOSIBILIDAD DE ESCRITURA desde authenticated (capa 1 de MI-2) ---'
\echo '        Sin política de INSERT/UPDATE/DELETE, la única vía de escritura'
\echo '        será la función SECURITY DEFINER de B5 — mismo criterio que audit_log.'
set role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-4444-4444-4444-444444444444', false);
\set ON_ERROR_STOP off
insert into public.management_intents
  (user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('dddddddd-4444-4444-4444-444444444444', now(), 'long', 'EURUSD',
        now(), now() + interval '5 minutes');
insert into public.management_intent_destinations
  (intent_id, account_id, frozen_plan, risk_transformation)
values ('11111111-dddd-dddd-dddd-111111111111', :'cuenta_m_id'::uuid,
        '{}'::jsonb, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [19] UPDATE y DELETE desde authenticated — esperado: UPDATE 0 / DELETE 0 ---'
\set ON_ERROR_STOP off
update public.management_intents set side = 'short'
  where id = '11111111-dddd-dddd-dddd-111111111111';
delete from public.management_intents
  where id = '11111111-dddd-dddd-dddd-111111111111';
update public.management_intent_destinations set state = 'sent'
  where id = '44444444-dddd-dddd-dddd-444444444444';
delete from public.management_intent_destinations
  where id = '44444444-dddd-dddd-dddd-444444444444';
\set ON_ERROR_STOP on

\echo '--- [20] M sí lee sus Intenciones — esperado: 3 ([1] + las dos de [8]) ---'
select count(*) as intenciones_de_m from public.management_intents;

\echo '--- [21] RLS: N no ve ninguna Intención de M — esperado: 1 (solo la suya) ---'
select set_config('request.jwt.claim.sub', 'eeeeeeee-5555-5555-5555-555555555555', false);
select count(*) as intenciones_visibles_para_n from public.management_intents;

\echo '--- [22] RLS: N no ve los destinos de M, ni el que apunta a su propia Cuenta ---'
\echo '        La propiedad de un destino la da su Intención, nunca la Cuenta. Esperado: 0'
select count(*) as destinos_visibles_para_n from public.management_intent_destinations;

\echo '--- [23] HALLAZGO: la cascada por Cuenta es INALCANZABLE en el sistema actual ---'
\echo '        Borrar una Cuenta lo bloquea el ledger append-only de BUILD 001'
\echo '        (`reject_capital_event_mutation`, 20260803120300) antes de que ninguna'
\echo '        cascada llegue a correr, y no existe ninguna función que borre Cuentas.'
\echo '        La FK con `on delete cascade` se mantiene por coherencia con'
\echo '        `trades.account_id`, no porque hoy pueda dispararse. Esperado: ERROR'
reset role;
\set ON_ERROR_STOP off
delete from public.accounts where id = :'cuenta_m_id'::uuid;
\set ON_ERROR_STOP on

\echo '--- [24] CASCADA por Operación: borrar la Operación arrastra su destino — esperado: 1 → 0 ---'
select count(*) as destinos_con_esa_operacion_antes from public.management_intent_destinations
  where trade_id = :'trade_m_id'::uuid;
delete from public.trades where id = :'trade_m_id'::uuid;
select count(*) as destinos_con_esa_operacion_despues from public.management_intent_destinations
  where trade_id = :'trade_m_id'::uuid;

\echo '--- [25] la Intención SOBREVIVE a la desaparición de un destino — esperado: 1 ---'
\echo '        Pertenece al Usuario, no a la Cuenta ni a la Operación.'
select count(*) as intencion_superviviente from public.management_intents
  where id = '11111111-dddd-dddd-dddd-111111111111';

\echo '--- [26] CASCADA por Intención: arrastra sus destinos restantes — esperado: 1 → 0 ---'
select count(*) as destinos_antes from public.management_intent_destinations
  where intent_id = '11111111-dddd-dddd-dddd-111111111111';
delete from public.management_intents where id = '11111111-dddd-dddd-dddd-111111111111';
select count(*) as destinos_despues from public.management_intent_destinations
  where intent_id = '11111111-dddd-dddd-dddd-111111111111';

reset role;
