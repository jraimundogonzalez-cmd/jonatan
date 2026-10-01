-- BUILD 004 — Operations Engine + Management Plans (SPEC-002, 21.5 §3.4, 21 §3).
--
-- Ninguna fórmula matemática vive aquí. `r_final`/`pnl_amount` siempre llegan
-- ya calculados desde @tradepilot/risk-engine (que a su vez invoca
-- @tradepilot/quant-engine) — este esquema solo persiste hechos ya ocurridos
-- y hechos ya calculados, nunca deriva R por sí mismo (SPEC-002 §1.4 punto 1).

-- ============================================================
-- MANAGEMENT_PLANS — la plantilla reutilizable (Entity, 21.5 §3.4)
-- Nombre null = Plan anónimo, "existe igualmente como registro" (21.5 §3.4)
-- pero se filtra de cualquier listado de "planes guardados para reutilizar".
-- be_trigger es metadata de eco/auditoría — @tradepilot/quant-engine ya lo
-- documenta como tal (core/types.ts: "no interviene en el cálculo, se
-- conserva únicamente para eco/auditoría") — nunca se lee para derivar R.
-- ============================================================
create table public.management_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text,
  rr_objective numeric(8,4) not null check (rr_objective > 0),
  be_trigger text not null default 'NONE' check (be_trigger in ('NONE','AFTER_NTH_PARTIAL','CUSTOM_LEVEL')),

  -- "Condiciones de ejecución" (antes "Reglas" — 21 §1.3, renombrado para no
  -- colisionar con las reglas de la prop firm de Rule Engine) y "Etiqueta de
  -- riesgo" (antes "Perfil de gestión", incluye λ opcional propio del Plan,
  -- 21 §3) son metadata puramente descriptiva — no participan en ningún
  -- cálculo de R_final, así que no forman parte del PlanSnapshot obligatorio
  -- de `trades` (ver comentario junto a `trades.management_plan_id` más
  -- abajo): renombrar/editar estos campos en un Plan guardado nunca reescribe
  -- ningún hecho matemático de una Operación pasada, exactamente el mismo
  -- precedente que `accounts.prop_firm_id` (FK leída en vivo, nunca
  -- snapshotada, porque el nombre de una Empresa no es un hecho histórico).
  condiciones_ejecucion text,
  etiqueta_riesgo text,
  lambda_risk_aversion numeric(6,4),

  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.management_plans enable row level security;

create policy "management_plans_owner_rw" on public.management_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index management_plans_user_idx on public.management_plans(user_id) where status = 'active';

create table public.management_plan_partials (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.management_plans(id) on delete cascade,
  sequence smallint not null check (sequence between 1 and 5),
  rr_level numeric(8,4) not null,
  pct_close numeric(5,2) not null check (pct_close > 0 and pct_close <= 100),
  unique (plan_id, sequence)
);

alter table public.management_plan_partials enable row level security;

