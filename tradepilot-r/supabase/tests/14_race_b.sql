-- SESIÓN B de las seis carreras de dos sesiones de BUILD 018. Ver la cabecera
-- de `14_race_a.sql` para el cómo se lanzan.
--
-- B es siempre **la que pierde**: espera 2 s —tiempo de sobra para que A haya
-- ejecutado su acto sin confirmarlo— y entonces intenta el suyo. Su
-- instantánea de READ COMMITTED todavía no ve nada de A, así que **pasa
-- cualquier comprobación previa** y se bloquea en el `select ... for update`
-- que BUILD 018 puso por delante de toda comprobación de estado. Cuando A
-- confirma, Postgres reevalúa la fila (EvalPlanQual) y B ve por fin el estado
-- real.
--
-- **El cronómetro es la prueba.** Cada ronda imprime cuánto esperó B. Si
-- resolviera por su propia instantánea —es decir, si la carrera no fuera
-- real— volvería en milisegundos. Un valor cercano a 3 s (lo que le quedaba a
-- A de sus 5) es lo que demuestra que hubo bloqueo de verdad.
--
-- Sin el `for update` que 018 añadió, ninguna de estas seis rondas se
-- bloquearía: las dos sesiones evaluarían el estado sobre su propia
-- instantánea y las dos escribirían.

\set ON_ERROR_STOP off

-- Misma barrera de reloj de pared que `14_race_a.sql`, definida idéntica: cada
-- ronda arranca en el siguiente múltiplo de 10 s del reloj Unix, de modo que el
-- desfase que B acumula con sus consultas de verificación no puede sacar las
-- dos sesiones de sincronía. Ver la cabecera de A para por qué hizo falta.
\set barrera 'select pg_sleep((select case when r < 1 then r + 10 else r end from (select 10 - mod(extract(epoch from clock_timestamp())::numeric, 10) as r) s)) as barrera;'

set role authenticated;
select set_config('request.jwt.claim.sub', 'e0180180-1818-1818-1818-e0180180e018', false);

select id as t1 from public.trades where symbol = 'CARRERA1' \gset
select id as t2 from public.trades where symbol = 'CARRERA2' \gset
select id as t3 from public.trades where symbol = 'CARRERA3' \gset
select id as t4 from public.trades where symbol = 'CARRERA4' \gset
select id as t5 from public.trades where symbol = 'CARRERA5' \gset
select id as t6 from public.trades where symbol = 'CARRERA6' \gset

-- ============================================================
\echo ''
\echo '=== B · CARRERA 1 — cierre vs cierre con la MISMA clave ==='
:barrera
\echo '    Esperado: B NO falla. La clave es la misma, luego es un reenvío del'
\echo '    mismo acto, no un segundo cierre: devuelve la Operación de A sin'
\echo '    escribir nada. Un solo evento trade_pnl.'
select pg_sleep(2);
select clock_timestamp() as b_inicio \gset
select (aplicar_cierre_operacion(
  p_trade_id => :'t1'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e0180000-0000-0000-0000-000000000001'::uuid
)).id = :'t1'::uuid as devolvio_la_operacion_de_a;
\echo 'B · esperó (debe rondar 3 s, no milisegundos):'
select clock_timestamp() - :'b_inicio'::timestamptz as espera_real;
\echo 'B · eventos de capital de CARRERA1 — esperado: 1'
select count(*) as eventos_pnl, sum(amount) as suma
  from public.account_capital_events where trade_id = :'t1'::uuid and event_type = 'trade_pnl';

