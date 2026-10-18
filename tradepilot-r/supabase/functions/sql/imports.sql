-- API de importación de ficheros (migración 20261018120000_trade_file_imports.sql).
--
-- Convención de errores: "IMPORT_ERROR:<CODE>:<detalle>", que
-- apps/web/lib/api/imports.ts traduce a un error tipado. Igual que funding.sql
-- y operations.sql: un error que no siga el formato llega como UNKNOWN, nunca
-- se descarta.
--
-- Estas funciones NO crean Operaciones, no calculan R y no envían nada a
-- ninguna plataforma (I17). Solo guardan y leen evidencia importada.

-- ============================================================
-- consultar_importacion_previa — lo que la vista previa necesita saber de la
-- base: qué claves ya existen y a qué cuenta externa y zona está vinculada la
-- Cuenta. Solo lectura.
-- ============================================================
create or replace function public.consultar_importacion_previa(
  p_account_id uuid,
  p_source text,
  p_external_account_ref text,
  p_dedup_keys text[],
  p_match_keys text[]
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_vinculo public.import_batches;
  v_otra record;
begin
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = auth.uid()) then
    raise exception 'IMPORT_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', p_account_id;
  end if;

  -- El primer lote de la Cuenta fija su cuenta externa y su zona horaria.
  select * into v_vinculo from public.import_batches
    where account_id = p_account_id and source = p_source
    order by created_at, id limit 1;

  select b.account_id, a.name into v_otra
    from public.import_batches b join public.accounts a on a.id = b.account_id
    where b.user_id = auth.uid() and b.source = p_source
      and b.external_account_ref = p_external_account_ref and b.account_id <> p_account_id
    limit 1;

  return jsonb_build_object(
    'claves_existentes', coalesce((
      select jsonb_agg(dedup_key) from public.imported_trade_rows
      where account_id = p_account_id and source = p_source and dedup_key = any(p_dedup_keys)), '[]'::jsonb),
    'coincidencias_existentes', coalesce((
      select jsonb_agg(distinct match_key) from public.imported_trade_rows
      where account_id = p_account_id and source = p_source and match_key = any(p_match_keys)), '[]'::jsonb),
    'cuenta_externa_vinculada', v_vinculo.external_account_ref,
    'zona_horaria_vinculada', v_vinculo.source_timezone,
    'cuenta_externa_en_otra_cuenta', case when v_otra.account_id is null then null
      else jsonb_build_object('account_id', v_otra.account_id, 'account_name', v_otra.name) end
  );
end;
$$;

-- ============================================================
-- confirmar_importacion — guarda un lote completo o nada.
--
-- Atomicidad: todo ocurre dentro de esta función, que es una sola
-- transacción. Si cualquier fila viola una restricción (fecha, precio,
-- cantidad, cuenta…), se revierte el lote entero: ni lote ni filas.
--
-- Idempotencia: `on conflict do nothing` sobre (cuenta, conector, clave). Una
-- fila ya guardada no se duplica y se cuenta como duplicada en el lote. Un
-- cerrojo consultivo por (cuenta, conector) serializa dos confirmaciones
-- simultáneas de la misma Cuenta para que los recuentos y el vínculo sean
-- exactos.
-- ============================================================
create or replace function public.confirmar_importacion(
  p_account_id uuid,
  p_source text,
  p_file_name text,
  p_file_sha256 text,
  p_source_timezone text,
  p_external_account_ref text,
  p_confirmar_vinculo boolean,
  p_rows jsonb,
  p_resumen jsonb
)
returns public.import_batches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_batch_id uuid := gen_random_uuid();
  v_vinculo public.import_batches;
  v_total_filas integer;
  v_insertadas integer;
  v_con_revision integer;
  v_lote public.import_batches;
