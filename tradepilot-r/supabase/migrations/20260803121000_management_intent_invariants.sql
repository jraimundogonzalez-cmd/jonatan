-- BUILD 011 / B2 — Management Intent: integridad e inmutabilidad
--
-- Capa 2 de las invariantes que B1 solo pudo proteger con RLS. Es el hallazgo
-- metodológico de BUILD 003 aplicado por cuarta vez: los superusuarios y el
-- propietario de una tabla están exentos de RLS sin excepción, así que la
-- inmutabilidad no puede depender de ella. B1 cerró la escritura desde
-- `authenticated` (sin política de INSERT/UPDATE/DELETE); estos triggers
-- cierran la mutación frente a cualquier rol que salte RLS.
--
-- **Alcance de este build (B2 de BUILD 009): solo integridad.** Sin emisión de
-- eventos (B3), sin tocar `accounts` (B4), sin funciones de creación (B5),
-- sin caducidad programada (B6), sin lecturas (B7), sin reclamación (B8) ni
-- desenlace (B9).
--
-- Sigue el precedente de `enforce_trade_invariants` (BUILD 004): una sola
-- función por tabla que agrupa inmutabilidad y transición, y el formato de
-- error `MODULO_ERROR:CODIGO:detalle` ya usado por FUNDING_ERROR y
-- OPERATIONS_ERROR.

-- ============================================================
-- MI-2 · Una Intención es inmutable desde su emisión.
--
-- Rechazo absoluto: ninguna columna de una Intención emitida admite cambio.
-- "Cambiar de opinión crea una Intención nueva" — nunca reescribe la anterior,
-- que es el registro de lo que el trader aprobó de verdad.
--
-- Se rechaza UPDATE, **no DELETE**: MI-2 gobierna la mutación, y B1 construyó
-- deliberadamente las cascadas `on delete` que hoy dependen de que el borrado
-- siga siendo posible. Convertir una Intención en indestructible es una
-- decisión distinta, no incluida en el alcance de B2 (ver informe, riesgo R2).
-- ============================================================
create or replace function public.reject_management_intent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'INTENT_ERROR:IMMUTABLE_INTENT:una Intención es inmutable desde su emisión — cambiar de opinión crea una Intención nueva';
end;
$$;

create trigger on_management_intent_update_reject
  before update on public.management_intents
  for each row execute function public.reject_management_intent_mutation();

-- ============================================================
-- Destinos: declaración inmutable + máquina de estados.
--
-- Un destino es la única pieza mutable del agregado, y solo en un sentido muy
-- concreto: **su declaración es inmutable y solo su desenlace transiciona**,
-- una única vez, hacia un estado terminal. Misma semántica monótona que
-- `cancelled` en `trades`.
--
--   pending ──► sent ──► materialized
--      │           └───► rejected
--      ├──► expired      (SOLO desde pending)
--      └──► discarded    (SOLO desde pending)
--
-- **Por qué la caducidad solo dispara desde `pending`**: si un destino cuya
-- orden ya salió pudiera caducar, un fill tardío llegaría a una Operación
-- real —que I14 obliga a registrar igualmente— sin ningún destino al que
-- vincularla, y se perdería el vínculo causal en silencio. Es la única
-- topología que preserva a la vez I14 y la caducidad de MI-3.
-- ============================================================
create or replace function public.enforce_intent_destination_invariants() returns trigger
language plpgsql as $$
begin
  -- 1. La declaración es parte de la decisión: nunca cambia.
  if new.id is distinct from old.id
     or new.intent_id is distinct from old.intent_id
     or new.account_id is distinct from old.account_id
     or new.frozen_plan is distinct from old.frozen_plan
     or new.risk_transformation is distinct from old.risk_transformation
     or new.risk_cap_applied is distinct from old.risk_cap_applied
     or new.risk_cap_reason is distinct from old.risk_cap_reason
     or new.created_at is distinct from old.created_at then
    raise exception 'INTENT_ERROR:IMMUTABLE_DECLARATION:la declaración de un destino es inmutable — solo el desenlace transiciona';
  end if;

  -- 2. Un desenlace alcanzado no se reabre, ni siquiera para corregir la
  --    Operación asociada: es un hecho, no un borrador.
  if old.state in ('materialized','rejected','expired','discarded') then
    raise exception 'INTENT_ERROR:TERMINAL_STATE:%:un desenlace alcanzado no se reabre', old.state;
  end if;

  -- 3. Sin cambio de estado no queda nada que validar: el CHECK de B1 ya
  --    impide un `trade_id` fuera de 'materialized'.
  if old.state = new.state then
    return new;
  end if;

  if old.state = 'pending' and new.state in ('sent','expired','discarded') then
    return new;
  end if;

  if old.state = 'sent' and new.state in ('materialized','rejected') then
    return new;
  end if;

  raise exception 'INTENT_ERROR:INVALID_STATE_TRANSITION:%:%:transición no permitida', old.state, new.state;
end;
$$;

create trigger on_intent_destination_write_invariants
  before update on public.management_intent_destinations
  for each row execute function public.enforce_intent_destination_invariants();
