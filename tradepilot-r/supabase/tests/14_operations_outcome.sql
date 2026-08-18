-- Validación de BUILD 018 — Operations: el desenlace como hecho de dominio.
--
-- BUILD 016B cerró **quién puede escribir**. Esta suite valida lo que 018
-- cierra: **qué es un desenlace válido**. Hasta 018, por la única puerta que
-- quedaba abierta —la RPC, expuesta por PostgREST a cualquier sesión
-- autenticada— se podía cerrar una Operación con `r_final = 99` sin un solo
-- parcial que lo sostuviera, con un `pnl_amount` sin relación alguna con
-- `risk_amount × r_final`, y con `closure_reason = BREAK_EVEN` sobre un
-- desenlace de 5R.
--
-- ============================================================
-- LO QUE ESTA SUITE **NO** DEMUESTRA
--
-- No demuestra que el `r_final` que llega sea el que produciría el Quant
-- Engine. PostgreSQL no vuelve a calcular la fórmula y no debe hacerlo nunca:
-- una segunda implementación sería una segunda fuente de verdad. Lo que se
-- comprueba es **coherencia** — que el desenlace no se contradiga a sí mismo
-- ni a la evidencia registrada. Un valor coherente pero incorrecto sigue
-- siendo aceptable para la base, y eso es deliberado.
--
-- Dicho de otro modo: `[13]`-`[22]` no rechazan "un r_final falso", rechazan
-- "un r_final que la propia Operación desmiente". La diferencia importa y no
-- debe difuminarse al leer los resultados.
--
-- ============================================================
-- LOS DOS NIVELES
--
-- Igual que `13_operations_integrity.sql`, cada ataque relevante se ejecuta en
-- dos niveles, y prueban cosas distintas:
--
--   · **nivel A, como `authenticated` por la RPC** → es la vía real de la
--     aplicación. Demuestra que la puerta legítima no admite un desenlace
--     incoherente.
--   · **nivel B, como propietario de las tablas**, que salta RLS y tiene todos
--     los privilegios → demuestra que la coherencia **no depende** de que esa
--     puerta esté bien escrita. Es la razón de que 018 viva en triggers y no
--     dentro de las RPC.
--
-- UUIDs `c018.../d018...` — distintos de los trece scripts anteriores por la
-- razón documentada en el README.

\set ON_ERROR_STOP off

insert into auth.users (id, email) values
  ('c0180180-1818-1818-1818-c0180180c018', 'trader-desenlace@test.local'),
  ('d0180180-1818-1818-1818-d0180180d018', 'trader-ajeno-018@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);
select crear_empresa('Personal', true);
select id as firm from public.prop_firms where user_id = 'c0180180-1818-1818-1818-c0180180c018' \gset
select id as cta from crear_cuenta(:'firm'::uuid, 'Cuenta Desenlace', '10000.0000', 'USD', null) \gset

-- `rr_objective` 3.0000 en todos los Planes de esta suite: es el umbral contra
-- el que se mide la regla de TAKE_PROFIT_FULL.
select id as plan from crear_plan_gestion(
  p_name => 'Plan Desenlace', p_rr_objective => '3.0000', p_be_trigger => 'AFTER_NTH_PARTIAL',
  p_partials => '[{"sequence":1,"rr_level":"1.0000","pct_close":"50.00"}]'::jsonb) \gset

\echo ''
\echo '============================================================'
\echo ' RUTAS LEGÍTIMAS — el camino real, entero, con la puerta cerrada'
\echo '============================================================'

\echo '--- [1] registrar_operacion — esperado: open / risk_amount 100.0000 / time_in_market_sec NULO ---'
select id as op1 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'EURUSD', p_side => 'long',
  p_opened_at => now() - interval '90 seconds',
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select status, risk_amount, time_in_market_sec from public.trades where id = :'op1'::uuid;

\echo '--- [2] registrar_parcial_ejecutado (seq 1, 1.0R, 50%) — esperado: 1 parcial ---'
select sequence, rr_level, pct_close from registrar_parcial_ejecutado(:'op1'::uuid, 1, '1.0000', '50.00', now());

-- 0.50×1.0 + 0.50×R_resto = 0.5000 exige R_resto = 0, que es la prioridad 3 de
-- la fórmula congelada (k ≥ 1, sin cierre manual, r_max por debajo del
-- objetivo). R_resto = 0 con parciales ejecutados **es** un break-even.
\echo '--- [3] aplicar_cierre_operacion CON testigo y clave — esperado: closed / 0.5000 / 50.0000 ---'
select status, r_final, pnl_amount from aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => now(), p_closure_reason => 'BREAK_EVEN',
  p_cierre_manual_rr => null, p_r_max => '2.5000', p_r_final => '0.5000', p_pnl_amount => '50.0000',
  p_expected_partials => 1, p_idempotency_key => 'c0180000-0000-0000-0000-000000000001'::uuid);

