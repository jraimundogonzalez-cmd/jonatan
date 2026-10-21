-- BUILD 006A — Event Backbone
--
-- Completa el modelo único de eventos del sistema. Dos hallazgos reales,
-- verificados contra el código antes de escribir esta migración:
--
--   1. Operations Engine no emitía NINGUNO de los cinco eventos que
--      SPEC-002 §3.1 le exige. El único escritor del outbox era
--      risk_engine_apply_accumulator_update ('AcumuladorActualizado'),
--      así que Rule Engine (SPEC-004 §4.1) no habría tenido nada que
--      consumir: su pipeline entero quedaba inerte.
--   2. `domain_events` no tenía ninguna secuencia monotónica. Su orden solo
--      podía derivarse de `occurred_at`, que en Postgres es el instante de
--      INICIO DE TRANSACCIÓN: dos eventos de la misma transacción reciben
--      timestamps idénticos. Es exactamente el Riesgo #1 de SPEC-004, del
--      que depende su hallazgo principal (§14.2, `triggering_event_sequence`).
--
-- ESTRICTAMENTE ADITIVA. No modifica ni un carácter de operations.sql,
-- funding.sql ni de las migraciones de BUILD 003/004. No cambia el
-- comportamiento funcional de ningún motor: solo aparecen filas en una tabla
-- que hoy nadie lee. Este build NO introduce ningún consumidor.

-- ============================================================
-- 1. SECUENCIA MONOTÓNICA
--
-- `generated always as identity` rellena automáticamente las filas ya
-- existentes y no requiere tocar el INSERT de Risk Engine, que no nombra
-- esta columna.
--
-- **Qué garantiza y qué no** (la distinción importa, es la trampa clásica
-- del patrón Outbox):
--   • SÍ: orden total consistente y monotonía por Cuenta. Es lo que
--     SPEC-004 §14.2 necesita para comparar `triggering_event_sequence`
--     contra la ya cacheada y no sobrescribir un `compliance_flag` con una
--     evaluación tardía. Dentro de una transacción, varios INSERT reciben
--     valores crecientes: el orden causal se preserva.
--   • NO: no sirve como CURSOR DE ENTREGA. Dos transacciones pueden tomar
--     los números 5 y 6 y confirmarse en orden inverso; un lector que
--     avanzara un cursor por `event_sequence > último_visto` perdería el 5
--     para siempre. Por eso la entrega sigue siendo `published = false`,
--     que ya existía y es inmune a ese fallo por ser una cola de trabajo y
--     no un cursor. **La secuencia ordena; el flag entrega.**
--   • Tampoco es libre de huecos (un ROLLBACK consume número) — sirve para
--     ordenar, nunca para detectar eventos perdidos por conteo.
--
-- Se llama `event_sequence` y no `sequence` para no colisionar
-- conceptualmente con `trade_partials_executed.sequence`, que significa
-- algo completamente distinto (el ordinal del parcial dentro de una
-- Operación).
-- ============================================================
alter table public.domain_events add column event_sequence bigint generated always as identity;

-- Índice de entrega ordenado por la secuencia real. El índice previo
-- (`domain_events_unpublished_idx`, sobre `occurred_at`) se conserva
-- deliberadamente para mantener el cambio estrictamente aditivo: queda
-- redundante y puede retirarse en una limpieza futura, nunca en este build.
create index domain_events_delivery_idx on public.domain_events(event_sequence) where published = false;

-- ============================================================
-- 2. EMISIÓN DE EVENTOS
--
-- Se emite desde triggers sobre las tablas que ya son fuente de verdad, no
-- desde las funciones RPC. Tres razones, y solo la tercera es de comodidad:
--
--   a. Cierra "path drift" (SPEC-002 §5.7) por construcción: cualquier vía
--      de escritura futura — Trade Capture Engine, un Import Adapter de
--      bróker, una corrección manual — emite el evento sin poder olvidarlo.
--   b. Atomicidad real y gratuita: el evento se escribe en la misma
--      transacción que el hecho que lo origina. Nunca existe un hecho sin su
--      evento ni un evento sin su hecho — el patrón Outbox en su forma
--      correcta.
--   c. No toca ningún archivo congelado.
--
-- **Los eventos son hechos consumados** (restricción del fundador): cada uno
-- se emite DESPUÉS de que la fila exista o haya cambiado, nunca antes.
-- Ninguno representa una intención, una predicción ni una recomendación.
--
-- **Los eventos son inmutables**: `domain_events` no admite UPDATE de
-- contenido en ninguna vía de este esquema; si la realidad cambia, se emite
-- un evento nuevo (una Operación editada emite `OperacionEditada`, jamás
-- reescribe el `OperacionCerrada` anterior).
--
-- **El payload es mínimo**: identidad + el contexto mínimo que describe la
-- transición ocurrida. Nunca una copia del estado de otro módulo. El
-- consumidor relee la fuente de verdad — es lo que impide que el outbox se
-- convierta en una segunda base de datos, y lo que respeta SPEC-004 §1.2
-- punto 2 ("nunca almacena hechos que pertenezcan a otro módulo").
--
-- **Orden de disparo entre triggers de una misma tabla**: Postgres los
-- ejecuta en orden alfabético de nombre. Es irrelevante aquí porque cada
-- tabla tiene un único trigger emisor y porque el payload no lleva estado
-- derivado: ningún observador externo ve el estado intermedio de una
-- transacción, y todo consumidor lee después del COMMIT.
--
-- SECURITY INVOKER (por defecto): la política `domain_events_owner_i` ya
-- autoriza el INSERT por propiedad de la Cuenta, y toda escritura que
-- dispara estos triggers ocurre sobre una Cuenta del propio usuario. No
-- hace falta SECURITY DEFINER, a diferencia de `trades_audit_trigger`
-- (audit_log no tiene política de INSERT para `authenticated`).
-- ============================================================

