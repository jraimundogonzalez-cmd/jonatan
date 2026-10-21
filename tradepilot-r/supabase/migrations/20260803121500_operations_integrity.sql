-- BUILD 016B — Operations: el contrato es la única puerta
--
-- Cierra H1, H2, H3, H5, H7, H8 e INT-9, todas demostradas con ataques reales
-- ejecutados como rol `authenticated` contra una base construida desde cero.
-- Lo que se demostró, resumido: un usuario podía insertar una Operación forjada
-- con `r_final` arbitrario, reescribir por completo una Operación ya cerrada,
-- borrar una Operación —arrastrando consigo el destino de su Intención—,
-- reescribir o borrar la evidencia de sus parciales ejecutados, e imponer
-- cualquier valor a su propio acumulador de riesgo.
--
-- ============================================================
-- EL MODELO DE TRES CAPAS, Y POR QUÉ HACEN FALTA LAS TRES
--
--   GRANT / RLS      → quién puede *intentar* escribir.
--   SECURITY DEFINER → la autoridad de las operaciones legítimas.
--   TRIGGER          → qué estado es *válido*, incluso frente a un rol que
--                      salte RLS (el propietario de la tabla siempre lo hace).
--   audit_log        → el registro de las correcciones que el dominio permite.
--
-- Ninguna capa sustituye a las otras, y la razón es exactamente la que la
-- auditoría demostró: **un trigger puede verificar si una fila es válida, pero
-- no puede distinguir una fila legítimamente creada de una fila forjada con
-- valores válidos.** Por eso no basta con blindar el contenido: hay que cerrar
-- la puerta. Y al revés: cerrar la puerta tampoco basta, porque el propietario
-- de la tabla la tiene siempre abierta — por eso el trigger es obligatorio.
--
-- ============================================================
-- IDENTIDAD FRENTE A DESENLACE — la frontera de este build
--
-- **Hechos de identidad**: quedan fijados al nacer la Operación y no cambian
-- por ninguna vía, ni siquiera por una RPC legítima ni por el propietario.
-- Los impone un trigger.
--
-- **Hechos de desenlace** (`r_final`, `pnl_amount`, `r_max`, `closure_reason`,
-- `cierre_manual_rr`, `closed_at`, `status`): el dominio admite corregirlos —
-- `aplicar_edicion_operacion` existe exactamente para eso y BUILD 018 lo
-- necesita—. No se convierten en inmutables absolutos: se protegen **cerrando
-- la superficie** (sólo las RPC `SECURITY DEFINER` pueden escribirlos) y
-- **dejando evidencia** (`trades_audit_trigger`, que ya es SECURITY DEFINER y
-- ya registra en `audit_log` cada UPDATE con su `before`/`after`). No hace
-- falta ninguna semántica nueva de "corrección": la que existe ya cumple.
--
-- **Anotación** (`notes`, `comments`): libre. No entra en ningún cálculo.
--
-- ============================================================
-- FUERA DE ALCANCE, DELIBERADAMENTE
--
-- **H6 — `accounts.current_capital` sigue siendo escribible directamente.** Es
-- deuda de Funding Management y este build no la toca ni construye una
-- protección paralela. Impacto documentado: un `current_capital` corrupto
-- produce `risk_amount` corruptos en toda Operación futura, porque el núcleo
-- lo calcula como Capital_en_ese_instante × Riesgo% (SPEC-002 §2.5).
--
-- Tampoco se toca BUILD 016, ni SPEC-008, ni Quant Engine, ni `packages/`, ni
-- el contrato de BUILD 017.

-- ============================================================
-- 1 · `trades` — identidad inmutable y existencia perpetua.
--
-- Se **extiende la misma función** que BUILD 017 extendió, en vez de añadir un
-- segundo guardián: dos triggers sobre la misma tabla acabarían dependiendo de
-- su orden de ejecución.
--
-- El orden interno importa y es deliberado: la comprobación de hechos
-- heredados de BUILD 017 va **antes** que la de identidad, para que una
-- Operación vinculada siga recibiendo su error específico
-- (`IMMUTABLE_INHERITED_FACT`) y el contrato de 017 no cambie. La de identidad
-- recoge todo lo demás, incluidas las Operaciones sin Intención, que hasta
-- ahora no tenían ninguna protección.
-- ============================================================
create or replace function public.enforce_trade_invariants() returns trigger
language plpgsql as $$
declare
  v_executed_count integer;
  v_vinculada boolean;
