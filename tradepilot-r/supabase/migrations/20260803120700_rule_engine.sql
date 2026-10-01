-- BUILD 006B — Rule Engine (SPEC-004)
--
-- El sistema de cumplimiento normativo. Interpreta reglas configurables
-- contra hechos YA CALCULADOS por otros módulos y produce un veredicto.
--
-- **Rule Engine es un motor de evaluación, nunca de ejecución.** Su única
-- escritura es su propio catálogo (`rule_*`). No escribe en `accounts`, ni en
-- `trades`, ni en `account_capital_events` — Resolución 1 del fundador
-- (BUILD 006B): "la actualización de cachés derivados corresponde siempre al
-- módulo propietario". `accounts.compliance_flag` pertenece a Funding
-- Management y se actualiza en su propia migración
-- (20260803120800_funding_compliance_cache.sql), nunca desde aquí.
--
-- Corrige una contradicción interna real de SPEC-004: su §1.2 punto 3
-- prohíbe modificar entidades de otro módulo, pero su §4.3 paso 7 pedía
-- actualizar `accounts.compliance_flag` desde este pipeline. SPEC-003 §8.1 ya
-- resolvía el conflicto en la dirección correcta y es la que se implementa.

-- ============================================================
-- RULE DEFINITIONS — la Library. Catálogo global y versionado.
--
-- `category` incluye 'calculation' como **categoría reservada** (Resolución 2
-- del fundador): durante este build no existe ningún evaluador, ninguna
-- Definition ni ningún camino de ejecución que pueda alcanzarla. El único
-- caso que SPEC-004 §3 nombraba (Profit Split) ya pertenece a Funding
-- Management por decisión de SPEC-003 §5.5, y está implementado ahí desde
-- BUILD 001 (`accounts.profit_split_pct`). Si algún día aparece un caso real
-- que lo justifique, se abre una ADR específica antes de implementarlo.
-- ============================================================
create table public.rule_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null default 1,
  name text not null,
  description text,
  archetype text not null check (archetype in (
    'static_threshold','dynamic_threshold','progress_to_target',
    'set_membership','time_window','time_window_external_source','composite'
  )),
  category text not null default 'compliance' check (category in ('compliance','calculation')),
  scope text not null check (scope in ('account_state','operation_event')),
  parameter_schema jsonb not null,
  depends_on_definition_key text,
  archetype_version text not null,
  created_at timestamptz not null default now(),
  unique (key, version)
);

alter table public.rule_definitions enable row level security;

-- La Library es un catálogo global curado por el equipo: legible por
-- cualquier usuario autenticado, nunca escribible desde la aplicación
-- (sin política de INSERT/UPDATE/DELETE, mismo criterio que audit_log).
create policy "rule_definitions_read_all" on public.rule_definitions
  for select using (auth.uid() is not null);

