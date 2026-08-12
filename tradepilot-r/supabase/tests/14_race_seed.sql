-- Siembra de las SEIS carreras de dos sesiones de BUILD 018.
--
-- Se ejecuta una sola vez, antes de lanzar `14_race_a.sql` y `14_race_b.sql`
-- en paralelo. Crea una Cuenta y seis Operaciones —una por carrera— con
-- símbolos `CARRERA1`..`CARRERA6`, que es como las dos sesiones las localizan
-- sin tener que coordinarse por ningún otro medio.
--
-- Las seis nacen **antes** de que ninguna se cierre, a propósito:
-- `risk_amount` se congela al nacer como Capital_en_ese_instante × Riesgo% y
-- 016B lo hizo inmutable, así que las seis comparten `risk_amount` 100.0000 y
-- todos los `pnl_amount` de las carreras cuadran contra el mismo número. Si
-- nacieran escalonadas, `INCOHERENT_PNL` saltaría en mitad de una carrera y
-- taparía lo que la carrera pretende medir.
--
-- UUID `e018.../f018...`, distinto de los catorce scripts anteriores.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('e0180180-1818-1818-1818-e0180180e018', 'trader-carreras@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'e0180180-1818-1818-1818-e0180180e018', false);

select crear_empresa('Personal', true);
select id as firm from public.prop_firms where user_id = 'e0180180-1818-1818-1818-e0180180e018' \gset
select id as cta from crear_cuenta(:'firm'::uuid, 'Cuenta Carreras', '10000.0000', 'USD', null) \gset
select id as plan from crear_plan_gestion(
  p_name => 'Plan Carreras', p_rr_objective => '3.0000', p_be_trigger => 'NONE') \gset

select id as t1 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CARRERA1', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as t2 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CARRERA2', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as t3 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CARRERA3', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as t4 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CARRERA4', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as t5 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CARRERA5', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as t6 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CARRERA6', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset

-- La carrera 3 mide el testigo de evidencia: necesita un parcial ya existente
-- para que la sesión que cierra llegue con una cuenta obsoleta de 1.
select registrar_parcial_ejecutado(:'t3'::uuid, 1, '1.0000', '30.00', now()) is not null as parcial_carrera3;

-- La carrera 6 enfrenta dos correcciones: su Operación tiene que estar ya
-- Cerrada. Se cierra aquí, la última, cuando las seis ya han nacido.
select status, r_final, pnl_amount from aplicar_cierre_operacion(
  p_trade_id => :'t6'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'e0180000-0000-0000-0000-000000000006'::uuid);

\echo '--- siembra: seis Operaciones, risk_amount idéntico — esperado: 6 / 100.0000 / 100.0000 ---'
select count(*) as operaciones, min(risk_amount) as minimo, max(risk_amount) as maximo
  from public.trades where account_id = :'cta'::uuid;

\echo '--- siembra: capital tras cerrar CARRERA6 — esperado: 10100.0000 ---'
select current_capital from public.accounts where id = :'cta'::uuid;

reset role;
