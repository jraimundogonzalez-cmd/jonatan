-- Validación de permisos explícitos (20261026120000) y del aislamiento de
-- `registrar_operacion` / `crear_operacion_nucleo` (operations.sql).
--
-- Se ejecuta SOLO sobre una base preparada con 00_supabase_proyecto_nuevo_setup.sql
-- (sin permisos de tabla genéricos), las migraciones y los cuatro ficheros de
-- funciones. Sobre una base preparada con 00_local_test_setup.sql la sección
-- [0] fallaría a propósito: allí `authenticated` lo tiene todo.
--
-- Se CORRIGE SOLA, como la suite 16: cada comprobación lanza `SUITE17_FALLO`
-- si el resultado no es el esperado. Ha pasado si termina con exit 0 y la
-- línea `SUITE 17 · TODO CORRECTO`.
--
-- Qué demuestra:
--   [0] la matriz de permisos de tabla de anon/authenticated/service_role es
--       exactamente la de la migración; RLS activa en todas las tablas;
--       crear_operacion_nucleo no es invocable por authenticated ni anon;
--   [1] las 26 RPC que usa la aplicación funcionan como `authenticated` con
--       esos permisos y nada más (listados, empresa, cuenta, capital,
--       operaciones, parciales, cierre, edición, auditoría, cancelación,
--       Risk Engine e importaciones);
--   [2] aislamiento de la idempotencia de registrar_operacion entre usuarios
--       y sin sesión, e idempotencia por Cuenta;
--   [3] RLS bloquea escrituras directas aunque el GRANT exista, y lo que no
--       tiene GRANT falla por permisos.
--
-- Datos sintéticos: UUIDs `c0260260-…`, correos @test.local.

\set ON_ERROR_STOP on
set lc_messages to 'C';

insert into auth.users (id, email) values
  ('c0260260-0000-4000-8000-00000000000a', 'usuario-a@test.local'),
  ('c0260260-0000-4000-8000-00000000000b', 'usuario-b@test.local')
on conflict (id) do nothing;

select set_config('t17.a', 'c0260260-0000-4000-8000-00000000000a', false);
select set_config('t17.b', 'c0260260-0000-4000-8000-00000000000b', false);
select set_config('t17.clave', 'c0260260-1111-4000-8000-000000000001', false);

-- ============================================================
\echo ''
\echo '--- [0a] permisos de tabla: authenticated tiene exactamente los de la migración ---'
do $$
declare v_dif text;
begin
  with esperado(tabla, priv) as (values
    ('prop_firms','SELECT'), ('accounts','SELECT'), ('account_capital_events','SELECT'),
    ('account_risk_state','SELECT'), ('risk_engine_processed_events','SELECT'),
    ('management_plans','SELECT'), ('trades','SELECT'), ('trade_partials_planned','SELECT'),
    ('trade_partials_executed','SELECT'), ('audit_log','SELECT'), ('import_batches','SELECT'),
    ('imported_trade_rows','SELECT'),
    ('prop_firms','INSERT'), ('accounts','INSERT'), ('account_capital_events','INSERT'),
    ('account_risk_state','INSERT'), ('domain_events','INSERT')
  ), real as (
    select c.relname::text as tabla, a.privilege_type::text as priv
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname = 'public' and c.relkind = 'r'
      and a.grantee = 'authenticated'::regrole
      and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
  ), dif as (
    (select 'sobra ' || tabla || ' ' || priv from real except select 'sobra ' || tabla || ' ' || priv from esperado)
    union all
    (select 'falta ' || tabla || ' ' || priv from esperado except select 'falta ' || tabla || ' ' || priv from real)
  )
  select string_agg(d, ', ' order by d) into v_dif from dif as x(d);
  if v_dif is not null then
    raise exception 'SUITE17_FALLO [0a]: %', v_dif;
  end if;
end $$;

\echo '--- [0b] permisos de columna: solo UPDATE (current_capital, peak_capital) de accounts ---'
do $$
declare v text;
begin
  select string_agg(c.relname || '.' || a.attname || ' ' || x.privilege_type, ', '
                    order by c.relname, a.attname, x.privilege_type) into v
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(a.attacl) x
  where n.nspname = 'public' and x.grantee = 'authenticated'::regrole;
  if v is distinct from 'accounts.current_capital UPDATE, accounts.peak_capital UPDATE' then
    raise exception 'SUITE17_FALLO [0b]: permisos de columna %', v;
  end if;