begin
  if new.account_id <> old.account_id then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_ACCOUNT_ID:account_id no puede editarse — registra una Operación distinta';
  end if;

  -- BUILD 017: los hechos que la Operación heredó de su Intención.
  select exists (
    select 1 from public.management_intent_destinations d
    where d.trade_id = old.id and d.state = 'materialized'
  ) into v_vinculada;

  if v_vinculada then
    if new.management_plan_id is distinct from old.management_plan_id
       or new.rr_objective    is distinct from old.rr_objective
       or new.be_trigger      is distinct from old.be_trigger
       or new.risk_pct        is distinct from old.risk_pct
       or new.side            is distinct from old.side
       or new.instrument_key  is distinct from old.instrument_key
       or new.symbol          is distinct from old.symbol then
      raise exception 'OPERATIONS_ERROR:IMMUTABLE_INHERITED_FACT:una Operación nacida de una Intención no puede contradecir la decisión que la originó — el desenlace de su destino es terminal y no podría reflejar la corrección';
    end if;
  end if;

  -- BUILD 016B: la identidad de CUALQUIER Operación, vinculada o no.
  -- `risk_amount` está aquí y no entre los campos de desenlace por una razón
  -- concreta: SPEC-002 §2.5 (Invariante 3) dice que se calcula y persiste una
  -- sola vez, Capital_en_ese_instante × Riesgo%. Recalcularlo después sería
  -- usar un capital que no es el del momento de la decisión.
  if new.user_id            is distinct from old.user_id
     or new.symbol          is distinct from old.symbol
     or new.instrument_key  is distinct from old.instrument_key
     or new.side            is distinct from old.side
     or new.opened_at       is distinct from old.opened_at
     or new.risk_pct        is distinct from old.risk_pct
     or new.risk_amount     is distinct from old.risk_amount
     or new.management_plan_id is distinct from old.management_plan_id
     or new.rr_objective    is distinct from old.rr_objective
     or new.be_trigger      is distinct from old.be_trigger
     or new.source          is distinct from old.source
     or new.external_ref    is distinct from old.external_ref
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at      is distinct from old.created_at then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:la identidad de una Operación se fija al nacer y no se corrige — el desenlace sí, la identidad nunca';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'cancelled' then
    raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:%:Cancelada es un estado terminal', old.status, new.status;
  end if;

  if old.status = 'open' and new.status = 'closed' then
    return new; -- cerrarOperacion
  end if;

  if old.status = 'open' and new.status = 'cancelled' then
    select count(*) into v_executed_count from public.trade_partials_executed where trade_id = new.id;
    if v_executed_count > 0 then
      raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:%:cancelación simple solo permitida sin parciales ejecutados (% ejecutados)', old.status, new.status, v_executed_count;
    end if;
    return new; -- cancelación simple
  end if;

  if old.status = 'closed' and new.status = 'cancelled' then
    return new; -- cancelación "fantasma", con reversión de capital gestionada aparte
  end if;

  raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:%:transición no permitida', old.status, new.status;
end;
$$;

-- H7 · Una Operación no se elimina. Cancelarla es una transición de dominio;
-- borrarla es hacer desaparecer un hecho. Hasta ahora una Operación **abierta**
-- se podía borrar sin más, y una cerrada se salvaba sólo por accidente: la FK
-- `account_capital_events.trade_id on delete set null` disparaba un UPDATE
-- sobre una tabla append-only y el trigger de aquélla lo rechazaba. Protección
-- colateral, no diseño.
create or replace function public.reject_trade_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'OPERATIONS_ERROR:TRADE_NOT_DELETABLE:una Operación no se elimina — cancelarla es una transición de dominio, borrarla haría desaparecer un hecho';
end;
$$;

create trigger on_trade_delete_reject
  before delete on public.trades
  for each row execute function public.reject_trade_delete();

-- ============================================================
-- 2 · INT-9 · `trade_partials_executed` — la evidencia no se reescribe.
--
-- Sobre esta tabla se calcula R_final. Se demostró que podía modificarse
-- (`pct_close` 50.00 → 99.00 sobre una Operación ya cerrada), borrarse entera,
-- y —lo que no estaba nombrado— **insertarse un parcial sobre una Operación
-- cerrada por la vía directa**, saltándose la comprobación de estado que
-- `registrar_parcial_ejecutado` sí hace. El resultado y su evidencia podían
-- dejar de concordar sin dejar rastro: esta tabla no tiene auditoría.
--
-- Mismo patrón que `reject_capital_event_mutation`, que la auditoría verificó
-- que sí resiste. El `AFTER INSERT` que emite `ParcialEjecutado` no se toca.
-- No se crea ninguna segunda fuente de verdad: sólo se prohíbe reescribir la
-- primera.
-- ============================================================
-- Una sola función para las dos tablas de parciales: la regla es idéntica y el
-- mensaje nombra la tabla concreta, en vez de dos funciones que dirían lo mismo.
create or replace function public.reject_trade_partial_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'OPERATIONS_ERROR:IMMUTABLE_EVIDENCE:%:los parciales de una Operación son la evidencia sobre la que se calcula R_final — no se reescriben ni se borran', tg_table_name;
end;
$$;

