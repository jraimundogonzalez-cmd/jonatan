-- Validación de BUILD 019 — la corrección del desenlace deja de tener un
-- callejón sin salida.
--
-- ============================================================
-- EL PROBLEMA QUE CIERRA ESTA SUITE
--
-- `aplicar_edicion_operacion` interpreta `null` como "no tocar" (semántica
-- `Partial`, BUILD 004). Dos de las cuatro reglas de `closure_reason` de BUILD
-- 018 —`TAKE_PROFIT_FULL` y `BREAK_EVEN`— exigen que `cierre_manual_rr` esté
-- **vacío**. Cruzando ambas cosas: una Operación cerrada como `MANUAL_CLOSE`
-- **no podía corregirse jamás** a esos dos motivos, porque no existía forma de
-- vaciar el campo por ninguna vía de dominio.
--
-- Y corregirla a `STOP_LOSS` sí salía adelante —ese motivo no tiene
-- restricción— pero dejaba el nivel de cierre manual como **residuo**, que
-- bloqueaba para siempre cualquier corrección posterior.
--
-- Ninguna de las dos decisiones era un error. Juntas producían una corrección
-- imposible, contra la invariante de que el desenlace **sí** se corrige
-- mientras la identidad no. BUILD 019 lo resuelve con
-- `p_borrar_cierre_manual_rr`: un acto declarado, nunca inferido de una
-- omisión.
--
-- ============================================================
-- LO QUE ESTA SUITE **NO** RELAJA
--
-- El borrado no exime de coherencia. Todo lo que valida el trigger de 018
-- sigue valiendo: `[7]` comprueba que borrar dejando `MANUAL_CLOSE` se rechaza
-- igual. 019 no duplica ni una sola de las cuatro reglas — se limita a hacer
-- alcanzable un estado que antes no lo era.
--
-- UUID `a019.../b019...`, distinto de los quince scripts anteriores.

\set ON_ERROR_STOP off

insert into auth.users (id, email) values
  ('a0190190-1919-1919-1919-a0190190a019', 'trader-correccion@test.local')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', 'a0190190-1919-1919-1919-a0190190a019', false);
select crear_empresa('Personal', true);
select id as firm from public.prop_firms where user_id = 'a0190190-1919-1919-1919-a0190190a019' \gset
select id as cta from crear_cuenta(:'firm'::uuid, 'Cuenta Corrección', '10000.0000', 'USD', null) \gset
select id as plan from crear_plan_gestion(
  p_name => 'Plan Corrección', p_rr_objective => '3.0000', p_be_trigger => 'NONE') \gset

-- Las cuatro Operaciones nacen juntas, antes de que ninguna cierre: así las
-- cuatro comparten `risk_amount` 100.0000 y todos los `pnl_amount` de esta
-- suite cuadran contra el mismo número. Misma trampa documentada en la
-- suite 14 `[4b]`.
select id as op1 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CORR1', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op2 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CORR2', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op3 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CORR3', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select id as op4 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CORR4', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset

\echo '--- [0] las cuatro comparten risk_amount — esperado: 4 / 100.0000 / 100.0000 ---'
select count(*) as operaciones, min(risk_amount) as minimo, max(risk_amount) as maximo
  from public.trades where account_id = :'cta'::uuid;

\echo ''
\echo '============================================================'
\echo ' MANUAL_CLOSE → TAKE_PROFIT_FULL — antes de 019 era IMPOSIBLE'
\echo '============================================================'

\echo '--- [1] cierre MANUAL_CLOSE a 1.5R con r_max 4.0 — esperado: closed / MANUAL_CLOSE / 1.5000 ---'
select status, closure_reason, cierre_manual_rr, r_final from aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.5000', p_r_max => '4.0000', p_r_final => '1.5000', p_pnl_amount => '150.0000',
  p_expected_partials => 0, p_idempotency_key => 'a0190000-0000-0000-0000-000000000001'::uuid);

