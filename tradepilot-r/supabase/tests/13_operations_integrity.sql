-- Validación de la integridad de Operations — BUILD 016B contra Postgres real.
--
-- Cierra H1, H2, H3, H5, H7, H8 e INT-9. Cada ataque se ejecuta en **dos
-- niveles**, y los dos importan:
--
--   NIVEL A · como `authenticated` → debe fallar por **privilegios**.
--             Demuestra que la superficie pública está cerrada.
--   NIVEL B · como **propietario de las tablas**, que salta RLS y tiene todos
--             los privilegios → debe fallar por **trigger**.
--             Demuestra que la integridad **no depende** de que esa superficie
--             esté cerrada.
--
-- Un test que sólo dijera "permission denied" y terminase ahí no probaría lo
-- segundo, que es justo lo que la auditoría de 016B identificó como la
-- diferencia entre una frontera y una cerradura.
--
-- UUIDs c016.../d016... — distintos de los de 01-12.

\set ON_ERROR_STOP off

insert into auth.users (id, email) values
  ('c0160160-1616-1616-1616-c0160160c016', 'integridad-a@test.local'),
  ('d0160160-1616-1616-1616-d0160160d016', 'integridad-b@test.local')
on conflict (id) do nothing;

-- ============================================================
-- Sembrado por las vías legítimas. Si algo de esto falla, 016B ha roto la
-- creación legítima y el resto del fichero es irrelevante.
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0160160-1616-1616-1616-c0160160c016', false);
select crear_empresa('Personal', true);
select id as firm from public.prop_firms where user_id = 'c0160160-1616-1616-1616-c0160160c016' \gset
select id as cta from crear_cuenta(:'firm'::uuid, 'Cuenta Integridad', '10000.0000', 'USD', null) \gset
select id as plan from crear_plan_gestion(
  p_name => 'Plan Integridad', p_rr_objective => '3.0000', p_be_trigger => 'AFTER_NTH_PARTIAL',
  p_partials => '[{"sequence":1,"rr_level":"1.0000","pct_close":"50.00"}]'::jsonb) \gset

\echo ''
\echo '============================================================'
\echo ' RUTAS LEGÍTIMAS — deben seguir funcionando con la puerta cerrada'
\echo '============================================================'

\echo '--- [1] registrar_operacion — esperado: Operación abierta, risk_amount 100.0000 ---'
select id as op from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'LIBRE', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select status, risk_pct, risk_amount, rr_objective from public.trades where id = :'op'::uuid;

\echo '--- [2] registrar_parcial_ejecutado — esperado: 1 parcial ---'
select sequence, rr_level, pct_close from registrar_parcial_ejecutado(:'op'::uuid, 1, '1.0000', '50.00', now());

-- BUILD 018 corrigió el `closure_reason` de este fixture, y sólo eso: los
-- números ya eran exactos. Con el parcial de 50% a 1.0R ejecutado, la fórmula
-- congelada da 0.50×1.0 + 0.50×R_resto = 0.5000 justo cuando R_resto = 0 — que
-- es la prioridad 3 (`k ≥ 1`, sin cierre manual, `r_max` 2.5 por debajo del
-- `rr_objective` 3.0). R_resto = 0 con parciales ejecutados **es** un cierre a
-- break-even, no un take-profit completo: `TAKE_PROFIT_FULL` afirmaba que el
-- precio alcanzó un objetivo que `r_max` desmiente. Los tres valores
-- esperados —closed / 0.5000 / 50.0000— siguen siendo los mismos.
\echo '--- [3] aplicar_cierre_operacion — esperado: closed / 0.5000 / 50.0000 ---'
select status, r_final, pnl_amount from aplicar_cierre_operacion(
  :'op'::uuid, now(), 'BREAK_EVEN', null, '2.5000', '0.5000', '50.0000');

\echo '--- [4] abrir_operacion_desde_intencion — esperado: Operación con instrument_key ---'
select id as intent from crear_intencion_de_gestion(
  p_side => 'long', p_instrument_key => 'EURUSD', p_decided_at => now(),
  p_valid_until => now() + interval '2 hours',
  p_destinations => format('[{"account_id":"%s","management_plan_id":"%s","risk_pct":"1.00",
                             "risk_transformation":{"kind":"absolute"}}]', :'cta', :'plan')::jsonb) \gset