create policy "management_plan_partials_owner_rw" on public.management_plan_partials
  for all using (
    exists (select 1 from public.management_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

-- ============================================================
-- TRADES — Aggregate Root (SPEC-002). DDL base de docs/04 §3, con los tres
-- hallazgos de SPEC-002 §8.3 ya incorporados desde el origen (Cancelada,
-- idempotency_key, source/external_ref) en vez de aplicarse como ALTER
-- retroactivo — no hay datos de producción todavía bajo el esquema antiguo.
-- ============================================================
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,

  symbol text not null,
  side text not null check (side in ('long','short')),
  opened_at timestamptz not null,
  closed_at timestamptz,

  -- Riesgo%/Riesgo€ son hechos de la Operación, no del Plan (02 §1: "Riesgo%
  -- asumido en la operación" — 21 §3 nunca los lista como campo del Plan).
  -- risk_amount se calcula y persiste una sola vez, en el momento de
  -- creación (Capital_en_ese_instante × Riesgo%) — nunca se recalcula si el
  -- capital de la Cuenta cambia después (SPEC-002 §2.5 invariante 3).
  risk_pct numeric(5,2) not null check (risk_pct > 0),
  risk_amount numeric(18,4) not null,

  -- --- PlanSnapshot (regla 13, patrón Snapshot) — los únicos campos de los
  -- que depende calcularRFinal, congelados en el momento de crear la
  -- Operación, nunca vueltos a leer desde management_plans. Editar el Plan
  -- después nunca altera una Operación ya registrada (SPEC-002 §1.4 punto 4).
  management_plan_id uuid not null references public.management_plans(id),
  rr_objective numeric(8,4) not null check (rr_objective > 0),
  be_trigger text not null check (be_trigger in ('NONE','AFTER_NTH_PARTIAL','CUSTOM_LEVEL')),

  r_max numeric(8,4),
  r_final numeric(8,4),
  pnl_amount numeric(18,4),

  closure_reason text check (closure_reason in ('STOP_LOSS','BREAK_EVEN','TAKE_PROFIT_FULL','MANUAL_CLOSE')),
  cierre_manual_rr numeric(8,4),

  time_in_market_sec integer,
  notes text,
  comments text,

  -- Cancelada: hallazgo SPEC-002 §8.3.1 — sin este estado no hay forma de
  -- "deshacer" una operación fantasma sin borrar un registro financiero
  -- (15 §3.4) o contaminar estadísticas para siempre con datos falsos.
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  cancellation_reason text,

  -- Idempotencia: hallazgo SPEC-002 §8.3.2 — un reintento de red con la
  -- misma clave nunca produce una segunda fila (índice único parcial abajo).
  idempotency_key uuid,

  -- Preparación de importación futura: hallazgo SPEC-002 §8.3.3/§5.7 — sin
  -- esto, el primer conector real exigiría una migración retroactiva de todo
  -- el histórico manual. Ningún Import Adapter se especifica todavía aquí.
  source text not null default 'manual',
  external_ref text,

  created_at timestamptz not null default now()
);

alter table public.trades enable row level security;

create policy "trades_owner_rw" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index trades_account_idx on public.trades(account_id, opened_at desc);
create index trades_user_idx on public.trades(user_id, opened_at desc);
create index trades_symbol_idx on public.trades(symbol);
create index trades_management_plan_idx on public.trades(management_plan_id);
-- Operaciones espejo en varias cuentas son un caso legítimo, no un duplicado
-- a prevenir (SPEC-002 §8.4.2) — la idempotencia es siempre por Cuenta.
create unique index trades_idempotency_idx on public.trades(account_id, idempotency_key) where idempotency_key is not null;
create unique index trades_external_ref_idx on public.trades(account_id, source, external_ref) where external_ref is not null;

-- Cancelación simple (Abierta, 0 parciales) exige cancellation_reason; la
-- comprobación de "0 parciales ejecutados" vive en el trigger de máquina de
-- estados de abajo, que sí tiene acceso a trade_partials_executed.
alter table public.trades add constraint trades_cancellation_reason_required
  check (status <> 'cancelled' or cancellation_reason is not null);
alter table public.trades add constraint trades_manual_close_requires_level
  check (closure_reason <> 'MANUAL_CLOSE' or cierre_manual_rr is not null);

-- ============================================================
-- PARCIALES: planificados (snapshot por Operación) vs. ejecutados (hecho)
-- ============================================================
create table public.trade_partials_planned (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sequence smallint not null check (sequence between 1 and 5),
  rr_level numeric(8,4) not null,
  pct_close numeric(5,2) not null check (pct_close > 0 and pct_close <= 100),
  unique (trade_id, sequence)
);

create table public.trade_partials_executed (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sequence smallint not null check (sequence between 1 and 5),
  rr_level numeric(8,4) not null,
  pct_close numeric(5,2) not null check (pct_close > 0 and pct_close <= 100),
  executed_at timestamptz not null,
  unique (trade_id, sequence)
);

alter table public.trade_partials_planned enable row level security;
alter table public.trade_partials_executed enable row level security;

create policy "partials_planned_owner_rw" on public.trade_partials_planned
  for all using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));
