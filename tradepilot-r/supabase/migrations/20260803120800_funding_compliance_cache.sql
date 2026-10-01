-- BUILD 006B — Caché de cumplimiento, propiedad de FUNDING MANAGEMENT
--
-- Archivo separado a propósito. La frontera de propiedad debe ser visible en
-- la estructura del repositorio, no solo en un comentario: `compliance_flag`
-- es un dato de la Cuenta, y la Cuenta pertenece a Funding Management
-- (SPEC-003 §4.1, §8.1). Rule Engine **nunca** lo escribe.
--
-- Resolución 1 del fundador (BUILD 006B), ahora principio permanente de
-- arquitectura: *"la actualización de cachés derivados corresponde siempre al
-- módulo propietario"*. Rule Engine evalúa, registra y emite; el propietario
-- del dato reacciona.
--
-- Resuelve también la contradicción interna de SPEC-004 (§1.2 punto 3
-- prohíbe escribir en otra entidad; §4.3 paso 7 lo pedía) en la dirección que
-- SPEC-003 §8.1 ya había fijado.

-- ============================================================
-- Dos columnas aditivas sobre `accounts`.
--
-- `compliance_flag_event_sequence` no aparece nombrada en SPEC-004, pero es
-- imprescindible para implementar su §14.2: sin guardar la secuencia del
-- evento que produjo el valor cacheado, no hay forma de comparar si una
-- actualización entrante es más reciente o es una llegada tardía.
-- ============================================================
alter table public.accounts
  add column compliance_flag text not null default 'unknown'
    check (compliance_flag in ('unknown','compliant','violated')),
  add column compliance_flag_event_sequence bigint not null default 0;

-- ============================================================
-- Consumidor propietario: reacciona a `ReglaIncumplida` del outbox.
--
-- **Compare-and-set sobre la secuencia del evento** (SPEC-004 §14.2): una
-- escritura tardía, con secuencia menor que la ya cacheada, se ignora para el
-- caché — pero su `rule_evaluation` sigue persistida íntegra para auditoría.
-- Esto evita necesitar un lock o una cola serializada por Cuenta, que
-- penalizaría a las cuentas más activas (contra I16).
--
-- SECURITY DEFINER: el trigger escribe en `accounts`, y su política RLS exige
-- `user_id = auth.uid()`. La escritura es legítima y del módulo propietario,
-- pero ocurre dentro de un trigger cuyo contexto es el del evento, no el de
-- una operación directa del usuario sobre su Cuenta — mismo patrón acotado
-- que `trades_audit_trigger` (BUILD 004).
-- ============================================================
create or replace function public.funding_aplicar_compliance_flag() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sequence bigint;
begin
  if new.event_type <> 'ReglaIncumplida' or new.account_id is null then
    return null;
  end if;

  v_sequence := coalesce((new.payload->>'triggering_event_sequence')::bigint, new.event_sequence);

  update public.accounts
  set compliance_flag = 'violated',
      compliance_flag_event_sequence = v_sequence
  where id = new.account_id
    and compliance_flag_event_sequence < v_sequence;

  return null;
end;
$$;

create trigger on_regla_incumplida_update_cache
  after insert on public.domain_events
  for each row execute function public.funding_aplicar_compliance_flag();
