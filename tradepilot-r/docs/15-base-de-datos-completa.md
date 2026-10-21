# 15 · Base de datos completa — normalización, versionado, logs, configuración e IA

*Voz: Database Architect Senior*

Este documento **extiende** 04-base-de-datos.md, no lo sustituye: reafirma la normalización de lo ya diseñado con el razonamiento formal que un Database Architect Senior debe dejar por escrito, y cierra tres dominios que 04 dejaba implícitos o incompletos — **versionado**, **logs** y **configuración** — más un cierre de dominio para **IA** (reproducibilidad de recomendaciones pasadas).

## 1. Principios de normalización aplicados (con ejemplos reales del esquema)

**1FN (sin grupos repetidos)**: ejemplo ya resuelto en 04 §1.4 — los parciales no son columnas `partial_1_rr, partial_2_rr...`, son filas de `trade_partials_planned`/`trade_partials_executed`. Una columna repetida por índice (`partial_1`, `partial_2`...) es la violación de 1FN más común en esquemas de trading mal diseñados, y es exactamente lo que ese diseño evita.

**2FN (sin dependencias parciales de una clave compuesta)**: ejemplo, `user_stat_buckets` (04 §3) tiene clave compuesta `(user_id, rr_bucket_min, rr_bucket_max)`. Sus atributos no clave (`beta_alpha`, `beta_beta`, `sample_size`) dependen de la combinación completa de las tres columnas — ninguno depende solo de `user_id` (variarían entonces igual en todos los buckets del usuario, lo cual es falso) ni solo del rango de bucket (serían iguales para todos los usuarios, lo cual contradice el principio de 01 §2.5). Satisface 2FN por construcción.

**3FN (sin dependencias transitivas)**: ejemplo, por qué `prop_firms` es una tabla separada de `accounts` y no columnas `firm_name`, `firm_color` dentro de `accounts`. El nombre y el color de una empresa de fondeo no dependen de la cuenta — dependen de la empresa. Si vivieran duplicados en cada fila de `accounts`, cambiar el color de "FTMO" exigiría actualizar N filas (una por cada cuenta de esa empresa) con riesgo real de inconsistencia (dos cuentas de la misma empresa con colores distintos por una actualización parcial). Separar `prop_firms` elimina la dependencia transitiva `account → prop_firm_id → firm_name` y la anomalía de actualización que produciría.

**Denormalización deliberada, no violación**: `accounts.current_capital` es un valor **derivable** (capital inicial + eventos de capital + P&L de operaciones cerradas, §3.1) que se **cachea** en la propia fila de `accounts` en lugar de calcularse sumando en cada lectura. Esto rompería la normalización estricta si fuera un dato con fuente de verdad propia — no lo es: se mantiene por trigger (§3.1), tiene una única fuente de verdad (el ledger `account_capital_events` + `trades`), y su propósito es exclusivamente de rendimiento de lectura (11 §5-6: el dashboard no puede permitirse sumar todo el histórico de eventos en cada carga). Un Database Architect Senior declara esta excepción explícitamente, con su mecanismo de consistencia — no la esconde ni la confunde con negligencia de diseño.

## 2. Tabla por tabla — qué guarda, por qué existe, forma normal