end $$;

\echo '--- [0c] anon y service_role: ningún SELECT/INSERT/UPDATE/DELETE en public ---'
do $$
declare v text;
begin
  select string_agg(c.relname || ' ' || a.grantee::regrole::text || ' ' || a.privilege_type, ', ') into v
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) a
  where n.nspname = 'public' and c.relkind = 'r'
    and a.grantee in ('anon'::regrole, 'service_role'::regrole)
    and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE');
  if v is not null then raise exception 'SUITE17_FALLO [0c]: %', v; end if;

  select string_agg(c.relname || '.' || a.attname, ', ') into v
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(a.attacl) x
  where n.nspname = 'public' and x.grantee in ('anon'::regrole, 'service_role'::regrole);
  if v is not null then raise exception 'SUITE17_FALLO [0c]: permisos de columna %', v; end if;
end $$;

\echo '--- [0d] RLS activa en las 23 tablas de public ---'
do $$
declare v_total int; v_sin text;
begin
  select count(*), string_agg(c.relname, ', ') filter (where not c.relrowsecurity)
    into v_total, v_sin
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
  if v_total <> 23 or v_sin is not null then
    raise exception 'SUITE17_FALLO [0d]: % tablas; sin RLS: %', v_total, v_sin;
  end if;
end $$;

\echo '--- [0e] EXECUTE: las 26 RPC de la aplicación para authenticated; el núcleo para nadie; confirmar_importacion no para anon ---'
do $$
declare
  v_nucleo regprocedure := 'public.crear_operacion_nucleo(uuid, text, text, text, timestamptz, numeric, uuid, numeric, text, jsonb, uuid, text, text)';
  v_import regprocedure := 'public.confirmar_importacion(uuid, text, text, text, text, text, boolean, jsonb, jsonb)';
  v_faltan text;
begin
  if has_function_privilege('authenticated', v_nucleo, 'EXECUTE') then
    raise exception 'SUITE17_FALLO [0e]: authenticated puede ejecutar crear_operacion_nucleo';
  end if;
  if has_function_privilege('anon', v_nucleo, 'EXECUTE') then
    raise exception 'SUITE17_FALLO [0e]: anon puede ejecutar crear_operacion_nucleo';
  end if;
  if has_function_privilege('anon', v_import, 'EXECUTE') then
    raise exception 'SUITE17_FALLO [0e]: anon puede ejecutar confirmar_importacion';
  end if;
  if not has_function_privilege('authenticated', v_import, 'EXECUTE') then
    raise exception 'SUITE17_FALLO [0e]: authenticated no puede ejecutar confirmar_importacion';
  end if;

  select string_agg(r.nombre, ', ') into v_faltan
  from unnest(array[
    'aplicar_cierre_operacion','aplicar_edicion_operacion','cancelar_operacion','confirmar_importacion',
    'consultar_importacion_previa','crear_cuenta','crear_empresa','listar_auditoria_operacion',
    'listar_cuentas','listar_empresas','listar_eventos_capital','listar_lotes_importacion',
    'listar_operaciones','listar_parciales_ejecutados','listar_parciales_planificados',
    'listar_planes_gestion','listar_r_final_vigente_por_cuenta','obtener_cuenta',
    'obtener_lote_importacion','obtener_operacion','registrar_evento_capital','registrar_operacion',
    'registrar_parcial_ejecutado','risk_engine_apply_accumulator_update','risk_engine_obtener_estado',
    'risk_engine_ya_procesado']) as r(nombre)
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = r.nombre
      and has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_faltan is not null then
    raise exception 'SUITE17_FALLO [0e]: authenticated no puede ejecutar %', v_faltan;
  end if;
end $$;

-- ============================================================
\echo ''
\echo '--- [1] las RPC de la aplicación funcionan como authenticated (usuario A) ---'
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t17.a'), false);

do $$
begin
  if (select count(*) from listar_empresas()) <> 0 then raise exception 'SUITE17_FALLO [1a]: listar_empresas'; end if;
  if (select count(*) from listar_cuentas()) <> 0 then raise exception 'SUITE17_FALLO [1a]: listar_cuentas'; end if;
  if (select count(*) from listar_planes_gestion()) <> 0 then raise exception 'SUITE17_FALLO [1a]: listar_planes_gestion'; end if;
