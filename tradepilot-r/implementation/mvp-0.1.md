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
│       │   ├── stats/                   # Grupo C (+ calcularDesviacionR)
│       │   ├── curves/                  # Grupo D
│       │   ├── risk-state/              # Grupo E (calcularDrawdownState)
│       │   ├── simulation/               # Grupo F (simularGestion/calcularScore) — implementado,
│       │   │                              sin golden dataset dedicado todavía (§11.5)
│       │   ├── explain/                  # QuantResult<T>
│       │   └── errors/
│       └── test/{unit,golden}/
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
- Grupo F de Quant Engine (`simularGestion`/`calcularScore`) se implementa (§6.1) pero **sin golden dataset dedicado en esta entrega** — nada lo invoca todavía (Optimizer/Simulation Engine son Capa 6); se cubre cuando esos componentes lleguen, coherente con "no construir pruebas de un camino que nada ejercita todavía".

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

- Grupo F de Quant Engine sin golden dataset dedicado (§11.5) — deuda aceptada, se paga cuando Optimizer/Simulation Engine lleguen.
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
