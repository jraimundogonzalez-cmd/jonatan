-- Validación de BUILD 024 — fechas y horas de los hechos.
--
-- A diferencia de las suites 01–15, esta se CORRIGE SOLA: cada comprobación es
-- un bloque que lanza `SUITE16_FALLO` si el resultado no es el esperado. Con
-- `ON_ERROR_STOP on`, el primer fallo aborta psql con código de salida 3; si
-- termina con exit 0 y la línea `SUITE 16 · TODO CORRECTO`, ha pasado entera.
--
-- Qué demuestra:
--   · una operación con hora de entrada PASADA se guarda con esa hora, y su
--     hora de registro (`created_at`) es la del momento de teclearla;
--   · el riesgo se congela con el capital vigente AL REGISTRAR (comportamiento
--     actual, DEC-013 sin resolver) y no cambia después por nada: ni por un
--     depósito, ni por un cierre, ni por un intento directo del propietario;
--   · el orden cronológico: ningún hecho en el futuro, ningún parcial antes de
--     la apertura ni antes del parcial previo, ningún cierre antes de la
--     apertura ni antes del último parcial;
--   · `recorded_at` y `closure_recorded_at` los fija la base, no el cliente.
--
-- UUIDs `c024…` — distintos de los de las suites anteriores (ver README).

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('c0240240-2424-2424-2424-c0240240c024', 'trader-fechas@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0240240-2424-2424-2424-c0240240c024', false);
select crear_empresa('Personal', true);
select id as firm from public.prop_firms where user_id = 'c0240240-2424-2424-2424-c0240240c024' \gset
select id as cta from crear_cuenta(:'firm'::uuid, 'Cuenta Fechas', '10000.0000', 'USD', null) \gset
select set_config('t16.cta', :'cta', false);

-- Instantes de referencia, fijados una vez para toda la suite.
select set_config('t16.apertura', (date_trunc('minute', now()) - interval '3 days')::text, false);

\echo ''
\echo '--- [1] apertura con hora PASADA (hace 3 días) — esperado: se guarda esa hora; created_at es ahora; riesgo 100.0000 ---'
select id as op1 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => current_setting('t16.apertura')::timestamptz,
  p_risk_pct => '1.00', p_rr_objective => '3.0000', p_be_trigger => 'NONE') \gset
select set_config('t16.op1', :'op1', false);
select opened_at, created_at, risk_pct, risk_amount from public.trades where id = :'op1'::uuid;
do $$
declare t public.trades;
begin
  select * into t from public.trades where id = current_setting('t16.op1')::uuid;
  if t.opened_at <> current_setting('t16.apertura')::timestamptz then
    raise exception 'SUITE16_FALLO [1]: opened_at % no es la hora declarada', t.opened_at;
  end if;
  if t.created_at < now() - interval '1 minute' then
    raise exception 'SUITE16_FALLO [1]: created_at % no es la hora de registro', t.created_at;
  end if;
  if t.risk_amount <> 100.0000 then
    raise exception 'SUITE16_FALLO [1]: risk_amount % (esperado 100.0000 = capital vigente al registrar × 1%%)', t.risk_amount;
  end if;
end $$;

\echo '--- [2] depósito de 5.000 DESPUÉS — esperado: capital 15000; el riesgo congelado sigue en 100.0000 ---'
select registrar_evento_capital(:'cta'::uuid, 'deposit', '5000.0000', 'Depósito de prueba');
select current_capital from public.accounts where id = :'cta'::uuid;
do $$
begin
  if (select current_capital from public.accounts where id = current_setting('t16.cta')::uuid) <> 15000.0000 then
    raise exception 'SUITE16_FALLO [2]: el depósito no movió el capital';
  end if;
  if (select risk_amount from public.trades where id = current_setting('t16.op1')::uuid) <> 100.0000 then
    raise exception 'SUITE16_FALLO [2]: el riesgo congelado cambió con el capital';
  end if;
end $$;

\echo '--- [3] parcial 1 una hora después de la apertura — esperado: aceptado; recorded_at es ahora, executed_at la hora declarada ---'
select sequence, executed_at, recorded_at from registrar_parcial_ejecutado(
  :'op1'::uuid, 1, '1.0000', '50.00', current_setting('t16.apertura')::timestamptz + interval '1 hour');
do $$
declare p public.trade_partials_executed;
begin
  select * into p from public.trade_partials_executed where trade_id = current_setting('t16.op1')::uuid and sequence = 1;
  if p.executed_at <> current_setting('t16.apertura')::timestamptz + interval '1 hour' then
    raise exception 'SUITE16_FALLO [3]: executed_at % no es la hora declarada', p.executed_at;
  end if;
  if p.recorded_at is null or p.recorded_at < now() - interval '1 minute' then
    raise exception 'SUITE16_FALLO [3]: recorded_at % no es la hora de registro', p.recorded_at;
  end if;
end $$;

