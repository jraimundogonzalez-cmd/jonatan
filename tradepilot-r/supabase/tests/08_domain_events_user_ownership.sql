-- Validación del backbone de eventos tras BUILD 012B contra Postgres real.
--
-- Cubre exclusivamente lo que este BUILD cambia: el ancla de propiedad, la
-- derivación automática, el backfill y las políticas RLS reancladas.
--
-- **No prueba ningún evento nuevo**: el trigger de emisión de Management
-- Intent es B3 y no existe todavía.
--
-- La comprobación decisiva es [4]: los seis emisores existentes siguen
-- publicando sin haber sido modificados. Si esa falla, el BUILD entero es
-- inválido por incumplir su requisito de compatibilidad.
--
-- UUIDs 1a1a.../2b2b... — distintos de los de 01-07.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('1a1a1a1a-7777-7777-7777-1a1a1a1a1a1a', 'trader-q@test.local'),
  ('2b2b2b2b-8888-8888-8888-2b2b2b2b2b2b', 'trader-r@test.local')
on conflict (id) do nothing;

\echo '--- [1] BACKFILL: ningún evento preexistente quedó sin propietario — esperado: 0 ---'
\echo '        Las suites 01-07 ya han emitido eventos contra esta misma base de datos.'
reset role;
select count(*) as eventos_sin_user_id from public.domain_events where user_id is null;

\echo '--- [2] BACKFILL: el propietario coincide con el dueño de la Cuenta — esperado: 0 discrepancias ---'
select count(*) as discrepancias from public.domain_events e
  join public.accounts a on a.id = e.account_id
  where e.user_id <> a.user_id;

\echo '--- [3] el orden total y el mecanismo de entrega no cambian ---'
\echo '        event_sequence sigue siendo estrictamente creciente y published sigue en false.'
select
  (select count(*) from public.domain_events) as eventos,
  (select count(distinct event_sequence) from public.domain_events) as secuencias_distintas,
  (select count(*) from public.domain_events where published) as publicados,
  (select count(*) from public.domain_events where published_at is not null) as con_published_at;

set role authenticated;
select set_config('request.jwt.claim.sub', '1a1a1a1a-7777-7777-7777-1a1a1a1a1a1a', false);

select crear_empresa('Personal', true);
select id as firm_q_id from public.prop_firms where user_id = '1a1a1a1a-7777-7777-7777-1a1a1a1a1a1a' \gset
select id as cuenta_q_id from crear_cuenta(:'firm_q_id'::uuid, 'Cuenta Q', '10000.0000', 'USD', null) \gset
select id as plan_q_id from crear_plan_gestion('Plan Q', '3.0000', 'NONE') \gset

\echo ''
\echo '--- [4] COMPATIBILIDAD: un emisor existente publica SIN modificarse ---'
\echo '        registrar_operacion inserta (event_type, account_id, payload) igual que'
\echo '        antes de este BUILD. El trigger deriva user_id y RLS lo valida.'
select id as trade_q_id from registrar_operacion(
  :'cuenta_q_id'::uuid, 'EURUSD', 'long', now(), '1.00', null, :'plan_q_id'::uuid, '3.0000'
) \gset

select event_type, (user_id = '1a1a1a1a-7777-7777-7777-1a1a1a1a1a1a') as propietario_derivado_ok,
       (account_id = :'cuenta_q_id'::uuid) as sujeto_ok
  from public.domain_events
  where account_id = :'cuenta_q_id'::uuid and event_type = 'OperacionRegistrada';

\echo '--- [5] la cadena completa de emisores sigue funcionando: parcial + cierre ---'
select registrar_parcial_ejecutado(:'trade_q_id'::uuid, 1, '1.5000', '50.00', now()) is not null as parcial_ok;
-- BUILD 018: mismo arreglo de fixture que en `03_operations_engine.sql` [6].
-- Declaraba `TAKE_PROFIT_FULL` con `r_max` 2.0000 sobre un Plan de
-- `rr_objective` 3.0000 — el precio nunca llegó al objetivo, así que el
-- take-profit no pudo ejecutarse entero. Y los números tampoco cerraban: con
-- el parcial de 50% a 1.5R ya ejecutado, la fórmula congelada da
-- 0.50×1.5 + 0.50×R_resto; para que R_final valga 1.2500 hace falta
-- R_resto = 1.0, que sólo se obtiene por cierre manual a 1.0R. La aserción de
-- este paso —que la cadena parcial + cierre sigue emitiendo con propietario
-- derivado— es exactamente la misma.
select (aplicar_cierre_operacion(
  p_trade_id => :'trade_q_id'::uuid, p_closed_at => now(),
  p_closure_reason => 'MANUAL_CLOSE', p_cierre_manual_rr => '1.0000',
  p_r_max => '2.0000', p_r_final => '1.2500', p_pnl_amount => '125.0000'
)).status as estado_tras_cierre;