\echo '--- [4] el capital se movió exactamente una vez — esperado: 1 evento trade_pnl / capital 10050.0000 ---'
select (select count(*) from public.account_capital_events
          where trade_id = :'op1'::uuid and event_type = 'trade_pnl') as eventos_pnl,
       (select current_capital from public.accounts where id = :'cta'::uuid) as capital;

-- ============================================================
-- Segunda Cuenta, y **todas** las Operaciones de ataque nacidas de una vez,
-- antes de que ninguna se cierre.
--
-- No es cosmética: `risk_amount` se congela al nacer como
-- Capital_en_ese_instante × Riesgo%, y 016B lo hizo inmutable. Si una
-- Operación de ataque naciera después de que otra hubiera cerrado con
-- beneficio, su `risk_amount` sería 100.50 en vez de 100.00 y **todos** los
-- `pnl_amount` de esta suite dejarían de cuadrar — `INCOHERENT_PNL` saltaría
-- primero y taparía el error que cada comprobación pretende provocar.
--
-- Este fixture se escribió mal la primera vez exactamente así, y fue la propia
-- suite quien lo detectó: nueve comprobaciones devolvieron INCOHERENT_PNL en
-- lugar de su error esperado. Se deja escrito para que nadie lo reintroduzca.
-- ============================================================
select id as ctb from crear_cuenta(:'firm'::uuid, 'Cuenta Ataques', '10000.0000', 'USD', null) \gset