select id as dest from public.management_intent_destinations where intent_id = :'intent'::uuid \gset
select id as op_v from abrir_operacion_desde_intencion(:'dest'::uuid, now(), null) \gset
select status, instrument_key, rr_objective from public.trades where id = :'op_v'::uuid;

\echo '--- [5] D2: corrección legítima del desenlace por su RPC — esperado: r_final 2.0000 ---'
select r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'op'::uuid, p_r_final => '2.0000', p_pnl_amount => '200.0000');

\echo '--- [6] D2: esa corrección quedó AUDITADA — esperado: al menos 1 entrada con before/after ---'
select entity_type, action, (diff ? 'before' and diff ? 'after') as tiene_before_y_after
  from public.audit_log where entity_id = :'op'::uuid order by id desc limit 1;

\echo ''
\echo '============================================================'
\echo ' NIVEL A — como authenticated: la superficie pública está cerrada'
\echo '============================================================'

\echo '--- [7] H2: INSERT directo en trades — esperado: permission denied ---'
insert into public.trades (user_id, account_id, symbol, side, opened_at, risk_pct, risk_amount,
                           management_plan_id, rr_objective, be_trigger, status, r_final, pnl_amount)
values ('c0160160-1616-1616-1616-c0160160c016', :'cta'::uuid, 'FORJADA', 'long', now(), 1.00, 777777.0000,
        :'plan'::uuid, 3.0000, 'NONE', 'closed', 33.3333, 777777.0000);

\echo '--- [8] H2: crear_operacion_nucleo invocado directamente — esperado: permission denied ---'
select crear_operacion_nucleo(:'cta'::uuid, 'NUCLEO', 'NUCLEO', 'long', now(), 1.00,
                              :'plan'::uuid, 3.0000, 'NONE', '[]'::jsonb, null, 'manual', null);

\echo '--- [9] H3/H1: UPDATE directo de risk_amount — esperado: permission denied ---'
update public.trades set risk_amount = '999999.0000' where id = :'op'::uuid;

\echo '--- [10] H3: UPDATE directo de r_final en Operación cerrada — esperado: permission denied ---'
update public.trades set r_final = 77.7777 where id = :'op'::uuid;

\echo '--- [11] H7: DELETE de una Operación — esperado: permission denied ---'
delete from public.trades where id = :'op'::uuid;

\echo '--- [12] INT-9: UPDATE de un parcial ejecutado — esperado: permission denied ---'
update public.trade_partials_executed set pct_close = 99.00 where trade_id = :'op'::uuid;

\echo '--- [13] INT-9: DELETE de un parcial ejecutado — esperado: permission denied ---'
delete from public.trade_partials_executed where trade_id = :'op'::uuid;

\echo '--- [14] INT-9: INSERT de un parcial sobre Operación cerrada — esperado: permission denied ---'
insert into public.trade_partials_executed (trade_id, sequence, rr_level, pct_close, executed_at)
values (:'op'::uuid, 5, '9.0000', '100.00', now());

\echo '--- [15] H5: UPDATE/DELETE de parciales planificados — esperado: permission denied ---'
update public.trade_partials_planned set pct_close = 1.00 where trade_id = :'op'::uuid;
delete from public.trade_partials_planned where trade_id = :'op'::uuid;

\echo '--- [16] H1: UPDATE del acumulador de riesgo — esperado: permission denied ---'
update public.account_risk_state set n = 999, mean = 42.0000, version = 999 where account_id = :'cta'::uuid;

\echo '--- [17] H1: DELETE del acumulador — esperado: permission denied ---'
delete from public.account_risk_state where account_id = :'cta'::uuid;

\echo '--- [18] verificación: nada de lo anterior cambió el estado real ---'
select (select risk_amount from public.trades where id = :'op'::uuid) as risk_amount,
       (select r_final from public.trades where id = :'op'::uuid) as r_final,
       (select count(*) from public.trades where symbol in ('FORJADA','NUCLEO')) as operaciones_forjadas,
       (select pct_close from public.trade_partials_executed where trade_id = :'op'::uuid) as pct_close,
       (select count(*) from public.trade_partials_planned where trade_id = :'op'::uuid) as planificados,
       (select n from public.account_risk_state where account_id = :'cta'::uuid) as acumulador_n;