| Tabla | Qué guarda | Por qué existe como tabla propia (no fusionada en otra) | Forma normal |
|---|---|---|---|
| `auth.users` | Identidad de autenticación (gestionada por Supabase) | Separar autenticación de perfil de producto es el límite de responsabilidad estándar entre proveedor de identidad y aplicación | 3FN |
| `profiles` | Datos de producto del usuario: nombre, riesgo% por defecto, λ del optimizador | 1:1 con `auth.users` pero conceptualmente distinto (identidad vs. preferencias de producto) — separarlo evita que el esquema de negocio dependa del esquema interno de Supabase Auth | 3FN |
| `prop_firms` | Catálogo de empresas de fondeo (o "capital propio") por usuario | Evita duplicar nombre/color de empresa en cada cuenta (ver 3FN arriba) | 3FN |
| `accounts` | Una cuenta de trading: capital, moneda, empresa a la que pertenece | Es la unidad real de gestión de riesgo del trader (01 §1, persona P1) — no puede fusionarse con `prop_firms` porque la cardinalidad es 1:N (una empresa, muchas cuentas) | 3FN (con cache justificado, §1) |
| `account_rules` | Límites de drawdown/objetivo de la prop firm para esa cuenta | Separada de `accounts` porque son datos de naturaleza distinta (reglas externas impuestas por la firma vs. estado propio de la cuenta) y de cardinalidad 1:1 opcional (no toda cuenta de capital propio tiene reglas de prop firm) | 3FN |
| `account_capital_events` *(nuevo, §3.1)* | Ledger inmutable de depósitos, retiradas, resets y ajustes de capital | Sin esta tabla, `current_capital` no tiene historia — no se puede reconstruir la curva de capital real ni auditar un reset de cuenta de una prop firm | 3FN, append-only |
| `trades` | Una operación: símbolo, dirección, riesgo, RR objetivo, resultado derivado | Entidad central del dominio (01 §5, 11 §1) | 3FN |
| `trade_partials_planned` | Configuración de parciales planificada al abrir la operación | Separada de `trades` (1FN) y separada de `_executed` porque planificación ≠ ejecución real — ambas son necesarias para que el optimizador aprenda comparando intención vs. resultado (02 §6, 04 §1.5) | 3FN |
| `trade_partials_executed` | Parciales realmente ejecutados | Ídem — cardinalidad 1:N respecto a `trades`, independiente de la planificación | 3FN |
| `trade_screenshots` | Capturas adjuntas a una operación, con detección IA opcional | Cardinalidad 1:N (una operación puede tener varias capturas); separarla evita nulls masivos en `trades` para un dato opcional y de naturaleza distinta (binario/adjunto vs. datos estructurados) | 3FN |
| `ai_recommendations` | Auditoría de cada recomendación generada: input, output, explicación, si se aplicó | Es un log de dominio, no una tabla operativa — cardinalidad 1:N respecto a `trades` (una operación puede haber recibido varias recomendaciones a lo largo de su gestión) o 0:N si es exploración libre en la calculadora | 3FN |
| `user_stat_buckets` | Parámetros bayesianos `(α, β)` ponderados por recencia, por usuario y bucket de RR | Cache de un cómputo costoso de recorrer (13 §3) — se recalcula de forma incremental, no se deriva en cada lectura | 2FN/3FN (cache justificado igual que `current_capital`) |
| `user_preferences` *(nuevo, §3.2)* | Preferencias de cola larga, poco consultadas (tema visual, idioma, notificaciones) | Ver §3.2 — evita migraciones de esquema por cada preferencia nueva de bajo impacto, sin mezclar esa cola larga con las columnas críticas de `profiles` que sí se leen en cada cálculo | 1FN estricta (clave-valor declarado como tal, no una tabla "de negocio" disfrazada) |
| `feature_flags` *(nuevo, §3.3)* | Catálogo de funcionalidades en despliegue progresivo | Mecanismo de rollout ya previsto en 11 §2, ahora especificado | 3FN |
| `user_feature_overrides` *(nuevo, §3.3)* | Excepciones de flag por usuario (activar/desactivar manualmente) | Separada del catálogo porque es una relación N:M usuario↔flag, no un atributo del catálogo | 3FN |
| `audit_log` *(nuevo, §3.4)* | Quién hizo qué, cuándo, sobre qué entidad sensible | Ver 11 §11 (ya anticipada, ahora especificada con DDL e inmutabilidad forzada) | 3FN, append-only |

## 3. Nuevas tablas (DDL)

### 3.1 Versionado de capital — `account_capital_events`

```sql
create table public.account_capital_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null check (event_type in ('initial','deposit','withdrawal','reset','adjustment')),
  amount numeric(18,4) not null,              -- con signo: positivo incrementa, negativo decrementa
  occurred_at timestamptz not null default now(),
  note text,
  created_by uuid not null references auth.users(id)
);

alter table public.account_capital_events enable row level security;

create policy "capital_events_owner_rw" on public.account_capital_events
  for all using (exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));

create index capital_events_account_idx on public.account_capital_events(account_id, occurred_at);
```

`accounts.current_capital` deja de ser un valor editado a mano: se mantiene por trigger, con una única fuente de verdad (este ledger + las operaciones cerradas):