select id as op2 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'ATAQUE1', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op3 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'ATAQUE2', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op4 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'ATAQUE3', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op5 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'ATAQUE4', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op6 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'REASON1', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op7 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'REASON2', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op8 from registrar_operacion(
  p_account_id => :'ctb'::uuid, p_symbol => 'EVIDENCIA', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset

\echo '--- [4b] las siete Operaciones de ataque comparten risk_amount 100.0000 — esperado: 7 / 100.0000 / 100.0000 ---'
select count(*) as operaciones, min(risk_amount) as minimo, max(risk_amount) as maximo
  from public.trades where account_id = :'ctb'::uuid;

\echo ''
\echo '============================================================'
\echo ' time_in_market_sec — DERIVADO, NUNCA APORTADO (criterio 9)'
\echo '============================================================'

\echo '--- [5] derivado en el cierre — esperado: t (coincide con closed_at - opened_at, ~90 s) ---'
select time_in_market_sec,
       (time_in_market_sec = extract(epoch from (closed_at - opened_at))::int) as coincide_con_la_resta
  from public.trades where id = :'op1'::uuid;

-- Nivel B: el ataque real no es pasarlo por la RPC —ninguna RPC lo acepta como
-- parámetro— sino escribirlo a mano. El trigger BEFORE lo reescribe siempre,
-- así que el UPDATE **tiene éxito** y aun así el valor falso no sobrevive. Es
-- la única forma de que un campo derivado sea infalsificable: no rechazarlo,
-- sino ignorarlo.
reset role;
\echo '--- [6] NIVEL B: UPDATE crudo de time_in_market_sec = 999999 — esperado: UPDATE 1, pero el valor sigue siendo el derivado ---'
update public.trades set time_in_market_sec = 999999 where id = :'op1'::uuid;
select time_in_market_sec, (time_in_market_sec = 999999) as falsificacion_sobrevivio
  from public.trades where id = :'op1'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

-- `aplicar_edicion_operacion` no admite `closed_at` —no es un parámetro de su
-- firma—, así que el único lado por el que `time_in_market_sec` puede moverse
-- es una corrección a nivel de tabla. `opened_at` es identidad inmutable desde
-- 016B: el otro extremo de la resta no se mueve nunca.
reset role;
\echo '--- [7] mover closed_at recalcula el derivado — esperado: 300 ---'
update public.trades set closed_at = opened_at + interval '300 seconds' where id = :'op1'::uuid;
select time_in_market_sec from public.trades where id = :'op1'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

\echo ''
\echo '============================================================'
\echo ' IDEMPOTENCIA DEL CIERRE (criterios 10, 11, 14, 15)'
\echo '============================================================'

\echo '--- [8] reintento EXACTO con la MISMA clave — esperado: misma Operación, sin error ---'
select (aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => now(), p_closure_reason => 'BREAK_EVEN',
  p_cierre_manual_rr => null, p_r_max => '2.5000', p_r_final => '0.5000', p_pnl_amount => '50.0000',
  p_expected_partials => 1, p_idempotency_key => 'c0180000-0000-0000-0000-000000000001'::uuid
)).id = :'op1'::uuid as misma_operacion;

\echo '--- [9] el reintento NO duplicó el movimiento de capital — esperado: 1 evento / capital 10050.0000 ---'
select (select count(*) from public.account_capital_events
          where trade_id = :'op1'::uuid and event_type = 'trade_pnl') as eventos_pnl,
       (select current_capital from public.accounts where id = :'cta'::uuid) as capital;

\echo '--- [10] segundo cierre con clave DISTINTA — esperado: ERROR INVALID_STATE_TRANSITION (closed:closed) ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '2.5000', p_r_final => '-1.0000', p_pnl_amount => '-100.0000',
  p_expected_partials => 1, p_idempotency_key => 'c0180000-0000-0000-0000-000000000002'::uuid);

\echo '--- [11] segundo cierre SIN clave — esperado: ERROR INVALID_STATE_TRANSITION ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '2.5000', p_r_final => '-1.0000', p_pnl_amount => '-100.0000');

\echo '--- [12] el capital sigue intacto tras los dos intentos — esperado: 1 evento / capital 10050.0000 ---'
select (select count(*) from public.account_capital_events
          where trade_id = :'op1'::uuid and event_type = 'trade_pnl') as eventos_pnl,
       (select current_capital from public.accounts where id = :'cta'::uuid) as capital;

-- Nivel B: reescribir la clave permitiría replicar el cierre — pasar por la
-- puerta de idempotencia con una clave nueva y volver a mover capital.
reset role;
\echo '--- [13] NIVEL B: reescribir closure_idempotency_key — esperado: ERROR IMMUTABLE_CLOSURE_KEY ---'
update public.trades set closure_idempotency_key = 'c0180000-0000-0000-0000-0000000000ff'::uuid
  where id = :'op1'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

\echo ''
\echo '============================================================'
\echo ' EL DESENLACE NO PUEDE CONTRADECIRSE (criterios 1-7)'
\echo '============================================================'
\echo '        Nivel A: por la RPC, la vía real de la aplicación.'

\echo '--- [14] pnl_amount que no es risk_amount × r_final — esperado: ERROR INCOHERENT_PNL ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '1.0000', p_r_final => '1.0000', p_pnl_amount => '999999.0000',
  p_expected_partials => 0);

\echo '--- [15] r_final = 99 sin evidencia que lo sostenga (r_max 2) — esperado: ERROR OUTCOME_EXCEEDS_R_MAX ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '99.0000', p_pnl_amount => '9900.0000',
  p_expected_partials => 0);