-- ============================================================
\echo ''
\echo '=== B · CARRERA 2 — cierre vs cierre con claves DISTINTAS ==='
:barrera
\echo '    Esperado: ERROR INVALID_STATE_TRANSITION. Clave distinta significa'
\echo '    acto distinto, y una Operación sólo se cierra una vez.'
select pg_sleep(2);
select clock_timestamp() as b_inicio \gset
select aplicar_cierre_operacion(
  p_trade_id => :'t2'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e018000b-0000-0000-0000-000000000002'::uuid);
\echo 'B · esperó:'
select clock_timestamp() - :'b_inicio'::timestamptz as espera_real;
\echo 'B · eventos de capital de CARRERA2 — esperado: 1'
select count(*) as eventos_pnl, sum(amount) as suma
  from public.account_capital_events where trade_id = :'t2'::uuid and event_type = 'trade_pnl';

-- ============================================================
\echo ''
\echo '=== B · CARRERA 3 — parcial nuevo vs cierre con testigo obsoleto ==='
:barrera
\echo '    B leyó UN parcial y calculó su R_final con él. A insertó el segundo.'
\echo '    Esperado: ERROR EVIDENCE_CHANGED (esperados 1, actuales 2), y la'
\echo '    Operación sigue ABIERTA — es exactamente el caso que el for update'
\echo '    solo NO puede cubrir, porque la lectura ocurrió en otra transacción.'
select pg_sleep(2);
select clock_timestamp() as b_inicio \gset
select aplicar_cierre_operacion(
  p_trade_id => :'t3'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '-0.7000', p_pnl_amount => '-70.0000',
  p_expected_partials => 1);
\echo 'B · esperó:'
select clock_timestamp() - :'b_inicio'::timestamptz as espera_real;
\echo 'B · estado de CARRERA3 y evidencia — esperado: open / 2 parciales / 0 eventos'
select (select status from public.trades where id = :'t3'::uuid) as estado,
       (select count(*) from public.trade_partials_executed where trade_id = :'t3'::uuid) as parciales,
       (select count(*) from public.account_capital_events where trade_id = :'t3'::uuid) as eventos;

-- ============================================================
\echo ''
\echo '=== B · CARRERA 4 — cierre vs cancelación simple ==='
:barrera
\echo '    Esperado: ERROR VALIDATION_ERROR:status. Una Operación ya Cerrada no'
\echo '    se cancela en simple: eso exige la reversión "fantasma", que mueve'
\echo '    capital y pide confirmación explícita.'
select pg_sleep(2);
select clock_timestamp() as b_inicio \gset
select cancelar_operacion(p_trade_id => :'t4'::uuid, p_motivo => 'llegué tarde');
\echo 'B · esperó:'
select clock_timestamp() - :'b_inicio'::timestamptz as espera_real;
\echo 'B · estado de CARRERA4 — esperado: closed / 1 evento'
select (select status from public.trades where id = :'t4'::uuid) as estado,
       (select count(*) from public.account_capital_events
          where trade_id = :'t4'::uuid and event_type = 'trade_pnl') as eventos_pnl;

-- ============================================================
\echo ''
\echo '=== B · CARRERA 5 — cierre vs corrección ==='
:barrera
\echo '    Aquí B NO falla: corregir el desenlace de una Operación Cerrada es'
\echo '    legítimo. Lo que se mide es que no haya escritura perdida — que el'
\echo '    delta de B se calcule sobre el cierre de A y no sobre la nada que B'
\echo '    veía al empezar. La invariante: Σ eventos trade_pnl = pnl_amount.'
select pg_sleep(2);
select clock_timestamp() as b_inicio \gset
select r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'t5'::uuid, p_r_final => '1.8000', p_pnl_amount => '180.0000');
\echo 'B · esperó:'
select clock_timestamp() - :'b_inicio'::timestamptz as espera_real;
\echo 'B · Σ trade_pnl vs pnl_amount de CARRERA5 — esperado: 180.0000 / 180.0000 / t'
select (select sum(amount) from public.account_capital_events
          where trade_id = :'t5'::uuid and event_type = 'trade_pnl') as suma_eventos,
       (select pnl_amount from public.trades where id = :'t5'::uuid) as pnl_final,
       ((select sum(amount) from public.account_capital_events
           where trade_id = :'t5'::uuid and event_type = 'trade_pnl')
        = (select pnl_amount from public.trades where id = :'t5'::uuid)) as cuadra;

-- ============================================================
\echo ''
\echo '=== B · CARRERA 6 — corrección vs corrección ==='
:barrera
\echo '    A corrigió a 1.5R/150. B corrige a 2.0R/200 sobre una instantánea que'
\echo '    todavía dice 1.0R/100. Si B calculara su delta con ese valor obsoleto'
\echo '    sumaría 100 en vez de 50 y el capital acabaría en 250 con la Operación'
\echo '    diciendo 200. Esperado: Σ = 200.0000 = pnl_amount.'
select pg_sleep(2);
select clock_timestamp() as b_inicio \gset
select r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'t6'::uuid, p_r_final => '2.0000', p_pnl_amount => '200.0000');
\echo 'B · esperó:'
select clock_timestamp() - :'b_inicio'::timestamptz as espera_real;
\echo 'B · Σ trade_pnl vs pnl_amount de CARRERA6 — esperado: 200.0000 / 200.0000 / t'
select (select sum(amount) from public.account_capital_events
          where trade_id = :'t6'::uuid and event_type = 'trade_pnl') as suma_eventos,
       (select pnl_amount from public.trades where id = :'t6'::uuid) as pnl_final,
       ((select sum(amount) from public.account_capital_events
           where trade_id = :'t6'::uuid and event_type = 'trade_pnl')
        = (select pnl_amount from public.trades where id = :'t6'::uuid)) as cuadra;

\echo ''
\echo '=== B · verificación final de las seis carreras ==='
\echo '    Esperado: ninguna Operación con más de un cierre, ningún capital'
\echo '    descuadrado respecto a su propia Operación.'
select t.symbol, t.status, t.pnl_amount,
       coalesce((select sum(e.amount) from public.account_capital_events e
                   where e.trade_id = t.id and e.event_type = 'trade_pnl'), 0) as suma_eventos,
       coalesce(t.pnl_amount, 0) = coalesce((select sum(e.amount) from public.account_capital_events e
                   where e.trade_id = t.id and e.event_type = 'trade_pnl'), 0) as cuadra
  from public.trades t where t.symbol like 'CARRERA%' order by t.symbol;

reset role;