\echo ''
\echo '============================================================'
\echo ' NIVEL B — como PROPIETARIO (salta RLS): los triggers aguantan'
\echo '============================================================'
reset role;

\echo '--- [19] identidad: UPDATE de risk_amount — esperado: ERROR IMMUTABLE_IDENTITY_FACT ---'
update public.trades set risk_amount = '999999.0000' where id = :'op'::uuid;

\echo '--- [20] identidad: UPDATE de risk_pct — esperado: ERROR ---'
update public.trades set risk_pct = 99.99 where id = :'op'::uuid;

\echo '--- [21] identidad: UPDATE de rr_objective — esperado: ERROR ---'
update public.trades set rr_objective = 99.9999 where id = :'op'::uuid;

\echo '--- [22] identidad: UPDATE de be_trigger — esperado: ERROR ---'
update public.trades set be_trigger = 'NONE' where id = :'op'::uuid;

\echo '--- [23] identidad: UPDATE de instrument_key — esperado: ERROR ---'
update public.trades set instrument_key = 'FORJADO' where id = :'op'::uuid;

\echo '--- [24] identidad: UPDATE de side — esperado: ERROR ---'
update public.trades set side = 'short' where id = :'op'::uuid;

\echo '--- [25] identidad: UPDATE de symbol — esperado: ERROR ---'
update public.trades set symbol = 'OTRO' where id = :'op'::uuid;

\echo '--- [26] identidad: UPDATE de account_id — esperado: ERROR IMMUTABLE_ACCOUNT_ID ---'
update public.trades set account_id = gen_random_uuid() where id = :'op'::uuid;

\echo '--- [27] identidad: UPDATE de opened_at — esperado: ERROR ---'
update public.trades set opened_at = now() - interval '99 days' where id = :'op'::uuid;

\echo '--- [28] H7: DELETE de una Operación — esperado: ERROR TRADE_NOT_DELETABLE ---'
delete from public.trades where id = :'op'::uuid;

\echo '--- [29] INT-9: UPDATE de un parcial ejecutado — esperado: ERROR IMMUTABLE_EVIDENCE ---'
update public.trade_partials_executed set pct_close = 99.00 where trade_id = :'op'::uuid;

\echo '--- [30] INT-9: DELETE de un parcial ejecutado — esperado: ERROR IMMUTABLE_EVIDENCE ---'
delete from public.trade_partials_executed where trade_id = :'op'::uuid;

\echo '--- [31] H5: UPDATE de un parcial planificado — esperado: ERROR IMMUTABLE_EVIDENCE ---'
update public.trade_partials_planned set pct_close = 1.00 where trade_id = :'op'::uuid;

\echo '--- [32] H5: DELETE de un parcial planificado — esperado: ERROR IMMUTABLE_EVIDENCE ---'
delete from public.trade_partials_planned where trade_id = :'op'::uuid;

\echo '--- [33] H1: UPDATE del acumulador saltando la versión — esperado: ERROR INVALID_VERSION ---'
update public.account_risk_state set n = 999, mean = 42.0000, version = 999 where account_id = :'cta'::uuid;

\echo '--- [34] H1: UPDATE que hace retroceder n — esperado: ERROR ACCUMULATOR_REGRESSION ---'
update public.account_risk_state set n = -1, version = version + 1 where account_id = :'cta'::uuid;

\echo '--- [35] H1: DELETE del acumulador — esperado: ERROR NOT_DELETABLE ---'
delete from public.account_risk_state where account_id = :'cta'::uuid;

-- BUILD 018 no estrechó esta libertad: la obligó a ser **coherente**. Corregir
-- `r_final` a 3.0000 dejando `pnl_amount` en 200.0000 y `r_max` en 2.5000
-- producía una Operación que se contradecía a sí misma por partida doble —un
-- P&L que no es `risk_amount` × `r_final`, y un resultado por encima del máximo
-- que la propia Operación declara haber alcanzado—. Desde 018 el desenlace se
-- corrige **entero o nada**, en un solo UPDATE. La aserción de D2 —el desenlace
-- es corregible por el propietario, la identidad nunca— es exactamente la
-- misma, y el valor esperado tampoco cambia.
\echo '--- [36] desenlace: el propietario SÍ puede corregir r_final (D2) — esperado: 3.0000 ---'
update public.trades set r_max = 3.0000, r_final = 3.0000, pnl_amount = 300.0000 where id = :'op'::uuid;
select r_final from public.trades where id = :'op'::uuid;