\echo '--- [4] parcial ANTERIOR a la apertura — esperado: CHRONOLOGY_VIOLATION ---'
do $$
begin
  perform registrar_parcial_ejecutado(current_setting('t16.op1')::uuid, 2, '2.0000', '10.00',
    current_setting('t16.apertura')::timestamptz - interval '1 minute');
  raise exception 'SUITE16_FALLO [4]: aceptó un parcial anterior a la apertura';
exception when others then
  if sqlerrm not like '%CHRONOLOGY_VIOLATION%' then raise exception 'SUITE16_FALLO [4]: %', sqlerrm; end if;
  raise notice '[4] rechazado: %', sqlerrm;
end $$;

\echo '--- [5] parcial 2 ANTERIOR al parcial 1 — esperado: CHRONOLOGY_VIOLATION ---'
do $$
begin
  perform registrar_parcial_ejecutado(current_setting('t16.op1')::uuid, 2, '2.0000', '10.00',
    current_setting('t16.apertura')::timestamptz + interval '30 minutes');
  raise exception 'SUITE16_FALLO [5]: aceptó un parcial anterior al previo';
exception when others then
  if sqlerrm not like '%CHRONOLOGY_VIOLATION%' then raise exception 'SUITE16_FALLO [5]: %', sqlerrm; end if;
  raise notice '[5] rechazado: %', sqlerrm;
end $$;

\echo '--- [6] parcial en el FUTURO — esperado: EVENT_IN_FUTURE ---'
do $$
begin
  perform registrar_parcial_ejecutado(current_setting('t16.op1')::uuid, 2, '2.0000', '10.00', now() + interval '1 hour');
  raise exception 'SUITE16_FALLO [6]: aceptó un parcial en el futuro';
exception when others then
  if sqlerrm not like '%EVENT_IN_FUTURE%' then raise exception 'SUITE16_FALLO [6]: %', sqlerrm; end if;
  raise notice '[6] rechazado: %', sqlerrm;
end $$;

\echo '--- [7] apertura en el FUTURO — esperado: EVENT_IN_FUTURE y ninguna Operación creada ---'
do $$
declare n_antes int; n_despues int;
begin
  select count(*) into n_antes from public.trades where account_id = current_setting('t16.cta')::uuid;
  begin
    perform registrar_operacion(
      p_account_id => current_setting('t16.cta')::uuid, p_symbol => 'MNQ', p_side => 'short',
      p_opened_at => now() + interval '1 hour', p_risk_pct => '1.00', p_rr_objective => '2.0000', p_be_trigger => 'NONE');
    raise exception 'SUITE16_FALLO [7]: aceptó una apertura en el futuro';
  exception when others then
    if sqlerrm not like '%EVENT_IN_FUTURE%' then raise exception 'SUITE16_FALLO [7]: %', sqlerrm; end if;
    raise notice '[7] rechazado: %', sqlerrm;
  end;
  select count(*) into n_despues from public.trades where account_id = current_setting('t16.cta')::uuid;
  if n_despues <> n_antes then raise exception 'SUITE16_FALLO [7]: se creó una Operación'; end if;
end $$;

\echo '--- [8] cierre ANTERIOR al último parcial — esperado: CHRONOLOGY_VIOLATION, la Operación sigue abierta ---'
do $$
begin
  perform aplicar_cierre_operacion(
    p_trade_id => current_setting('t16.op1')::uuid,
    p_closed_at => current_setting('t16.apertura')::timestamptz + interval '30 minutes',
    p_closure_reason => 'TAKE_PROFIT_FULL', p_cierre_manual_rr => null,
    p_r_max => '3.0000', p_r_final => '2.0000', p_pnl_amount => '200.0000', p_expected_partials => 1);
  raise exception 'SUITE16_FALLO [8]: aceptó un cierre anterior al último parcial';
exception when others then
  if sqlerrm not like '%CHRONOLOGY_VIOLATION%' then raise exception 'SUITE16_FALLO [8]: %', sqlerrm; end if;
  raise notice '[8] rechazado: %', sqlerrm;
end $$;
do $$
begin
  if (select status from public.trades where id = current_setting('t16.op1')::uuid) <> 'open' then
    raise exception 'SUITE16_FALLO [8]: la Operación no sigue abierta';
  end if;
end $$;

\echo '--- [9] cierre en el FUTURO — esperado: EVENT_IN_FUTURE ---'
do $$
begin
  perform aplicar_cierre_operacion(
    p_trade_id => current_setting('t16.op1')::uuid, p_closed_at => now() + interval '1 hour',
    p_closure_reason => 'TAKE_PROFIT_FULL', p_cierre_manual_rr => null,
    p_r_max => '3.0000', p_r_final => '2.0000', p_pnl_amount => '200.0000', p_expected_partials => 1);
  raise exception 'SUITE16_FALLO [9]: aceptó un cierre en el futuro';
exception when others then
  if sqlerrm not like '%EVENT_IN_FUTURE%' then raise exception 'SUITE16_FALLO [9]: %', sqlerrm; end if;
  raise notice '[9] rechazado: %', sqlerrm;
end $$;