-- ============================================================
-- RULE PROFILES — propiedad de dominio: Empresa. CRUD: Rule Engine.
-- ============================================================
create table public.rule_profiles (
  id uuid primary key default gen_random_uuid(),
  prop_firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

alter table public.rule_profiles enable row level security;

create policy "rule_profiles_owner_rw" on public.rule_profiles
  for all using (
    exists (select 1 from public.prop_firms f where f.id = prop_firm_id and f.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.prop_firms f where f.id = prop_firm_id and f.user_id = auth.uid())
  );

-- ============================================================
-- RULE INSTANCES — una Definition + parámetros concretos, dentro de un Profile.
-- Referencia `rule_definition_id` (una versión concreta e inmutable), nunca
-- `key` a secas: es lo que impide que editar una Definition cambie
-- silenciosamente el significado de una Instance compuesta hace un año
-- (SPEC-004 §8).
-- ============================================================
create table public.rule_instances (
  id uuid primary key default gen_random_uuid(),
  rule_profile_id uuid not null references public.rule_profiles(id) on delete cascade,
  rule_definition_id uuid not null references public.rule_definitions(id),
  parameters jsonb not null,
  mode text not null default 'enforced' check (mode in ('enforced','shadow')),
  effective_from timestamptz,
  effective_until timestamptz,
  active_only_in_status text[],
  created_at timestamptz not null default now()
);

alter table public.rule_instances enable row level security;

create policy "rule_instances_owner_rw" on public.rule_instances
  for all using (
    exists (
      select 1 from public.rule_profiles p
      join public.prop_firms f on f.id = p.prop_firm_id
      where p.id = rule_profile_id and f.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.rule_profiles p
      join public.prop_firms f on f.id = p.prop_firm_id
      where p.id = rule_profile_id and f.user_id = auth.uid()
    )
  );

-- ============================================================
-- RULE PROFILE SNAPSHOTS — VO inmutable con identidad técnica (32 §1).
-- `frozen_instances` congela las Instances CON su Definition ya resuelta:
-- es lo que hace que una evaluación histórica siga siendo reproducible
-- aunque la Library y el Perfil cambien después (regla 13, patrón Snapshot).
-- ============================================================
create table public.rule_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_rule_profile_id uuid not null references public.rule_profiles(id),
  frozen_instances jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.rule_profile_snapshots enable row level security;

create policy "rule_profile_snapshots_owner_r" on public.rule_profile_snapshots
  for select using (
    exists (
      select 1 from public.rule_profiles p
      join public.prop_firms f on f.id = p.prop_firm_id
      where p.id = source_rule_profile_id and f.user_id = auth.uid()
    )
  );

create policy "rule_profile_snapshots_owner_i" on public.rule_profile_snapshots
  for insert with check (
    exists (
      select 1 from public.rule_profiles p
      join public.prop_firms f on f.id = p.prop_firm_id
      where p.id = source_rule_profile_id and f.user_id = auth.uid()
    )
  );

create or replace function public.reject_snapshot_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'rule_profile_snapshots es inmutable: % no permitido', TG_OP;
end;
$$;

create trigger rule_profile_snapshots_immutable
  before update or delete on public.rule_profile_snapshots
  for each row execute function public.reject_snapshot_mutation();

-- ============================================================
-- RULE EVALUATIONS — registro append-only (32 §3.11).
--
-- `evaluation_context` es la explicabilidad SIN IA: guarda los inputs
-- exactos usados, el arquetipo y su versión, de modo que cualquier veredicto
-- puede responder "qué regla, qué evidencia, por qué" con datos, nunca con
-- texto generado (SPEC-004 §9, patrón Explainable Quant).
--
-- `triggering_event_sequence` viene del Event Backbone (BUILD 006A) y es lo
-- que protege contra escrituras desordenadas (SPEC-004 §14.2).
-- ============================================================
create table public.rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  rule_profile_snapshot_id uuid not null references public.rule_profile_snapshots(id),
  rule_definition_key text not null,
  rule_definition_version int not null,
  archetype_version text not null,
  mode text not null check (mode in ('enforced','shadow')),
  trade_id uuid references public.trades(id),
  verdict text not null check (verdict in ('compliant','violated','unavailable')),
  margin numeric(18,4),
  triggering_event_id uuid not null,
  triggering_event_sequence bigint not null,
  evaluated_at timestamptz not null default now(),
  evaluation_context jsonb not null
);

alter table public.rule_evaluations enable row level security;

create policy "rule_evaluations_owner_r" on public.rule_evaluations
  for select using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create policy "rule_evaluations_owner_i" on public.rule_evaluations
  for insert with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create or replace function public.reject_rule_evaluation_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'rule_evaluations es append-only: % no permitido', TG_OP;
end;
$$;

create trigger rule_evaluations_append_only
  before update or delete on public.rule_evaluations
  for each row execute function public.reject_rule_evaluation_mutation();

create index rule_evaluations_account_idx on public.rule_evaluations(account_id, evaluated_at desc);
create index rule_evaluations_lookup_idx on public.rule_evaluations(account_id, rule_definition_key, triggering_event_sequence desc);

-- ============================================================
-- IDEMPOTENCIA — el mismo evento nunca produce dos evaluaciones distintas.
-- Mismo patrón ya validado bajo concurrencia real en BUILD 003
-- (risk_engine_processed_events).
-- ============================================================
create table public.rule_engine_processed_events (
  event_id uuid not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  processed_at timestamptz not null default now(),
  primary key (event_id, account_id)
);

