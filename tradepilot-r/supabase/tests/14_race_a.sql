-- SESIÓN A de las seis carreras de dos sesiones de BUILD 018.
--
-- A es siempre **la que gana**: abre una transacción, ejecuta su acto y la
-- retiene sin confirmar durante 5 segundos. B, que arranca a la vez, espera 2 s
-- y se estrella contra el bloqueo que A mantiene sobre la fila de `trades`.
--
-- Las seis carreras corren **una detrás de otra dentro de la misma pareja de
-- sesiones**, y cada ronda arranca en una **barrera de reloj de pared**: ambas
-- sesiones duermen hasta el siguiente múltiplo exacto de 10 segundos del reloj
-- Unix. Comparten máquina y por tanto reloj, así que aterrizan en la misma
-- barrera sin necesidad de hablarse.
--
-- La barrera no es decorativa. La primera versión de estos ficheros dejaba que
-- las rondas se re-sincronizaran solas —B sale de su bloqueo justo cuando A
-- confirma— y funcionó en cinco de las seis: en la sexta, el desfase acumulado
-- por las consultas de verificación de B bastó para que A ya hubiera
-- confirmado cuando B llegó, y B midió 0.067 s en lugar de 3. La carrera se
-- había convertido en un reintento secuencial sin que nada fallara. Los 5 s de
-- holgura de cada franja de 10 absorben ese desfase.
--
-- Se lanzan en paralelo, después de `14_race_seed.sql`:
--
--   psql -d tradepilot_test -f 14_race_a.sql > /tmp/a.txt 2>&1 &
--   psql -d tradepilot_test -f 14_race_b.sql > /tmp/b.txt 2>&1 &
--   wait; cat /tmp/a.txt /tmp/b.txt
--
-- Lo que convierte esto en carreras reales y no en reintentos secuenciales
-- disfrazados es el **cronómetro de B**: si resolviera por su propia
-- instantánea volvería en milisegundos. Ese cronómetro se imprime en
-- `14_race_b.sql`.

\set ON_ERROR_STOP off

-- La barrera: dormir hasta el siguiente múltiplo de 10 s del reloj Unix. Si
-- faltase menos de 1 s se salta a la franja siguiente, para que un arranque
-- justo en el borde no deje a las dos sesiones en barreras distintas.
\set barrera 'select pg_sleep((select case when r < 1 then r + 10 else r end from (select 10 - mod(extract(epoch from clock_timestamp())::numeric, 10) as r) s)) as barrera;'

set role authenticated;
select set_config('request.jwt.claim.sub', 'e0180180-1818-1818-1818-e0180180e018', false);

select id as t1 from public.trades where symbol = 'CARRERA1' \gset
select id as t2 from public.trades where symbol = 'CARRERA2' \gset
select id as t3 from public.trades where symbol = 'CARRERA3' \gset
select id as t4 from public.trades where symbol = 'CARRERA4' \gset
select id as t5 from public.trades where symbol = 'CARRERA5' \gset
select id as t6 from public.trades where symbol = 'CARRERA6' \gset

\echo ''
\echo '=== A · CARRERA 1 — cierre vs cierre con la MISMA clave ==='
:barrera
begin;
select status, r_final from aplicar_cierre_operacion(
  p_trade_id => :'t1'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e0180000-0000-0000-0000-000000000001'::uuid);
select pg_sleep(5);
commit;
\echo 'A · confirmada.'

\echo ''
\echo '=== A · CARRERA 2 — cierre vs cierre con claves DISTINTAS ==='
:barrera
begin;
select status, r_final from aplicar_cierre_operacion(
  p_trade_id => :'t2'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e018000a-0000-0000-0000-000000000002'::uuid);
select pg_sleep(5);
commit;
\echo 'A · confirmada.'

-- Aquí A es la que **inserta el parcial**, no la que cierra: es la única forma
-- de reproducir la ventana que el testigo protege. B calculó su R_final con un
-- parcial y llega a cerrar cuando ya hay dos.
\echo ''
\echo '=== A · CARRERA 3 — parcial nuevo vs cierre con testigo obsoleto ==='
:barrera
begin;
select sequence, rr_level from registrar_parcial_ejecutado(:'t3'::uuid, 2, '2.0000', '30.00', now());
select pg_sleep(5);
commit;
\echo 'A · confirmada.'

\echo ''
\echo '=== A · CARRERA 4 — cierre vs cancelación simple ==='
:barrera
begin;
select status, r_final from aplicar_cierre_operacion(
  p_trade_id => :'t4'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e0180000-0000-0000-0000-000000000004'::uuid);
select pg_sleep(5);
commit;
\echo 'A · confirmada.'

\echo ''
\echo '=== A · CARRERA 5 — cierre vs corrección ==='
:barrera
begin;
select status, r_final, pnl_amount from aplicar_cierre_operacion(
  p_trade_id => :'t5'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e0180000-0000-0000-0000-000000000005'::uuid);
select pg_sleep(5);
commit;
\echo 'A · confirmada.'

\echo ''
\echo '=== A · CARRERA 6 — corrección vs corrección ==='
:barrera
begin;
select r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'t6'::uuid, p_r_final => '1.5000', p_pnl_amount => '150.0000');
select pg_sleep(5);
commit;
\echo 'A · confirmada. Fin de la sesión A.'

reset role;
