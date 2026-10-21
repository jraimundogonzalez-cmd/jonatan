-- Lista los objetos del esquema public, uno por línea: tipo|objeto
-- Usado por generar-esquema-esperado.sh (para el fichero de referencia) y por
-- el diagnóstico de Windows (sobre la base real, en modo solo lectura).
-- Reglas del fichero: una sola sentencia SELECT, sin comillas dobles y sin
-- comentarios a partir de esta cabecera (el diagnóstico la envía en una línea).
select tipo || '|' || objeto from (
  select 'tabla' as tipo, format('%I', c.relname) as objeto
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  union all
  select 'vista', format('%I', c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  union all
  select 'columna', format('%I.%I %s', c.relname, a.attname, format_type(a.atttypid, a.atttypmod))
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm') and a.attnum > 0 and not a.attisdropped
  union all
  select 'funcion', format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  union all
  select 'trigger', format('%I %I', c.relname, t.tgname)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
  union all
  select 'politica', format('%I %I', tablename, policyname) from pg_policies where schemaname = 'public'
  union all
  select 'indice', format('%I', indexname) from pg_indexes where schemaname = 'public'
  union all
  select 'tipo', format('%I', t.typname)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and (t.typtype in ('e', 'd') or (t.typtype = 'c' and exists (select 1 from pg_class c where c.oid = t.typrelid and c.relkind = 'c')))
) objetos
order by 1;