\echo '--- [16] r_final por debajo de -1 (peor caso: el stop completo) — esperado: ERROR OUTCOME_OUT_OF_RANGE ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '-5.0000', p_pnl_amount => '-500.0000',
  p_expected_partials => 0);

\echo '--- [17] cierre_manual_rr por encima de r_max — esperado: ERROR OUTCOME_EXCEEDS_R_MAX ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '9.0000', p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0);

\echo '--- [18] la Operación sigue ABIERTA tras los cuatro intentos — esperado: open / 0 eventos de capital ---'
select (select status from public.trades where id = :'op2'::uuid) as estado,
       (select count(*) from public.account_capital_events where trade_id = :'op2'::uuid) as eventos;

\echo '--- [19] r_max por debajo de un parcial YA ejecutado — esperado: ERROR INCONSISTENT_TRIGGER_STATE ---'
select registrar_parcial_ejecutado(:'op2'::uuid, 1, '3.0000', '50.00', now()) is not null as parcial_a_3r;
select aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 1);

\echo '        Nivel B: como propietario, saltando RLS y la RPC por completo.'
\echo '        Es lo que demuestra que la coherencia no depende de la puerta.'

reset role;
\echo '--- [20] NIVEL B: cerrar por UPDATE crudo con pnl incoherente — esperado: ERROR INCOHERENT_PNL ---'
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'STOP_LOSS',
       r_max = 1.0000, r_final = -1.0000, pnl_amount = 500.0000 where id = :'op3'::uuid;

\echo '--- [21] NIVEL B: cerrar por UPDATE crudo con r_final > r_max — esperado: ERROR OUTCOME_EXCEEDS_R_MAX ---'
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'STOP_LOSS',
       r_max = 1.0000, r_final = 5.0000, pnl_amount = 500.0000 where id = :'op3'::uuid;

\echo '--- [22] NIVEL B: cerrar por UPDATE crudo SIN r_final ni pnl — esperado: ERROR INCOMPLETE_OUTCOME ---'
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'STOP_LOSS'
  where id = :'op3'::uuid;

\echo '--- [23] NIVEL B: Σ pct_close de los parciales ejecutados > 100 — esperado: ERROR PARTIALS_EXCEED_100_PCT ---'
\echo '        (la RPC lo bloquea antes de insertar; aquí se inserta a mano para alcanzar el trigger)'
insert into public.trade_partials_executed (trade_id, sequence, rr_level, pct_close, executed_at)
values (:'op3'::uuid, 1, 1.0000, 60.00, now()), (:'op3'::uuid, 2, 2.0000, 50.00, now());
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'STOP_LOSS',
       r_max = 3.0000, r_final = 1.0000, pnl_amount = 100.0000 where id = :'op3'::uuid;

\echo '--- [24] NIVEL B: secuencias no consecutivas desde 1 (1 y 3) — esperado: ERROR INVALID_PARTIAL_SEQUENCE ---'
insert into public.trade_partials_executed (trade_id, sequence, rr_level, pct_close, executed_at)
values (:'op4'::uuid, 1, 1.0000, 25.00, now()), (:'op4'::uuid, 3, 2.0000, 25.00, now());
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'STOP_LOSS',
       r_max = 3.0000, r_final = 1.0000, pnl_amount = 100.0000 where id = :'op4'::uuid;

\echo '--- [25] NIVEL B: rr_level no estrictamente creciente por sequence (2.0 → 1.0) — esperado: ERROR INVALID_PARTIAL_SEQUENCE ---'
insert into public.trade_partials_executed (trade_id, sequence, rr_level, pct_close, executed_at)
values (:'op5'::uuid, 1, 2.0000, 25.00, now()), (:'op5'::uuid, 2, 1.0000, 25.00, now());
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'STOP_LOSS',
       r_max = 3.0000, r_final = 1.0000, pnl_amount = 100.0000 where id = :'op5'::uuid;

