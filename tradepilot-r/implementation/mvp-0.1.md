# MVP 0.1 — Documento de Ingeniería de Implementación

**Estado**: Pendiente de aprobación · **Versión**: 1.0 · **Fase**: Fase 2 — Construcción del MVP
**Voz**: Lead Software Engineer — Challenge Mode aplicado a la implementación exacta, no a la arquitectura.
**Alcance**: exactamente el definido en specs/015-mvp-roadmap.md, entrega MVP 0.1. No reabre ninguna decisión de Fase 1 — traduce SPEC-001 (Quant Engine) y SPEC-003 (Funding Management) a algo que un ingeniero puede programar sin preguntas.

---

## 1. Objetivo exacto de MVP 0.1

Tener, ejecutándose en producción (aunque sin usuarios reales todavía), un motor matemático completo y verificado (Quant Engine) y un modelo de datos real de Usuarios/Empresas/Cuentas con aislamiento multi-tenant verificado — la base sobre la que MVP 0.2 construye el registro de operaciones. Al final de esta entrega, ninguna cifra de dinero o de R se ha calculado nunca con `float`, y ningún usuario puede leer ni escribir un byte de los datos de otro.

## 2. Qué problema resuelve

Antes de que exista una sola Operación, hace falta demostrar dos cosas de forma verificable: que la matemática que sostiene todo el producto es exacta (Quant Engine, SPEC-001) y que el aislamiento de datos entre usuarios —el requisito de confianza más básico de un producto financiero— funciona desde la primera fila insertada. Construir esto primero, sin nada más encima, permite que cualquier bug de estos dos cimientos se descubra y corrija antes de que exista un solo dato real que proteger.

## 3. Componentes que participan

- **Quant Engine** (paquete compartido, `packages/quant-engine`) — catálogo completo de SPEC-001 (Grupos A-F), kernel decimal, Explainable Quant.
- **Identity** — Supabase Auth (passwordless/magic link, 01 §3.6) + tabla `profiles`.
- **Funding Management** — `prop_firms` (Empresas) y `accounts` (Cuentas), esquema corregido de SPEC-003 (sin `account_rules`, con `rule_profile_snapshot_id` nullable sin usar).
- **Ledger de capital** — `account_capital_events`, con su trigger de recálculo (15 §3.1, SPEC-003 §6.2) — construido completo ahora porque MVP 0.2 lo necesita sin rediseño.

## 4. Componentes que todavía NO existen (explícito, para que ningún ingeniero los dé por sentados)

Operations Engine, Rule Engine (ni su esquema `rule_definitions`/`rule_profiles`/etc.), Analytics, Knowledge Engine, AI Journal Engine, AI Decision Center, Optimizer, Simulation Engine, Trade Capture Engine, Design System más allá de los cuatro componentes visuales mínimos que esta entrega necesita (Botón, Input, Card, Empty State). Ningún código de esta entrega puede importar ni referenciar nada de lo anterior.

---

## 5. Flujo completo del usuario — paso a paso, sin saltos

1. El usuario abre la PWA sin sesión → pantalla única con campo de email y botón "Enviar enlace de acceso".
2. Introduce su email → Supabase Auth envía el magic link → estado de espera visible ("Revisa tu correo").
3. El usuario toca el enlace → sesión creada → trigger de Postgres (`on_auth_user_created`) inserta una fila en `profiles` automáticamente, sin ninguna pantalla intermedia.
4. Sesión activa, sin ninguna Empresa todavía → pantalla de bienvenida con una única pregunta: *"¿Vas a gestionar capital propio o el de una prop firm?"* con dos opciones (I16/I18: reduce la creación de Empresa+Cuenta a una decisión, no a dos formularios secuenciales para el caso común).
   - Si elige "Capital propio": se crea automáticamente una Empresa `is_personal = true` llamada "Personal" (sin pedir nombre, editable después) y el usuario pasa directo al paso 5 ya con esa Empresa seleccionada.
   - Si elige "Prop firm": pantalla con un campo de texto (nombre de la Empresa) y botón "Crear" → vuelve al paso 5.
5. Formulario de Cuenta: nombre (default: "Cuenta 1"), capital inicial (numérico, obligatorio, > 0), moneda (selector, default USD) → botón "Crear cuenta".
6. Redirección a "Cuentas" (home) → la Cuenta recién creada aparece en una lista con nombre, capital y moneda — sin drawdown, sin semáforo, sin estadísticas (no existen todavía, §4).
7. Tocar la Cuenta abre un detalle mínimo (mismo dato que la lista, sin nada más) — no hay nada más que hacer en esta entrega.

Fin del flujo. No hay paso 8.

---

## 6. Arquitectura técnica

### 6.1 Repositorios y estructura

```
tradepilot-r/
├── packages/
│   └── quant-engine/                    # SPEC-001 — librería compartida cliente+servidor
│       ├── src/
│       │   ├── decimal/                 # kernel decimal (§6.4) — único punto de import de decimal.js
│       │   ├── core/                    # Grupo A-B (calcularRFinal y derivados)
│       │   ├── stats/                   # Grupo C+G (+ calcularDesviacionR) — completo, BUILD 002
│       │   ├── curves/                  # Grupo D — completo, BUILD 002
│       │   ├── risk-state/              # Grupo E (calcularDrawdownState) — completo, BUILD 002
│       │   ├── simulation/               # Grupo F (simularGestion/calcularScore) — completo, BUILD 002,
│       │   │                              con golden dataset y benchmarks reales (specs/001 §8.6)
│       │   ├── explain/                  # QuantResult<T>
│       │   └── errors/
│       └── test/{unit,golden,stress,bench}/
├── apps/web/                              # Next.js — PWA
│   ├── app/(auth)/login/
│   ├── app/(onboarding)/empresa/
│   ├── app/(onboarding)/cuenta/
│   ├── app/(main)/cuentas/               # home
│   └── lib/supabase/{client.ts,server.ts}
└── supabase/
    ├── migrations/                       # DDL de §7
    └── functions/sql/                    # funciones RPC de §8
```

### 6.2 Backend

Sin Edge Functions en esta entrega — toda la lógica de Funding Management es CRUD con validación de negocio simple (estados válidos, `is_personal` vs. `profit_split_pct`), implementada como **funciones RPC de Postgres** (`plpgsql`), no como servicio Node — coherente con 05 §3 (Edge Functions reservadas para cómputo pesado: optimizador, visión — ninguno existe todavía en esta entrega).

### 6.3 Frontend

Next.js (App Router) + cliente de Supabase — cada caso de uso de §9 es una función tipada en `lib/api/` que envuelve una llamada RPC, nunca una llamada SQL directa desde un componente.

### 6.4 Kernel decimal — decisión concreta, no solo principio

**SPEC-001 §4.3 dejó abierto "decimal.js o big.js" — se decide aquí: `decimal.js`.** Justificación: soporta contexto de precisión y modo de redondeo configurables globalmente (`Decimal.set({ precision, rounding: Decimal.ROUND_HALF_EVEN })`, exactamente lo que SPEC-001 §4.3 exige), tiene tipado TypeScript maduro y es la librería de precisión arbitraria de mayor adopción en proyectos financieros JS. **Único punto de configuración**: `packages/quant-engine/src/decimal/kernel.ts` — ningún otro archivo del monorepo importa `decimal.js` directamente (regla de lint, §11.1).

### 6.5 Eventos y triggers (los únicos dos de esta entrega)

| Trigger | Dispara sobre | Efecto |
|---|---|---|
| `on_auth_user_created` | `INSERT` en `auth.users` (Supabase, gestionado por el sistema) | Inserta la fila correspondiente en `public.profiles` |
| `recompute_account_capital` | `INSERT` en `public.account_capital_events` | Recalcula `current_capital`/`peak_capital` de la Cuenta afectada (15 §3.1, SPEC-003 §6.2) |

Ningún otro evento de dominio existe todavía — `EmpresaCreada`/`CuentaCreada` (21.5 §7) se emiten como concepto pero no tienen ningún consumidor real hasta Rule Engine/Analytics, así que en esta entrega son, literalmente, la fila ya insertada — no se construye un bus de eventos para esto todavía (sería la sobreingeniería exacta que el fundador pide evitar).

