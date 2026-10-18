-- Validación de la importación de ficheros — fase 1
-- (migración 20261018120000_trade_file_imports.sql + functions/sql/imports.sql).
--
-- A diferencia de las suites anteriores, que se leen por etiqueta, esta se
-- AUTOVERIFICA: cada comprobación imprime `OK [n]` o aborta con un error. Se
-- ejecuta con ON_ERROR_STOP activo, así que la última línea `TODAS LAS
-- COMPROBACIONES DE 16 EN VERDE` solo aparece si no falló ninguna.
--
-- Igual que el resto: se conecta como `authenticated` (no superusuario) para
-- que RLS y los GRANT sean los reales. Los ataques "como propietario" se hacen
-- con `reset role` y están marcados.
--
-- UUIDs `c016…/d016…`, distintos de las demás suites.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('c0160016-1616-1616-1616-c0160016c016', 'trader-import@test.local'),
  ('d0160016-1616-1616-1616-d0160016d016', 'trader-ajeno-import@test.local')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Ayudantes (temporales, de esta sesión).
-- ------------------------------------------------------------
create or replace function pg_temp.espera_error(p_sql text, p_patron text, p_etiqueta text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_patron then
      raise notice 'OK %', p_etiqueta;
      return;
    end if;
    raise exception 'FALLO %: error inesperado «%»', p_etiqueta, sqlerrm;
  end;
  raise exception 'FALLO %: se esperaba un error «%» y no lo hubo', p_etiqueta, p_patron;
end;
$$;

create or replace function pg_temp.comprueba(p_condicion boolean, p_etiqueta text) returns void
language plpgsql as $$
begin
  if p_condicion is distinct from true then
    raise exception 'FALLO %', p_etiqueta;
  end if;
  raise notice 'OK %', p_etiqueta;
end;
$$;

create or replace function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;

-- Una fila tal como la envía la aplicación (apps/web/lib/api/imports.ts).
create or replace function pg_temp.fila(
  p_n integer, p_identidad text, p_ref text default 'NYS00000-000001',
  p_entry_price text default '31532', p_gross text default '71.5', p_net text default '69.9',
  p_occurrence integer default 1, p_entry_local text default '2026-10-06 14:03:56',
  p_exit_local text default '2026-10-06 14:07:51'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'row_number', p_n, 'occurrence', p_occurrence,
    'dedup_key', pg_temp.h('d:' || p_identidad), 'match_key', pg_temp.h('m:' || p_identidad),
    'external_account_ref', p_ref, 'symbol', 'MNQ', 'contract', '/MNQZ26:XCME',
    'entry_local', p_entry_local, 'exit_local', p_exit_local,
    'entry_utc', ((p_entry_local)::timestamp at time zone 'America/New_York'),
    'exit_utc', ((p_exit_local)::timestamp at time zone 'America/New_York'),
    'entry_price', p_entry_price, 'exit_price', '31567.75', 'side', 'BUY', 'quantity', '1',
    'gross_pnl', p_gross, 'net_pnl', p_net, 'review_reasons', '[]'::jsonb,
    'raw', jsonb_build_object('Account', p_ref, 'Net P/L', p_net)
  );
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- ------------------------------------------------------------
-- Siembra: dos Cuentas (como las dos Flex 25K del usuario) y una Operación
-- manual ya existente, que la importación no debe tocar.
-- ------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0160016-1616-1616-1616-c0160016c016', false);
select crear_empresa('Empresa de prueba', false);
select id as firm from public.prop_firms where user_id = 'c0160016-1616-1616-1616-c0160016c016' \gset
select id as cta1 from crear_cuenta(:'firm'::uuid, 'Flex 25K #1', '25000.0000', 'USD', null) \gset
select id as cta2 from crear_cuenta(:'firm'::uuid, 'Flex 25K #2', '25000.0000', 'USD', null) \gset
select id as op_manual from registrar_operacion(
  p_account_id => :'cta1'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => '2026-10-01 14:00:00+00', p_risk_pct => '0.50', p_rr_objective => '2.0000') \gset

-- Huella de lo existente, para comprobar al final que no cambió nada.
reset role;
create temp table antes as
  select (select md5(string_agg(t::text, '|' order by t.id)) from public.trades t) as trades_md5,
         (select md5(string_agg(a::text, '|' order by a.id)) from public.accounts a) as accounts_md5,
         (select count(*) from public.account_capital_events) as capital_events;
grant select on antes to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0160016-1616-1616-1616-c0160016c016', false);

\echo '--- [1] Primera importación sin confirmar el vínculo → rechazada'
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'lista.xlsx', %L, 'America/New_York',
    'NYS00000-000001', false, %L, '{"total":1}')$q$,
    :'cta1', pg_temp.h('fichero1'), jsonb_build_array(pg_temp.fila(2, 'a'))),
  'IMPORT_ERROR:LINK_CONFIRMATION_REQUIRED%', '[1] exige confirmar el vínculo la primera vez');

