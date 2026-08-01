# 04 · Esquema de base de datos

*Voz: Ingeniero Full Stack Senior + Arquitecto de software*

## 1. Decisiones de modelado (antes del DDL)

1. **Multi-tenant con Row-Level Security (RLS), esquema único.** Justificación en 01 §3.5: escalar a miles de usuarios × cientos de cuentas con schema-per-tenant es operacionalmente inviable (migraciones, backups, conexiones). RLS de Postgres da aislamiento verificado a nivel de fila con una sola base de datos, es el patrón estándar de Supabase y escala sin fricción operativa hasta varios millones de filas por tabla con los índices correctos.
2. **Dinero y R siempre en `numeric`, nunca `float`/`double`** (01 §3.4). `numeric(18,4)` para € y `numeric(8,4)` para valores de R (soporta decimales como 5.7234R sin error de redondeo acumulado).
3. **Empresa de fondeo es una entidad de catálogo por usuario**, no un enum fijo — el usuario puede tener FTMO, Topstep, Apex, 5%ers, FundedNext o una entrada custom ("capital propio" también es una "empresa" con `is_personal = true` para no bifurcar el modelo de datos).
4. **Los parciales viven en tabla propia**, no como columnas `partial_1_rr, partial_2_rr...` — el brief pide hasta 5 pero el modelo matemático (02) es genérico para `n` parciales; una tabla relacional evita rigidez y permite analítica agregada (`GROUP BY`) directamente en SQL.
5. **Snapshot inmutable de resultado vs. configuración planificada.** Se guarda tanto la configuración de parciales *planificada* como el resultado *real* (qué parciales se ejecutaron de verdad) — son conceptualmente distintos y ambos son necesarios para que el optimizador aprenda (02 §6).

## 2. Diagrama de entidades (resumen)

```
auth.users (Supabase)
   └─ profiles (1:1)
        └─ prop_firms (1:N)
             └─ accounts (1:N)
                  ├─ account_rules (1:1)
                  └─ trades (1:N)
                       ├─ trade_partials_planned (1:N)
                       ├─ trade_partials_executed (1:N)
                       ├─ trade_screenshots (1:N)
                       └─ ai_recommendations (1:N)
        └─ user_stat_buckets (1:N, cache de posteriors bayesianos)
```

## 3. DDL

