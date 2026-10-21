-- BUILD 010 / B1 — Management Intent: esquema base (BUILD 007-008)
--
-- Una Management Intent es una **decisión de gestión, fechada, dirigida a N
-- Cuentas, que todavía no es un hecho en ninguna de ellas**. Es la pieza que
-- faltaba entre el Plan de Gestión (plantilla sin Cuenta ni momento) y la
-- Operación (hecho, una Cuenta, un momento), y su valor de dominio es ser la
-- identidad que hace reconocibles como una misma decisión a N Operaciones
-- distintas — lo que 21.5 §3.5 anticipó como "Operaciones vinculadas".
--
-- **Nunca es un hecho.** Por sí sola no crea ni modifica ninguna Operación.
-- No contiene precios, contratos, ticks, lotes ni símbolos nativos (A3), ni
-- credenciales (A1), ni nada comercial (ADR-0001 D1/D3), ni ningún veredicto
-- de Rule Engine (I17), ni ningún resultado, ni ninguna razón de mercado (I9).
--
-- **Alcance de este build (B1 de BUILD 009): solo esquema.** Sin triggers, sin
-- funciones, sin eventos. Nada puede escribir todavía en estas tablas: las
-- políticas RLS son de solo lectura por diseño, y toda escritura llegará en
-- B5/B8/B9 por una única vía `SECURITY DEFINER`, mismo patrón que `audit_log`
-- ("authenticated no tiene grant de INSERT", 20260803120500 §trades_audit).

-- ============================================================
-- MANAGEMENT INTENTS — Aggregate Root. Propiedad: Usuario.
--
-- Referencia a Usuario, Cuentas y Planes; no contiene ninguno (21.5 §5:
-- "referencia entre agregados, no anidamiento"). No lleva FK al Plan a
-- propósito: cada destino congela su propia copia, de modo que borrar un Plan
-- nunca queda bloqueado por una Intención — a diferencia de
-- `trades.management_plan_id`, que sí lo bloquea por ser un hecho histórico.
-- ============================================================
create table public.management_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Momento de la confirmación humana explícita. No es `created_at`: es el
  -- instante de la decisión, el que la hace reconocible para el trader
  -- ("¿qué pasó con mi decisión de las 14:32?").
  decided_at timestamptz not null,

  side text not null check (side in ('long','short')),

  -- Instrumento en forma **canónica**, nunca el símbolo nativo de una
  -- plataforma (SPEC-008 §6, `instrument_unit_specs.instrument_key`). Es la
  -- frontera física entre dominio e infraestructura: lo que se expresa en R o
  -- en forma canónica es intención; lo que necesita `instrument_unit_specs`
  -- para existir es ejecución.
  instrument_key text not null check (char_length(trim(instrument_key)) > 0),

  -- Ventana de vigencia. Sin caducidad, una decisión de hace cuatro horas
  -- podría materializarse hoy. La invariante vive en el CHECK, no en la
  -- disciplina de quien escriba.
  valid_from timestamptz not null,
  valid_until timestamptz not null,

  -- Versión del contrato entre Core y cualquier Connect presente o futuro.
  contract_version int not null default 1 check (contract_version > 0),

  -- Idempotencia por Usuario: un reintento de red sobre "Confirmar" nunca
  -- produce una segunda decisión. Mismo mecanismo que `trades.idempotency_key`
  -- (SPEC-002 §8.3.2), con el ámbito que corresponde aquí — el Usuario, no la
  -- Cuenta, porque una Intención abarca N Cuentas.
  idempotency_key uuid,

  created_at timestamptz not null default now(),

  constraint management_intents_window_ordered check (valid_until > valid_from)
);

alter table public.management_intents enable row level security;

-- Solo lectura para `authenticated`, deliberadamente. Es la capa 1 de MI-2
-- (una Intención es inmutable desde su emisión): sin política de
-- INSERT/UPDATE/DELETE no existe ninguna vía de escritura desde la
-- aplicación. Mismo criterio ya aplicado a `audit_log` y a `rule_definitions`.
create policy "management_intents_owner_read" on public.management_intents
  for select using (auth.uid() = user_id);

create unique index management_intents_idempotency_idx
  on public.management_intents(user_id, idempotency_key)
  where idempotency_key is not null;