\echo '--- [26] ninguna de las tres Operaciones atacadas quedó cerrada — esperado: 0 ---'
select count(*) as cerradas_indebidamente from public.trades
  where id in (:'op3'::uuid, :'op4'::uuid, :'op5'::uuid) and status = 'closed';

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

\echo ''
\echo '============================================================'
\echo ' LAS CUATRO REGLAS DE closure_reason — NI UNA MÁS (criterio 8)'
\echo '============================================================'
\echo '        Las ambigüedades STOP_LOSS/BREAK_EVEN quedan deliberadamente'
\echo '        fuera: el corpus no permite cerrarlas sin inventar semántica.'

\echo '--- [27] MANUAL_CLOSE sin cierre_manual_rr — esperado: ERROR (VALIDATION_ERROR en la RPC) ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op6'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0);

reset role;
\echo '--- [28] NIVEL B: MANUAL_CLOSE sin cierre_manual_rr saltándose la RPC — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
update public.trades set status = 'closed', closed_at = now(), closure_reason = 'MANUAL_CLOSE',
       r_max = 2.0000, r_final = 1.0000, pnl_amount = 100.0000 where id = :'op6'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

\echo '--- [29] TAKE_PROFIT_FULL con r_max (2.0) por debajo del rr_objective (3.0) — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op6'::uuid, p_closed_at => now(), p_closure_reason => 'TAKE_PROFIT_FULL',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '2.0000', p_pnl_amount => '200.0000',
  p_expected_partials => 0);

\echo '--- [30] TAKE_PROFIT_FULL con cierre_manual_rr — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op6'::uuid, p_closed_at => now(), p_closure_reason => 'TAKE_PROFIT_FULL',
  p_cierre_manual_rr => '2.0000', p_r_max => '3.0000', p_r_final => '3.0000', p_pnl_amount => '300.0000',
  p_expected_partials => 0);

\echo '--- [31] BREAK_EVEN SIN ningún parcial ejecutado — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
\echo '        (sin parciales el motor congelado daría -1, no 0: eso es MANUAL_CLOSE con cierre_manual_rr = 0)'
select aplicar_cierre_operacion(
  p_trade_id => :'op6'::uuid, p_closed_at => now(), p_closure_reason => 'BREAK_EVEN',
  p_cierre_manual_rr => null, p_r_max => '2.0000', p_r_final => '0.0000', p_pnl_amount => '0.0000',
  p_expected_partials => 0);

\echo '--- [32] TAKE_PROFIT_FULL con r_max (3.0) >= rr_objective (3.0) — esperado: closed / 3.0000 / 300.0000 ---'
select status, r_final, pnl_amount from aplicar_cierre_operacion(
  p_trade_id => :'op6'::uuid, p_closed_at => now(), p_closure_reason => 'TAKE_PROFIT_FULL',
  p_cierre_manual_rr => null, p_r_max => '3.0000', p_r_final => '3.0000', p_pnl_amount => '300.0000',
  p_expected_partials => 0);

select registrar_parcial_ejecutado(:'op7'::uuid, 1, '1.0000', '50.00', now()) is not null as parcial_ok;

\echo '--- [33] BREAK_EVEN con cierre_manual_rr — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op7'::uuid, p_closed_at => now(), p_closure_reason => 'BREAK_EVEN',
  p_cierre_manual_rr => '0.5000', p_r_max => '2.0000', p_r_final => '0.5000', p_pnl_amount => '50.0000',
  p_expected_partials => 1);

\echo '--- [34] STOP_LOSS CON un parcial ejecutado — esperado: closed (permitido a propósito) ---'
\echo '        Un parcial a 1R seguido de stop en el original es legítimo y frecuente.'
\echo '        Exigir "STOP_LOSS ⟹ sin parciales" lo haría irregistrable.'
select status, r_final from aplicar_cierre_operacion(
  p_trade_id => :'op7'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '1.5000', p_r_final => '0.0000', p_pnl_amount => '0.0000',
  p_expected_partials => 1);