```sql
-- ============================================================
-- PROFILES (extiende auth.users de Supabase)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_risk_pct numeric(5,2) default 1.00,
  optimizer_lambda numeric(4,2) default 0.25,     -- aversión a varianza, ver 02 §5.2
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_rw" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- PROP FIRMS (catálogo por usuario; incluye "capital propio")
-- ============================================================
create table public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,                              -- "FTMO", "Topstep", "Capital propio"...
  is_personal boolean not null default false,
  color text,                                       -- para UI (heatmaps, badges)
  created_at timestamptz not null default now()
);

alter table public.prop_firms enable row level security;

create policy "prop_firms_owner_rw" on public.prop_firms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- ACCOUNTS
-- ============================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prop_firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null,                               -- "Cuenta 100k #2"
  initial_capital numeric(18,4) not null,
  current_capital numeric(18,4) not null,
  currency char(3) not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "accounts_owner_rw" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index accounts_user_idx on public.accounts(user_id);
create index accounts_prop_firm_idx on public.accounts(prop_firm_id);

-- ============================================================
-- ACCOUNT RULES (límites de la prop firm: drawdown diario/total, etc.)
-- ============================================================
create table public.account_rules (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  max_daily_drawdown_pct numeric(5,2),
  max_total_drawdown_pct numeric(5,2),
  profit_target_pct numeric(5,2),
  max_position_risk_pct numeric(5,2)
);

alter table public.account_rules enable row level security;

create policy "account_rules_owner_rw" on public.account_rules
  for all using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

-- ============================================================
-- TRADES
-- ============================================================
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,

  symbol text not null,                             -- "EURUSD", "NAS100", "XAUUSD"...
  side text not null check (side in ('long','short')),
  opened_at timestamptz not null,
  closed_at timestamptz,

  risk_pct numeric(5,2) not null,
  risk_amount numeric(18,4) not null,               -- Riesgo€, ver 02 §1
  rr_objective numeric(8,4) not null,                -- RR_obj decimal libre

  r_max numeric(8,4),                                -- recorrido máximo a favor observado (02 §1)
  r_final numeric(8,4),                              -- resultado ponderado final (02 §2)
  pnl_amount numeric(18,4),                          -- Beneficio_real en €

  time_in_market_sec integer,
  notes text,
  comments text,

  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

alter table public.trades enable row level security;

create policy "trades_owner_rw" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index trades_account_idx on public.trades(account_id, opened_at desc);
create index trades_user_idx on public.trades(user_id, opened_at desc);
create index trades_symbol_idx on public.trades(symbol);

-- ============================================================
-- PARCIALES: planificados vs. ejecutados (ver §1.5)
-- ============================================================
create table public.trade_partials_planned (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sequence smallint not null,                        -- 1..5
  rr_level numeric(8,4) not null,
  pct_close numeric(5,2) not null check (pct_close > 0 and pct_close <= 100),
  unique (trade_id, sequence)
);

create table public.trade_partials_executed (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sequence smallint not null,
  rr_level numeric(8,4) not null,
  pct_close numeric(5,2) not null check (pct_close > 0 and pct_close <= 100),
  executed_at timestamptz,
  unique (trade_id, sequence)
);

alter table public.trade_partials_planned enable row level security;
alter table public.trade_partials_executed enable row level security;

create policy "partials_planned_owner_rw" on public.trade_partials_planned
  for all using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));
create policy "partials_executed_owner_rw" on public.trade_partials_executed
  for all using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));

-- ============================================================
-- CAPTURAS
-- ============================================================
create table public.trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  storage_path text not null,                        -- Supabase Storage bucket path
  ai_detected_entry numeric(18,6),
  ai_detected_stop numeric(18,6),
  ai_detected_tp numeric(18,6),
  ai_detected_rr numeric(8,4),
  ai_confirmed_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.trade_screenshots enable row level security;

create policy "screenshots_owner_rw" on public.trade_screenshots
  for all using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));

-- ============================================================
-- RECOMENDACIONES DE IA (auditoría de explicabilidad)
-- ============================================================
create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references public.trades(id) on delete cascade,   -- null si es exploración libre en el optimizador
  user_id uuid not null references auth.users(id) on delete cascade,
  input_snapshot jsonb not null,                      -- inputs de la calculadora en el momento de generar
  recommended_config jsonb not null,                  -- configuración de parciales recomendada
  score numeric(10,4) not null,
  explanation text not null,
  applied_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ai_recommendations enable row level security;

create policy "ai_recs_owner_rw" on public.ai_recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- BUCKETS ESTADÍSTICOS PERSONALIZADOS (cache de posteriors, ver 02 §6)
-- ============================================================
create table public.user_stat_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rr_bucket_min numeric(8,4) not null,
  rr_bucket_max numeric(8,4) not null,
  beta_alpha numeric(10,4) not null default 1,
  beta_beta numeric(10,4) not null default 1,
  sample_size integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, rr_bucket_min, rr_bucket_max)
);

alter table public.user_stat_buckets enable row level security;

create policy "stat_buckets_owner_rw" on public.user_stat_buckets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 4. Por qué RLS y no lógica de autorización en el backend

- **Defensa en profundidad**: incluso si un endpoint de Next.js/Edge Function tiene un bug de autorización, la base de datos nunca devuelve filas de otro usuario. En un producto que gestiona datos financieros de cuentas reales de fondeo, esto no es opcional.
- **Menos código, menos bugs**: no hay que replicar `WHERE user_id = ?` en cada query de cada endpoint — Postgres lo garantiza siempre.
- **Coste marginal insignificante a la escala objetivo** (miles de usuarios): RLS con políticas indexadas sobre `user_id`/`account_id` no introduce overhead medible frente a filtrar manualmente.

## 5. Vistas materializadas para el dashboard (rendimiento)

Los agregados del dashboard global (por cuenta, por empresa, totales) **no se calculan on-the-fly sobre `trades` en cada carga** a escala — se mantienen vistas materializadas refrescadas por trigger o cron ligero (Supabase `pg_cron`), p.ej. `mv_account_stats`, `mv_prop_firm_stats`. Con cientos de cuentas y miles de operaciones por usuario, agregar en cada carga de dashboard sería el primer cuello de botella de rendimiento del producto — se documenta el patrón aquí para que no se improvise más adelante.