---

## 7. Esquema real de base de datos

```sql
-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_risk_pct numeric(5,2) not null default 1.00,
  optimizer_lambda numeric(4,2) not null default 0.25,   -- sin uso hasta Optimizer, columna barata, no se difiere
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_rw" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROP FIRMS (Empresas)
-- ============================================================
create table public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  is_personal boolean not null default false,
  color text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

alter table public.prop_firms enable row level security;

create policy "prop_firms_owner_rw" on public.prop_firms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index prop_firms_user_idx on public.prop_firms(user_id);

-- ============================================================
-- ACCOUNTS (Cuentas) — esquema ya corregido por SPEC-003 (sin account_rules)
-- ============================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prop_firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  currency char(3) not null default 'USD',

  initial_capital numeric(18,4) not null check (initial_capital > 0),
  current_capital numeric(18,4) not null,      -- derivado, nunca editado directo (§7.1)
  peak_capital numeric(18,4) not null,           -- derivado, nunca editado directo

  status text not null default 'live'
    check (status in ('challenge','funded','live','paused','terminated','merged')),

  profit_split_pct numeric(5,2)
    check (profit_split_pct is null or (profit_split_pct >= 0 and profit_split_pct <= 100)),
  rule_profile_snapshot_id uuid,                  -- nullable, sin uso hasta Rule Engine (Capa 3)

  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "accounts_owner_rw" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index accounts_user_idx on public.accounts(user_id);
create index accounts_prop_firm_idx on public.accounts(prop_firm_id);

-- Invariante: cuenta personal nunca tiene profit split (18 §3, is_personal excluye profit_split)
alter table public.accounts add constraint personal_account_no_profit_split
  check (
    profit_split_pct is null
    or not exists (
      select 1 from public.prop_firms pf
      where pf.id = prop_firm_id and pf.is_personal = true
    )
  );
-- Nota de implementación: un CHECK no puede hacer sub-SELECT en Postgres — se aplica como
-- trigger BEFORE INSERT/UPDATE (§7.2), no como CHECK literal. Se deja aquí como documentación
-- de la regla; el mecanismo real está en la función de §8.

-- ============================================================
-- ACCOUNT CAPITAL EVENTS (ledger, 15 §3.1)
-- ============================================================
create table public.account_capital_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null check (event_type in ('initial','deposit','withdrawal','payout','reset','adjustment')),
  amount numeric(18,4) not null,             -- con signo
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

alter table public.account_capital_events enable row level security;

create policy "capital_events_owner_rw" on public.account_capital_events
  for all using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create index capital_events_account_idx on public.account_capital_events(account_id, occurred_at);

-- append-only: nunca se edita ni se borra un evento de capital ya insertado
create or replace function public.reject_capital_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'account_capital_events es append-only — no se permite UPDATE/DELETE';
end;
$$;

create trigger reject_capital_event_update
  before update or delete on public.account_capital_events
  for each row execute function public.reject_capital_event_mutation();

-- ============================================================
-- TRIGGER: recálculo de capital (15 §3.1, SPEC-003 §6.2)
-- ============================================================
create or replace function public.recompute_account_capital()
returns trigger language plpgsql as $$
declare
  v_total numeric(18,4);
begin
  select coalesce(sum(amount), 0) into v_total
  from public.account_capital_events
  where account_id = new.account_id;

  update public.accounts
  set current_capital = v_total,
      peak_capital = greatest(peak_capital, v_total)
  where id = new.account_id;

  return new;
end;
$$;

create trigger on_capital_event_recompute
  after insert on public.account_capital_events
  for each row execute function public.recompute_account_capital();
```

### 7.1 Por qué `current_capital`/`peak_capital` no son `generated always as` columns

Postgres permite columnas generadas, pero `peak_capital` necesita el máximo histórico (`greatest`), que no es una expresión pura de la fila actual — requiere el trigger. Se documenta para que ningún ingeniero intente "simplificarlo" a una columna generada y rompa la semántica de máximo histórico.

### 7.2 La validación `is_personal` ⇒ sin profit split — función, no CHECK

```sql
create or replace function public.validate_account_profit_split()
returns trigger language plpgsql as $$
begin
  if new.profit_split_pct is not null and exists (
    select 1 from public.prop_firms pf where pf.id = new.prop_firm_id and pf.is_personal = true
  ) then
    raise exception 'PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT';
  end if;
  return new;
end;
$$;

create trigger validate_profit_split
  before insert or update on public.accounts
  for each row execute function public.validate_account_profit_split();
```

---

## 8. API pública

Todas las funciones viven en `apps/web/lib/api/funding.ts`, cada una envolviendo una llamada RPC a Postgres (`supabase.rpc(...)`):

```ts
// packages/quant-engine ya expone su propia API pública completa (SPEC-001 §3) — no se repite aquí.

interface CrearEmpresaInput { name: string; is_personal: boolean }
function crearEmpresa(input: CrearEmpresaInput): Promise<Result<PropFirm, FundingError>>

interface CrearCuentaInput {
  prop_firm_id: string
  name: string
  initial_capital: string      // string, nunca number — evita que el cliente introduzca un float por el borde de la API
  currency: string              // ISO 4217, 3 letras
  profit_split_pct?: string
}
function crearCuenta(input: CrearCuentaInput): Promise<Result<Account, FundingError>>

function listarCuentas(): Promise<Result<Account[], FundingError>>
function obtenerCuenta(id: string): Promise<Result<Account, FundingError>>
function registrarEventoCapital(account_id: string, event_type: CapitalEventType, amount: string, note?: string): Promise<Result<void, FundingError>>

type FundingError =
  | { code: "PROP_FIRM_NOT_FOUND" }
  | { code: "ACCOUNT_NOT_FOUND" }
  | { code: "INVALID_INITIAL_CAPITAL"; detail: string }        // ≤ 0, o no numérico
  | { code: "INVALID_AMOUNT"; detail: string }                  // registrarEventoCapital: no numérico (sí admite negativo)
  | { code: "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT" }        // reexporta el error de la función SQL (§7.2)
  | { code: "VALIDATION_ERROR"; field: string; detail: string } // nombre vacío, event_type='initial' fuera de crearCuenta — §14.7
  | { code: "UNAUTHORIZED" }                                     // RLS rechazó la operación
  | { code: "UNKNOWN"; detail: string }                          // catch-all honesto para un error de Postgres no catalogado — §14.7
```

**Regla de borde de API, nueva en este documento**: `initial_capital`/`amount` viajan como `string` en la API pública, nunca como `number` — un `number` de JS en el borde de red ya es un `float` antes de que el kernel decimal (§6.4) pueda intervenir; forzar `string` en el contrato de API es la única forma de garantizar que ningún dato monetario pase por una representación de coma flotante en ningún punto del recorrido cliente→servidor→BD.

---

## 9. Casos de uso completos

| Caso de uso | Quién | Efecto |
|---|---|---|
| Registrar (crear Empresa) | Usuario | `crearEmpresa` → `INSERT prop_firms` |
| Registrar (crear Cuenta) | Usuario | `crearCuenta` → `INSERT accounts` + `INSERT account_capital_events (event_type='initial')` en la misma transacción |
| Editar (nombre de Empresa/Cuenta) | Usuario | `UPDATE` directo vía RLS — no hay lógica de negocio más allá de la propiedad |
| Cancelar | No aplica en esta entrega | No existe ningún proceso cancelable todavía (sin Operaciones) |
| Consultar | Usuario | `listarCuentas`/`obtenerCuenta` — lectura simple filtrada por RLS |
| Eliminar | Explícitamente diferido | SPEC-013 §5.7 ya exige fricción deliberada + ventana de gracia para eliminar una Cuenta — no se implementa en MVP 0.1 (ninguna operación depende todavía de una Cuenta, así que el caso real de "eliminar con historial que perder" no existe hasta MVP 0.2+) |