begin
  if v_uid is null or not exists (select 1 from public.accounts where id = p_account_id and user_id = v_uid) then
    raise exception 'IMPORT_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', p_account_id;
  end if;
  if p_source is null or p_source !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:source:"%" no es un identificador de conector válido', p_source;
  end if;
  if p_source_timezone is null or not exists (select 1 from pg_timezone_names where name = p_source_timezone) then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:source_timezone:"%" no es una zona horaria reconocida', p_source_timezone;
  end if;
  if coalesce(trim(p_external_account_ref), '') = '' then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:external_account_ref:falta la cuenta del fichero';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:rows:se esperaba una lista de filas';
  end if;
  if jsonb_typeof(p_resumen) is distinct from 'object' then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:resumen:se esperaba un objeto';
  end if;
  v_total_filas := jsonb_array_length(p_rows);
  if v_total_filas > 5000 then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:rows:% filas superan el máximo de 5000', v_total_filas;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text || ':' || p_source, 0));

  -- El vínculo Cuenta ↔ cuenta externa lo fija el primer lote, por
  -- confirmación expresa del usuario, y no cambia después.
  select * into v_vinculo from public.import_batches
    where account_id = p_account_id and source = p_source
    order by created_at, id limit 1;
  if found then
    if v_vinculo.external_account_ref <> p_external_account_ref then
      raise exception 'IMPORT_ERROR:ACCOUNT_MISMATCH:esta Cuenta está vinculada a la cuenta externa %, el fichero es de %',
        v_vinculo.external_account_ref, p_external_account_ref;
    end if;
    if v_vinculo.source_timezone <> p_source_timezone then
      raise exception 'IMPORT_ERROR:TIMEZONE_MISMATCH:los lotes anteriores de esta Cuenta se importaron en %, no en %',
        v_vinculo.source_timezone, p_source_timezone;
    end if;
  elsif not coalesce(p_confirmar_vinculo, false) then
    raise exception 'IMPORT_ERROR:LINK_CONFIRMATION_REQUIRED:es la primera importación de esta Cuenta; confirma que % le corresponde',
      p_external_account_ref;
  end if;
  if exists (
    select 1 from public.import_batches
    where user_id = v_uid and source = p_source
      and external_account_ref = p_external_account_ref and account_id <> p_account_id
  ) then
    raise exception 'IMPORT_ERROR:EXTERNAL_ACCOUNT_LINKED_ELSEWHERE:la cuenta externa % ya está vinculada a otra Cuenta',
      p_external_account_ref;
  end if;

  -- Defensa en profundidad: ninguna fila puede ser de otra cuenta externa.
  if exists (
    select 1 from jsonb_array_elements(p_rows) e
    where e->>'external_account_ref' is distinct from p_external_account_ref
  ) then
    raise exception 'IMPORT_ERROR:VALIDATION_ERROR:rows:hay filas de una cuenta externa distinta de %', p_external_account_ref;
  end if;

  -- El instante se recalcula aquí con la base de zonas de PostgreSQL. Si no
  -- coincide con el que calculó el conector (otra versión de la base de zonas,
  -- o un cliente que no es el nuestro), se rechaza el lote en vez de guardar
  -- una hora distinta de la que vio el usuario en la vista previa.
  if exists (
    select 1 from jsonb_array_elements(p_rows) e
    where ((e->>'entry_local')::timestamp at time zone p_source_timezone) is distinct from (e->>'entry_utc')::timestamptz
       or ((e->>'exit_local')::timestamp at time zone p_source_timezone) is distinct from (e->>'exit_utc')::timestamptz
  ) then
    raise exception 'IMPORT_ERROR:TIMEZONE_CONVERSION_MISMATCH:la conversión horaria de alguna fila no coincide con la de la vista previa';
  end if;

  with insertadas as (
    insert into public.imported_trade_rows (
      batch_id, user_id, account_id, source,
      dedup_key, match_key, occurrence, row_number,
      external_account_ref, symbol, contract,
      entry_local, exit_local, entry_at, exit_at,
      entry_price, exit_price, side, quantity, gross_pnl, net_pnl,
      review_reasons, raw
    )
    select
      v_batch_id, v_uid, p_account_id, p_source,
      e->>'dedup_key', e->>'match_key', (e->>'occurrence')::integer, (e->>'row_number')::integer,
      e->>'external_account_ref', e->>'symbol', e->>'contract',
      e->>'entry_local', e->>'exit_local',
      -- La conversión a instante se rehace AQUÍ desde el reloj y la zona del
      -- lote: el instante guardado no depende de lo que calculó el cliente.
      (e->>'entry_local')::timestamp at time zone p_source_timezone,
      (e->>'exit_local')::timestamp at time zone p_source_timezone,
      (e->>'entry_price')::numeric, (e->>'exit_price')::numeric, e->>'side', (e->>'quantity')::numeric,
      (e->>'gross_pnl')::numeric, (e->>'net_pnl')::numeric,
      coalesce((select array_agg(x) from jsonb_array_elements_text(e->'review_reasons') x), '{}'),
      e->'raw'
    from jsonb_array_elements(p_rows) e
    on conflict (account_id, source, dedup_key) do nothing
    returning review_reasons
  )
  select count(*), count(*) filter (where cardinality(review_reasons) > 0)
    into v_insertadas, v_con_revision
  from insertadas;

  insert into public.import_batches (
    id, user_id, account_id, source, file_name, file_sha256, source_timezone, external_account_ref,
    rows_total, rows_imported, rows_review_accepted, rows_duplicate,
    rows_review_skipped, rows_other_account, rows_invalid, summary
  ) values (
    v_batch_id, v_uid, p_account_id, p_source, p_file_name, p_file_sha256, p_source_timezone, p_external_account_ref,
    coalesce((p_resumen->>'total')::integer, v_total_filas),
    v_insertadas,
    v_con_revision,
    -- Duplicadas: las detectadas en la vista previa + las que la clave única
    -- rechazó ahora (p. ej. otra importación confirmada entre medias).
    coalesce((p_resumen->>'duplicadas')::integer, 0) + (v_total_filas - v_insertadas),
    coalesce((p_resumen->>'revision_no_aceptadas')::integer, 0),
    coalesce((p_resumen->>'otra_cuenta')::integer, 0),
    coalesce((p_resumen->>'invalidas')::integer, 0),
    p_resumen
  )
  returning * into v_lote;

  return v_lote;
