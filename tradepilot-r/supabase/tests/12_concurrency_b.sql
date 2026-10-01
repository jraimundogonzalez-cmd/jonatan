-- Carrera real sobre un mismo destino — SESIÓN B (la perdedora). BUILD 017.
--
-- Se ejecuta EN PARALELO con `12_concurrency_a.sql`. Ver README.
--
-- B espera 2 s (A ya tiene su transición sin confirmar), pasa la comprobación
-- previa de estado sin ver nada —el destino sigue `pending` para su
-- instantánea— y se bloquea en el `UPDATE` de estado contra la fila que A
-- retiene. Cuando A confirma, B reevalúa en READ COMMITTED y encuentra el
-- destino ya `materialized`: el trigger de B2 lo rechaza con TERMINAL_STATE.
--
-- Resultado esperado: **una sola Operación** sobre ese destino. B no crea una
-- segunda: falla limpiamente. La red de idempotencia por estado sólo devuelve
-- la Operación ganadora en un reintento **secuencial**; en una carrera genuina
-- la perdedora recibe el error tipado, que es el comportamiento correcto para
-- un doble envío simultáneo.

\set ON_ERROR_STOP off

set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

select id as dest_carrera from public.management_intent_destinations d
  where d.intent_id = (select i.id from public.management_intents i
                        where i.user_id = 'ad17ad17-1717-1717-1717-ad17ad17ad17'
                          and i.instrument_key = 'CARRERA017' limit 1) \gset

\echo '=== B: esperando 2 s a que A tenga su transición sin confirmar ==='
select pg_sleep(2);

\echo '=== B: llamando sobre el MISMO destino — debe bloquearse hasta el COMMIT de A ==='
-- El cronómetro es lo que distingue una carrera real de un reintento
-- secuencial disfrazado: si B hubiera resuelto por la comprobación previa de
-- estado, volvería en milisegundos. Bloquearse ~3 s (lo que le queda a A de
-- sus 5) demuestra que B llegó hasta el UPDATE y esperó a la fila.
select clock_timestamp() as t_antes \gset

select abrir_operacion_desde_intencion(:'dest_carrera'::uuid, now(), null);

\echo '=== B: ¿esperó de verdad? — esperado: bloqueo_real = t (más de 1 s) ==='
select (clock_timestamp() - :'t_antes'::timestamptz) as espera_real_de_b,
       ((clock_timestamp() - :'t_antes'::timestamptz) > interval '1 second') as bloqueo_real;

\echo '=== VEREDICTO: una sola Operación sobre el destino compartido ==='
select state, (trade_id is not null) as vinculado,
       (select count(*) from public.trades t where t.id = d.trade_id) as operaciones
  from public.management_intent_destinations d where d.id = :'dest_carrera'::uuid;

reset role;
