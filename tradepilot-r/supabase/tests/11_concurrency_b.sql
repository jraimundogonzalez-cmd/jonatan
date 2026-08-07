-- Carrera real de idempotencia — SESIÓN B (la perdedora).
--
-- Se ejecuta EN PARALELO con `11_concurrency_a.sql`. Ver README.
--
-- B espera 2 s (A ya tiene su fila sin confirmar), pasa la comprobación previa
-- de idempotencia sin ver nada, y se bloquea en el INSERT contra el índice
-- único. Cuando A confirma, B recibe `unique_violation`, su subtransacción
-- revierte y el manejador relee la fila ganadora — en READ COMMITTED la
-- sentencia siguiente toma una instantánea nueva y ya la ve confirmada.
--
-- Resultado esperado: B devuelve EXACTAMENTE el mismo id que A, existe UNA
-- sola Intención con esa clave, UN solo destino y UN solo evento.

\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);

select id as cuenta_id from public.accounts
  where user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b' and name = 'Cuenta Libre' \gset
select id as plan_id from public.management_plans
  where user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b' and name = 'Plan Simple' \gset

\echo '=== B: esperando 2 s a que A tenga su fila sin confirmar ==='
select pg_sleep(2);

\echo '=== B: llamando con la MISMA clave — debe bloquearse hasta el COMMIT de A ==='
-- El cronómetro es lo que distingue una carrera real de un reintento
-- secuencial disfrazado: si B hubiera resuelto por la comprobación previa de
-- idempotencia, volvería en milisegundos. Bloquearse ~3 s (lo que le queda a
-- A de sus 5) demuestra que B llegó hasta el INSERT y esperó al índice único.
select clock_timestamp() as t_antes \gset

select id as perdedora from crear_intencion_de_gestion(
  p_side           => 'long',
  p_instrument_key => 'CARRERA',
  p_decided_at     => now(),
  p_valid_until    => now() + interval '30 minutes',
  p_destinations   => format(
    '[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
       "risk_transformation":{"kind":"absolute"}}]',
    :'cuenta_id', :'plan_id')::jsonb,
  p_idempotency_key => 'cccc2222-8b8b-8b8b-8b8b-cccc22220000'::uuid
) \gset

\echo '=== B: id devuelto (debe coincidir con el de A) ==='
select :'perdedora' as intencion_devuelta_a_b;

\echo '=== B: ¿esperó de verdad? — esperado: bloqueo_real = t (más de 1 s) ==='
select (clock_timestamp() - :'t_antes'::timestamptz) as espera_real_de_b,
       ((clock_timestamp() - :'t_antes'::timestamptz) > interval '1 second') as bloqueo_real;

\echo '=== VEREDICTO: una sola Intención, un solo destino, un solo evento ==='
select (select count(*) from public.management_intents
          where idempotency_key = 'cccc2222-8b8b-8b8b-8b8b-cccc22220000') as intenciones,
       (select count(*) from public.management_intent_destinations
          where intent_id = :'perdedora') as destinos,
       (select count(*) from public.domain_events
          where payload->>'intent_id' = :'perdedora') as eventos,
       (select instrument_key from public.management_intents
          where id = :'perdedora') as instrumento;

reset role;