end;
$$;

-- ============================================================
-- Lecturas. Los decimales salen como TEXTO (I5): `to_jsonb(numeric)` daría un
-- número JSON que el cliente leería como coma flotante.
-- ============================================================
create or replace function public.listar_lotes_importacion(p_account_id uuid)
returns setof public.import_batches
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select * from public.import_batches
  where account_id = p_account_id and user_id = auth.uid()
  order by created_at desc, id desc;
$$;

create or replace function public.obtener_lote_importacion(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lote public.import_batches;
begin
  select * into v_lote from public.import_batches where id = p_batch_id and user_id = auth.uid();
  if not found then
    raise exception 'IMPORT_ERROR:BATCH_NOT_FOUND:no existe un lote % del usuario actual', p_batch_id;
  end if;
  return jsonb_build_object(
    'lote', to_jsonb(v_lote),
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'row_number', r.row_number,
        'occurrence', r.occurrence,
        'symbol', r.symbol,
        'contract', r.contract,
        'entry_local', r.entry_local,
        'exit_local', r.exit_local,
        'entry_at', r.entry_at,
        'exit_at', r.exit_at,
        'entry_price', r.entry_price::text,
        'exit_price', r.exit_price::text,
        'side', r.side,
        'quantity', r.quantity::text,
        'gross_pnl', r.gross_pnl::text,
        'net_pnl', r.net_pnl::text,
        'review_reasons', to_jsonb(r.review_reasons)
      ) order by r.row_number)
      from public.imported_trade_rows r where r.batch_id = p_batch_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.confirmar_importacion(uuid, text, text, text, text, text, boolean, jsonb, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.confirmar_importacion(uuid, text, text, text, text, text, boolean, jsonb, jsonb) from anon;
  end if;
end $$;
grant execute on function public.confirmar_importacion(uuid, text, text, text, text, text, boolean, jsonb, jsonb) to authenticated;