\echo '--- [6] todos los eventos de la Cuenta Q tienen propietario derivado — esperado: 0 sin él ---'
select count(*) as eventos_de_q, count(*) filter (where user_id is null) as sin_propietario
  from public.domain_events where account_id = :'cuenta_q_id'::uuid;

\echo ''
\echo '--- [7] EVENTO DE USUARIO: account_id nulo, user_id explícito ---'
\echo '        Es la forma que B3 usará para una Management Intent. Esperado: INSERT 0 1'
insert into public.domain_events (event_type, account_id, user_id, payload)
values ('_ProbeUsuarioQ', null, '1a1a1a1a-7777-7777-7777-1a1a1a1a1a1a',
        '{"probe":"evento sin Cuenta"}'::jsonb);

\echo '--- [8] el evento de Usuario recibió su event_sequence del mismo contador — esperado: t ---'
select (select event_sequence from public.domain_events where event_type = '_ProbeUsuarioQ')
       > (select max(event_sequence) from public.domain_events where event_type = 'OperacionCerrada')
       as secuencia_posterior_y_del_mismo_contador;

\echo ''
\echo '--- [9] FUGA CERRADA: R no ve el evento de Usuario de Q — esperado: 0 ---'
\echo '        Con la política anterior, account_id nulo era visible para TODOS.'
select set_config('request.jwt.claim.sub', '2b2b2b2b-8888-8888-8888-2b2b2b2b2b2b', false);
select count(*) as evento_de_usuario_visible_para_r from public.domain_events
  where event_type = '_ProbeUsuarioQ';

\echo '--- [10] R tampoco ve ningún evento de la Cuenta de Q — esperado: 0 ---'
select count(*) as eventos_de_q_visibles_para_r from public.domain_events
  where account_id = :'cuenta_q_id'::uuid;

\echo '--- [11] listar_eventos_pendientes respeta el nuevo ancla — esperado: 0 para R ---'
select count(*) as pendientes_visibles_para_r from listar_eventos_pendientes(1000);

\echo '--- [12] Q sí ve sus propios eventos, incluido el de Usuario — esperado: >= 4 y el probe presente ---'
select set_config('request.jwt.claim.sub', '1a1a1a1a-7777-7777-7777-1a1a1a1a1a1a', false);
select count(*) as pendientes_de_q,
       count(*) filter (where event_type = '_ProbeUsuarioQ') as incluye_el_de_usuario
  from listar_eventos_pendientes(1000);

\echo ''
\echo '--- [13] no se puede emitir un evento reclamando otro propietario — esperado: ERROR de RLS ---'
\set ON_ERROR_STOP off
insert into public.domain_events (event_type, account_id, user_id, payload)
values ('_ProbeRobo', null, '2b2b2b2b-8888-8888-8888-2b2b2b2b2b2b', '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [14] COHERENCIA: user_id propio + Cuenta ajena — esperado: ERROR OWNER_SUBJECT_MISMATCH ---'
\echo '        Sin esta comprobación, propiedad y sujeto dejarían de significar lo mismo.'
reset role;
insert into auth.users (id, email) values
  ('3c3c3c3c-9999-9999-9999-3c3c3c3c3c3c', 'trader-s@test.local') on conflict (id) do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '3c3c3c3c-9999-9999-9999-3c3c3c3c3c3c', false);
select crear_empresa('Personal', true);
select id as firm_s_id from public.prop_firms where user_id = '3c3c3c3c-9999-9999-9999-3c3c3c3c3c3c' \gset
select id as cuenta_s_id from crear_cuenta(:'firm_s_id'::uuid, 'Cuenta S', '1000.0000', 'USD', null) \gset
\set ON_ERROR_STOP off
insert into public.domain_events (event_type, account_id, user_id, payload)
values ('_ProbeMismatch', :'cuenta_q_id'::uuid, '3c3c3c3c-9999-9999-9999-3c3c3c3c3c3c', '{}'::jsonb);
\set ON_ERROR_STOP on

\echo '--- [15] un evento sin Cuenta y sin Usuario es rechazado ruidosamente — esperado: ERROR ---'
\echo '        Fallo ruidoso, nunca silencioso: NOT NULL lo detiene.'
reset role;
\set ON_ERROR_STOP off
insert into public.domain_events (event_type, account_id, payload)
values ('_ProbeHuerfano', null, '{}'::jsonb);
\set ON_ERROR_STOP on

\echo ''
\echo '--- [16] limpieza de las sondas para no contaminar suites posteriores ---'
delete from public.domain_events where event_type like '\_Probe%';
select count(*) as sondas_restantes from public.domain_events where event_type like '\_Probe%';

reset role;