---

## 10. Estados

### 10.1 Máquina de estados de `accounts.status` — implementada solo parcialmente, a propósito

**Hallazgo de Challenge Mode**: el esquema completo de 6 estados (SPEC-003 §4.2) se incluye en el `CHECK` desde ya (barato, evita una migración futura) — pero **la lógica de validación de transición solo cubre las dos que un usuario puede disparar manualmente hoy**:

```
Live ⇄ Paused                    (cuenta de capital propio)
Challenge → Funded                (el usuario confirma manualmente que superó la evaluación)
Funded ⇄ Paused
```

**Nunca implementadas en esta entrega** (correctamente diferidas, no un hueco): `→ Terminated` (lo dispara Rule Engine al detectar un incumplimiento grave — no existe todavía), `→ Merged` (Capa 6, SPEC-003 §6.3). Intentar esas transiciones en MVP 0.1 retorna `INVALID_STATE_TRANSITION` — el estado existe en el esquema, la lógica que lo alcanza no.

### 10.2 Errores y recuperación

| Error | Causa | Recuperación |
|---|---|---|
| `INVALID_INITIAL_CAPITAL` | ≤0 o no numérico | El formulario nunca envía el request — validación de cliente antes de llegar a la API (defensa en profundidad, la API también lo verifica) |
| `PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT` | Intento de fijar `profit_split_pct` en una Empresa `is_personal` | El formulario oculta ese campo por completo si `is_personal = true` — el error solo es alcanzable saltándose el cliente, y sigue protegido en la BD |
| `UNAUTHORIZED` (RLS) | Intento de leer/escribir una fila de otro usuario | No debería ser alcanzable desde la UI normal — solo mediante manipulación directa de API, cubierto por el test de aislamiento (§11.2) |

---

## 11. Testing

### 11.1 Unitarios — Quant Engine (golden dataset)

Caso concreto, uno por rama de `R_cierre_resto` (02 §2), con valores exactos verificados a mano:

| Caso | `riesgo_eur` | `rr_objetivo` | parciales ejecutados | `r_max` | `closure_reason` | `R_final` esperado |
|---|---|---|---|---|---|---|
| Stop Loss puro | 100.0000 | 3.0000 | ninguno | 0.4000 | STOP_LOSS | −1.0000 |
| Break Even tras 1 parcial | 100.0000 | 3.0000 | 1 parcial: 50% @ 1.0000R | 1.8000 | BREAK_EVEN | 0.5000 *(=0.5×1.0000 + 0.5×0)* |
| Take Profit completo, sin parciales | 100.0000 | 3.0000 | ninguno | 3.2000 | TAKE_PROFIT_FULL | 3.0000 |
| Cierre manual con 2 parciales | 100.0000 | 5.0000 | 30% @ 1.0000R, 30% @ 2.0000R | 2.5000 | MANUAL_CLOSE (resto en 2.2000R) | 1.7800 *(=0.3×1+0.3×2+0.4×2.2)* |

Cada fila es un test en `test/golden/r-final.test.ts` — comparación exacta (`toBe`, no `toBeCloseTo`) contra el `FixedDecimal` esperado, porque la aritmética es exacta por diseño (SPEC-001 §4.3) y una tolerancia de comparación escondería justo el tipo de error que este catálogo existe para prevenir.

### 11.2 Integración — aislamiento RLS

Test dedicado, no opcional: crear dos usuarios de prueba (A y B), cada uno con su Empresa y Cuenta; verificar que una consulta autenticada como A devuelve 0 filas al intentar leer/editar/borrar cualquier fila de B, en las tres tablas (`prop_firms`, `accounts`, `account_capital_events`) — sin excepción, sin importar el método de acceso (RPC o tabla directa).

### 11.3 Integración — trigger de capital

Insertar una secuencia de eventos (`initial: 10000`, `deposit: 500`, `withdrawal: -200`, `adjustment: 50`) y verificar `current_capital = 10350` y `peak_capital = max(10000, 10500, 10300, 10350) = 10500` — el caso que verifica que `peak_capital` no baja cuando `current_capital` sí lo hace.

### 11.4 E2E

Un flujo completo (Playwright, ya preinstalado en el entorno): abrir la app → login con magic link (mockeado en test) → elegir "capital propio" → crear cuenta con capital inicial → verificar que aparece en "Cuentas" con el capital correcto.

### 11.5 Casos borde

- `initial_capital = 0` → rechazado (`CHECK`).
- `initial_capital` negativo → rechazado.
- Nombre de Empresa/Cuenta vacío o solo espacios → rechazado (`CHECK` con `trim`).
- Doble clic en "Crear cuenta" → **no cubierto en esta entrega** (SPEC-002 §6.4 ya especificó idempotencia para el registro de Operaciones — Funding Management no la tiene todavía porque crear una Cuenta dos veces por error es de bajo impacto y fácil de corregir a mano/editar nombre; se anota como decisión consciente, no como omisión).
- Grupo F de Quant Engine (`simularGestion`/`calcularScore`) — **deuda saldada en BUILD 002**: golden dataset y tests propios ya existen (`test/unit/simulation.test.ts`), pese a que Optimizer/Simulation Engine (sus consumidores reales) siguen sin construirse — se adelantó al completar el catálogo matemático completo antes de empezar ningún módulo nuevo, por instrucción explícita del fundador.

---

## 12. Rendimiento

| Operación | Objetivo | Por qué es alcanzable sin optimización adicional |
|---|---|---|
| `crearEmpresa`/`crearCuenta` | <200ms p95 | Una fila, un índice, sin cómputo — Postgres estándar |
| `listarCuentas` | <100ms p95 | Consulta indexada (`accounts_user_idx`) sobre, como máximo, unas pocas decenas de filas en esta fase |
| Cualquier función de Quant Engine | <1ms | Ya establecido en SPEC-001 §5.1, sin cambios |

No se requiere ningún mecanismo de escalabilidad adicional en esta entrega — el volumen real (miles de usuarios, 19 §7) es un problema de fases posteriores, no de MVP 0.1.

---

## 13. Riesgos técnicos

1. **Que un archivo fuera de `packages/quant-engine/src/decimal/` importe `decimal.js` directamente**, reintroduciendo el riesgo de configuración divergente que SPEC-001 §4.3 ya advirtió — mitigación: regla de ESLint (`no-restricted-imports` sobre `decimal.js` fuera de `src/decimal/`), no solo disciplina de revisión.
2. **Que la función `validate_account_profit_split` (§7.2) no se dispare en un `UPDATE` que cambia `prop_firm_id`** de una cuenta ya existente hacia una Empresa personal — el trigger cubre `insert or update`, así que está cubierto, pero se anota como el caso de prueba específico a no olvidar (§11.5, ampliar).
3. **Que RLS por sí sola no sea suficiente si en el futuro se añade un rol de servicio con `service_role` key mal utilizado desde el cliente** — mitigación: la `service_role` key nunca se expone al cliente (ya un estándar de Supabase, se reafirma aquí como requisito de despliegue explícito, no implícito).

---

## 14. Auditoría Challenge Mode

### 14.1 Duplicaciones buscadas

Ninguna encontrada — `initial_capital`/`current_capital`/`peak_capital` son tres hechos distintos con tres razones de existir (18 §2, ya establecido), no una duplicación.

### 14.2 Dependencias innecesarias

**Encontrada y corregida**: la validación `personal_account_no_profit_split` se redactó primero como `CHECK` con subconsulta (§7, primer bloque) — Postgres no permite subconsultas en `CHECK`, así que se corrigió a una función `BEFORE INSERT/UPDATE` (§7.2) antes de que este documento se diera por cerrado. Es exactamente el tipo de error que un ingeniero real habría descubierto al primer intento de migrar — se corrige aquí, no en producción.

### 14.3 Complejidad gratuita

**Encontrada y corregida**: implementar la máquina de estados completa de `accounts.status` con las 6 transiciones sería trabajo sin consumidor real hoy (Terminated/Merged no tienen ningún disparador todavía) — se limita a las transiciones alcanzables por el usuario (§10.1), con el resto del esquema ya preparado sin lógica prematura.

