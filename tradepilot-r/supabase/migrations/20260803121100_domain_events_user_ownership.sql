-- BUILD 012B — Backbone de eventos: separar propiedad de sujeto
--
-- Ejecuta la revisión que BUILD 003 dejó programada por escrito junto a las
-- políticas de `domain_events`:
--
--   "Ningún evento emitido hoy tiene account_id nulo, así que la comprobación
--    de propiedad se exige siempre — se revisita si en el futuro existe un
--    evento genuinamente sin Cuenta asociada."
--
-- Ese evento ya existe: una Management Intent (BUILD 007-011) es un hecho que
-- **pertenece a un Usuario y concierne a N Cuentas**. No hay ningún valor de
-- `account_id` correcto para ella.
--
-- El defecto de fondo no era una columna que faltaba: era que `account_id`
-- cumplía dos funciones a la vez —ancla de propiedad y sujeto de dominio—
-- que para los siete eventos existentes coinciden y para una Intención no.
--
--   user_id     → PROPIEDAD. Siempre presente. Único ancla de RLS.
--   account_id  → SUJETO. Presente solo si el hecho concierne a una Cuenta.
--
-- Alinea `domain_events` con ADR-0001 §4.1 ("la propiedad es estrictamente
-- user_id → auth.users, y todas las políticas RLS del sistema se expresan
-- como user_id = auth.uid()") — era la única tabla que se salía.
--
-- **No cambia nada del backbone**: `event_sequence` y su orden total, el flag
-- `published`, `published_at`, la emisión por trigger AFTER sobre las tablas
-- fuente de verdad y el formato de los payloads existentes quedan intactos.
-- Y **ningún emisor se modifica**: los seis siguen insertando
-- `(event_type, account_id, payload)` exactamente igual.

-- ============================================================
-- 1. Ancla de propiedad, en tres pasos.
--
-- `add column ... not null` sin defecto fallaría sobre una tabla con filas;
-- la secuencia nullable → backfill → set not null es la única segura y es
-- estándar. El backfill alcanza al 100% de las filas existentes porque todas
-- tienen `account_id` no nulo — verificado antes de escribir esta migración.
-- ============================================================
alter table public.domain_events
  add column user_id uuid references auth.users(id) on delete cascade;

update public.domain_events e
set user_id = a.user_id
from public.accounts a
where a.id = e.account_id and e.user_id is null;

alter table public.domain_events alter column user_id set not null;

comment on column public.domain_events.user_id is
  'Ancla de propiedad. Siempre presente. Único criterio de RLS del outbox.';
comment on column public.domain_events.account_id is
  'Sujeto de dominio: la Cuenta a la que concierne el hecho. Nulo cuando el hecho pertenece al Usuario y no a una Cuenta concreta (p. ej. una Management Intent, que abarca N). Nunca es el ancla de propiedad.';

-- ============================================================
-- 2. Derivación automática — el mecanismo que hace innecesario tocar los seis
--    emisores existentes.
--
-- Verificado empíricamente contra Postgres real antes de escribirlo, no
-- supuesto: (a) un trigger BEFORE puede satisfacer una columna NOT NULL que
-- el INSERT no nombró, porque NOT NULL se comprueba después de los triggers
-- BEFORE; (b) el WITH CHECK de RLS se evalúa sobre la fila **ya modificada**
-- por el trigger, de modo que la política sobre `user_id` valida el valor
-- derivado y no el nulo original.
--
-- Deliberadamente SECURITY INVOKER, no DEFINER: si el emisor no puede ver la
-- Cuenta, `user_id` queda nulo y NOT NULL rechaza la fila. Fallo ruidoso,
-- nunca silencioso — y sin abrir ninguna vía de escalada de privilegios.
-- ============================================================
create or replace function public.domain_events_derive_owner() returns trigger
language plpgsql as $$
declare
  v_account_owner uuid;
begin
  if new.account_id is not null then
    select a.user_id into v_account_owner from public.accounts a where a.id = new.account_id;
  end if;

  if new.user_id is null then
    -- Emisor clásico: aporta la Cuenta, la propiedad se deriva de ella.
    new.user_id := v_account_owner;
    return new;
  end if;

  -- Ambos campos aportados: deben ser coherentes. Sin esta comprobación, un
  -- evento podría reclamar propiedad de un Usuario mientras referencia la
  -- Cuenta de otro, y los dos campos que esta migración separa dejarían de
  -- significar lo mismo.
  if new.account_id is not null and v_account_owner is distinct from new.user_id then
    raise exception 'EVENT_ERROR:OWNER_SUBJECT_MISMATCH:el user_id del evento no es el propietario de su account_id';
  end if;

  return new;
end;
$$;

create trigger on_domain_event_derive_owner
  before insert on public.domain_events
  for each row execute function public.domain_events_derive_owner();

-- ============================================================
-- 3. RLS anclada exclusivamente en `user_id`.
--
-- La política anterior de SELECT trataba `account_id is null` como visible
-- para **todos** los usuarios autenticados. Era inofensiva mientras ningún
-- emisor produjera nulos, y una fuga en el instante en que alguno lo hiciera.
-- Anclar en `user_id` la cierra por construcción: ya no existe ninguna rama
-- de nulo que interpretar.
-- ============================================================
drop policy "domain_events_owner_r" on public.domain_events;
drop policy "domain_events_owner_i" on public.domain_events;

create policy "domain_events_owner_r" on public.domain_events
  for select using (user_id = auth.uid());

create policy "domain_events_owner_i" on public.domain_events
  for insert with check (user_id = auth.uid());

-- Todo acceso al outbox filtra ahora por `user_id`; sin este índice, cada
-- comprobación de RLS recorrería la tabla entera.
create index domain_events_user_idx on public.domain_events(user_id, event_sequence);