end $$;

select id as firm_a from crear_empresa('Empresa A', false) \gset
select id as cta_a from crear_cuenta(:'firm_a'::uuid, 'Cuenta A', '10000.0000', 'USD', null) \gset
select id as cta_a2 from crear_cuenta(:'firm_a'::uuid, 'Cuenta A2', '5000.0000', 'USD', null) \gset
select set_config('t17.cta_a', :'cta_a', false);
select set_config('t17.cta_a2', :'cta_a2', false);
select registrar_evento_capital(:'cta_a'::uuid, 'deposit', '1000.0000', 'Depósito de prueba');

do $$
declare v_cta public.accounts; v_estado public.account_risk_state;
begin
  if (select count(*) from listar_empresas()) <> 1 then raise exception 'SUITE17_FALLO [1b]: listar_empresas'; end if;
  if (select count(*) from listar_cuentas()) <> 2 then raise exception 'SUITE17_FALLO [1b]: listar_cuentas'; end if;
  select * into v_cta from obtener_cuenta(current_setting('t17.cta_a')::uuid);
  if v_cta.name is distinct from 'Cuenta A' or v_cta.current_capital <> 11000.0000 or v_cta.peak_capital <> 11000.0000 then
    raise exception 'SUITE17_FALLO [1b]: obtener_cuenta % / % / %', v_cta.name, v_cta.current_capital, v_cta.peak_capital;
  end if;
  if (select count(*) from listar_eventos_capital(current_setting('t17.cta_a')::uuid)) <> 2 then
    raise exception 'SUITE17_FALLO [1b]: listar_eventos_capital (esperados initial + deposit)';
  end if;
  select * into v_estado from risk_engine_obtener_estado(current_setting('t17.cta_a')::uuid);
  if v_estado.account_id is null or v_estado.n <> 0 or v_estado.version <> 0 then
    raise exception 'SUITE17_FALLO [1b]: la Cuenta no nació con su acumulador';
  end if;
end $$;