\echo '--- [2] Primera importación confirmada: 2 filas'
select id as lote1 from confirmar_importacion(:'cta1', 'nys_markets_trade_list', 'lista.xlsx', pg_temp.h('fichero1'),
  'America/New_York', 'NYS00000-000001', true,
  jsonb_build_array(pg_temp.fila(2, 'a'), pg_temp.fila(3, 'b', p_entry_price => '31600', p_gross => '-40', p_net => '-43.2')),
  '{"total":2,"duplicadas":0,"invalidas":0}') \gset
select pg_temp.comprueba(
  (select rows_imported = 2 and rows_duplicate = 0 and rows_total = 2 from import_batches where id = :'lote1'),
  '[2] lote con 2 filas importadas');
select pg_temp.comprueba((select count(*) = 2 from imported_trade_rows where account_id = :'cta1'), '[2] 2 filas guardadas');

\echo '--- [3] Bruto y neto se guardan exactamente, sin redondeo ni comisión deducida'
select pg_temp.comprueba(
  (select gross_pnl::text = '71.5' and net_pnl::text = '69.9' and entry_price::text = '31532'
   from imported_trade_rows where batch_id = :'lote1' and row_number = 2),
  '[3a] 71.5 / 69.9 exactos');
select pg_temp.comprueba(
  (select gross_pnl::text = '-40' and net_pnl::text = '-43.2'
   from imported_trade_rows where batch_id = :'lote1' and row_number = 3),
  '[3b] pérdida -40 / -43.2 exacta');
select pg_temp.comprueba(
  (select (f->>'net_pnl') = '69.9' and jsonb_typeof(f->'net_pnl') = 'string'
   from jsonb_array_elements(obtener_lote_importacion(:'lote1')->'filas') f where (f->>'row_number')::int = 2),
  '[3c] la lectura devuelve los decimales como texto (I5)');

\echo '--- [4] El instante se calcula con la zona del lote'
select pg_temp.comprueba(
  (select entry_at = '2026-10-06 18:03:56+00' and entry_local = '2026-10-06 14:03:56'
   from imported_trade_rows where batch_id = :'lote1' and row_number = 2),
  '[4] 14:03:56 Nueva York (EDT) = 18:03:56 UTC, con el reloj original conservado');

\echo '--- [5] Reimportar el mismo fichero no duplica nada'
select id as lote2 from confirmar_importacion(:'cta1', 'nys_markets_trade_list', 'lista.xlsx', pg_temp.h('fichero1'),
  'America/New_York', 'NYS00000-000001', false,
  jsonb_build_array(pg_temp.fila(2, 'a'), pg_temp.fila(3, 'b', p_entry_price => '31600', p_gross => '-40', p_net => '-43.2')),
  '{"total":2,"duplicadas":0}') \gset
select pg_temp.comprueba(
  (select rows_imported = 0 and rows_duplicate = 2 from import_batches where id = :'lote2'),
  '[5a] el segundo lote registra 0 importadas y 2 duplicadas');
select pg_temp.comprueba((select count(*) = 2 from imported_trade_rows where account_id = :'cta1'), '[5b] siguen siendo 2 filas');

\echo '--- [6] Dos filas idénticas legítimas (ocurrencias 1 y 2) se guardan las dos'
select id as lote3 from confirmar_importacion(:'cta1', 'nys_markets_trade_list', 'lista2.xlsx', pg_temp.h('fichero2'),
  'America/New_York', 'NYS00000-000001', false,
  jsonb_build_array(
    pg_temp.fila(2, 'c#1', p_entry_local => '2026-10-08 10:00:00', p_exit_local => '2026-10-08 10:05:00'),
    pg_temp.fila(3, 'c#2', p_occurrence => 2, p_entry_local => '2026-10-08 10:00:00', p_exit_local => '2026-10-08 10:05:00')
      || '{"review_reasons":["FILA_IDENTICA_EN_FICHERO"]}'::jsonb),
  '{"total":2}') \gset
select pg_temp.comprueba(
  (select rows_imported = 2 and rows_review_accepted = 1 from import_batches where id = :'lote3'),
  '[6a] las dos copias se guardan; una consta como aceptada tras revisión');