-- La prueba de que el borrado NO es accidental: sin la bandera, `null` sigue
-- significando "no tocar" y el campo sobrevive. Si esta comprobación dejara de
-- dar error, el borrado se habría vuelto inferible por omisión.
\echo '--- [2] corregir a TAKE_PROFIT_FULL SIN la bandera — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
\echo '        (p_cierre_manual_rr => null significa NO TOCAR, nunca BORRAR)'
select aplicar_edicion_operacion(
  p_trade_id => :'op1'::uuid, p_closure_reason => 'TAKE_PROFIT_FULL',
  p_cierre_manual_rr => null, p_r_final => '3.0000', p_pnl_amount => '300.0000');

\echo '--- [3] el desenlace no se movió — esperado: MANUAL_CLOSE / 1.5000 / 1.5000 ---'
select closure_reason, cierre_manual_rr, r_final from public.trades where id = :'op1'::uuid;

\echo '--- [4] corregir a TAKE_PROFIT_FULL CON la bandera — esperado: TAKE_PROFIT_FULL / vacío / 3.0000 ---'
select closure_reason, cierre_manual_rr, r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'op1'::uuid, p_closure_reason => 'TAKE_PROFIT_FULL',
  p_borrar_cierre_manual_rr => true, p_r_final => '3.0000', p_pnl_amount => '300.0000');

\echo '--- [5] y quedó AUDITADO con before/after — esperado: trade / update / t ---'
select entity_type, action, (diff ? 'before' and diff ? 'after') as tiene_before_y_after
  from public.audit_log where entity_id = :'op1'::uuid order by id desc limit 1;

\echo ''
\echo '============================================================'
\echo ' SEÑAL-1 — fijar y borrar a la vez no significa nada'
\echo '============================================================'
\echo '        No hay precedencia: ni gana el borrado ni gana el valor. La'
\echo '        combinación carece de significado y se rechaza. Elegir una'
\echo '        precedencia habría sido inventar semántica que el corpus no define.'

\echo '--- [6] valor + bandera simultáneamente — esperado: ERROR VALIDATION_ERROR:cierre_manual_rr ---'
select aplicar_edicion_operacion(
  p_trade_id => :'op1'::uuid, p_cierre_manual_rr => '2.0000', p_borrar_cierre_manual_rr => true);

\echo ''
\echo '============================================================'
\echo ' MANUAL_CLOSE → BREAK_EVEN (exige al menos un parcial ejecutado)'
\echo '============================================================'

\echo '--- [7] parcial 50% a 1.0R + cierre MANUAL_CLOSE a 0.5R — esperado: closed / MANUAL_CLOSE ---'
select registrar_parcial_ejecutado(:'op2'::uuid, 1, '1.0000', '50.00', now()) is not null as parcial_ok;
select status, closure_reason, cierre_manual_rr from aplicar_cierre_operacion(
  p_trade_id => :'op2'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '0.5000', p_r_max => '2.0000', p_r_final => '0.7500', p_pnl_amount => '75.0000',
  p_expected_partials => 1, p_idempotency_key => 'a0190000-0000-0000-0000-000000000002'::uuid);

-- Este bloque va DESPUÉS del cierre a propósito: el trigger de coherencia de
-- 018 sólo se dispara cuando la fila resultante está Cerrada. Probarlo sobre
-- una Operación Abierta no demuestra nada — la primera versión de esta suite
-- lo hacía así y la comprobación pasaba sin error, sin proteger nada.
\echo '--- [8] borrar dejando el motivo en MANUAL_CLOSE — esperado: ERROR INCOHERENT_CLOSURE_REASON ---'
\echo '        MANUAL_CLOSE exige cierre_manual_rr: vaciarlo sin cambiar el motivo'
\echo '        deja la Operación contradiciéndose, y el trigger de 018 lo rechaza.'
\echo '        El borrado NO exime de coherencia: 019 sólo hace alcanzable un'
\echo '        estado que antes no lo era, no relaja ninguna de las cuatro reglas.'
select aplicar_edicion_operacion(
  p_trade_id => :'op2'::uuid, p_borrar_cierre_manual_rr => true);

-- Con el parcial de 50% a 1.0R y R_resto = 0 (prioridad 3 de la fórmula
-- congelada), R_final = 0.50×1.0 + 0.50×0 = 0.5000. Ese cero con parciales
-- ejecutados **es** un break-even.
\echo '--- [9] corregir a BREAK_EVEN con la bandera — esperado: BREAK_EVEN / vacío / 0.5000 ---'
select closure_reason, cierre_manual_rr, r_final, pnl_amount from aplicar_edicion_operacion(
  p_trade_id => :'op2'::uuid, p_closure_reason => 'BREAK_EVEN',
  p_borrar_cierre_manual_rr => true, p_r_final => '0.5000', p_pnl_amount => '50.0000');

