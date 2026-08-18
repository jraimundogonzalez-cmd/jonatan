-- Validación de la emisión del evento de Management Intent — B3 (BUILD 013)
-- contra Postgres real.
--
-- Cubre exclusivamente lo que B3 construye: un evento por Intención, con la
-- propiedad y el sujeto correctos, atómico con el hecho que lo origina, y la
-- ausencia de emisión en cualquier otra operación.
--
-- **No prueba la función de creación, la caducidad, la reclamación ni el
-- desenlace**: pertenecen a B5-B9 y no existen todavía.
--
-- UUIDs 4d4d.../5e5e... — distintos de los de 01-08.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d', 'trader-t@test.local'),
  ('5e5e5e5e-2020-2020-2020-5e5e5e5e5e5e', 'trader-u@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d', false);
select crear_empresa('Personal', true);
select id as firm_t_id from public.prop_firms where user_id = '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d' \gset
select id as cuenta_t_id from crear_cuenta(:'firm_t_id'::uuid, 'Cuenta T', '10000.0000', 'USD', null) \gset
select id as plan_t_id from crear_plan_gestion('Plan T', '3.0000', 'NONE') \gset
reset role;

\echo '--- [1] UNA Intención genera EXACTAMENTE UN evento — esperado: 1 ---'
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('11110000-4d4d-4d4d-4d4d-111100000001',
        '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d',
        now(), 'long', 'EURUSD', now(), now() + interval '20 minutes');

select count(*) as eventos_emitidos from public.domain_events
  where event_type = 'IntencionDeGestionEmitida'
    and payload->>'intent_id' = '11110000-4d4d-4d4d-4d4d-111100000001';

\echo '--- [2] PROPIEDAD y SUJETO: user_id del dueño, account_id NULL — esperado: t / t ---'
select (user_id = '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d') as propietario_ok,
       (account_id is null) as sujeto_nulo_ok
  from public.domain_events
  where payload->>'intent_id' = '11110000-4d4d-4d4d-4d4d-111100000001';

\echo '--- [3] PAYLOAD MÍNIMO: solo intent_id, nada más — esperado: 1 clave, intent_id ---'
\echo '        BUILD 006A: identidad y forma de la transición, nunca copia del'
\echo '        estado de otro módulo. Ni instrumento, ni dirección, ni destinos.'
select jsonb_object_keys(payload) as unica_clave,
       (select count(*) from jsonb_object_keys(payload)) as numero_de_claves
  from public.domain_events
  where payload->>'intent_id' = '11110000-4d4d-4d4d-4d4d-111100000001';

\echo '--- [4] MISMO CONTADOR GLOBAL: la secuencia supera a la del último evento previo ---'
\echo '        Esperado: t — no hay un contador aparte para eventos de Usuario.'
select (select event_sequence from public.domain_events
          where payload->>'intent_id' = '11110000-4d4d-4d4d-4d4d-111100000001')
       > (select max(event_sequence) from public.domain_events
          where event_type <> 'IntencionDeGestionEmitida') as del_mismo_contador;

\echo '--- [5] MECANISMO DE PUBLICACIÓN sin cambios — esperado: f / null ---'
select published, published_at from public.domain_events
  where payload->>'intent_id' = '11110000-4d4d-4d4d-4d4d-111100000001';

\echo ''
\echo '--- [6] ATOMICIDAD · ROLLBACK: el evento desaparece con la Intención ---'
begin;
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('22220000-4d4d-4d4d-4d4d-222200000002',
        '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d',
        now(), 'short', 'GBPUSD', now(), now() + interval '10 minutes');
\echo '        dentro de la transacción — esperado: 1 Intención / 1 evento'
select
  (select count(*) from public.management_intents where id = '22220000-4d4d-4d4d-4d4d-222200000002') as intencion,
  (select count(*) from public.domain_events where payload->>'intent_id' = '22220000-4d4d-4d4d-4d4d-222200000002') as evento;
rollback;

\echo '        tras el ROLLBACK — esperado: 0 Intención / 0 evento ---'
select
  (select count(*) from public.management_intents where id = '22220000-4d4d-4d4d-4d4d-222200000002') as intencion,
  (select count(*) from public.domain_events where payload->>'intent_id' = '22220000-4d4d-4d4d-4d4d-222200000002') as evento;