### 14.4 Deuda técnica identificada explícitamente (no oculta)

- ~~Grupo F de Quant Engine sin golden dataset dedicado~~ — **saldada en BUILD 002** (ver §11.5, actualizado).
- Sin idempotencia en creación de Cuenta/Empresa (§11.5) — deuda aceptada, bajo impacto.
- Sin manejo de `Terminated`/`Merged` (§10.1) — no es deuda, es alcance correctamente diferido (ambos dependen de módulos que no existen).

### 14.6 Correcciones encontradas al escribir el código (post-aprobación de este documento)

Dos hallazgos reales durante la implementación de `packages/quant-engine`, siguiendo la regla del propio proyecto ("si aparece un problema de arquitectura: detener, explicar, proponer, corregir la documentación, continuar"):

1. **Error aritmético en el golden dataset (§11.1, caso "Cierre manual con 2 parciales")**: el valor esperado estaba escrito como `1.6600`, pero la propia fórmula mostrada junto a él (`0.3×1+0.3×2+0.4×2.2`) da `1.7800` (`0.3+0.6+0.88=1.78`). Es un error de transcripción del documento aprobado, no de la fórmula — corregido aquí a `1.7800`, y es el valor contra el que `test/golden/r-final.test.ts` verifica.
2. **Alcance de `cierre_manual_rr` demasiado estrecho en SPEC-001 §3.4**: el campo estaba anotado como válido "solo si el usuario cerró manualmente con R_max ≥ rr_objetivo" — pero el propio caso 4 de este golden dataset (`r_max=2.5000 < rr_objetivo=5.0000`, cierre manual en `2.2000R`) es exactamente el caso que esa restricción excluye. Se generaliza `cierre_manual_rr` a "el valor de R en el que el usuario cerró manualmente el tramo no cubierto por parciales", sin relación obligatoria con `rr_objetivo` — sigue siendo un dato observado (nunca inferido), así que no compromete ninguna regla de Quant Engine. Corregido en SPEC-001 §3.4 y documentado en `packages/quant-engine/src/core/types.ts`.

### 14.7 Hallazgos al implementar la capa RPC de Funding Management (`supabase/functions/sql/funding.sql`)

1. **Hallazgo de seguridad real, el más importante de esta entrega**: una `FOREIGN KEY` en Postgres valida existencia contra la tabla completa — **no aplica RLS**. `accounts.prop_firm_id references prop_firms(id)` por sí sola no impide que un usuario cree una Cuenta apuntando al `prop_firm_id` de **otro** usuario; la FK solo comprueba que la fila exista en algún sitio, no que le pertenezca a quien hace la petición. Esto es un bypass real de aislamiento multi-tenant que ninguna prueba de RLS de lectura (§11.2) detectaría, porque el problema está en un INSERT, no en un SELECT. **Corrección**: `crear_cuenta` verifica explícitamente `exists(select 1 from prop_firms where id = p_prop_firm_id and user_id = auth.uid())` antes de insertar, y trata "existe pero no es tuya" igual que "no existe" (`PROP_FIRM_NOT_FOUND`) — nunca revela que la Empresa de otro usuario existe.
2. **`event_type = 'initial'` no estaba protegido en `registrar_evento_capital`**: el `CHECK` de la tabla permite `'initial'` porque `crear_cuenta` lo necesita para el evento fundacional — pero sin una restricción adicional, cualquier usuario podría llamar a `registrar_evento_capital` directamente con `event_type='initial'` y duplicar ese evento fuera del flujo atómico de creación de Cuenta. Corregido: `registrar_evento_capital` rechaza explícitamente `'initial'` con `VALIDATION_ERROR`.
3. **`amount` en `registrar_evento_capital` valida solo que sea numérico, nunca su signo** — a diferencia de `initial_capital` en `crear_cuenta` (que exige `> 0`), un evento de capital admite legítimamente valores negativos (`withdrawal`, un `adjustment` a la baja); confundir ambas validaciones habría rechazado retiradas válidas.
4. **El catálogo `FundingError` de §8 estaba incompleto**: no tenía forma de representar un nombre vacío (cubierto solo por un `CHECK` de esquema, no por una regla de negocio con código propio) ni un error de Postgres no catalogado. Se añaden `VALIDATION_ERROR` (validaciones de forma con campo explícito) y `UNKNOWN` (catch-all honesto — Trust Layer, SPEC-014: nunca ocultar un error propio bajo una etiqueta que no le corresponde) — ver §8 arriba, ya actualizado.
5. **`SECURITY DEFINER` sin `search_path` fijado** (`handle_new_user`) es una vulnerabilidad conocida de Postgres/Supabase (secuestro de `search_path`) si no se fija explícitamente — se añade `set search_path = public` a toda función `SECURITY DEFINER`/`SECURITY INVOKER` de este documento, no solo a la que ya lo requería por diseño.

### 14.8 Implementación de frontend/autenticación real (`apps/web`) — hallazgos de esta sesión

Alcance de esta sesión: autenticación completa (Supabase magic link), middleware de protección de rutas, onboarding, Dashboard de Cuentas, Nueva Cuenta, Detalle de Cuenta, Registrar Evento, layout (Sidebar/Header), y 4 componentes mínimos del Design System (Botón/Input/Card/Empty State, SPEC-012 §4/§6.3). 68 tests (19 Quant Engine + 49 web), `tsc --noEmit` limpio, lint limpio, `next build` real ejecutado con éxito (11 rutas generadas).

**Hallazgos de API/esquema** (necesarios para que las pantallas pedidas pudieran leer datos que mvp-0.1.md §8 nunca expuso):
1. **Sin función de lectura para `prop_firms`**: el enrutado de onboarding ("¿el usuario ya tiene una Empresa?") y el formulario de Nueva Cuenta ("¿a qué Empresa la asocio?") no tenían forma de leerlas. Añadida `listar_empresas()` (RPC) + `listarEmpresas()` (wrapper) — misma convención que el resto del catálogo.
2. **Sin función de lectura para el ledger de capital**: la pantalla de Detalle de Cuenta (pedida explícitamente con "Historial de eventos") no podía leerlo. Añadida `listar_eventos_capital(p_account_id)` (RPC, con verificación de propiedad vía `join accounts` sobre `auth.uid()`) + `listarEventosCapital()` (wrapper).