\echo ''
\echo '============================================================'
\echo ' MANUAL_CLOSE → STOP_LOSS → TAKE_PROFIT_FULL, sin residuo'
\echo '============================================================'
\echo '        Antes de 019 el primer salto funcionaba pero dejaba el nivel de'
\echo '        cierre manual pegado a un STOP_LOSS, y ese residuo bloqueaba el'
\echo '        segundo salto para siempre.'

\echo '--- [10] cierre MANUAL_CLOSE a 1.0R, r_max 4.0 — esperado: closed / MANUAL_CLOSE / 1.0000 ---'
select status, closure_reason, cierre_manual_rr from aplicar_cierre_operacion(
  p_trade_id => :'op3'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '1.0000', p_r_max => '4.0000', p_r_final => '1.0000', p_pnl_amount => '100.0000',
  p_expected_partials => 0, p_idempotency_key => 'a0190000-0000-0000-0000-000000000003'::uuid);

\echo '--- [11] corregir a STOP_LOSS borrando el residuo — esperado: STOP_LOSS / vacío ---'
select closure_reason, cierre_manual_rr, r_final from aplicar_edicion_operacion(
  p_trade_id => :'op3'::uuid, p_closure_reason => 'STOP_LOSS',
  p_borrar_cierre_manual_rr => true, p_r_final => '-1.0000', p_pnl_amount => '-100.0000');

\echo '--- [12] y desde ahí a TAKE_PROFIT_FULL — esperado: TAKE_PROFIT_FULL / vacío / 3.0000 ---'
\echo '        Éste es el salto que antes era inalcanzable.'
select closure_reason, cierre_manual_rr, r_final from aplicar_edicion_operacion(
  p_trade_id => :'op3'::uuid, p_closure_reason => 'TAKE_PROFIT_FULL',
  p_r_final => '3.0000', p_pnl_amount => '300.0000');

\echo '--- [13] tres correcciones, tres entradas de auditoría — esperado: >= 3 ---'
select count(*) as entradas_auditoria from public.audit_log where entity_id = :'op3'::uuid;

\echo ''
\echo '============================================================'
\echo ' COMPATIBILIDAD: la semántica Partial no ha cambiado'
\echo '============================================================'

\echo '--- [14] cierre MANUAL_CLOSE a 2.0R — esperado: closed / 2.0000 ---'
select status, cierre_manual_rr from aplicar_cierre_operacion(
  p_trade_id => :'op4'::uuid, p_closed_at => now(), p_closure_reason => 'MANUAL_CLOSE',
  p_cierre_manual_rr => '2.0000', p_r_max => '4.0000', p_r_final => '2.0000', p_pnl_amount => '200.0000',
  p_expected_partials => 0, p_idempotency_key => 'a0190000-0000-0000-0000-000000000004'::uuid);

\echo '--- [15] editar SÓLO las notas — esperado: cierre_manual_rr intacto (2.0000) ---'
\echo '        Ninguna llamada existente cambia de comportamiento: la bandera'
\echo '        omitida vale false y el campo no se toca.'
select cierre_manual_rr, notes from aplicar_edicion_operacion(
  p_trade_id => :'op4'::uuid, p_notes => 'sólo una nota');

\echo '--- [16] editar con la bandera a FALSE explícito — esperado: cierre_manual_rr intacto ---'
select cierre_manual_rr from aplicar_edicion_operacion(
  p_trade_id => :'op4'::uuid, p_notes => 'otra nota', p_borrar_cierre_manual_rr => false);

\echo ''
\echo '============================================================'
\echo ' IDENTIDAD Y EVIDENCIA SIGUEN INTACTAS'
\echo '============================================================'

\echo '--- [17] la bandera no abre ninguna puerta a la identidad — esperado: ERROR IMMUTABLE_IDENTITY_FACT ---'
select aplicar_edicion_operacion(
  p_trade_id => :'op4'::uuid, p_risk_amount => '999.0000', p_borrar_cierre_manual_rr => true);