-- --- Operations Engine: alta de una Operación ---------------------------
create or replace function public.emit_operacion_registrada() returns trigger
language plpgsql as $$
begin
  insert into public.domain_events (event_type, account_id, payload)
  values ('OperacionRegistrada', new.account_id, jsonb_build_object('trade_id', new.id));
  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;

create trigger on_trade_insert_emit_event
  after insert on public.trades
  for each row execute function public.emit_operacion_registrada();

-- --- Operations Engine: cierre, cancelación y edición -------------------
-- Un único trigger para los tres, porque los tres son el mismo UPDATE sobre
-- `trades` y la distinción es exactamente la transición de `status`. El
-- guard `to_jsonb(old) is distinct from to_jsonb(new)` replica el del
-- trigger de auditoría ya existente: un UPDATE que no cambia nada no es un
-- hecho, y por tanto no emite evento.
create or replace function public.emit_evento_operacion_actualizada() returns trigger
language plpgsql as $$
declare
  v_event_type text;
  v_payload jsonb;
begin
  if old.status = 'open' and new.status = 'closed' then
    v_event_type := 'OperacionCerrada';
    -- `closure_reason` es la forma de la transición, no una copia del
    -- estado de la Operación — describe QUÉ ocurrió, que es justo lo que un
    -- evento debe llevar.
    v_payload := jsonb_build_object('trade_id', new.id, 'closure_reason', new.closure_reason);
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    v_event_type := 'OperacionCancelada';
    -- `previous_status` distingue la cancelación simple (desde 'open') de la
    -- reversión de "operación fantasma" (desde 'closed', SPEC-002 §5.4), que
    -- son dos hechos distintos con consecuencias de capital distintas.
    v_payload := jsonb_build_object('trade_id', new.id, 'previous_status', old.status);
  elsif old.status = new.status then
    v_event_type := 'OperacionEditada';
    v_payload := jsonb_build_object('trade_id', new.id);
  else
    -- Cualquier otra transición está prohibida por
    -- `enforce_trade_invariants` (BUILD 004) y nunca llega hasta aquí.
    return null;
  end if;

  insert into public.domain_events (event_type, account_id, payload)
  values (v_event_type, new.account_id, v_payload);
  return null;
end;
$$;

-- Nombrado para que ordene DESPUÉS de `on_trade_update_audit`: la auditoría
-- del cambio se registra primero, el evento después. No es un requisito
-- funcional (ver nota de orden arriba), pero deja el orden fijado de forma
-- explícita en vez de dependiente del azar del nombre elegido.
create trigger on_trade_update_emit_event
  after update on public.trades
  for each row
  when (to_jsonb(old) is distinct from to_jsonb(new))
  execute function public.emit_evento_operacion_actualizada();

-- --- Operations Engine: parcial ejecutado -------------------------------
-- `trade_partials_executed` no tiene `account_id`; se resuelve por JOIN con
-- `trades`. Es un SELECT puntual por fila insertada (índice de clave
-- primaria), no un coste relevante — se documenta porque es una dependencia
-- real entre tablas dentro de un trigger.
create or replace function public.emit_parcial_ejecutado() returns trigger
language plpgsql as $$
declare
  v_account_id uuid;
begin
  select account_id into v_account_id from public.trades where id = new.trade_id;

  insert into public.domain_events (event_type, account_id, payload)
  values (
    'ParcialEjecutado',
    v_account_id,
    jsonb_build_object('trade_id', new.trade_id, 'sequence', new.sequence)
  );
  return null;
end;
$$;

create trigger on_partial_executed_emit_event
  after insert on public.trade_partials_executed
  for each row execute function public.emit_parcial_ejecutado();

-- --- Funding Management: capital recalculado ---------------------------
-- El ledger es append-only (BUILD 001 rechaza UPDATE/DELETE), así que un
-- INSERT es siempre un hecho nuevo y consumado. El payload lleva la
-- referencia al evento de capital y su tipo — nunca el importe ni el capital
-- resultante: eso es estado de Funding Management y el consumidor lo relee.
create or replace function public.emit_capital_recalculado() returns trigger
language plpgsql as $$
begin
  insert into public.domain_events (event_type, account_id, payload)
  values (
    'CapitalRecalculado',
    new.account_id,
    jsonb_build_object('capital_event_id', new.id, 'event_type', new.event_type)
  );
  return null;
end;
$$;

create trigger on_capital_event_emit_event
  after insert on public.account_capital_events
  for each row execute function public.emit_capital_recalculado();

-- ============================================================
-- 3. LECTURA DEL OUTBOX
--
-- Una única función de lectura, para que ningún consumidor futuro invente
-- la suya y acabe con dos criterios distintos de "qué está pendiente".
-- Devuelve en orden de secuencia real, nunca de `occurred_at`.
--
-- No se entrega ninguna función de marcado como publicado ni ningún worker:
-- este build no introduce consumidores (restricción explícita del alcance).
-- El día que exista un worker, `domain_events.id` es su clave de
-- idempotencia natural — el patrón ya está probado en producción con
-- `risk_engine_processed_events` (BUILD 003), validado contra dos sesiones
-- Postgres genuinamente concurrentes.
-- ============================================================
create or replace function public.listar_eventos_pendientes(p_limite integer default 100)
returns setof public.domain_events
language sql
security invoker
set search_path = public
as $$
  select * from public.domain_events
  where published = false
  order by event_sequence asc
  limit p_limite;
$$;