```sql
create or replace function public.recompute_account_capital(p_account_id uuid) returns void as $$
begin
  update public.accounts set current_capital =
    initial_capital
    + coalesce((select sum(amount) from public.account_capital_events where account_id = p_account_id), 0)
    + coalesce((select sum(pnl_amount) from public.trades where account_id = p_account_id and status = 'closed'), 0)
  where id = p_account_id;
end;
$$ language plpgsql security definer;

create or replace function public.trg_recompute_capital() returns trigger as $$
begin
  perform public.recompute_account_capital(coalesce(new.account_id, old.account_id));
  return null;
end;
$$ language plpgsql;

create trigger recompute_capital_on_event
  after insert or update or delete on public.account_capital_events
  for each row execute function public.trg_recompute_capital();

create trigger recompute_capital_on_trade_close
  after insert or update of status, pnl_amount on public.trades
  for each row when (new.status = 'closed')
  execute function public.trg_recompute_capital();
```

**Por qué esto cierra una laguna real del diseño anterior**: 04 definía `current_capital` como una columna mutable sin mecanismo de actualización explícito — en la práctica, alguien tendría que escribirla a mano desde el cliente, lo cual (a) es una fuente directa de descuadre con el broker/prop firm real, y (b) pierde para siempre el historial de depósitos/retiradas/resets que un trader de cuentas fondeadas necesita poder auditar (01 §1, persona P1: "reset de cuenta" es un evento real y frecuente en prop firms).

### 3.2 Configuración — `user_preferences`

```sql
create table public.user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;

create policy "preferences_owner_rw" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Decisión explícita, no por defecto**: no toda configuración vive aquí. `default_risk_pct` y `optimizer_lambda` (04 §3, tabla `profiles`) se quedan como **columnas tipadas**, no como entradas de esta tabla clave-valor, porque se leen en el camino crítico de cada cálculo de la calculadora (05 §2) — un valor tipado con `numeric(5,2)` y `check` de rango es más rápido de leer, más seguro de validar y más simple de indexar que un `jsonb` genérico. `user_preferences` existe exclusivamente para la cola larga de preferencias de bajo impacto y alta variabilidad (tema visual, idioma, activación de notificaciones) que crecerá con el tiempo — usar clave-valor aquí evita una migración de esquema por cada preferencia nueva de ese tipo, sin sacrificar el rendimiento de las que sí importan en cada cálculo. Es una decisión híbrida deliberada, no una inconsistencia.

### 3.3 Feature flags — despliegue progresivo (ya anticipado en 11 §2)

```sql
create table public.feature_flags (
  key text primary key,
  description text not null,
  rollout_pct smallint not null default 0 check (rollout_pct between 0 and 100),
  enabled_globally boolean not null default false
);

create table public.user_feature_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  primary key (user_id, flag_key)
);

alter table public.feature_flags enable row level security;
alter table public.user_feature_overrides enable row level security;

create policy "flags_read_all_authenticated" on public.feature_flags
  for select using (auth.role() = 'authenticated');
create policy "overrides_owner_rw" on public.user_feature_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3.4 Logs de auditoría — `audit_log` (especificación de 11 §11)

```sql
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,                  -- 'account' | 'prop_firm' | 'trade' | ...
  entity_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  diff jsonb,                                   -- { before: {...}, after: {...} }
  occurred_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log_owner_read" on public.audit_log
  for select using (auth.uid() = user_id);
-- deliberadamente: sin policy de insert/update/delete para el rol autenticado.
-- Solo un rol de servicio (Edge Function/trigger) escribe aquí.

create or replace function public.audit_log_immutable() returns trigger as $$
begin
  raise exception 'audit_log es append-only: % no permitido', TG_OP;
end;
$$ language plpgsql;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
```

**Por qué la inmutabilidad se fuerza con un trigger y no solo con una convención de equipo**: un log de auditoría que puede editarse o borrarse no es un log de auditoría, es una nota. La garantía tiene que vivir en la base de datos, no en la disciplina de quien escriba el código de la aplicación — coherente con la filosofía de RLS de 04 §4 ("la base de datos nunca confía únicamente en la capa de aplicación").

### 3.5 Reproducibilidad de IA — ajuste a `ai_recommendations`

```sql
alter table public.ai_recommendations
  add column algorithm_version text not null default 'v1';
```

**Por qué**: si el algoritmo del optimizador cambia (resolución de grid, fórmula de `Score`, 02 §5), una recomendación histórica debe seguir siendo interpretable con el algoritmo que realmente la generó, no con el vigente hoy. Sin esta columna, una auditoría futura de "por qué el sistema recomendó esto en su momento" sería irreproducible — coherente con el versionado de API ya exigido en 11 §3 (`/v1/...` desde la primera función).