\echo '--- [1c] registrar_operacion con clave de idempotencia (riesgo esperado 110.0000) ---'
select id as op1 from registrar_operacion(
  p_account_id => :'cta_a'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
  p_idempotency_key => current_setting('t17.clave')::uuid,
  p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select set_config('t17.op1', :'op1', false);

do $$
declare t public.trades;
begin
  select * into t from obtener_operacion(current_setting('t17.op1')::uuid);
  if t.id is null or t.status <> 'open' or t.risk_amount <> 110.0000 then
    raise exception 'SUITE17_FALLO [1c]: obtener_operacion % / % / %', t.id, t.status, t.risk_amount;
  end if;
  if (select count(*) from listar_operaciones(current_setting('t17.cta_a')::uuid)) <> 1 then
    raise exception 'SUITE17_FALLO [1c]: listar_operaciones';
  end if;
end $$;

\echo '--- [1d] parcial, listados de parciales, cierre, edición y auditoría ---'
select registrar_parcial_ejecutado(:'op1'::uuid, 1, '1.0000', '50.00', now() - interval '90 minutes');
select status from aplicar_cierre_operacion(
  p_trade_id => :'op1'::uuid, p_closed_at => now() - interval '1 hour',
  p_closure_reason => 'MANUAL_CLOSE', p_cierre_manual_rr => '0.0000',
  p_r_max => '1.0000', p_r_final => '0.5000', p_pnl_amount => '55.0000',
  p_expected_partials => 1, p_idempotency_key => gen_random_uuid());
select id from aplicar_edicion_operacion(p_trade_id => :'op1'::uuid, p_notes => 'Nota de prueba');

do $$
declare t public.trades; v_op uuid := current_setting('t17.op1')::uuid;
begin
  if (select count(*) from listar_parciales_planificados(v_op)) <> 0 then
    raise exception 'SUITE17_FALLO [1d]: listar_parciales_planificados';
  end if;
  if (select count(*) from listar_parciales_ejecutados(v_op)) <> 1 then
    raise exception 'SUITE17_FALLO [1d]: listar_parciales_ejecutados';
  end if;
  select * into t from obtener_operacion(v_op);
  if t.status <> 'closed' or t.pnl_amount <> 55.0000 or t.notes is distinct from 'Nota de prueba' then
    raise exception 'SUITE17_FALLO [1d]: cierre/edición % / % / %', t.status, t.pnl_amount, t.notes;
  end if;
  if (select count(*) from listar_auditoria_operacion(v_op)) < 2 then
    raise exception 'SUITE17_FALLO [1d]: listar_auditoria_operacion (esperadas al menos cierre y edición)';
  end if;
  if (select array_agg(r_final) from listar_r_final_vigente_por_cuenta(current_setting('t17.cta_a')::uuid)) <> array[0.5000::numeric(8,4)] then
    raise exception 'SUITE17_FALLO [1d]: listar_r_final_vigente_por_cuenta';
  end if;
  if (select current_capital from obtener_cuenta(current_setting('t17.cta_a')::uuid)) <> 11055.0000 then
    raise exception 'SUITE17_FALLO [1d]: el cierre no movió el capital';
  end if;
end $$;

\echo '--- [1e] Risk Engine: aplicar, ya_procesado, obtener_estado ---'
select applied from risk_engine_apply_accumulator_update(
  p_account_id => :'cta_a'::uuid, p_event_id => 'c0260260-2222-4000-8000-000000000001'::uuid,
  p_event_type => 'OperacionCerrada', p_expected_version => 0,
  p_new_n => 1, p_new_mean => 0.5000, p_new_m2 => 0.0000);
do $$
begin
  if not risk_engine_ya_procesado('c0260260-2222-4000-8000-000000000001'::uuid) then
    raise exception 'SUITE17_FALLO [1e]: risk_engine_ya_procesado';
  end if;
  if (select n from risk_engine_obtener_estado(current_setting('t17.cta_a')::uuid)) <> 1 then
    raise exception 'SUITE17_FALLO [1e]: el acumulador no avanzó';
  end if;
end $$;

\echo '--- [1f] cancelar_operacion de una Operación abierta sin parciales ---'
select id as op2 from registrar_operacion(
  p_account_id => :'cta_a'::uuid, p_symbol => 'MES', p_side => 'short',
  p_opened_at => now() - interval '30 minutes', p_risk_pct => '0.50',
  p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select status from cancelar_operacion(:'op2'::uuid, 'Prueba de cancelación');
do $$
begin
  if (select status from obtener_operacion(current_setting('t17.op1')::uuid)) <> 'closed' then
    raise exception 'SUITE17_FALLO [1f]: la cancelación afectó a otra Operación';
  end if;
end $$;
select set_config('t17.op2', :'op2', false);
do $$
begin
  if (select status from obtener_operacion(current_setting('t17.op2')::uuid)) <> 'cancelled' then
    raise exception 'SUITE17_FALLO [1f]: cancelar_operacion';
  end if;
end $$;

\echo '--- [1g] importaciones: consultar, confirmar, listar y obtener ---'
do $$
declare v jsonb;
begin
  v := consultar_importacion_previa(current_setting('t17.cta_a')::uuid, 'test_conector', 'EXT-0001',
         array[repeat('a', 64)], array[repeat('b', 64)]);
  if v->'claves_existentes' <> '[]'::jsonb or v->>'cuenta_externa_vinculada' is not null then
    raise exception 'SUITE17_FALLO [1g]: consultar_importacion_previa %', v;
  end if;
end $$;
select id as lote from confirmar_importacion(
  :'cta_a'::uuid, 'test_conector', 'prueba.csv', repeat('c', 64), 'UTC', 'EXT-0001', true,
  jsonb_build_array(jsonb_build_object(
    'dedup_key', repeat('a', 64), 'match_key', repeat('b', 64), 'occurrence', 1, 'row_number', 1,
    'external_account_ref', 'EXT-0001', 'symbol', 'MNQ', 'contract', 'MNQZ6',
    'entry_local', '2026-10-01 10:00:00', 'exit_local', '2026-10-01 11:00:00',
    'entry_utc', '2026-10-01 10:00:00+00', 'exit_utc', '2026-10-01 11:00:00+00',
    'entry_price', '20000', 'exit_price', '20010', 'side', 'BUY', 'quantity', '1',
    'gross_pnl', '20', 'net_pnl', '18.5', 'review_reasons', '[]'::jsonb,
    'raw', jsonb_build_object('Symbol', 'MNQ'))),
  '{"total":1}'::jsonb) \gset
select set_config('t17.lote', :'lote', false);
do $$
begin
  if (select count(*) from listar_lotes_importacion(current_setting('t17.cta_a')::uuid)) <> 1 then
    raise exception 'SUITE17_FALLO [1g]: listar_lotes_importacion';
  end if;
  if jsonb_array_length(obtener_lote_importacion(current_setting('t17.lote')::uuid)->'filas') <> 1 then
    raise exception 'SUITE17_FALLO [1g]: obtener_lote_importacion';
  end if;
  if consultar_importacion_previa(current_setting('t17.cta_a')::uuid, 'test_conector', 'EXT-0001',
       array[repeat('a', 64)], array[]::text[])->'claves_existentes' <> jsonb_build_array(repeat('a', 64)) then
    raise exception 'SUITE17_FALLO [1g]: la clave importada no aparece como existente';
  end if;
end $$;

-- ============================================================
\echo ''
\echo '--- [2a] A repite la misma llamada: misma Operación, sin duplicado ---'
select id as op1_bis from registrar_operacion(
  p_account_id => :'cta_a'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
  p_idempotency_key => current_setting('t17.clave')::uuid,
  p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select set_config('t17.op1_bis', :'op1_bis', false);
do $$
begin
  if current_setting('t17.op1_bis') <> current_setting('t17.op1') then
    raise exception 'SUITE17_FALLO [2a]: el reintento devolvió otra Operación';
  end if;
  if (select count(*) from public.trades
      where account_id = current_setting('t17.cta_a')::uuid
        and idempotency_key = current_setting('t17.clave')::uuid) <> 1 then
    raise exception 'SUITE17_FALLO [2a]: el reintento duplicó la Operación';
  end if;
end $$;

\echo '--- [2b] la misma clave en OTRA Cuenta de A: Operación nueva (idempotencia por Cuenta) ---'
select id as op_a2 from registrar_operacion(
  p_account_id => :'cta_a2'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
  p_idempotency_key => current_setting('t17.clave')::uuid,
  p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select set_config('t17.op_a2', :'op_a2', false);
select id as op_a2_bis from registrar_operacion(
  p_account_id => :'cta_a2'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
  p_idempotency_key => current_setting('t17.clave')::uuid,
  p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select set_config('t17.op_a2_bis', :'op_a2_bis', false);
do $$
begin
  if current_setting('t17.op_a2') = current_setting('t17.op1') then
    raise exception 'SUITE17_FALLO [2b]: la clave de otra Cuenta devolvió la Operación de cta_a';
  end if;
  if current_setting('t17.op_a2_bis') <> current_setting('t17.op_a2') then
    raise exception 'SUITE17_FALLO [2b]: el reintento en cta_a2 no fue idempotente';
  end if;
  if (select account_id from obtener_operacion(current_setting('t17.op_a2')::uuid)) <> current_setting('t17.cta_a2')::uuid then
    raise exception 'SUITE17_FALLO [2b]: la Operación no quedó en cta_a2';
  end if;
end $$;

\echo '--- [2c] el usuario B pide la Cuenta y la clave de A: ACCOUNT_NOT_FOUND, sin datos de A ---'
select set_config('request.jwt.claim.sub', current_setting('t17.b'), false);
select id as firm_b from crear_empresa('Empresa B', false) \gset
select id as cta_b from crear_cuenta(:'firm_b'::uuid, 'Cuenta B', '5000.0000', 'USD', null) \gset
select set_config('t17.cta_b', :'cta_b', false);
do $$
declare t public.trades;
begin
  begin
    select * into t from registrar_operacion(
      p_account_id => current_setting('t17.cta_a')::uuid, p_symbol => 'MNQ', p_side => 'long',
      p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
      p_idempotency_key => current_setting('t17.clave')::uuid,
      p_rr_objective => '2.0000', p_be_trigger => 'NONE');
    raise exception 'SUITE17_FALLO [2c]: B recibió la Operación % de A', t.id;
  exception when others then
    if sqlerrm not like 'OPERATIONS_ERROR:ACCOUNT_NOT_FOUND:%' then
      raise exception 'SUITE17_FALLO [2c]: %', sqlerrm;
    end if;
    raise notice '[2c] rechazado: %', sqlerrm;
  end;
  -- Y tampoco por lectura: RLS no le deja ver la Operación de A.
  if (select count(*) from public.trades where id = current_setting('t17.op1')::uuid) <> 0 then
    raise exception 'SUITE17_FALLO [2c]: B ve la Operación de A';
  end if;
  if (select id from obtener_operacion(current_setting('t17.op1')::uuid)) is not null then
    raise exception 'SUITE17_FALLO [2c]: obtener_operacion devolvió la Operación de A a B';
  end if;
end $$;

\echo '--- [2d] la clave de A en la Cuenta de B: Operación propia de B, no la de A ---'
select id as op_b from registrar_operacion(
  p_account_id => :'cta_b'::uuid, p_symbol => 'MNQ', p_side => 'long',
  p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
  p_idempotency_key => current_setting('t17.clave')::uuid,
  p_rr_objective => '2.0000', p_be_trigger => 'NONE') \gset
select set_config('t17.op_b', :'op_b', false);
do $$
begin
  if current_setting('t17.op_b') in (current_setting('t17.op1'), current_setting('t17.op_a2')) then
    raise exception 'SUITE17_FALLO [2d]: B recibió una Operación de A';
  end if;
  if (select user_id from obtener_operacion(current_setting('t17.op_b')::uuid)) <> current_setting('t17.b')::uuid then
    raise exception 'SUITE17_FALLO [2d]: la Operación no es de B';
  end if;
end $$;

\echo '--- [2e] sin sesión (anon, sin claim): ACCOUNT_NOT_FOUND, sin datos ---'
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare t public.trades;
begin
  begin
    select * into t from registrar_operacion(
      p_account_id => current_setting('t17.cta_a')::uuid, p_symbol => 'MNQ', p_side => 'long',
      p_opened_at => now() - interval '2 hours', p_risk_pct => '1.00',
      p_idempotency_key => current_setting('t17.clave')::uuid,
      p_rr_objective => '2.0000', p_be_trigger => 'NONE');
    raise exception 'SUITE17_FALLO [2e]: anon recibió la Operación %', t.id;
  exception when others then
    if sqlerrm not like 'OPERATIONS_ERROR:ACCOUNT_NOT_FOUND:%' then
      raise exception 'SUITE17_FALLO [2e]: %', sqlerrm;
    end if;
    raise notice '[2e] rechazado: %', sqlerrm;
  end;
end $$;

\echo '--- [2f] anon: sin lectura de tablas, sin crear_operacion_nucleo, sin confirmar_importacion ---'
do $$
begin
  begin
    perform 1 from public.trades;
    raise exception 'SUITE17_FALLO [2f]: anon lee trades';
  exception when insufficient_privilege then
    raise notice '[2f] trades: %', sqlerrm;
  end;
  begin
    perform public.crear_operacion_nucleo(
      current_setting('t17.cta_a')::uuid, 'MNQ', null, 'long', now(), 1.00, null, 2.0000, 'NONE',
      '[]'::jsonb, null, 'manual', null);
    raise exception 'SUITE17_FALLO [2f]: anon ejecutó crear_operacion_nucleo';
  exception when insufficient_privilege then
    raise notice '[2f] crear_operacion_nucleo: %', sqlerrm;
  end;
  begin
    perform public.confirmar_importacion(
      current_setting('t17.cta_a')::uuid, 'test_conector', 'x.csv', repeat('d', 64), 'UTC', 'EXT-0001',
      true, '[]'::jsonb, '{}'::jsonb);
    raise exception 'SUITE17_FALLO [2f]: anon ejecutó confirmar_importacion';
  exception when insufficient_privilege then
    raise notice '[2f] confirmar_importacion: %', sqlerrm;
  end;
end $$;

-- ============================================================
\echo ''
\echo '--- [3a] usuario A: el GRANT existe, pero RLS bloquea escribir sobre lo de B ---'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t17.a'), false);
do $$
declare v_n int;
begin
  begin
    insert into public.account_capital_events (account_id, event_type, amount)
    values (current_setting('t17.cta_b')::uuid, 'deposit', 1);
    raise exception 'SUITE17_FALLO [3a]: A escribió en el ledger de B';
  exception when insufficient_privilege then
    if sqlerrm not like '%row-level security%' then raise exception 'SUITE17_FALLO [3a] ledger: %', sqlerrm; end if;
  end;
  begin
    insert into public.prop_firms (user_id, name) values (current_setting('t17.b')::uuid, 'Empresa intrusa');
    raise exception 'SUITE17_FALLO [3a]: A creó una Empresa a nombre de B';
  exception when insufficient_privilege then
    if sqlerrm not like '%row-level security%' then raise exception 'SUITE17_FALLO [3a] prop_firms: %', sqlerrm; end if;
  end;
  begin
    insert into public.domain_events (event_type, account_id, user_id, payload)
    values ('EventoForjado', null, current_setting('t17.b')::uuid, '{}'::jsonb);
    raise exception 'SUITE17_FALLO [3a]: A emitió un evento a nombre de B';
  exception when insufficient_privilege then
    if sqlerrm not like '%row-level security%' then raise exception 'SUITE17_FALLO [3a] domain_events: %', sqlerrm; end if;
  end;
  begin
    insert into public.account_risk_state (account_id) values (current_setting('t17.cta_b')::uuid);
    raise exception 'SUITE17_FALLO [3a]: A provisionó un acumulador en la Cuenta de B';
  exception when insufficient_privilege then
    if sqlerrm not like '%row-level security%' then raise exception 'SUITE17_FALLO [3a] account_risk_state: %', sqlerrm; end if;
  end;
  update public.accounts set current_capital = 1 where id = current_setting('t17.cta_b')::uuid;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'SUITE17_FALLO [3a]: A modificó el capital de B'; end if;
end $$;

\echo '--- [3b] usuario A: lo que no tiene GRANT falla por permisos, no por RLS ---'
do $$
declare
  v_sql text;
begin
  foreach v_sql in array array[
    'insert into public.trades (symbol) values (''X'')',
    format('update public.trades set notes = %L where id = %L', 'x', current_setting('t17.op1')),
    'delete from public.trade_partials_executed',
    'delete from public.trade_partials_planned',
    'insert into public.import_batches (source) values (''x'')',
    'delete from public.imported_trade_rows',
    format('update public.accounts set name = %L where id = %L', 'x', current_setting('t17.cta_a')),
    format('delete from public.accounts where id = %L', current_setting('t17.cta_a')),
    format('update public.account_risk_state set n = 99 where account_id = %L', current_setting('t17.cta_a')),
    'insert into public.audit_log (user_id, entity_type, entity_id, action) values (auth.uid(), ''trade'', gen_random_uuid(), ''update'')',
    'select 1 from public.domain_events',
    'select 1 from public.profiles',
    'select 1 from public.management_intents',
    'select 1 from public.rule_definitions'
  ] loop
    begin
      execute v_sql;
      raise exception 'SUITE17_FALLO [3b]: permitido: %', v_sql;
    exception when insufficient_privilege then
      if sqlerrm not like 'permission denied%' then
        raise exception 'SUITE17_FALLO [3b]: % → % (se esperaba falta de permiso)', v_sql, sqlerrm;
      end if;
    end;
  end loop;

  begin
    perform public.crear_operacion_nucleo(
      current_setting('t17.cta_a')::uuid, 'MNQ', null, 'long', now(), 1.00, null, 2.0000, 'NONE',
      '[]'::jsonb, null, 'manual', null);
    raise exception 'SUITE17_FALLO [3b]: authenticated ejecutó crear_operacion_nucleo';
  exception when insufficient_privilege then
    raise notice '[3b] crear_operacion_nucleo: %', sqlerrm;
  end;
end $$;

\echo '--- [3c] nada de lo anterior cambió los datos de B ni duplicó los de A ---'
reset role;
do $$
begin
  if (select current_capital from public.accounts where id = current_setting('t17.cta_b')::uuid) <> 5000.0000 then
    raise exception 'SUITE17_FALLO [3c]: el capital de B cambió';
  end if;
  if (select count(*) from public.prop_firms where user_id = current_setting('t17.b')::uuid) <> 1 then
    raise exception 'SUITE17_FALLO [3c]: B tiene Empresas de más';
  end if;
  if (select count(*) from public.trades where user_id = current_setting('t17.a')::uuid) <> 3 then
    raise exception 'SUITE17_FALLO [3c]: A debería tener 3 Operaciones (op1, op2 cancelada, op_a2)';
  end if;
  if (select count(*) from public.trades where user_id = current_setting('t17.b')::uuid) <> 1 then
    raise exception 'SUITE17_FALLO [3c]: B debería tener 1 Operación';
  end if;
end $$;

\echo ''
\echo 'SUITE 17 · TODO CORRECTO'
