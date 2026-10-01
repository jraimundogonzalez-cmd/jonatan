-- Carrera real de idempotencia — SESIÓN A (la ganadora).
--
-- Se ejecuta EN PARALELO con `11_concurrency_b.sql`, en dos procesos psql
-- distintos, después de `11_management_intent_creation.sql` (reutiliza la
-- Cuenta y el Plan que aquel sembró). Ver README para el comando exacto.
--
-- A abre una transacción, crea la Intención con la clave compartida y la
-- mantiene SIN CONFIRMAR durante 5 segundos. Durante esa ventana, B ejecuta la
-- misma llamada: la comprobación previa de idempotencia no ve nada (la fila de
-- A aún no está confirmada) y B llega hasta el INSERT, donde el índice único
-- parcial `management_intents_idempotency_idx` lo bloquea. Es la carrera
-- genuina, no un reintento secuencial.

\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b', false);

select id as cuenta_id from public.accounts
  where user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b' and name = 'Cuenta Libre' \gset
select id as plan_id from public.management_plans
  where user_id = '8b8b8b8b-5050-5050-5050-8b8b8b8b8b8b' and name = 'Plan Simple' \gset

begin;

select id as ganadora from crear_intencion_de_gestion(
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

\echo '=== A: Intención creada dentro de la transacción, todavía SIN confirmar ==='
select :'ganadora' as intencion_de_a;

\echo '=== A: reteniendo 5 s para que B choque contra el índice único ==='
select pg_sleep(5);

commit;
\echo '=== A: COMMIT ==='
select :'ganadora' as intencion_de_a;

reset role;