\echo '--- [10] cierre dos horas después de la apertura — esperado: closed; closed_at declarado; closure_recorded_at ahora; 7200 s; riesgo 100.0000 ---'
select status, closed_at, closure_recorded_at, time_in_market_sec, risk_amount, r_final, pnl_amount
from aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => current_setting('t16.apertura')::timestamptz + interval '2 hours',
  p_closure_reason => 'TAKE_PROFIT_FULL', p_cierre_manual_rr => null,
  p_r_max => '3.0000', p_r_final => '2.0000', p_pnl_amount => '200.0000', p_expected_partials => 1);
do $$
declare t public.trades;
begin
  select * into t from public.trades where id = current_setting('t16.op1')::uuid;
  if t.status <> 'closed' then raise exception 'SUITE16_FALLO [10]: no se cerró'; end if;
  if t.closed_at <> current_setting('t16.apertura')::timestamptz + interval '2 hours' then
    raise exception 'SUITE16_FALLO [10]: closed_at % no es la hora declarada', t.closed_at;
  end if;
  if t.closure_recorded_at is null or t.closure_recorded_at < now() - interval '1 minute' then
    raise exception 'SUITE16_FALLO [10]: closure_recorded_at % no es la hora de registro', t.closure_recorded_at;
  end if;
  if t.time_in_market_sec <> 7200 then raise exception 'SUITE16_FALLO [10]: time_in_market_sec %', t.time_in_market_sec; end if;
  if t.risk_amount <> 100.0000 then raise exception 'SUITE16_FALLO [10]: el cierre cambió el riesgo congelado'; end if;
end $$;

\echo '--- [11] apertura de otra Operación tras el depósito — esperado: riesgo 152.0000 (capital vigente al registrar: 15200 tras depósito y cierre; DEC-013 abierta) ---'
select id as op2 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'MNQ', p_side => 'short',
  p_opened_at => current_setting('t16.apertura')::timestamptz,
  p_risk_pct => '1.00', p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select set_config('t16.op2', :'op2', false);
do $$
begin
  if (select risk_amount from public.trades where id = current_setting('t16.op2')::uuid) <> 152.0000 then
    raise exception 'SUITE16_FALLO [11]: el riesgo no salió del capital vigente al registrar';
  end if;
end $$;

\echo '--- [12] cierre ANTERIOR a la apertura (sin parciales) — esperado: CHRONOLOGY_VIOLATION ---'
do $$
begin
  perform aplicar_cierre_operacion(
    p_trade_id => current_setting('t16.op2')::uuid,
    p_closed_at => current_setting('t16.apertura')::timestamptz - interval '1 minute',
    p_closure_reason => 'STOP_LOSS', p_cierre_manual_rr => null,
    p_r_max => '0.0000', p_r_final => '-1.0000', p_pnl_amount => '-152.0000', p_expected_partials => 0);
  raise exception 'SUITE16_FALLO [12]: aceptó un cierre anterior a la apertura';
exception when others then
  if sqlerrm not like '%CHRONOLOGY_VIOLATION%' then raise exception 'SUITE16_FALLO [12]: %', sqlerrm; end if;
  raise notice '[12] rechazado: %', sqlerrm;
end $$;

reset role;

\echo ''
\echo '--- NIVEL B — como propietario (salta RLS): los triggers aguantan ---'

\echo '--- [13] reescribir closure_recorded_at — esperado: se ignora, conserva el valor original ---'
select closure_recorded_at as cra_antes from public.trades where id = :'op1'::uuid \gset
update public.trades set closure_recorded_at = '2000-01-01T00:00:00Z' where id = :'op1'::uuid;
do $$
begin
  if (select closure_recorded_at from public.trades where id = current_setting('t16.op1')::uuid) = '2000-01-01T00:00:00Z'::timestamptz then
    raise exception 'SUITE16_FALLO [13]: se reescribió la hora de registro del cierre';
  end if;
end $$;

\echo '--- [14] mover closed_at antes del último parcial — esperado: CHRONOLOGY_VIOLATION ---'
do $$
begin
  update public.trades set closed_at = current_setting('t16.apertura')::timestamptz + interval '10 minutes'
   where id = current_setting('t16.op1')::uuid;
  raise exception 'SUITE16_FALLO [14]: aceptó un closed_at anterior al último parcial';
exception when others then
  if sqlerrm not like '%CHRONOLOGY_VIOLATION%' then raise exception 'SUITE16_FALLO [14]: %', sqlerrm; end if;
  raise notice '[14] rechazado: %', sqlerrm;
end $$;

\echo '--- [15] el riesgo de la Operación con fecha pasada sigue intacto tras todo lo anterior ---'
do $$
declare t public.trades;
begin
  select * into t from public.trades where id = current_setting('t16.op1')::uuid;
  if t.risk_amount <> 100.0000 or t.risk_pct <> 1.00 or t.opened_at <> current_setting('t16.apertura')::timestamptz then
    raise exception 'SUITE16_FALLO [15]: identidad o riesgo alterados (% / % / %)', t.risk_amount, t.risk_pct, t.opened_at;
  end if;
end $$;

\echo ''
\echo 'SUITE 16 · TODO CORRECTO'