select pg_temp.comprueba(
  (select review_reasons = '{FILA_IDENTICA_EN_FICHERO}' from imported_trade_rows where batch_id = :'lote3' and occurrence = 2),
  '[6b] la copia conserva el motivo de revisión');

\echo '--- [7] Cuenta, zona y vínculo'
select pg_temp.comprueba(
  (select (r->>'cuenta_externa_vinculada') = 'NYS00000-000001' and (r->>'zona_horaria_vinculada') = 'America/New_York'
          and jsonb_array_length(r->'claves_existentes') = 1 and jsonb_array_length(r->'coincidencias_existentes') = 1
   from (select consultar_importacion_previa(:'cta1', 'nys_markets_trade_list', 'NYS00000-000001',
          array[pg_temp.h('d:a'), pg_temp.h('d:zzz')], array[pg_temp.h('m:a')]) as r) s),
  '[7a] la consulta previa devuelve el vínculo y solo las claves que existen');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'America/New_York',
    'NYS00000-000002', true, %L, '{}')$q$, :'cta1', pg_temp.h('f3'),
    jsonb_build_array(pg_temp.fila(2, 'e', p_ref => 'NYS00000-000002'))),
  'IMPORT_ERROR:ACCOUNT_MISMATCH%', '[7b] otra cuenta externa sobre una Cuenta ya vinculada → rechazo');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'Europe/Madrid',
    'NYS00000-000001', false, %L, '{}')$q$, :'cta1', pg_temp.h('f3'),
    jsonb_build_array(pg_temp.fila(2, 'e'))),
  'IMPORT_ERROR:TIMEZONE_MISMATCH%', '[7c] otra zona horaria → rechazo');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'America/New_York',
    'NYS00000-000001', true, %L, '{}')$q$, :'cta2', pg_temp.h('f3'),
    jsonb_build_array(pg_temp.fila(2, 'e'))),
  'IMPORT_ERROR:EXTERNAL_ACCOUNT_LINKED_ELSEWHERE%', '[7d] la misma cuenta externa en la otra Cuenta → rechazo');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'America/New_York',
    'NYS00000-000001', false, %L, '{}')$q$, :'cta1', pg_temp.h('f3'),
    jsonb_build_array(pg_temp.fila(2, 'e', p_ref => 'NYS00000-000002'))),
  'IMPORT_ERROR:VALIDATION_ERROR:rows%', '[7e] una fila de otra cuenta externa dentro del lote → rechazo');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'Hora/Inventada',
    'NYS00000-000001', false, %L, '{}')$q$, :'cta1', pg_temp.h('f3'), jsonb_build_array(pg_temp.fila(2, 'e'))),
  'IMPORT_ERROR:VALIDATION_ERROR:source_timezone%', '[7f] zona horaria desconocida → rechazo');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'America/New_York',
    'NYS00000-000001', false, %L, '{}')$q$, :'cta1', pg_temp.h('f3'),
    jsonb_build_array(pg_temp.fila(2, 'e') || jsonb_build_object('entry_utc', '2026-10-06 14:03:56+00'))),
  'IMPORT_ERROR:TIMEZONE_CONVERSION_MISMATCH%', '[7g] instante distinto del de la vista previa → rechazo');

\echo '--- [8] Fallo a mitad: ni lote ni filas'
create temp table conteo_previo as
  select (select count(*) from import_batches) as lotes, (select count(*) from imported_trade_rows) as filas;
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'roto.xlsx', %L, 'America/New_York',
    'NYS00000-000001', false, %L, '{}')$q$, :'cta1', pg_temp.h('roto'),
    jsonb_build_array(pg_temp.fila(2, 'f1'), pg_temp.fila(3, 'f2'), pg_temp.fila(4, 'f3', p_entry_price => '0'))),
  '%imported_trade_rows_entry_price_check%', '[8a] la tercera fila (precio 0) rechaza el lote');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'roto.xlsx', %L, 'America/New_York',
    'NYS00000-000001', false, %L, '{}')$q$, :'cta1', pg_temp.h('roto'),
    jsonb_build_array(pg_temp.fila(2, 'f1'), pg_temp.fila(3, 'f2', p_net => 'abc'))),
  '%invalid input syntax for type numeric%', '[8b] un importe ilegible rechaza el lote');
select pg_temp.comprueba(
  (select lotes = (select count(*) from import_batches) and filas = (select count(*) from imported_trade_rows) from conteo_previo),
  '[8c] tras los dos fallos no queda ni un lote ni una fila de más');

