-- Carrera real sobre un mismo destino — SESIÓN A (la ganadora). BUILD 017.
--
-- Se ejecuta EN PARALELO con `12_concurrency_b.sql`, en dos procesos psql
-- distintos, después de `12_management_intent_binding.sql` (reutiliza la Cuenta
-- y el Plan que aquel sembró). Ver README.
--
-- A abre una transacción, materializa el destino compartido y la mantiene SIN
-- CONFIRMAR durante 5 segundos. Durante esa ventana B ejecuta la misma llamada:
-- su lectura previa ve el destino todavía `pending` —la fila de A no está
-- confirmada— y llega hasta el `UPDATE` de estado, donde el bloqueo de fila lo
-- detiene. Es la carrera genuina, no un reintento secuencial.

\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', 'ad17ad17-1717-1717-1717-ad17ad17ad17', false);

select id as dest_carrera from public.management_intent_destinations d
  where d.intent_id = (select i.id from public.management_intents i
                        where i.user_id = 'ad17ad17-1717-1717-1717-ad17ad17ad17'
                          and i.instrument_key = 'CARRERA017' limit 1) \gset

begin;

select id as ganadora from abrir_operacion_desde_intencion(:'dest_carrera'::uuid, now(), null) \gset

\echo '=== A: Operación creada dentro de la transacción, todavía SIN confirmar ==='
select :'ganadora' as operacion_de_a;

\echo '=== A: reteniendo 5 s para que B choque contra el bloqueo de fila del destino ==='
select pg_sleep(5);

commit;
\echo '=== A: COMMIT ==='
select :'ganadora' as operacion_de_a;

reset role;
