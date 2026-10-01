-- BUILD 017 / B8 + B7-mín — Management Intent: el vínculo con la Operación
--
-- Cierra el primer corte real del dominio. Hasta aquí, `crear_intencion_de_gestion`
-- escribía una decisión que nadie consumía: verificado en ejecución sobre Postgres
-- real, tras `registrar_operacion` el destino seguía en `pending` con `trade_id`
-- nulo. Intención y Operación eran dos actos sin relación.
--
-- **El vínculo no se inventa aquí: ya estaba construido.** B1 creó
-- `management_intent_destinations.trade_id`, el `CHECK` que ata estado y enlace
-- (`(state = 'materialized') = (trade_id is not null)`) y el índice parcial; B2
-- construyó la máquina de estados y su trigger. Lo único que faltaba era el
-- camino de escritura, y vive en `supabase/functions/sql/management_intent.sql`.
--
-- Esta migración aporta las dos piezas que ese camino necesita del esquema y
-- que no pueden vivir en una función:
--
--   1. `trades.instrument_key` — la identidad canónica materializada.
--   2. La inmutabilidad de los hechos que una Operación hereda de su Intención.
--
-- **Alcance: sólo eso.** Sin caducidad programada (B6), sin desenlace `rejected`
-- ni `discarded` (B9), sin tocar Risk Engine, Rule Engine ni Funding.

-- ============================================================
-- 1 · `trades.instrument_key` — identidad canónica de la Operación.
--
-- `management_intents.instrument_key` es el instrumento en forma **canónica**
-- (20260803120900 §instrument_key: "nunca el símbolo nativo de una plataforma").
-- `trades.symbol` es la representación con la que la Operación se registró.
-- Son dos conceptos distintos y **no se colapsan**: esta columna existe
-- precisamente para no tener que colapsarlos.
--
-- **Por qué faltaba y por qué se añade aquí**: sin ella, una Operación no puede
-- declarar a qué instrumento canónico pertenece, y la correspondencia entre la
-- Operación y el instrumento que su Intención decidió no sería demostrable por
-- ningún medio. Con ella, la correspondencia es verdadera por construcción: la
-- ruta desde Intención no acepta ningún instrumento del llamante y copia el de
-- la Intención.
--
-- **Aditiva y nullable a propósito.** Las Operaciones ya existentes y las que
-- nazcan por `registrar_operacion` (sin Intención) la dejan nula: no existe
-- ninguna autoridad que traduzca un símbolo libre a forma canónica, y esa
-- frontera —la resolución `instrument_native → instrument_key`— pertenece a
-- SPEC-008 (Trade Capture Engine), no a este build. Inventarla aquí sería
-- exactamente la sobreingeniería que 31 (TPOS) obliga a evitar.
-- ============================================================
alter table public.trades
  add column instrument_key text
    check (instrument_key is null or char_length(trim(instrument_key)) > 0);

comment on column public.trades.instrument_key is
  'Identidad canónica del instrumento, copiada de la Intención cuando la Operación nace de una. Nula cuando no procede de una Intención: la resolución símbolo nativo → clave canónica pertenece a SPEC-008, no a este módulo. Nunca es lo mismo que `symbol`.';

-- ============================================================
-- 2 · Hechos heredados: inmutables mientras la Operación esté vinculada.
--
-- Una Operación nacida de una Intención materializa una decisión ya tomada.
-- Editarla después hasta contradecir esa decisión rompería el vínculo causal
-- sin que nada lo registre: el destino es terminal y **no puede reflejar la
-- corrección** (B2: "un desenlace alcanzado no se reabre"). El resultado sería
-- un destino que afirma haber producido una Operación que ya no se le parece.
--
-- **Por qué en el trigger y no en la RPC**: un `BEFORE UPDATE` sobre `trades`
-- alcanza todos los caminos de escritura —`aplicar_edicion_operacion`,
-- `aplicar_cierre_operacion`, un `UPDATE` directo, y cualquier rol que salte
-- RLS—. Una comprobación dentro de una RPC alcanza uno solo. Es el mismo
-- razonamiento con el que B2 justificó sus propios triggers: la inmutabilidad
-- no puede depender de RLS, porque el propietario de la tabla está exento.
--
-- **Se extiende la función existente en vez de añadir un trigger nuevo**: la
-- invariante pertenece a la integridad de `trades`, y dos guardianes sobre la
-- misma tabla acabarían dependiendo de su orden de ejecución.
--
-- **Qué NO protege, deliberadamente**: `risk_amount` y todos los campos de
-- desenlace (`r_max`, `r_final`, `pnl_amount`, `closure_reason`,
-- `cierre_manual_rr`, `closed_at`, `notes`, `comments`). `risk_amount` no es un
-- hecho heredado: es un hecho propio de la Operación, calculado una sola vez
-- como Capital_en_ese_instante × Riesgo% (SPEC-002 §2.5, Invariante 3), y su
-- protección frente a escritura arbitraria pertenece a la frontera de BUILD
-- 016B, no a ésta. Los de desenlace son exactamente los que BUILD 018 necesita
-- poder escribir al cerrar y al editar.
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
  -- El `CHECK` de B1 garantiza que `state = 'materialized'` equivale a
  -- `trade_id is not null`; se comprueban los dos por legibilidad, y el índice
  -- parcial `management_intent_destinations_trade_idx` hace la búsqueda O(1).
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