create index management_intents_user_idx
  on public.management_intents(user_id, decided_at desc);

-- ============================================================
-- MANAGEMENT INTENT DESTINATIONS — Entity dentro del agregado.
--
-- Es Entity y no Value Object embebido por dos razones independientes:
-- (1) concurrencia — N desenlaces simultáneos sobre una colección embebida
--     contenderían sobre la misma fila;
-- (2) MI-2 — registrar un desenlace reescribiría la fila de la Intención.
--
-- Su declaración (Cuenta, Plan congelado, transformación) es inmutable; solo
-- el desenlace transiciona, y una única vez hacia un estado terminal — misma
-- semántica monótona que `cancelled` en `trades`.
-- ============================================================
create table public.management_intent_destinations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.management_intents(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,

  -- PlanSnapshot congelado en el instante de la confirmación (regla 13). Se
  -- embebe como jsonb, no como tabla espejo, aplicando el criterio que ya
  -- distingue `rule_profile_snapshots.frozen_instances` (jsonb, se lee como
  -- unidad indivisible) de `trade_partials_planned` (tabla, se consulta y
  -- alimenta calcularRFinal): un Plan congelado aquí se lee entero para
  -- materializar, y nadie consultará jamás "todas las Intenciones cuyo segundo
  -- parcial está en 2R".
  --
  -- **Todo valor numérico dentro de este jsonb viaja como cadena** ('2.0000',
  -- nunca 2.0), exactamente como `rule_instances.parameters`: un número jsonb
  -- atravesaría `JSON.parse` como float y violaría I5.
  frozen_plan jsonb not null check (jsonb_typeof(frozen_plan) = 'object'),

  -- La forma de la decisión de riesgo, no su resultado: "0.5× la máster" y
  -- "riesgo propio 0.5%" producen el mismo número siendo decisiones distintas,
  -- y la explicabilidad debe poder separarlas. Mismos valores como cadena (I5).
  risk_transformation jsonb not null check (jsonb_typeof(risk_transformation) = 'object'),

  -- A4: el **valor** del tope pertenece a Funding Management; aquí solo consta
  -- que se aplicó y por qué. "Debe quedar completamente explicado y
  -- registrado" se hace cumplir por CHECK, no por convención.
  risk_cap_applied boolean not null default false,
  risk_cap_reason text,

  state text not null default 'pending'
    check (state in ('pending','sent','materialized','rejected','expired','discarded')),

  -- La Operación que este destino produjo, cuando la produjo. La arista va en
  -- esta dirección y solo en esta: `trades` **no conoce su Intención** (A8),
  -- lo que hace imposible cualquier ciclo de referencias.
  trade_id uuid references public.trades(id) on delete cascade,

  created_at timestamptz not null default now(),

  -- MI-6: una pareja (Intención, Cuenta) tiene como máximo un destino.
  unique (intent_id, account_id),

  -- Un destino materializado tiene Operación, y solo un destino materializado
  -- la tiene. Cierra los dos estados imposibles simétricos de una vez.
  constraint management_intent_destinations_trade_iff_materialized
    check ((state = 'materialized') = (trade_id is not null)),

  constraint management_intent_destinations_cap_explained
    check (risk_cap_applied = false or risk_cap_reason is not null)
);

alter table public.management_intent_destinations enable row level security;

-- Solo lectura, por la propiedad de su Intención. Es también lo que impide
-- insertar un destino **después** de la emisión, cerrando MI-2 por el lado del
-- INSERT: sin política de escritura, la única vía será la función atómica de
-- B5, que además deberá verificar que toda Cuenta destino pertenece a
-- auth.uid() — porque al ser SECURITY DEFINER saltará RLS.
create policy "management_intent_destinations_owner_read"
  on public.management_intent_destinations
  for select using (
    exists (
      select 1 from public.management_intents i
      where i.id = intent_id and i.user_id = auth.uid()
    )
  );

-- Postgres no indexa automáticamente las columnas de clave foránea: sin estos
-- índices, borrar una Cuenta o una Operación recorrería la tabla entera para
-- resolver la cascada.
create index management_intent_destinations_account_idx
  on public.management_intent_destinations(account_id);

create index management_intent_destinations_trade_idx
  on public.management_intent_destinations(trade_id)
  where trade_id is not null;