**Errores reales encontrados y corregidos en el propio código de esta sesión** (no en el diseño previo):
3. **Bug de rutas descubierto solo al ejecutar `next build` real**: el onboarding se escribió inicialmente bajo un *route group* `app/(onboarding)/` — en Next.js App Router, los segmentos entre paréntesis son puramente organizativos y **no** forman parte de la URL. El build generó `/empresa` y `/cuenta` en vez de `/onboarding/empresa` y `/onboarding/cuenta`, que es a lo que todo el código (`redirect()`, `<Link>`) ya apuntaba. Es exactamente el tipo de error que "compilar mentalmente" no habría detectado y que el propio fundador pidió cubrir ejecutando el build real. Corregido renombrando el directorio a un segmento real `app/onboarding/`.
4. **`redirect()` de `next/navigation` llamado dentro de una Server Action invocada de forma imperativa (`signOutAction`)**: `redirect()` funciona lanzando una excepción de control de flujo especial; `LogoutButton` la envolvía en un `try/catch` que la habría capturado como un fallo real, mostrando "no se ha podido cerrar sesión" incluso cuando el cierre de sesión tuvo éxito. Corregido: `signOutAction` ya no redirige — el cliente hace `router.push("/login")` tras esperar la acción; el middleware queda como red de seguridad independiente.
5. **Vulnerabilidad de salto abierto (open redirect)**: al completar el hilo de `redirectTo` (capturado por el middleware cuando bloquea una ruta protegida) hasta el enlace mágico y el route handler `/auth/confirm?next=...`, un valor de `next`/`redirectTo` sin sanear permitiría a un enlace manipulado redirigir a un dominio externo tras el login. Añadido `sanitizeRedirectTarget()` — solo acepta rutas relativas que empiecen por `/` y rechaza `//host` y `scheme://host` — aplicado en los tres puntos donde ese valor cruza un límite de confianza (login, acción de envío del enlace, y el propio route handler de confirmación).
6. **Bug de invalidación de caché incompleta**: `registrarEventoCapitalAction` solo revalidaba `/cuentas/[id]` — el Dashboard (`/cuentas`) también cachea `current_capital` de esa misma Cuenta y se habría quedado con un valor obsoleto tras registrar un evento. Corregido: revalida ambas rutas.
7. **Colisión de significado de color evitada antes de que ocurriera**: los eventos del ledger de capital (depósito/retirada/ajuste) se muestran en `CapitalEventList` con color neutro (`--text-primary`), nunca con `--positive`/`--negative` — esos tokens están reservados a P&L de R/€ (03 §5.2); un depósito no es "beneficio" ni una retirada es "pérdida", así que colorearlos con esa paleta habría diluido su significado exactamente como SPEC-012 §4.1.1 ya advirtió para `--success` vs. `--positive`.
8. **Simplificación deliberada, documentada como tal**: el selector de moneda (3 valores fijos) y el selector de Empresa en Nueva Cuenta (cuando hay más de una) usan un `<select>` HTML nativo estilizado con los tokens de Input, no el componente "Selector" completo del catálogo de SPEC-012 §6.3 — ninguna de sus variantes más ricas (segmentado, chip múltiple, buscador) tiene un caso de uso real todavía en esta entrega; construirlas ahora habría sido la sobreingeniería exacta que SPEC-012 §11 pide evitar sin pasar antes las cinco preguntas de gobernanza.
9. **Guardas de desarrollo, no solo documentación**: la regla "nunca anidar una Card dentro de otra Card" (SPEC-012 §6.3) se hace verificable con un `Context` que avisa en consola en desarrollo si se detecta anidación, en vez de depender solo de disciplina de revisión de código.