\echo '--- [18] la evidencia sigue siendo inmutable — esperado: 1 parcial en CORR2 ---'
select count(*) as parciales from public.trade_partials_executed where trade_id = :'op2'::uuid;

\echo '--- [19] capital coherente con los desenlaces — esperado: Σ trade_pnl = Σ pnl_amount ---'
select
  (select coalesce(sum(amount), 0) from public.account_capital_events
     where account_id = :'cta'::uuid and event_type = 'trade_pnl') as suma_eventos,
  (select coalesce(sum(pnl_amount), 0) from public.trades
     where account_id = :'cta'::uuid and status = 'closed') as suma_desenlaces,
  ((select coalesce(sum(amount), 0) from public.account_capital_events
      where account_id = :'cta'::uuid and event_type = 'trade_pnl')
   = (select coalesce(sum(pnl_amount), 0) from public.trades
        where account_id = :'cta'::uuid and status = 'closed')) as cuadra;

\echo ''
\echo '============================================================'
\echo ' FIRMAS SUPERADAS — el defecto latente de BUILD 018'
\echo '============================================================'
\echo '        `create or replace function` NO reemplaza una función cuya lista de'
\echo '        parámetros cambió: crea una sobrecarga y deja viva la anterior. Las'
\echo '        suites nunca lo vieron porque construyen la base desde cero.'

reset role;

\echo '--- [20] se resucita a mano la firma pre-018 de aplicar_cierre_operacion ---'
create or replace function public.aplicar_cierre_operacion(
  p_trade_id uuid, p_closed_at timestamptz, p_closure_reason text, p_cierre_manual_rr text,
  p_r_max text, p_r_final text, p_pnl_amount text
) returns public.trades language plpgsql as $$ begin raise exception 'FIRMA_ANTIGUA'; end; $$;

\echo '--- [21] ahora conviven dos firmas — esperado: 2 ---'
select count(*) as firmas from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'aplicar_cierre_operacion';

\echo '--- [22] y una llamada de 7 argumentos es AMBIGUA — esperado: ERROR is not unique ---'
select aplicar_cierre_operacion(:'op1'::uuid, now(), 'STOP_LOSS', null, '1.0', '-1.0', '-100.0');

\echo '--- [23] se reaplica operations.sql (los drop del encabezado hacen su trabajo) ---'
\i :operations_sql

\echo '--- [24] queda exactamente UNA firma — esperado: 1 ---'
select count(*) as firmas from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'aplicar_cierre_operacion';

\echo '--- [25] y una firma de aplicar_edicion_operacion — esperado: 1 ---'
select count(*) as firmas from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'aplicar_edicion_operacion';

\echo '--- [26] reaplicar por SEGUNDA vez sigue dejando una sola — esperado: 1 y 1 ---'
\i :operations_sql
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'aplicar_cierre_operacion') as cierre,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'aplicar_edicion_operacion') as edicion;

set role authenticated;
select set_config('request.jwt.claim.sub', 'a0190190-1919-1919-1919-a0190190a019', false);

\echo '--- [27] y la llamada de 7 argumentos vuelve a funcionar sin ambigüedad ---'
select id as op5 from registrar_operacion(
  p_account_id => :'cta'::uuid, p_symbol => 'CORR5', p_side => 'long', p_opened_at => now(),
  p_risk_pct => '1.00', p_management_plan_id => :'plan'::uuid) \gset
select status from aplicar_cierre_operacion(
  :'op5'::uuid, now(), 'STOP_LOSS', null, '0.5000', '-1.0000',
  (select (-risk_amount)::text from public.trades where id = :'op5'::uuid));

\echo ''
\echo '--- [28] verificación final ---'
select
  (select count(*) from public.trades where account_id = :'cta'::uuid and status = 'closed') as cerradas,
  (select count(*) from public.trades
     where account_id = :'cta'::uuid and closure_reason = 'MANUAL_CLOSE'
       and cierre_manual_rr is null) as manual_sin_nivel_incoherente,
  (select count(*) from public.trades
     where account_id = :'cta'::uuid and closure_reason in ('TAKE_PROFIT_FULL','BREAK_EVEN')
       and cierre_manual_rr is not null) as motivos_con_residuo;

reset role;