### 3.6 Ajuste de precisión — `user_stat_buckets.sample_size`

```sql
alter table public.user_stat_buckets
  alter column sample_size type numeric(10,4);
```

**Por qué**: 13 §4 introduce ponderación por decaimiento temporal — el "tamaño de muestra" ya no es un conteo entero de operaciones, es una suma ponderada (`Σ exp(−Δt/τ)`), que es fraccionaria por definición. Mantenerlo como `integer` (04 original) truncaría silenciosamente esa ponderación.

## 4. Relaciones — inventario completo

| Relación | Cardinalidad | ON DELETE | Por qué esta regla |
|---|---|---|---|
| `profiles.id → auth.users.id` | 1:1 | CASCADE | El perfil no tiene sentido sin el usuario de auth |
| `prop_firms.user_id → auth.users.id` | N:1 | CASCADE | Catálogo propiedad exclusiva del usuario |
| `accounts.prop_firm_id → prop_firms.id` | N:1 | CASCADE | Una cuenta no puede existir sin su empresa (incluida "capital propio") |
| `account_rules.account_id → accounts.id` | 1:1 | CASCADE | Reglas sin cuenta no tienen referente |
| `account_capital_events.account_id → accounts.id` | N:1 | CASCADE | Ledger propiedad exclusiva de la cuenta |
| `trades.account_id → accounts.id` | N:1 | CASCADE | Operación sin cuenta no es válida en el dominio (01 §5) |
| `trade_partials_planned/executed.trade_id → trades.id` | N:1 | CASCADE | Parciales no existen sin su operación |
| `trade_screenshots.trade_id → trades.id` | N:1 | CASCADE | Adjunto sin operación no tiene sentido |
| `ai_recommendations.trade_id → trades.id` | N:1, **nullable** | CASCADE | Nullable porque una recomendación puede originarse en exploración libre de la calculadora, sin operación real asociada (03 §4) |
| `user_stat_buckets.user_id → auth.users.id` | N:1 | CASCADE | Perfil estadístico propiedad exclusiva del usuario (01 §2.5 — nunca compartido) |
| `user_preferences.user_id → auth.users.id` | N:1 | CASCADE | Idéntico razonamiento |
| `user_feature_overrides.flag_key → feature_flags.key` | N:1 | CASCADE | Una excepción no puede apuntar a un flag inexistente |
| `audit_log.user_id → auth.users.id` | N:1 | CASCADE | El log pertenece al usuario auditado; se borra solo si se borra la cuenta completa (derecho de supresión) |

**Nota sobre `ON DELETE CASCADE` como decisión consciente, no por defecto**: se usa en todas las relaciones porque el árbol de propiedad (11 §1) es estrictamente jerárquico y de un solo dueño — borrar un usuario debe borrar en cascada todo lo que le pertenece, sin dejar filas huérfanas que violarían la integridad referencial silenciosamente. La única alternativa considerada y descartada fue `ON DELETE RESTRICT` en `trades`/`accounts` para forzar borrado explícito nivel a nivel — se descarta porque añade fricción de producto (borrar una cuenta debería ser una acción, no una cascada manual de N pasos) sin beneficio real, dado que el propio flujo de UI ya pide confirmación explícita antes de borrar una cuenta con operaciones.

## 5. "Versionado": las tres cosas distintas que significa en este esquema

El término es ambiguo si no se precisa — un Database Architect Senior lo desambigua explícitamente:

1. **Versionado de esquema** (migraciones): no es una tabla, es una práctica — todo cambio de esquema es SQL versionado en control de código, aplicado vía CI (11 §4). Ya cubierto, se referencia aquí para que quede completo el mapa de "versionado" del proyecto.
2. **Versionado de datos de negocio en el tiempo**: `account_capital_events` (§3.1) — el capital de una cuenta no es un número, es una serie temporal de eventos; el número que se muestra en el dashboard es una proyección cacheada de esa serie, no la fuente de verdad.
3. **Versionado de comportamiento del sistema** (reproducibilidad de IA): `ai_recommendations.algorithm_version` (§3.5) — una recomendación pasada se interpreta con el algoritmo que la generó, no con el vigente.

Ninguna de las tres se resuelve con la misma técnica, y confundirlas (por ejemplo, intentar resolver el versionado de capital con un log de auditoría genérico, o el versionado de esquema con una tabla) habría producido un diseño más complicado y menos correcto que tratarlas por separado, como se ha hecho aquí.
