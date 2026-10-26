-- ============================================================
-- Permisos de tabla explícitos para `authenticated`
--
-- Hasta aquí ninguna migración concedía permisos de tabla: el esquema se
-- apoyaba en los privilegios por defecto que Supabase daba a toda tabla nueva
-- de `public` (select/insert/update/delete para anon, authenticated y
-- service_role). Un proyecto creado con «exponer automáticamente nuevas
-- tablas» desactivado —el comportamiento por defecto de los proyectos nuevos
-- desde 2026— crea las tablas SIN esos permisos, y entonces toda RPC
-- `SECURITY INVOKER` falla con 42501 (`listar_empresas`, en la primera
-- pantalla).
--
-- Esta migración concede a `authenticated` exactamente lo que necesitan las
-- RPC `SECURITY INVOKER` que usa la aplicación y los triggers que esas RPC
-- disparan, y nada más. Nada a `anon` ni a `service_role`, ningún TRUNCATE.
--
-- QUIÉN NECESITA QUÉ
--   · Las RPC `SECURITY DEFINER` (registrar_operacion, registrar_parcial_
--     ejecutado, cancelar_*, aplicar_cierre/edicion_operacion,
--     risk_engine_apply_accumulator_update, confirmar_importacion,
--     crear_intencion_de_gestion, abrir_operacion_desde_intencion) y los
--     triggers que se disparan DENTRO de ellas se ejecutan como el
--     propietario: no necesitan ningún permiso de esta lista.
--   · Las RPC `SECURITY INVOKER` y sus triggers se ejecutan como
--     `authenticated`, y también las subconsultas de las políticas RLS:
--       crear_empresa ............ INSERT … RETURNING en prop_firms
--       crear_cuenta ............. SELECT prop_firms; INSERT … RETURNING en
--                                  accounts → trigger de provisión: INSERT en
--                                  account_risk_state; INSERT en
--                                  account_capital_events → trigger de
--                                  recálculo: SELECT account_capital_events y
--                                  UPDATE (current_capital, peak_capital) en
--                                  accounts; trigger emisor: INSERT en
--                                  domain_events (su BEFORE lee accounts)
--       registrar_evento_capital . lo mismo que el ledger de crear_cuenta
--       listar_* / obtener_* ..... SELECT de las tablas que leen (abajo)
--       risk_engine_obtener_estado / risk_engine_ya_procesado: SELECT
--       consultar_importacion_previa, listar_lotes_importacion,
--       obtener_lote_importacion: SELECT
--   · Las comprobaciones de clave foránea se hacen como propietario de la
--     tabla referenciada: no exigen permiso. Las columnas identidad
--     (`domain_events.event_sequence`) no exigen permiso sobre su secuencia.
--   · `EXECUTE` de las RPC llega por el privilegio por defecto de PUBLIC en
--     PostgreSQL, que esta opción del proyecto no retira; las dos funciones que
--     lo restringen lo hacen en sus propios ficheros (operations.sql,
--     imports.sql).
--
-- GRANT Y RLS
-- El GRANT es la primera puerta (¿puede este rol intentar la sentencia?) y la
-- RLS la segunda (¿sobre qué filas?). Hacen falta las dos. Un GRANT de esta
-- lista no abre ninguna fila ajena: las 23 tablas tienen RLS activa y sus
-- políticas filtran por `auth.uid()`. Y un GRANT de INSERT no autoriza una
-- escritura que ninguna política permite (p. ej. `domain_events` solo admite
-- filas con `user_id = auth.uid()`).
--
-- LO QUE NO SE CONCEDE, A PROPÓSITO
--   · Escritura en trades, trade_partials_* , import_batches,
--     imported_trade_rows y account_risk_state (UPDATE/DELETE): las
--     revocaciones de 20260803121500 y 20261018120000 siguen en vigor; aquí
--     solo se da SELECT (e INSERT de provisión en account_risk_state).
--   · UPDATE de accounts más allá de las dos columnas que mantiene el trigger
--     de recálculo. `current_capital` sigue siendo escribible por el propio
--     usuario: es la deuda H6 de Funding Management (20260803121500), que esto
--     no empeora ni resuelve.
--   · Tablas que ninguna RPC de la aplicación usa como invocador: profiles,
--     domain_events (SELECT), management_plan_partials, rule_*,
--     management_intents y management_intent_destinations. Las RPC INVOKER que las usan
--     (Rule Engine, lecturas de Intenciones, CRUD de Planes,
--     listar_eventos_pendientes) no las llama la aplicación hoy; si llegan a
--     usarse, necesitarán su propio GRANT en una migración nueva.
--
-- Sobre una base que ya tenía los privilegios por defecto antiguos (la local),
-- esta migración no cambia nada: concede lo que ya estaba concedido. No toca
-- ninguna fila.
-- ============================================================

-- Lectura (RPC de listado y subconsultas de las políticas RLS)
grant select on
  public.prop_firms,
  public.accounts,
  public.account_capital_events,
  public.account_risk_state,
  public.risk_engine_processed_events,
  public.management_plans,
  public.trades,
  public.trade_partials_planned,
  public.trade_partials_executed,
  public.audit_log,
  public.import_batches,
  public.imported_trade_rows
to authenticated;

-- Altas que hacen las RPC de Funding y los triggers que disparan
grant insert on
  public.prop_firms,
  public.accounts,
  public.account_capital_events,
  public.account_risk_state,
  public.domain_events
to authenticated;

-- Recálculo de capital (recompute_account_capital): solo estas dos columnas
grant update (current_capital, peak_capital) on public.accounts to authenticated;