create policy "partials_executed_owner_rw" on public.trade_partials_executed
  for all using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));

-- ============================================================
-- ACCOUNT_CAPITAL_EVENTS — extensión: el cierre/edición/cancelación de una
-- Operación mueve capital reutilizando el ledger y el trigger de recálculo
-- que Funding Management ya construyó en BUILD 001 (recompute_account_capital,
-- SUM(amount) sobre el histórico) — cero fórmulas nuevas, un event_type más.
-- `trade_id` es nuevo: sin él, ningún evento 'trade_pnl' sería trazable hasta
-- la Operación que lo originó.
-- ============================================================
alter table public.account_capital_events add column trade_id uuid references public.trades(id) on delete set null;
alter table public.account_capital_events drop constraint account_capital_events_event_type_check;
alter table public.account_capital_events add constraint account_capital_events_event_type_check
  check (event_type in ('initial', 'deposit', 'withdrawal', 'payout', 'reset', 'adjustment', 'trade_pnl'));

create index account_capital_events_trade_idx on public.account_capital_events(trade_id) where trade_id is not null;

-- ============================================================
-- AUDIT_LOG (15 §3.4) — append-only, alimentado exclusivamente por el
-- trigger de abajo. Deliberadamente sin policy de insert/update/delete para
-- "authenticated": la propia spec de 15 §3.4 exige que solo un trigger
-- escriba aquí, nunca la aplicación directamente — así ninguna edición de
-- `trades` puede saltarse la auditoría por un bug de la capa de aplicación
-- (SPEC-002 §2.5 invariante 5: "no existe una edición silenciosa").
-- ============================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  diff jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log_owner_read" on public.audit_log
  for select using (auth.uid() = user_id);

create or replace function public.audit_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log es append-only: % no permitido', TG_OP;
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- SECURITY DEFINER acotado a esta única función — el resto del esquema sigue
-- protegido por RLS bajo SECURITY INVOKER; esta es la única vía de escritura
-- a audit_log, precisamente porque "authenticated" no tiene grant de INSERT.
create or replace function public.trades_audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (user_id, entity_type, entity_id, action, diff)
  values (new.user_id, 'trade', new.id, 'update', jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return new;
end;
$$;

create trigger on_trade_update_audit
  after update on public.trades
  for each row
  when (to_jsonb(old) is distinct from to_jsonb(new))
  execute function public.trades_audit_trigger();

-- ============================================================
-- INVARIANTES DE ESCRITURA — enforcement a nivel de base de datos (SPEC-002
-- §2.3/§2.5), no solo en la capa de aplicación: ninguna vía de escritura (RPC
-- de hoy, REST directo de PostgREST, o un bug futuro) puede violarlas,
-- mismo principio que ya protege el append-only de audit_log/
-- risk_engine_processed_events. Dos invariantes distintas en un único
-- trigger porque ambas se evalúan sobre el mismo par old/new de cada UPDATE:
--   1. `account_id` es inmutable tras la creación, sin excepción (invariante 1)
--      — "editar account_id no es una corrección, es una Operación distinta".
--   2. Transición de `status` — solo cuando `status` realmente cambia.
--      `editarOperacion` nunca cambia `status` (FORBIDDEN_STATUS_EDIT,
--      §5.6) — al no tocar esa columna, la comprobación 2 ni se evalúa.
-- ============================================================
create or replace function public.enforce_trade_invariants() returns trigger
language plpgsql as $$
declare
  v_executed_count integer;
begin
  if new.account_id <> old.account_id then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_ACCOUNT_ID:account_id no puede editarse — registra una Operación distinta';
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

create trigger on_trade_write_invariants
  before update on public.trades
  for each row execute function public.enforce_trade_invariants();