create trigger reject_partial_executed_mutation
  before update or delete on public.trade_partials_executed
  for each row execute function public.reject_trade_partial_mutation();

-- H5 · `trade_partials_planned` es el Plan materializado en la Operación —
-- y, cuando nace de una Intención, el `frozen_plan` hecho filas. Reescribirlo
-- después es reescribir lo que el trader planificó.
create trigger reject_partial_planned_mutation
  before update or delete on public.trade_partials_planned
  for each row execute function public.reject_trade_partial_mutation();

-- ============================================================
-- 3 · H1 · `account_risk_state` — el acumulador sólo avanza.
--
-- No tenía ningún trigger, y su RPC es `SECURITY INVOKER` **sin ninguna
-- comprobación de propiedad**: se apoyaba enteramente en RLS. Un usuario podía
-- fijar n = 999 y mean = 42 de un solo UPDATE.
--
-- No se rediseña Risk Engine ni se inventa ninguna fórmula: se protege la
-- invariante que su propio contrato ya tiene — control optimista de versión
-- (BUILD 003) — y el hecho de que el número de Operaciones acumuladas nunca
-- disminuye.
-- ============================================================
create or replace function public.enforce_account_risk_state_invariants() returns trigger
language plpgsql as $$
begin
  if new.account_id is distinct from old.account_id then
    raise exception 'RISK_ERROR:IMMUTABLE_ACCOUNT_ID:el acumulador pertenece a su Cuenta y no cambia de dueño';
  end if;

  if new.version <> old.version + 1 then
    raise exception 'RISK_ERROR:INVALID_VERSION:%→%:el acumulador solo avanza de una en una, con control optimista de versión', old.version, new.version;
  end if;

  if new.n < old.n then
    raise exception 'RISK_ERROR:ACCUMULATOR_REGRESSION:%→%:el número de Operaciones acumuladas nunca disminuye', old.n, new.n;
  end if;

  return new;
end;
$$;

create trigger on_account_risk_state_update_invariants
  before update on public.account_risk_state
  for each row execute function public.enforce_account_risk_state_invariants();

create or replace function public.reject_account_risk_state_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'RISK_ERROR:NOT_DELETABLE:el acumulador de una Cuenta no se borra';
end;
$$;

create trigger on_account_risk_state_delete_reject
  before delete on public.account_risk_state
  for each row execute function public.reject_account_risk_state_delete();

-- La RPC del acumulador pasa a `SECURITY DEFINER` **con la comprobación de
-- propiedad que hoy no tiene**: convertirla sin añadirla abriría un agujero
-- entre usuarios donde hoy no lo hay, porque era RLS quien lo cerraba.
-- El cuerpo se conserva **palabra por palabra** respecto de BUILD 003: misma
-- firma, mismas columnas de salida, mismo control optimista de versión, mismo
-- payload del evento. Los dos únicos cambios son la cláusula de seguridad y la
-- comprobación de propiedad que añade al principio. No se rediseña Risk Engine
-- ni se toca ninguna fórmula.
create or replace function public.risk_engine_apply_accumulator_update(
  p_account_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_expected_version bigint,
  p_new_n integer,
  p_new_mean numeric(8,4),
  p_new_m2 numeric(8,4)
) returns table(
  applied boolean,
  current_version bigint,
  current_n integer,
  current_mean numeric(8,4),
  current_m2 numeric(8,4)
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_version bigint;
begin
  -- BUILD 016B: bajo SECURITY DEFINER, RLS deja de filtrar. Hasta aquí esta
  -- función no comprobaba la propiedad **en absoluto** — se apoyaba entera en
  -- la política `for all` de la tabla. Convertirla sin añadir esto abriría un
  -- agujero entre usuarios donde hoy no lo hay.
  if not exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = auth.uid()) then
    raise exception 'RISK_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', p_account_id;
  end if;

  if exists (select 1 from public.risk_engine_processed_events where event_id = p_event_id) then
    return query
      select false, ars.version, ars.n, ars.mean, ars.m2
      from public.account_risk_state ars
      where ars.account_id = p_account_id;
    return;
  end if;

  update public.account_risk_state
  set n = p_new_n, mean = p_new_mean, m2 = p_new_m2, version = version + 1, updated_at = now()
  where account_id = p_account_id and version = p_expected_version
  returning version into v_new_version;

  if not found then
    return query
      select false, ars.version, ars.n, ars.mean, ars.m2
      from public.account_risk_state ars
      where ars.account_id = p_account_id;
    return;
  end if;

  insert into public.risk_engine_processed_events (event_id, account_id, event_type)
  values (p_event_id, p_account_id, p_event_type);

  insert into public.domain_events (event_type, account_id, payload)
  values (
    'AcumuladorActualizado',
    p_account_id,
    jsonb_build_object(
      'n', p_new_n,
      'mean', p_new_mean,
      'm2', p_new_m2,
      'version', v_new_version,
      'triggering_event_type', p_event_type
    )
  );

  return query select true, v_new_version, p_new_n, p_new_mean, p_new_m2;