\echo '--- [37] y esa corrección también quedó auditada — esperado: entradas > 1 ---'
select count(*) as entradas_auditoria from public.audit_log where entity_id = :'op'::uuid;

\echo '--- [38] verificación final: la identidad y la evidencia intactas ---'
select (select risk_amount from public.trades where id = :'op'::uuid) as risk_amount,
       (select symbol from public.trades where id = :'op'::uuid) as symbol,
       (select rr_objective from public.trades where id = :'op'::uuid) as rr_objective,
       (select pct_close from public.trade_partials_executed where trade_id = :'op'::uuid) as pct_close,
       (select count(*) from public.trade_partials_planned where trade_id = :'op'::uuid) as planificados,
       (select n from public.account_risk_state where account_id = :'cta'::uuid) as acumulador_n;

\echo ''
\echo '============================================================'
\echo ' H8 — la Operación no destruye la historia de la Intención'
\echo '============================================================'

\echo '--- [39] el destino está materializado y vinculado — esperado: materialized / t ---'
select state, (trade_id = :'op_v'::uuid) as vinculado
  from public.management_intent_destinations where id = :'dest'::uuid;

\echo '--- [40] borrar la Operación vinculada como PROPIETARIO — esperado: ERROR TRADE_NOT_DELETABLE ---'
delete from public.trades where id = :'op_v'::uuid;

\echo '--- [41] el destino SOBREVIVE — esperado: 1 / materialized (antes de 016B era 0) ---'
select count(*) as destinos, max(state) as estado
  from public.management_intent_destinations where id = :'dest'::uuid;

\echo '--- [42] la FK ya no es CASCADE — esperado: RESTRICT ---'
select confdeltype as tipo_on_delete
  from pg_constraint where conname = 'management_intent_destinations_trade_id_fkey';

\echo ''
\echo '============================================================'
\echo ' AISLAMIENTO Y SUPERFICIE'
\echo '============================================================'
set role authenticated;
select set_config('request.jwt.claim.sub', 'd0160160-1616-1616-1616-d0160160d016', false);

\echo '--- [43] H1: el acumulador ajeno por su RPC — esperado: ERROR ACCOUNT_NOT_FOUND ---'
select * from risk_engine_apply_accumulator_update(:'cta'::uuid, gen_random_uuid(), 'OperacionCerrada', 0, 99, 9.0000, 9.0000);

\echo '--- [44] B no ve ninguna Operación de A — esperado: 0 ---'
select count(*) as operaciones_de_a_visibles_para_b from public.trades;

\echo '--- [45] las seis RPC de escritura son SECURITY DEFINER — esperado: 6 filas, todas t ---'
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in
   ('registrar_operacion','registrar_parcial_ejecutado','cancelar_operacion',
    'cancelar_operacion_fantasma','aplicar_cierre_operacion','aplicar_edicion_operacion')
 order by proname;

\echo '--- [46] el núcleo no es ejecutable por authenticated — esperado: f ---'
select has_function_privilege('authenticated',
  'public.crear_operacion_nucleo(uuid,text,text,text,timestamptz,numeric,uuid,numeric,text,jsonb,uuid,text,text)',
  'execute') as nucleo_ejecutable;

\echo '--- [47] privilegios de escritura revocados — esperado: solo SELECT (y INSERT en el acumulador) ---'
select table_name, string_agg(privilege_type, ',' order by privilege_type) as privilegios
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'authenticated'
   and table_name in ('trades','trade_partials_executed','trade_partials_planned','account_risk_state')
 group by table_name order by table_name;

\echo '--- [48] H6 SIGUE FUERA DE ALCANCE: accounts sigue siendo escribible (deuda de Funding) ---'
select set_config('request.jwt.claim.sub', 'c0160160-1616-1616-1616-c0160160c016', false);
update public.accounts set current_capital = '11111.0000' where id = :'cta'::uuid;
select current_capital as capital_tras_update_directo from public.accounts where id = :'cta'::uuid;

reset role;