\echo '--- [9] La evidencia es inmutable'
select pg_temp.espera_error(format('update imported_trade_rows set net_pnl = 0 where batch_id = %L', :'lote1'),
  '%permission denied%', '[9a] authenticated no puede actualizar filas');
select pg_temp.espera_error(format('delete from import_batches where id = %L', :'lote1'),
  '%permission denied%', '[9b] authenticated no puede borrar lotes');
select pg_temp.espera_error(
  $q$insert into imported_trade_rows (batch_id, user_id, account_id, source, dedup_key, match_key, occurrence, row_number,
     external_account_ref, symbol, contract, entry_local, exit_local, entry_at, exit_at, entry_price, exit_price, side,
     quantity, gross_pnl, net_pnl, raw) values (gen_random_uuid(), auth.uid(), gen_random_uuid(), 'x', repeat('a',64),
     repeat('a',64), 1, 1, 'r', 's', 'c', '2026-01-01 00:00:00', '2026-01-01 00:00:00', now(), now(), 1, 1, 'BUY', 1, 0, 0, '{}')$q$,
  '%permission denied%', '[9c] authenticated no puede insertar saltándose la RPC');
reset role;
select pg_temp.espera_error(format('update imported_trade_rows set net_pnl = 0 where batch_id = %L', :'lote1'),
  'IMPORT_ERROR:IMMUTABLE_EVIDENCE%', '[9d] ni el propietario puede actualizar filas (trigger)');
select pg_temp.espera_error(format('delete from import_batches where id = %L', :'lote1'),
  'IMPORT_ERROR:IMMUTABLE_EVIDENCE%', '[9e] ni el propietario puede borrar lotes (trigger)');
-- Borrar la Cuenta ya lo impedían protecciones anteriores (eventos de capital
-- append-only, operaciones). Lo que se comprueba es el resultado: el intento
-- falla y la evidencia importada sigue entera.
select pg_temp.espera_error(format('delete from public.accounts where id = %L', :'cta1'),
  '%', '[9f] borrar la Cuenta se rechaza');
select pg_temp.comprueba((select count(*) = 4 from imported_trade_rows where account_id = :'cta1'),
  '[9g] y la evidencia importada sigue entera');

\echo '--- [10] Aislamiento entre usuarios'
set role authenticated;
select set_config('request.jwt.claim.sub', 'd0160016-1616-1616-1616-d0160016d016', false);
select pg_temp.comprueba((select count(*) = 0 from import_batches), '[10a] otro usuario no ve lotes ajenos');
select pg_temp.comprueba((select count(*) = 0 from imported_trade_rows), '[10b] otro usuario no ve filas ajenas');
select pg_temp.espera_error(
  format($q$select confirmar_importacion(%L, 'nys_markets_trade_list', 'x.xlsx', %L, 'America/New_York',
    'NYS00000-000001', true, %L, '{}')$q$, :'cta1', pg_temp.h('intruso'), jsonb_build_array(pg_temp.fila(2, 'intruso'))),
  'IMPORT_ERROR:ACCOUNT_NOT_FOUND%', '[10c] otro usuario no puede importar en una Cuenta ajena');
select pg_temp.espera_error(format('select obtener_lote_importacion(%L)', :'lote1'),
  'IMPORT_ERROR:BATCH_NOT_FOUND%', '[10d] otro usuario no puede leer un lote ajeno');
select pg_temp.espera_error(
  format($q$select consultar_importacion_previa(%L, 'nys_markets_trade_list', 'x', '{}', '{}')$q$, :'cta1'),
  'IMPORT_ERROR:ACCOUNT_NOT_FOUND%', '[10e] otro usuario no puede consultar claves de una Cuenta ajena');

\echo '--- [11] Las Cuentas y Operaciones existentes no han cambiado'
reset role;
select pg_temp.comprueba(
  (select a.trades_md5 = (select md5(string_agg(t::text, '|' order by t.id)) from public.trades t)
      and a.accounts_md5 = (select md5(string_agg(x::text, '|' order by x.id)) from public.accounts x)
      and a.capital_events = (select count(*) from public.account_capital_events)
   from antes a),
  '[11] trades, accounts y eventos de capital idénticos byte a byte');
select pg_temp.comprueba((select count(*) = 1 from public.trades where account_id = :'cta1'), '[11b] la importación no creó Operaciones');

\echo 'TODAS LAS COMPROBACIONES DE 16 EN VERDE'