\echo ''
\echo '============================================================'
\echo ' LA EVIDENCIA: secuencia única y testigo de concurrencia'
\echo '============================================================'

select registrar_parcial_ejecutado(:'op8'::uuid, 1, '1.0000', '30.00', now()) is not null as primer_parcial;

-- `UNIQUE (trade_id, sequence)` existe desde BUILD 004; lo que faltaba era
-- traducir su violación a un error que un cliente pueda reconocer.
\echo '--- [35] segundo parcial con la MISMA sequence — esperado: ERROR DUPLICATE_PARTIAL_SEQUENCE ---'
select registrar_parcial_ejecutado(:'op8'::uuid, 1, '2.0000', '30.00', now());

\echo '--- [36] la evidencia no cambió — esperado: 1 parcial ---'
select count(*) as parciales from public.trade_partials_executed where trade_id = :'op8'::uuid;

-- El testigo existe porque `for update` no basta: `OperationsEngineService`
-- calcula R_final en una transacción **anterior y distinta**, así que entre la
-- lectura de los parciales y la llamada de cierre hay una ventana real. El
-- bloqueo serializa la escritura, no una lectura que ya ocurrió. La carrera de
-- dos sesiones que lo demuestra está en `14_race_e_*.sql`; aquí se comprueba
-- el mecanismo de forma determinista.
\echo '--- [37] cierre con un testigo que no coincide con la evidencia — esperado: ERROR EVIDENCE_CHANGED ---'
select aplicar_cierre_operacion(
  p_trade_id => :'op8'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '1.5000', p_r_final => '-0.4000', p_pnl_amount => '-40.0000',
  p_expected_partials => 0);

\echo '--- [38] la Operación sigue ABIERTA y sin mover capital — esperado: open / 0 ---'
select (select status from public.trades where id = :'op8'::uuid) as estado,
       (select count(*) from public.account_capital_events where trade_id = :'op8'::uuid) as eventos;

\echo '--- [39] con el testigo correcto cierra sin problema — esperado: closed ---'
select status from aplicar_cierre_operacion(
  p_trade_id => :'op8'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '1.5000', p_r_final => '-0.4000', p_pnl_amount => '-40.0000',
  p_expected_partials => 1);

\echo ''
\echo '============================================================'
\echo ' LAS CORRECCIONES SIGUEN SIENDO POSIBLES Y AUDITADAS (criterio 16)'
\echo '============================================================'
\echo '        018 no cierra la corrección del desenlace: la obliga a ser'
\echo '        coherente. Se corrige entero o no se corrige.'

\echo '--- [40] corrección COHERENTE del desenlace — esperado: r_final -0.2000 / pnl -20.0000 ---'
select r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'op8'::uuid, p_r_final => '-0.2000', p_pnl_amount => '-20.0000');

\echo '--- [41] esa corrección quedó AUDITADA con before/after — esperado: trade / update / t ---'
select entity_type, action, (diff ? 'before' and diff ? 'after') as tiene_before_y_after
  from public.audit_log where entity_id = :'op8'::uuid order by id desc limit 1;

\echo '--- [42] el capital recogió el delta exacto (+20) — esperado: 2 eventos, suma -20.0000 ---'
\echo '        Un evento por el cierre (-40) y otro por el delta de la corrección (+20).'
select count(*) as eventos, sum(amount) as suma
  from public.account_capital_events where trade_id = :'op8'::uuid and event_type = 'trade_pnl';

\echo '--- [43] corrección INCOHERENTE (mueve r_final sin mover pnl) — esperado: ERROR INCOHERENT_PNL ---'
select aplicar_edicion_operacion(p_trade_id => :'op8'::uuid, p_r_final => '-0.9000');

\echo '--- [44] y el desenlace no se movió — esperado: -0.2000 / -20.0000 ---'
select r_final, pnl_amount from public.trades where id = :'op8'::uuid;