end;
$$;

-- ============================================================
-- 4 · H8 · La Operación no destruye la historia de la Intención.
--
-- `management_intent_destinations.trade_id` se creó en B1 con `on delete
-- cascade`, cuando esa columna todavía no tenía uso. BUILD 017 la convirtió en
-- el vínculo histórico entre una decisión y su Operación, y con ello la cascada
-- pasó a ser destructiva: se verificó que borrar la Operación **elimina el
-- destino**, dejando una Intención con cero destinos —violando en silencio la
-- invariante que su propia función de creación garantiza—, la inmutabilidad de
-- la declaración (MI-2) y el carácter terminal del desenlace.
--
-- Con el trigger de H7 el borrado ya no ocurre; esta FK es la segunda cerradura
-- sobre la misma puerta, y la que sobrevive a que alguien retire la primera.
-- No cambia ninguna otra semántica de la relación.
-- ============================================================
alter table public.management_intent_destinations
  drop constraint management_intent_destinations_trade_id_fkey;

alter table public.management_intent_destinations
  add constraint management_intent_destinations_trade_id_fkey
  foreign key (trade_id) references public.trades(id) on delete restrict;

-- ============================================================
-- 5 · Superficie: sólo el contrato puede intentar escribir.
--
-- Las políticas pasan de `for all` a `for select`, y se revocan los privilegios
-- de escritura. A partir de aquí, la única forma de que una fila entre en estas
-- tablas es una RPC `SECURITY DEFINER`, que se ejecuta con los privilegios del
-- propietario y por tanto conserva su acceso.
--
-- `account_risk_state` conserva `insert` para `authenticated`: la provisión de
-- su fila la hace un trigger sobre `accounts` que corre como el invocante de
-- `crear_cuenta` (Funding, `SECURITY INVOKER`, fuera de alcance). No abre nada:
-- `account_id` es la clave primaria, así que un segundo INSERT sobre una Cuenta
-- que ya tiene acumulador choca contra ella, y toda Cuenta lo recibe al nacer.
-- ============================================================
drop policy trades_owner_rw on public.trades;
create policy trades_owner_read on public.trades
  for select using (auth.uid() = user_id);

drop policy partials_executed_owner_rw on public.trade_partials_executed;
create policy partials_executed_owner_read on public.trade_partials_executed
  for select using (exists (
    select 1 from public.trades t where t.id = trade_partials_executed.trade_id and t.user_id = auth.uid()));

drop policy partials_planned_owner_rw on public.trade_partials_planned;
create policy partials_planned_owner_read on public.trade_partials_planned
  for select using (exists (
    select 1 from public.trades t where t.id = trade_partials_planned.trade_id and t.user_id = auth.uid()));

drop policy account_risk_state_owner_rw on public.account_risk_state;
create policy account_risk_state_owner_read on public.account_risk_state
  for select using (exists (
    select 1 from public.accounts a where a.id = account_risk_state.account_id and a.user_id = auth.uid()));
create policy account_risk_state_owner_provision on public.account_risk_state
  for insert with check (exists (
    select 1 from public.accounts a where a.id = account_risk_state.account_id and a.user_id = auth.uid()));

revoke insert, update, delete on public.trades from authenticated;
revoke insert, update, delete on public.trade_partials_executed from authenticated;
revoke insert, update, delete on public.trade_partials_planned from authenticated;
revoke update, delete on public.account_risk_state from authenticated;