\echo ''
\echo '--- [7] ORDEN GLOBAL: toda Intención emitida ocupa una posición única y creciente ---'
\echo '        Incluye las que sembraron las suites 06-08: desde B3, cualquier Intención'
\echo '        creada por cualquier vía emite, que es lo que garantiza el trigger AFTER.'
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('33330000-4d4d-4d4d-4d4d-333300000003', '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d',
        now(), 'long', 'NAS100', now(), now() + interval '10 minutes');
insert into public.management_intents
  (id, user_id, decided_at, side, instrument_key, valid_from, valid_until)
values ('44440000-4d4d-4d4d-4d4d-444400000004', '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d',
        now(), 'short', 'NAS100', now(), now() + interval '10 minutes');

select count(*) as intenciones_emitidas,
       count(distinct event_sequence) as secuencias_distintas,
       (count(*) = count(distinct event_sequence)) as sin_colisiones,
       (min(event_sequence) < max(event_sequence)) as estrictamente_creciente
  from public.domain_events where event_type = 'IntencionDeGestionEmitida';

\echo '--- [8] ORDEN CAUSAL mezclado con eventos de Cuenta ---'
\echo '        Una Operación registrada DESPUÉS de las Intenciones recibe secuencia mayor.'
set role authenticated;
select set_config('request.jwt.claim.sub', '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d', false);
select id as trade_t_id from registrar_operacion(
  :'cuenta_t_id'::uuid, 'EURUSD', 'long', now(), '1.00', null, :'plan_t_id'::uuid, '3.0000'
) \gset
reset role;
select (select event_sequence from public.domain_events
          where event_type = 'OperacionRegistrada' and payload->>'trade_id' = :'trade_t_id')
       > (select max(event_sequence) from public.domain_events
          where event_type = 'IntencionDeGestionEmitida') as operacion_posterior_ok;

\echo ''
\echo '--- [9] NINGÚN EVENTO por transiciones de destino ---'
\echo '        Se cuenta el total antes y después de recorrer pending → sent → materialized.'
insert into public.management_intent_destinations
  (id, intent_id, account_id, frozen_plan, risk_transformation)
values ('dddd0000-4d4d-4d4d-4d4d-dddd00000001',
        '11110000-4d4d-4d4d-4d4d-111100000001', :'cuenta_t_id'::uuid,
        '{"rr_objective":"3.0000"}'::jsonb, '{"kind":"ratio","operand":"1.0000"}'::jsonb);
select count(*) as eventos_totales_antes from public.domain_events \gset

update public.management_intent_destinations set state = 'sent'
  where id = 'dddd0000-4d4d-4d4d-4d4d-dddd00000001';
update public.management_intent_destinations set state = 'materialized', trade_id = :'trade_t_id'::uuid
  where id = 'dddd0000-4d4d-4d4d-4d4d-dddd00000001';

select :eventos_totales_antes as antes, count(*) as despues,
       (count(*) = :eventos_totales_antes) as sin_eventos_nuevos
  from public.domain_events;

\echo '--- [10] NINGÚN EVENTO por DELETE de una Intención — esperado: sin_eventos_nuevos = t ---'
select count(*) as antes_del_delete from public.domain_events \gset ev_
delete from public.management_intents where id = '44440000-4d4d-4d4d-4d4d-444400000004';
select :ev_antes_del_delete as antes, count(*) as despues,
       (count(*) = :ev_antes_del_delete) as sin_eventos_nuevos
  from public.domain_events;

\echo '        el evento de esa Intención sobrevive al borrado (el outbox es append-only)'
select count(*) as evento_superviviente from public.domain_events
  where payload->>'intent_id' = '44440000-4d4d-4d4d-4d4d-444400000004';

\echo ''
\echo '--- [11] AISLAMIENTO: U no ve ningún evento de Intención de T — esperado: 0 ---'
set role authenticated;
select set_config('request.jwt.claim.sub', '5e5e5e5e-2020-2020-2020-5e5e5e5e5e5e', false);
select count(*) as intenciones_visibles_para_u from public.domain_events
  where event_type = 'IntencionDeGestionEmitida';

\echo '--- [12] listar_eventos_pendientes tampoco los expone a U — esperado: 0 ---'
select count(*) as pendientes_de_intencion_para_u from listar_eventos_pendientes(1000)
  where event_type = 'IntencionDeGestionEmitida';

\echo '--- [13] T sí los ve — esperado: 3 ---'
select set_config('request.jwt.claim.sub', '4d4d4d4d-1010-1010-1010-4d4d4d4d4d4d', false);
select count(*) as intenciones_visibles_para_t from listar_eventos_pendientes(1000)
  where event_type = 'IntencionDeGestionEmitida';

reset role;