\echo ''
\echo '============================================================'
\echo ' 016B Y 017 SIGUEN INTACTOS (criterio 17)'
\echo '============================================================'

\echo '--- [45] identidad: corregir risk_amount — esperado: ERROR IMMUTABLE_IDENTITY_FACT:risk_amount ---'
select aplicar_edicion_operacion(p_trade_id => :'op8'::uuid, p_risk_amount => '999.0000');

reset role;
\echo '--- [46] NIVEL B: borrar una Operación — esperado: ERROR TRADE_NOT_DELETABLE ---'
delete from public.trades where id = :'op8'::uuid;

\echo '--- [47] NIVEL B: reescribir un parcial ejecutado — esperado: ERROR IMMUTABLE_EVIDENCE ---'
update public.trade_partials_executed set pct_close = 99.00 where trade_id = :'op8'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

\echo '--- [48] aislamiento: un tercero no puede cerrar una Operación ajena — esperado: ERROR TRADE_NOT_FOUND ---'
select set_config('request.jwt.claim.sub', 'd0180180-1818-1818-1818-d0180180d018', false);
select aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'STOP_LOSS',
  p_cierre_manual_rr => null, p_r_max => '1.0000', p_r_final => '-1.0000', p_pnl_amount => '-100.0000',
  p_expected_partials => 1);
select set_config('request.jwt.claim.sub', 'c0180180-1818-1818-1818-c0180180c018', false);

\echo ''
\echo '============================================================'
\echo ' LA FRONTERA CON QUANT ENGINE — VERIFICACIÓN ESTRUCTURAL'
\echo '============================================================'

-- La afirmación "018 no reimplementa la fórmula" no se deja a la palabra de
-- nadie. La fórmula R_final = Σ p_i·RR_i + (…) necesariamente multiplica un
-- porcentaje de cierre por un nivel de RR; si ninguna rutina del esquema
-- contiene ese producto, ninguna la reimplementa. Es una comprobación
-- estructural, no una demostración de equivalencia — y como tal se lee.
\echo '--- [49] ninguna función del esquema multiplica pct_close por rr_level — esperado: 0 ---'
select count(*) as rutinas_que_reimplementan_la_formula
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc ~* '(pct_close[^;]*\*[^;]*rr_level|rr_level[^;]*\*[^;]*pct_close)';

\echo '--- [50] orden de disparo de los triggers de trades — esperado: derive < invariants < outcome_coherence ---'
\echo '        Postgres dispara los BEFORE del mismo momento en orden alfabético:'
\echo '        primero se deriva, luego identidad (016B/017), y por último coherencia.'
select tgname from pg_trigger
  where tgrelid = 'public.trades'::regclass and not tgisinternal
    and tgname in ('on_trade_derive_time_in_market','on_trade_write_invariants','on_trade_write_outcome_coherence')
  order by tgname;

\echo '--- [51] verificación final — esperado: 10050.0000 / 10280.0000 / 4 cerradas / 4 abiertas / 0 sin tiempo ---'
\echo '        Cuenta Ataques: 10000 +300 (op6) +0 (op7) -40 (op8) +20 (corrección) = 10280.'
\echo '        Ni un solo céntimo procede de un desenlace rechazado: los 34 ataques'
\echo '        de esta suite dejaron el capital exactamente donde estaba.'
select (select current_capital from public.accounts where id = :'cta'::uuid) as capital_feliz,
       (select current_capital from public.accounts where id = :'ctb'::uuid) as capital_ataques,
       (select count(*) from public.trades
          where account_id in (:'cta'::uuid, :'ctb'::uuid) and status = 'closed') as cerradas,
       (select count(*) from public.trades
          where account_id in (:'cta'::uuid, :'ctb'::uuid) and status = 'open') as abiertas,
       (select count(*) from public.trades
          where account_id in (:'cta'::uuid, :'ctb'::uuid)
            and status = 'closed' and time_in_market_sec is null) as cerradas_sin_tiempo;

reset role;