alter table public.rule_engine_processed_events enable row level security;

create policy "rule_engine_processed_events_owner_r" on public.rule_engine_processed_events
  for select using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create policy "rule_engine_processed_events_owner_i" on public.rule_engine_processed_events
  for insert with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

-- ============================================================
-- PERSISTENCIA ATÓMICA DE UNA PASADA DE EVALUACIÓN
--
-- Una sola función = una sola transacción: comprueba idempotencia, inserta
-- todas las evaluaciones de la pasada, y emite `ReglaIncumplida` al outbox
-- por cada veredicto `violated` en modo `enforced`. Nunca deja una pasada a
-- medias.
--
-- **No escribe en `accounts`** — Resolución 1. El consumidor propietario
-- (Funding Management) reacciona al evento emitido.
-- ============================================================
create or replace function public.rule_engine_persistir_evaluacion(
  p_account_id uuid,
  p_event_id uuid,
  p_evaluaciones jsonb
)
returns table(persisted boolean, evaluaciones_insertadas integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_insertadas integer := 0;
  r record;
begin
  if exists (select 1 from public.rule_engine_processed_events
             where event_id = p_event_id and account_id = p_account_id) then
    return query select false, 0;
    return;
  end if;

  for r in
    select * from jsonb_to_recordset(p_evaluaciones) as x(
      rule_profile_snapshot_id uuid,
      rule_definition_key text,
      rule_definition_version int,
      archetype_version text,
      mode text,
      trade_id uuid,
      verdict text,
      margin text,
      triggering_event_sequence bigint,
      evaluation_context jsonb
    )
  loop
    insert into public.rule_evaluations (
      account_id, rule_profile_snapshot_id, rule_definition_key, rule_definition_version,
      archetype_version, mode, trade_id, verdict, margin,
      triggering_event_id, triggering_event_sequence, evaluation_context
    ) values (
      p_account_id, r.rule_profile_snapshot_id, r.rule_definition_key, r.rule_definition_version,
      r.archetype_version, r.mode, r.trade_id, r.verdict, r.margin::numeric(18,4),
      p_event_id, r.triggering_event_sequence, r.evaluation_context
    );
    v_insertadas := v_insertadas + 1;

    -- Solo 'enforced' emite. Una regla en 'shadow' se evalúa y se audita
    -- igual, pero nunca produce un incumplimiento visible (SPEC-004 §10).
    if r.verdict = 'violated' and r.mode = 'enforced' then
      insert into public.domain_events (event_type, account_id, payload)
      values (
        'ReglaIncumplida',
        p_account_id,
        jsonb_build_object(
          'rule_definition_key', r.rule_definition_key,
          'triggering_event_sequence', r.triggering_event_sequence
        )
      );
    end if;
  end loop;

  insert into public.rule_engine_processed_events (event_id, account_id)
  values (p_event_id, p_account_id);

  return query select true, v_insertadas;
end;
$$;

-- ============================================================
-- LECTURA — el Snapshot vigente y el estado de cumplimiento por regla.
-- Siempre síncronas y baratas (SPEC-004 §6): nunca disparan una evaluación.
-- ============================================================
create or replace function public.rule_engine_obtener_snapshot(p_account_id uuid)
returns public.rule_profile_snapshots
language sql
security invoker
set search_path = public
as $$
  select s.* from public.rule_profile_snapshots s
  join public.accounts a on a.rule_profile_snapshot_id = s.id
  where a.id = p_account_id and a.user_id = auth.uid();
$$;

create or replace function public.rule_engine_ultimas_evaluaciones(p_account_id uuid)
returns setof public.rule_evaluations
language sql
security invoker
set search_path = public
as $$
  select distinct on (rule_definition_key) e.*
  from public.rule_evaluations e
  join public.accounts a on a.id = e.account_id
  where e.account_id = p_account_id and a.user_id = auth.uid()
  order by rule_definition_key, triggering_event_sequence desc, evaluated_at desc;
$$;