**Deuda técnica/limitaciones explícitas de esta sesión**:
- No se pudo ejecutar ningún test contra un proyecto Supabase real (RLS de extremo a extremo, trigger de capital contra Postgres real, flujo de magic link real) — este entorno no tiene credenciales de un proyecto Supabase. Los 49 tests de `apps/web` cubren validaciones puras, componentes (React Testing Library), Server Actions (con el cliente de Supabase sustituido en el límite de red) y el middleware de protección de rutas — nunca sustituyen a un test de integración real, que queda pendiente hasta que exista un proyecto Supabase de pruebas.
- `next build` se ejecutó con éxito pero sin variables de entorno reales (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — confirma que el build no falla en su ausencia (todas las rutas que usan `cookies()` optan por renderizado dinámico), pero no demuestra que el login real funcione; eso requiere un proyecto Supabase real, explícitamente fuera del alcance verificable en este entorno.
- No se implementó ningún cambio de estado de Cuenta (Live⇄Paused, Challenge→Funded) — no estaba en el alcance pedido en esta sesión; mvp-0.1.md §10.1 ya lo describe pero §8 nunca definió una función de API para ello, gap que queda anotado, no resuelto aquí.

### 14.9 BUILD 002 — Quant Engine completo (Grupos C-F)

Antes de tocar ningún módulo nuevo, se completó el catálogo matemático entero de SPEC-001 (instrucción explícita del fundador: "no quiero comenzar ningún módulo nuevo hasta que Quant Engine quede terminado al 100%"). Grupo C+G (stats), Grupo D (curvas), Grupo E (`calcularDrawdownState`), Grupo F (`simularGestion`/`calcularScore`) — todos con golden dataset, edge cases del catálogo §6.3, property tests, stress tests a escala (100.000/50.000 elementos) y benchmarks reales (`vitest bench`).

**Los hallazgos completos de Challenge Mode de este build viven en SPEC-001 §8.6** (no se duplican aquí letra por letra) — resumen: `calcularCurvaEquity` generalizada sobre el brand del kernel (corrige una firma que tipaba `Money[]` incluso con `unidad="R"`); `calcularTiempoMedioEnMercado` migrada de `number[]` nativo a un 4º brand `Seconds` (era la única función de todo el catálogo que violaba "nunca float" en su propia firma); `DrawdownStateInput.peak_capital` → `peak_capital_basis` (distingue "trailing" de "eod", que necesitan picos distintos) y eliminación de `max_daily_drawdown_pct` (parámetro muerto); nuevo `reason: "ZERO_CAPITAL"` en el catálogo de errores; unificación de una duplicación real entre `computeRFinal` y `calcularImpactoPorParcial` (`decomposeRFinal`); y un hallazgo de rendimiento encontrado por benchmark real (no por inspección) — la precisión del kernel decimal estaba en 50 dígitos significativos, muy por encima de los ~28-30 que SPEC-001 §4.3.2 exige, y los agregados de Grupo C sobre 10.000 operaciones excedían su objetivo de latencia; reducida a 30, verificado que ningún test existente cambia de valor.

**Cifras de benchmark reales** (`packages/quant-engine`, `npm run bench`, Node local — no un entorno de producción, pero sí una medición real, no estimada):

| Función | Objetivo (SPEC-001 §5.1) | Medido (media) | ¿Cumple? |
|---|---|---|---|
| `calcularRFinal` / `simularGestion` | < 1 ms | ~0.008 ms | Sí |
| `calcularEsperanzaIncremental` / `calcularDesviacionDesdeAcumulador` (modo streaming, acumulador de 10.000) | < 15 ms | ~0.005-0.015 ms | Sí |
| `calcularEsperanza`/`calcularDesviacionR` modo batch (N=10.000) | Sin objetivo — SPEC-001 §5.3/§8.5.2 lo declara utilidad de dev/debug | ~48-52 ms | No aplica (documentado, no un fallo) |
| `calcularCurvaEquity` (N=10.000) | < 20 ms | ~13-14 ms | Sí |
| `calcularDrawdownHistorico` (N=10.000, aislado) | < 20 ms | ~9 ms | Sí |
| `calcularDrawdownState` | < 1 ms | ~0.007 ms | Sí |

**Estado del Quant Engine tras este build**: catálogo completo de SPEC-001 §4.1 implementado (Grupos A-G), 77 tests en `packages/quant-engine` (golden + unitarios + property + stress + Grupo B previo), benchmarks reales ejecutados y documentados, `tsc --noEmit`/ESLint limpios. Ningún consumidor real (Risk Engine, Optimizer, Simulation Engine) existe todavía — es esperado y correcto en esta fase; el catálogo se construyó completo para no bloquear esos módulos futuros con una base matemática incompleta, no porque tengan ya un caso de uso concreto hoy.

### 14.10 BUILD 003 — Risk Engine (primer consumidor oficial de Quant Engine)

Con Quant Engine declarado congelado para producción (instrucción explícita del fundador: solo se modifica ante un bug matemático demostrado, un problema de rendimiento demostrado, o una violación de invariante I1-I21 — todo lo demás se resuelve fuera del core), arrancó Risk Engine (`packages/risk-engine`): el primer módulo que invoca Quant Engine en producción. Diseñado estrictamente como orquestador (Ports & Adapters / Dependency Inversion) — invoca Quant Engine, persiste el estado agregado por Cuenta, actualiza el ledger de idempotencia, emite eventos de dominio, prepara los datos que consumirá Rule Engine. **Nunca decide si un resultado es aceptable ni contiene una fórmula matemática propia** — "Calcular ≠ Juzgar" (19 regla 14) aplicado también al primer consumidor real, no solo al futuro Rule Engine.

**Código implementado**: dominio (`AccountRiskState`, `CapitalFacts`, `DrawdownConfig`, catálogo `RiskEngineError` tipado — nunca una excepción sin tipar), eventos de consumo (`OperacionCerrada`/`OperacionEditada`/`OperacionCancelada` — contratos ya probados contra eventos sintéticos, listos para Operations Engine en cuanto exista en código) y de emisión (`AcumuladorActualizado`), dos puertos (`AccountRiskStateRepository`, `CapitalFactsProvider`), `RiskEngineService` (`calcularResultado` sync <1ms sin I/O; `procesarOperacionCerrada` incremental O(1); `procesarOperacionEditada`/`procesarOperacionCancelada` vía reconstrucción completa del acumulador — Welford no admite una resta O(1), SPEC-001 §5.3 autoriza explícitamente esta vía de recuperación en vez de inventar matemática nueva, prohibido por el congelamiento; único bucle de reintento por conflicto de versión compartido por ambas vías, `MAX_VERSION_CONFLICT_RETRIES = 5`), y los adaptadores Supabase (`SupabaseAccountRiskStateRepository`, `SupabaseCapitalFactsProvider` — este último reutiliza `obtener_cuenta` de Funding Management en vez de duplicar el esquema de `accounts`).

**Base de datos** (`supabase/migrations/20260803120400_risk_engine.sql`): `account_risk_state` (el `WelfordAccumulator` persistido por Cuenta, `version` como concurrencia optimista pura), `risk_engine_processed_events` (ledger de idempotencia, append-only), `domain_events` (outbox transaccional — sin cola de mensajería real todavía, decisión abierta en 25 §…, esta es la vía honesta de emitir un evento de dominio sin infraestructura que no existe). Único punto de escritura: `risk_engine_apply_accumulator_update`, una función `SECURITY INVOKER` que resuelve idempotencia + concurrencia optimista + emisión del evento en una sola transacción implícita — nunca dos pasos que puedan dejar una escritura a medias. Trigger `on_account_created_provision_risk_state` provisiona la fila de estado atómicamente al crear la Cuenta (evita que el camino de lectura tenga que manejar "Cuenta sin estado de riesgo todavía").

**Hallazgo metodológico real** (no solo un hallazgo de código): la primera validación de RLS de este build se ejecutó como superusuario de Postgres (`sudo -u postgres psql`) y dos comprobaciones de aislamiento "pasaron" con un resultado que en realidad significaba fallo total de RLS — Postgres exime a los superusuarios y al propietario de la tabla de toda política de RLS, sin excepción. Corregido conectando como un rol `authenticated` real (no superusuario, no propietario, con `SET ROLE` + una función `auth.uid()` simulada vía variable de sesión) — eso reveló de inmediato un fallo genuino: la función atómica es `SECURITY INVOKER` a propósito (para que la RLS de `account_risk_state` proteja el `UPDATE`), pero eso significa que RLS también rige sus propios `INSERT` internos en `risk_engine_processed_events`/`domain_events`, que solo tenían política de `SELECT`. Corregido con las políticas de `INSERT` que faltaban. Con la metodología corregida en la mano, se reconfirmaron también las afirmaciones de aislamiento de BUILD 001 (nunca antes ejecutadas contra un Postgres real con RLS realmente vigente) — resultaron correctas.

**Validación de concurrencia real, no solo simulada en secuencia**: además de las 10 comprobaciones secuenciales de `supabase/tests/02_risk_engine.sql` (provisión, idempotencia, conflicto de versión y su reintento, outbox, aislamiento RLS de lectura/escritura), se ejecutaron dos sesiones de Postgres genuinamente simultáneas (procesos `psql` en paralelo, una de ellas reteniendo el lock de fila con `pg_sleep` dentro de una transacción explícita) compitiendo por el mismo `event_id` sobre la misma Cuenta — el resultado confirma que el lock de fila serializa correctamente la escritura: una sesión aplica (`version` 0→1), la otra bloquea hasta el commit de la primera y entonces detecta el conflicto correctamente, sin doble conteo (`n=1`, no 2) y sin escritura parcial (exactamente 1 fila en el ledger de idempotencia, exactamente 1 evento en el outbox).

**Desambiguación `already_processed` vs `version_conflict`**: la RPC atómica devuelve `applied=false` para ambos casos sin distinguirlos en la fila (mismo hallazgo documentado en la propia migración) — `SupabaseAccountRiskStateRepository.aplicarActualizacion` desambigua con una segunda lectura del ledger de idempotencia (`risk_engine_ya_procesado`) en vez de adivinar; verificado que esto es correcto incluso bajo la carrera real de dos sesiones concurrentes con el mismo `event_id` (la sesión perdedora, aunque falla por conflicto de versión y no por el atajo de "ya procesado" dentro de la función SQL, queda correctamente clasificada como `already_processed` por la relectura posterior, porque el `INSERT` de la ganadora ya está comprometido para entonces).

**Tests**: 24 en `packages/risk-engine` — 12 de `RiskEngineService` (con `InMemoryAccountRiskStateRepository`/`InMemoryCapitalFactsProvider`, incluyendo el reintento real ante conflicto de versión, el agotamiento de reintentos, y la reconstrucción del acumulador en edición/cancelación) + 12 de los dos adaptadores Supabase (doble del cliente sustituyendo solo `.rpc()`, mismo patrón que `apps/web/test/actions`). Más 15 comprobaciones SQL contra Postgres real en `supabase/tests/` (documentadas con su resultado esperado junto al real, lectura manual — deuda aceptada, bajo impacto).

**Estado del Risk Engine tras este build**: orquestador completo (invocación de Quant Engine, persistencia, idempotencia, concurrencia optimista, outbox) con adaptadores Supabase probados y una validación de concurrencia real (no solo teórica) contra Postgres. `tsc`/`eslint`/`npm test` limpios en todo el monorepo (150 tests: 77 Quant Engine + 24 Risk Engine + 49 web). Ningún punto identificado donde el diseño actual pueda perder consistencia bajo escritura concurrente — la combinación de `version` (optimista) + `event_id` (idempotencia) + transacción implícita de una sola función cubre los tres frentes exigidos (doble entrega, escritura concurrente perdida, escritura parcial). Lo que queda deliberadamente fuera de este build, sin ser una carencia: Operations Engine no existe en código todavía, así que los eventos de entrada (`OperacionCerrada`/`OperacionEditada`/`OperacionCancelada`) se prueban contra fixtures sintéticas, no contra un emisor real; y el outbox de `domain_events` no tiene todavía ningún worker que lo consuma (decisión de infraestructura explícitamente abierta en 25 §…, no una limitación de Risk Engine).

### 14.11 BUILD 004 — Operations Engine + Management Plans

Antes de escribir código se auditó la petición original ("Management Plans Engine" + "Smart Trade Assistant") contra las specs ya aprobadas — la mayor parte ya estaba diseñada con otro nombre (Optimizer, Simulation Engine, Knowledge Engine, AI Decision Center, Trade Capture Engine) y construirla de nuevo habría duplicado esos motores. El hallazgo real, aprobado antes de tocar código: Management Plans es "CRUD simple + Snapshot" (SPEC-015 §2, 21.5 §3.4), nunca un motor matemático, y Operations Engine (SPEC-002) no existía todavía en código — sin `trades`, ningún asistente de gestión en curso tiene nada que gestionar. Se acordó construir primero Operations Engine + Management Plans (este build) y dejar congelada, sin construir, la visión de "Gestión sugerida" para BUILD 005 (§14.12).

**Código implementado**: `management_plans`/`management_plan_partials` (plantilla reutilizable, Entity) + `trades`/`trade_partials_planned`/`trade_partials_executed` con el PlanSnapshot embebido en la propia fila de `trades` (regla 13, patrón Snapshot — nunca una referencia viva al Plan) — todo lo capital-neutral (abrir, registrar parciales, cancelar sin reversión, catálogo de Planes) vive en SQL puro (`supabase/functions/sql/operations.sql`, mismo patrón que `funding.sql`, sin fórmulas). Solo `cerrarOperacion`/`editarOperacion` viven en TypeScript (`packages/operations-engine`, depende de `@tradepilot/risk-engine`, nunca de `@tradepilot/quant-engine` directamente — SPEC-002 §4.1) porque son las únicas dos vías que pueden necesitar R_final/pnl_amount.

**Base de datos**: además del esquema, dos triggers hacen cumplir invariantes de SPEC-002 a nivel de Postgres, no solo de aplicación — inmunes a un futuro bug de la capa de aplicación o a un cliente que escriba directo por REST: `enforce_trade_invariants` (inmutabilidad de `account_id`, invariante 1; máquina de estados completa de §2.3, incluida la exigencia de "0 parciales ejecutados" para la cancelación simple) y `trades_audit_trigger` (todo `UPDATE` de `trades` queda en `audit_log` automáticamente, invariante 5 — "no existe una edición silenciosa"). El cierre/edición/reversión de una Operación mueve capital reutilizando el mismo trigger de recálculo de `account_capital_events` que Funding Management ya tenía (BUILD 001) — un `event_type` nuevo (`trade_pnl`), cero fórmulas nuevas.

**Backend**: `registrar_operacion` resuelve el Plan de Gestión — reutiliza uno guardado o congela uno anónimo nuevo (I11: "toda Operación ejecuta exactamente un Plan, con o sin nombre"), y es idempotente por `(account_id, idempotency_key)`. `OperationsEngineService.editarOperacion` decide si el cambio afecta a R_final (rr_objetivo, r_max, closure_reason, risk_amount) — si no, es una edición pura de datos que nunca invoca a Risk Engine; si sí, recalcula vía `calcularResultado` y reconstruye el acumulador de Risk Engine desde `listar_r_final_vigente_por_cuenta` (la muestra vigente que Risk Engine, BUILD 003, siempre esperó recibir de su llamador). `cerrarOperacion` usa `event_id = trade_id` para la actualización del acumulador — estable porque `OperacionCerrada` es 1:1 con el cierre de una Operación, lo que hace un reintento de ese paso idempotente por construcción vía el propio ledger de Risk Engine, sin inventar mecanismo nuevo.

**Hallazgo real de Challenge Mode** (encontrado ejecutando la validación contra Postgres real, no por inspección): una llamada SQL posicional a `aplicar_edicion_operacion` tras insertar un parámetro nuevo (`p_risk_amount`) en mitad de la lista desplazó silenciosamente todos los argumentos posteriores una posición — escribió `r_final` en la columna `cierre_manual_rr` y nunca aplicó el `pnl_amount` correcto, sin ningún error de Postgres. El adaptador TypeScript nunca estuvo en riesgo (`supabase-js`/PostgREST llama siempre con notación con nombre), pero el propio script de validación SQL sí lo estaba. Corregido moviendo el parámetro al final de la lista y reescribiendo **todas** las llamadas de `supabase/tests/` a notación con nombre (`p_x => valor`) — la función documenta ahora explícitamente la regla: todo parámetro nuevo se añade al final, nunca en medio.

**Tests**: 15 en `packages/operations-engine` (9 de `OperationsEngineService` con `InMemoryTradeGateway` + dobles mínimos de los puertos de Risk Engine para construir un `RiskEngineService` real; 6 del adaptador Supabase). Más 19 comprobaciones SQL contra Postgres real en `supabase/tests/03_operations_engine.sql` — máquina de estados, inmutabilidad de `account_id`, idempotencia, cascada de capital completa (abrir neutral → cerrar mueve capital → editar mueve el delta → la reversión "fantasma" revierte exactamente lo revertido), `audit_log`, y aislamiento RLS cruzado entre dos usuarios. 165 tests en todo el monorepo (77 Quant Engine + 24 Risk Engine + 15 Operations Engine + 49 web), `tsc`/`eslint` limpios.

**Estado tras este build**: el ciclo de vida completo de una Operación existe en código — abrir, parciales, cerrar, editar (auditado), cancelar (simple y "fantasma" con reversión de capital) — con Management Plans como su Snapshot de origen. Ningún punto identificado donde la math viva fuera de Quant Engine/Risk Engine. Lo que queda deliberadamente fuera: cualquier UI (mismo patrón que BUILD 003, backend primero); el Import Adapter de brókers (SPEC-002 §5.7, sin especificar a propósito); la sincronización local-first de la PWA (§6.3/§9.3, fuera de alcance de Operations Engine).

### 14.12 Visión congelada para BUILD 005 — "Gestión sugerida" (Smart Trade Assistant automático)

**Aprobada por el fundador, no construida todavía** — se documenta aquí para que la decisión sobreviva a este build, siguiendo el mismo principio que ya rige cualquier alcance futuro no construido (SPEC-002 §5.7, SPEC-011 §10).

**Objetivo**: cuando el trader abre una Operación, el sistema prepara automáticamente — sin que el trader tenga que preguntar nada — una "Gestión sugerida" completa: parcial recomendado (%), si conviene mover a Break Even o todavía no, la esperanza matemática esperada de esa gestión, el riesgo asociado, un nivel de confianza, y una explicación completa. El trader nunca inicia la pregunta; el sistema la responde antes de que exista.

**Reutiliza exclusivamente motores ya existentes o ya diseñados, sin una sola fórmula nueva**: Quant Engine (Grupo C, agregados ya calculados), Optimizer (SPEC-005, búsqueda de la configuración que maximiza `Score = E−λσ` sobre el propio historial), Simulation Engine (SPEC-011, contrafactual de gestión sobre `r_max` real), Knowledge Engine (SPEC-006, patrones ya descubiertos con evidencia/confianza), Analytics (SPEC-007, motor de Trade Set para filtrar el historial condicionado a un checkpoint de R ya alcanzado — precedente ya sentado por Simulation Engine, que reutiliza el mismo motor en vez de duplicarlo), AI Decision Center (SPEC-010, presentación con explicación y consecuencias, nunca una caja negra).

**Límites que no se negocian, ya aprobados en la auditoría previa a este build**: nunca datos de mercado, nunca precio, nunca estructura, nunca volatilidad, nunca análisis técnico, nunca probabilidad del activo (I9, con su ampliación de 27 §1: solo puede proyectar la propia distribución histórica del trader, nunca el mercado). I17 (Evaluate ≠ Execute) sin excepción — TradePilot nunca ejecuta, solo informa; la decisión es siempre del trader. Toda cifra condicionada a un checkpoint de R hereda el gate de confianza por ancho de intervalo ya usado en Knowledge Engine/13 — nunca se presenta un número seguro calculado sobre una muestra pequeña. El riesgo de dependencia excesiva ya está nombrado y mitigado en 29 §3 (explicar siempre el porqué, nunca auto-aplicar); queda pendiente, cuando se construya, calibrar el presupuesto de atención de I19 específicamente para una superficie que aparece en cada Operación abierta, un perfil de interrupción distinto al de una Coaching Card post-cierre.

**Principio central reforzado por el fundador tras aprobar BUILD 004 (cristalizado aquí, no es un invariante nuevo — composición explícita de I9/27 §1 + I17 + Explainable Quant, no una regla inventada)**: *"TradePilot nunca toma decisiones por el trader. Reduce el esfuerzo cognitivo mostrando las consecuencias estadísticas de cada alternativa de gestión basándose únicamente en el historial del propio trader y en el Quant Engine. La decisión final siempre pertenece al usuario."* Es la línea que evita que "Gestión sugerida" derive, build a build, hacia un copiloto que emite señales de compra/venta — el riesgo que 29 §3 ya nombraba ("erosión de la autonomía del trader") aplicado explícitamente al lenguaje de este build futuro, para que sobreviva a la implementación real y no solo a la intención.

**Contrato de explicabilidad obligatorio ("¿Por qué?")** — cada sugerencia debe poder desplegar, sin excepción: número de operaciones similares que la respaldan (`n`), nivel de confianza en lenguaje natural (Alto/Medio/Bajo, derivado del mismo gate de ancho de intervalo de Knowledge Engine/13, nunca inventado), esperanza matemática histórica (`QuantResult.value`), si la muestra es suficiente (booleano explícito, nunca implícito en el nivel de confianza), y qué variables se usaron (siempre "solo datos históricos del propio usuario", nunca mercado — el propio `inputs_echo` de `QuantResult`, SPEC-001 §3.2/§7, ya es exactamente ese registro). No es un mecanismo nuevo — es `QuantResult<T>` (Explainable Quant, ya construido y usado en cada función pública de Quant Engine desde BUILD 001) combinado con el patrón de evidencia/confianza de Knowledge Engine (13) — se cristaliza aquí como contrato de UX obligatorio para que ningún build futuro lo presente como opcional.

**Bloqueado por — corrección real encontrada al re-auditar esta sección antes de tocar código (no estaba bien en la versión anterior de este mismo párrafo)**: *no* es cierto que "nada de arquitectura" bloquee este build. De los seis motores que "Gestión sugerida" reutiliza, solo Quant Engine y Risk Engine existen en código (`packages/quant-engine`, `packages/risk-engine`) — **Optimizer (SPEC-005), Simulation Engine (SPEC-011), Knowledge Engine (SPEC-006), Analytics (SPEC-007) y AI Decision Center (SPEC-010) siguen siendo únicamente documentos de Fase 1, sin una sola línea de código**. "BUILD 005 = Gestión sugerida" tal como está redactado no es un build, es un programa de al menos cinco builds — construirlo de un salto obligaría a improvisar atajos matemáticos fuera de esos motores, exactamente lo que "reutiliza exclusivamente motores existentes, sin una fórmula nueva" prohíbe. Recomendación de secuencia, a confirmar antes de escribir código: **Optimizer primero** — es el único de los cinco sin dependencia de ningún otro motor no construido (consume directamente Grupo F de Quant Engine, ya congelado; 26 §2.7), responde por sí solo una de las cuatro preguntas de referencia ("¿qué % de parcial tiene mayor esperanza según mi historial?"), y deja Simulation Engine/Analytics/Knowledge Engine/AI Decision Center como builds subsiguientes, cada uno tan acotado como Risk Engine u Operations Engine lo fueron.

### 14.13 BUILD 005 — Optimizer (primer motor de descubrimiento)

**Hallazgo previo al código, resuelto sin tocar arquitectura**: la auditoría exigida antes de implementar encontró que `OptimizationProblem` (SPEC-005 §4.2) tipaba su entrada como `bootstrap_sample: RValue[]` citando 02 §5.2 — pero esa cita reproducía la forma **informal anterior** a que 28 §6.1 la sustituyera. 02 §5.2 habla de reutilizar *"cada **operación** pasada"*, y 28 §2 formalizó eso como `Trade Set` (colección de Operaciones). Proyectarlo a un vector de escalares descartaba `r_final`, `risk_amount` y `closed_at`, y con ellos la posibilidad de calcular `drawdown` y `recovery_factor` (§4.2) y la comparación contra baseline que §10.2 declara obligatoria. **No era un hueco del proyecto: la información existía y otro documento ya la nombraba.** SPEC-005 es el único de los consumidores (006/007/009/011/012/013) que no usaba `Trade Set`. Corregido con un diff mínimo en SPEC-005 §4.2 + su cabecera de dependencias; ninguna otra especificación se tocó.

**Hallazgo secundario, anotado sin corregir**: SPEC-011 §5.1 dice agregar *"la muestra de R_final hipotéticos"* con `calcularProfitFactor`/`calcularRecoveryFactor`, que exigen `Money`, no `RValue`. Como su entrada declarada (§4.4) **sí** es un Trade Set, el dato necesario está disponible y el defecto es de redacción, no de arquitectura — se resolverá cuando se construya Simulation Engine.

**Código implementado** (`packages/optimizer`): Domain Service puro, sin estado, sin persistencia, sin red, sin reloj — verificado por grep, no solo por intención. `evaluator-bridge` + `kernel` son los **únicos** módulos que importan `@tradepilot/quant-engine` como valor (SPEC-005 §3.3, choke point verificable con un `grep`); el resto del paquete usa solo imports de tipo. Ciclo `ask/tell` (§3.2) con `bounded_random_search.v1` como estrategia de referencia y su garantía matemática de cobertura (§2), registro de estrategias con los tres criterios de aprobación como gate real (§6.1), generador con muestreo válido por construcción (§5.1, palo roto sobre grid de 5%), comparador single-objetivo + frente de Pareto (§9), y `explain` (§10.2).

**Decisiones de implementación que evitaron inventar**: (a) qué parciales se consideran disparados sobre un `r_max` histórico no es una regla nueva — es el mismo predicado que `calcularRFinal` ya usa para rechazar un estado imposible y el que 12 §6 aplica en su demostración; se valida con un **golden test contra los números exactos de 12 §6**. (b) Los deltas de §10.2 se calculan con aritmética decimal exacta usando solo la API pública de Quant Engine (`toDecimal(...).minus(...).toFixed(4)` → `rvalue`), sin `number` intermedio y sin modificar el paquete congelado. (c) `evidence_sample_size` expone el `n` real crudo; traducirlo a una etiqueta cualitativa ("Alta/Media/Baja") es competencia de Knowledge Engine (SPEC-006), no de Optimizer — exponer el dato sin calificarlo cumple "nunca ocultar incertidumbre" sin invadir otro motor. (d) Si el baseline no puede evaluarse, la optimización falla de forma honesta en vez de emitir una explicación sin comparación: mostrar un subconjunto de métricas *"elegido por conveniencia"* está prohibido por SPEC-014 §4.3.

**Tests**: 21 en `packages/optimizer` — golden de 12 §6 (muestra de `R_final` exacta y `E[R]=1.2000`), property test de validez estructural sobre 2.000 candidatas de 200 semillas, reproducibilidad por semilla (§6.1/§13.3), independencia del orden de entrada, presupuesto en evaluaciones, restricciones duras, `NO_FEASIBLE_CANDIDATE`, frente de Pareto acotado y explicabilidad completa. **186 tests en todo el monorepo** (77 Quant + 24 Risk + 15 Operations + 21 Optimizer + 49 web), `tsc`/`eslint` limpios.

**Fuera de este build, deliberadamente**: reducción del frente de Pareto por *crowding* (§13.5/§14.3 la difieren hasta que exista uso multiobjetivo real medido — se usa el desempate determinista de §9.3); cualquier estrategia más allá de la de referencia (§6.2, TradePilot Labs); el conjunto de problemas benchmark para estrategias futuras (§6.1, Riesgo #2); AI Engine, que es quien decide cuándo invocar a Optimizer y persiste la recomendación (§3.4 — Optimizer nunca persiste, I17).

### 14.5 Verificación I1-I21 (continuación de §14.1-14.4, numeración conservada del documento aprobado)

- **I15 (precisión decimal)**: verificado — ningún campo monetario/R es `float`; el borde de API usa `string` (§8, hallazgo nuevo de esta entrega).
- **I16 (Zero Friction)**: verificado — el flujo de "capital propio" reduce Empresa+Cuenta a una decisión más un formulario (§5, paso 4), no dos pasos secuenciales completos.
- **I18 (Automation Before Interaction)**: verificado — moneda por defecto USD, nombre de Cuenta por defecto "Cuenta 1", Empresa personal creada sin pedir nombre.
- **I17/I19/I20/I21**: no aplican todavía de forma sustantiva — no hay recomendaciones, tarjetas de atención ni pantallas con más de una decisión en esta entrega; se revisarán en cuanto MVP 0.2+ introduzca ese tipo de superficie.

---

## Puntuación, madurez y veredicto de implementabilidad

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 riesgos de §13, ninguno de diseño — de disciplina de lint, de un caso de prueba a ampliar, y de higiene de despliegue.

**Nivel de madurez**: 96%. Esquema, funciones RPC, triggers, casos de uso, flujo de usuario y testing están completos; lo único pendiente es la ejecución real (escribir el código, correr las migraciones), no ninguna decisión de diseño.

**¿Está listo para programarse sin ninguna decisión arquitectónica pendiente?** **Sí.** Las dos decisiones que este documento tuvo que tomar por sí mismo (kernel decimal: `decimal.js`; API de dinero como `string` en el borde) quedan resueltas y justificadas aquí — ningún ingeniero que implemente este documento necesita decidir nada de arquitectura, solo escribir el código exactamente como está especificado.
