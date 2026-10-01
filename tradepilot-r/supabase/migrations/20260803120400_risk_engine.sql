-- BUILD 003 — Risk Engine: estado agregado por Cuenta, idempotencia y outbox
-- de eventos de dominio (SPEC-001 §5.3, 22.5 §2.3, 26 §8).
--
-- Ninguna de estas tres tablas contiene una fórmula matemática — son
-- persistencia pura. El cálculo real (Welford, drawdown) vive exclusivamente
-- en @tradepilot/quant-engine (TypeScript); Postgres solo aplica una
-- actualización de fila ya calculada, de forma atómica.

-- ============================================================
-- ACCOUNT_RISK_STATE — WelfordAccumulator persistido por Cuenta
-- (SPEC-001 §5.3: "el WelfordAccumulator es el objeto que Risk Engine
-- persiste por Cuenta... y actualiza con O(1) por operación cerrada").
-- `mean`/`m2` son numeric(8,4) — la escala de RValue (SPEC-001 §3.1), no de
-- Money. `version` es concurrencia optimista pura, sin significado de dominio.
-- ============================================================
create table public.account_risk_state (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  n integer not null default 0 check (n >= 0),
  mean numeric(8,4) not null default 0,
  m2 numeric(8,4) not null default 0,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.account_risk_state enable row level security;

create policy "account_risk_state_owner_rw" on public.account_risk_state
  for all using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

-- ============================================================
-- RISK_ENGINE_PROCESSED_EVENTS — ledger de idempotencia
-- Protección frente a doble procesamiento: un event_id ya visto nunca vuelve
-- a aplicarse, sin importar cuántas veces se reintente la entrega.
-- ============================================================
create table public.risk_engine_processed_events (
  event_id uuid primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.risk_engine_processed_events enable row level security;

create policy "risk_engine_processed_events_owner_r" on public.risk_engine_processed_events
  for select using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

-- Hallazgo real (encontrado ejecutando la migración contra un Postgres real
-- con un rol no-superusuario, no probando solo por inspección): sin política
-- de INSERT, el propio INSERT interno de risk_engine_apply_accumulator_update
-- fallaba con "new row violates row-level security policy" — la función es
-- SECURITY INVOKER a propósito (para que la RLS de account_risk_state
-- proteja el UPDATE), pero eso significa que RLS también rige cualquier otra
-- sentencia que ejecute como el rol que llama, incluida esta. No hay
-- política de UPDATE/DELETE — es un ledger append-only por diseño.
create policy "risk_engine_processed_events_owner_i" on public.risk_engine_processed_events
  for insert with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create index risk_engine_processed_events_account_idx on public.risk_engine_processed_events(account_id);

-- ============================================================
-- DOMAIN_EVENTS — outbox transaccional
-- Sin cola de mensajería real todavía (25 §… deja pg_boss/Inngest/Trigger.dev
-- como decisión abierta) — este outbox es la vía honesta de "emitir un
-- evento de dominio" sin inventar una infraestructura que no existe: el
-- evento queda persistido atómicamente junto con la actualización que lo
-- origina, listo para que un futuro worker lo consuma (`published = false`).
-- ============================================================
create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  account_id uuid references public.accounts(id) on delete cascade,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  published boolean not null default false,
  published_at timestamptz
);

alter table public.domain_events enable row level security;

create policy "domain_events_owner_r" on public.domain_events
  for select using (
    account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

-- Mismo hallazgo que en risk_engine_processed_events: el INSERT interno de
-- risk_engine_apply_accumulator_update necesita su propia política, RLS no
-- se salta por estar dentro de una función SECURITY INVOKER. Ningún evento
-- emitido hoy tiene account_id nulo, así que la comprobación de propiedad se
-- exige siempre — se revisita si en el futuro existe un evento genuinamente
-- sin Cuenta asociada.
create policy "domain_events_owner_i" on public.domain_events
  for insert with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create index domain_events_unpublished_idx on public.domain_events(occurred_at) where published = false;

-- ============================================================
-- RISK_ENGINE_APPLY_ACCUMULATOR_UPDATE
--
-- Único punto de escritura del acumulador. Atómico: idempotencia
-- (risk_engine_processed_events) + concurrencia optimista (version) + emisión
-- del evento de dominio, las tres en la misma transacción implícita de la
-- función — nunca una escritura parcial entre ellas.
--
-- SECURITY INVOKER (no DEFINER): la RLS de account_risk_state se aplica tal
-- cual al UPDATE de dentro de esta función — un intento sobre una Cuenta que
-- no pertenece al llamador no actualiza ninguna fila, igual que si el
-- llamador hubiera perdido la carrera de concurrencia (el cliente TypeScript
-- lo trata como ACCOUNT_NOT_FOUND al no encontrar fila alguna al releer).
-- ============================================================
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
security invoker
set search_path = public
as $$
declare
  v_new_version bigint;
begin
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
-- RISK_ENGINE_OBTENER_ESTADO — lectura simple, RLS ya filtra la propiedad
-- ============================================================
create or replace function public.risk_engine_obtener_estado(p_account_id uuid)
returns public.account_risk_state
language sql
security invoker
set search_path = public
as $$
  select * from public.account_risk_state where account_id = p_account_id;
$$;

create or replace function public.risk_engine_ya_procesado(p_event_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select exists(select 1 from public.risk_engine_processed_events where event_id = p_event_id);
$$;

-- ============================================================
-- Provisión atómica: toda Cuenta nueva nace con su fila de estado de riesgo
-- (n=0, mean=0, m2=0, version=0) — evita que el camino de lectura tenga que
-- manejar nunca "la Cuenta existe pero no tiene estado de riesgo todavía".
-- ============================================================
create or replace function public.risk_engine_provision_on_account_created()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.account_risk_state (account_id) values (new.id);
  return new;
end;
$$;

create trigger on_account_created_provision_risk_state
  after insert on public.accounts
  for each row execute function public.risk_engine_provision_on_account_created();
