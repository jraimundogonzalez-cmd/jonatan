-- Validación del tope de riesgo por Cuenta — B4 (BUILD 014) contra Postgres
-- real.
--
-- Cubre exclusivamente lo que B4 construye: la columna, sus restricciones
-- declarativas, su exposición por los contratos de lectura de Funding, y la
-- ausencia total de regresión sobre el comportamiento existente de Accounts.
--
-- **No prueba ninguna validación de negocio sobre el tope**: aplicarlo al
-- construir una Intención es B5 y no existe todavía. Aquí el valor solo se
-- guarda y se lee.
--
-- UUIDs 6f6f.../7a7a... — distintos de los de 01-09.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('6f6f6f6f-3030-3030-3030-6f6f6f6f6f6f', 'trader-v@test.local'),
  ('7a7a7a7a-4040-4040-4040-7a7a7a7a7a7a', 'trader-w@test.local')
on conflict (id) do nothing;

\echo '--- [1] la columna existe, es nullable y no tiene defecto ---'
\echo '        Las dos últimas propiedades son la condición del camino rápido:'
\echo '        add column nullable y sin defecto es solo metadatos desde PG11.'
reset role;
select column_name, data_type, numeric_precision, numeric_scale,
       is_nullable, coalesce(column_default, '(ninguno)') as defecto
  from information_schema.columns
  where table_schema = 'public' and table_name = 'accounts' and column_name = 'max_risk_pct';

\echo '--- [2] TODAS las Cuentas creadas por las suites 01-09 mantienen NULL — esperado: 0 con valor ---'
select count(*) as cuentas_totales,
       count(max_risk_pct) as cuentas_con_tope
  from public.accounts;

\echo ''
\echo '--- [3] SIN REESCRITURA DE TABLA: demostración empírica de la técnica ---'
\echo '        Se compara el relfilenode de una tabla con filas antes y después'
\echo '        de aplicar exactamente el mismo tipo de ALTER. Esperado: t'
create table _rewrite_probe (id int, v numeric(18,4));
insert into _rewrite_probe select g, g * 1.5 from generate_series(1, 500) g;
select relfilenode as filenode_antes from pg_class where relname = '_rewrite_probe' \gset
alter table _rewrite_probe
  add column max_risk_pct numeric(5,2)
    check (max_risk_pct is null or (max_risk_pct > 0 and max_risk_pct <= 100));
select (relfilenode = :filenode_antes) as mismo_filenode_sin_reescritura,
       (select count(*) from _rewrite_probe) as filas_intactas
  from pg_class where relname = '_rewrite_probe';
drop table _rewrite_probe;

\echo ''
set role authenticated;
select set_config('request.jwt.claim.sub', '6f6f6f6f-3030-3030-3030-6f6f6f6f6f6f', false);
select crear_empresa('Personal', true);
select id as firm_v_id from public.prop_firms where user_id = '6f6f6f6f-3030-3030-3030-6f6f6f6f6f6f' \gset

\echo '--- [4] NO REGRESIÓN: crear_cuenta sigue funcionando y deja el tope en NULL ---'
select id as cuenta_v_id, name, current_capital, (max_risk_pct is null) as tope_nulo
  from crear_cuenta(:'firm_v_id'::uuid, 'Cuenta V', '10000.0000', 'USD', null) \gset
select :'cuenta_v_id' is not null as cuenta_creada;
select name, (max_risk_pct is null) as tope_nulo from public.accounts where id = :'cuenta_v_id';

\echo '--- [5] el propietario fija el tope con la política ya existente (accounts_owner_rw) ---'
update public.accounts set max_risk_pct = 2.50 where id = :'cuenta_v_id';
select max_risk_pct from public.accounts where id = :'cuenta_v_id';

\echo '--- [6] LECTURA: obtener_cuenta expone el dato sin haber sido modificada ---'
\echo '        Devuelve `public.accounts` con select *, luego la columna fluye sola.'
select name, max_risk_pct from obtener_cuenta(:'cuenta_v_id'::uuid);

\echo '--- [7] LECTURA: listar_cuentas también lo expone — esperado: 1 fila con 2.50 ---'
select name, max_risk_pct from listar_cuentas() where id = :'cuenta_v_id';

\echo ''
\echo '--- [8] CHECK: un tope de 0 no es un límite, es una prohibición — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.accounts set max_risk_pct = 0 where id = :'cuenta_v_id';
\set ON_ERROR_STOP on

\echo '--- [9] CHECK: negativo — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.accounts set max_risk_pct = -1.00 where id = :'cuenta_v_id';
\set ON_ERROR_STOP on

\echo '--- [10] CHECK: por encima de 100% — esperado: ERROR ---'
\set ON_ERROR_STOP off
update public.accounts set max_risk_pct = 100.01 where id = :'cuenta_v_id';
\set ON_ERROR_STOP on

\echo '--- [11] los tres rechazos dejaron el valor intacto — esperado: 2.50 ---'
select max_risk_pct from public.accounts where id = :'cuenta_v_id';

\echo '--- [12] volver a NULL siempre es válido: retirar el tope — esperado: null, luego 1.00 ---'
update public.accounts set max_risk_pct = null where id = :'cuenta_v_id';
select max_risk_pct as tras_retirar from public.accounts where id = :'cuenta_v_id';
update public.accounts set max_risk_pct = 1.00 where id = :'cuenta_v_id';
select max_risk_pct as tras_reponer from public.accounts where id = :'cuenta_v_id';

\echo ''
\echo '--- [13] RLS: W no ve la Cuenta de V ni su tope — esperado: 0 ---'
select set_config('request.jwt.claim.sub', '7a7a7a7a-4040-4040-4040-7a7a7a7a7a7a', false);
select count(*) as cuenta_de_v_visible_para_w from public.accounts where id = :'cuenta_v_id';

\echo '--- [14] RLS: W no puede fijar el tope de la Cuenta de V — esperado: UPDATE 0 ---'
\set ON_ERROR_STOP off
update public.accounts set max_risk_pct = 99.00 where id = :'cuenta_v_id';
\set ON_ERROR_STOP on

\echo '--- [15] el tope de V sigue siendo el suyo — esperado: 1.00 ---'
select set_config('request.jwt.claim.sub', '6f6f6f6f-3030-3030-3030-6f6f6f6f6f6f', false);
select max_risk_pct from public.accounts where id = :'cuenta_v_id';

\echo ''
\echo '--- [16] NO REGRESIÓN: la cascada de capital de Funding sigue intacta ---'
\echo '        Registrar y cerrar una Operación mueve capital exactamente igual.'
select id as plan_v_id from crear_plan_gestion('Plan V', '3.0000', 'NONE') \gset
select id as trade_v_id from registrar_operacion(
  :'cuenta_v_id'::uuid, 'EURUSD', 'long', now(), '1.00', null, :'plan_v_id'::uuid, '3.0000'
) \gset
select current_capital as capital_tras_abrir from public.accounts where id = :'cuenta_v_id';
select (aplicar_cierre_operacion(
  p_trade_id => :'trade_v_id'::uuid, p_closed_at => now(),
  p_closure_reason => 'TAKE_PROFIT_FULL', p_cierre_manual_rr => null,
  p_r_max => '3.0000', p_r_final => '2.0000', p_pnl_amount => '200.0000'
)).status as estado;
select current_capital as capital_tras_cerrar, peak_capital,
       (max_risk_pct = 1.00) as tope_sin_tocar
  from public.accounts where id = :'cuenta_v_id';

reset role;
