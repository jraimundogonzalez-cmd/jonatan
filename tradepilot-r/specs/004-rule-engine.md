# SPEC-004 · Rule Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 18 §2 (drawdown estático/trailing), 19 regla 4 (anti-hardcoding), 19 regla 13 (Snapshot), 19 regla 14 (Calcular ≠ Juzgar), 19 I16 (Zero Friction, nueva — §15), 20 §0 (conflicto original que originó el Rule Engine), 21.5 §3.6 (Rule Profile), 22 (diseño conceptual completo: jerarquía, 7 arquetipos + 1 categoría de cálculo, distinción `account_state`/`operation_event`, resolución de dependencias), 22.5 §2.4 (contrato de módulo), 26 §2.6/§8 (frontera con Risk Engine/Quant Engine), 32 §3.6/§3.8/§3.11 (contratos de dominio de Rule Profile, Snapshot, Rule Evaluation), SPEC-001 (Quant Engine), SPEC-002 (Operations Engine, productor de eventos), SPEC-003 §11.2 (deja como requisito explícito el esquema real de `RuleProfile`/`RuleProfileSnapshot`, entregado aquí)
**No re-abre ninguna decisión conceptual ya aprobada.** El diseño de 22 (jerarquía, arquetipos, `scope`) se traduce a esquema y algoritmos concretos — no se rediseña. Los hallazgos nuevos de este documento se marcan explícitamente (§14).

---

## 1. Objetivo del componente

### 1.1 Qué es Rule Engine

El sistema de cumplimiento normativo de TradePilot. Su única responsabilidad es **interpretar reglas configurables contra hechos ya calculados por otros módulos** y producir un veredicto. No es una fuente de hechos, no es una fuente de magnitudes, no es un actor sobre el sistema.

### 1.2 Qué nunca debe hacer (instrucción explícita del fundador, traducida a reglas verificables)

1. **Nunca calcula un resultado matemático.** No reimplementa `R_final`, esperanza, ni `DrawdownState` — los consume ya calculados (§4.2, con una corrección importante sobre de quién los consume).
2. **Nunca almacena hechos que pertenezcan a otro módulo.** No guarda capital, no guarda datos de una Operación más allá de la referencia mínima necesaria para su propio veredicto (`trade_id`, §2.4).
3. **Nunca modifica una Operación, una Cuenta o cualquier entidad de otro módulo.** Su única escritura es su propio catálogo (`rule_*`) y el registro append-only de `Rule Evaluation` (32 §3.11, ya vigente).
4. **Nunca bloquea el registro de una Operación** (22 §7, ya vigente, reafirmado en SPEC-002 §4.2 como regla de implementación literal).
5. **Nunca contiene el nombre de una empresa ni una condición específica de una prop firm en su código.** Toda variación entre empresas vive como datos en `rule_definitions`/`rule_instances` (19 regla 4) — el núcleo del motor no cambia cuando aparece una prop firm nueva, solo cuando aparece una *forma de regla* genuinamente nueva (§11).

### 1.3 Responsabilidades

- Mantener la Rule Library (catálogo de `Rule Definition`, §3) y el CRUD de `Rule Profile`/`Rule Instance` — incluido para Perfiles cuya propiedad de dominio es de una Empresa (SPEC-003 §3.2, ya aclarado: propiedad de dominio ≠ responsabilidad de módulo).
- Producir y conservar `RuleProfileSnapshot` al ser adoptado por una Cuenta (vía Snapshot Engine, 22.5 §2.11).
- Evaluar Rule Instances contra hechos ya calculados, produciendo `Rule Evaluation` (§4, §9).
- Resolver dependencias entre reglas compuestas sin intervención manual del usuario (§5 — aplicación directa de I16).
- Permitir que una prop firm nueva se incorpore sin tocar código, siempre que sus reglas encajen en los arquetipos existentes (§11).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Calcular `DrawdownState`, `R_final`, esperanza o cualquier fórmula | Quant Engine, vía Risk Engine — **nunca invocado directamente por Rule Engine** (§14.1, corrección) |
| Registrar el hecho histórico de una Operación | Operations Engine (SPEC-002) |
| Representar el estado real de capital de una Cuenta | Funding Management (SPEC-003) |
| Decidir qué mostrar al trader y cuándo (Coaching Card, notificaciones) | AI Engine / Notification Engine — Rule Engine solo emite `ReglaIncumplida`, nunca decide su presentación |
| Actuar sobre el sistema (escalar una cuenta, generar un payout) cuando una regla de progreso se cumple | Ningún módulo, hoy — es un hallazgo explícito de esta auditoría (§14.4): Rule Engine nunca actúa, solo evalúa |

---

## 2. Arquitectura

### 2.1 Jerarquía (confirma 22 §3, se traduce a esquema)

```
Rule Library
  └─ Rule Definition (versionada, §8)
       └─ Rule Instance (dentro de un Rule Profile — parámetros concretos)
            └─ Rule Profile (propiedad de dominio: Empresa; CRUD: Rule Engine)
                 └─ Rule Profile Snapshot (VO con identidad técnica, 32 §1 — adoptado por una Cuenta)
                      └─ Rule Evaluation (registro append-only, 32 §3.11)
```

### 2.2 Esquema (entrega el requisito dejado pendiente por SPEC-003 §11.2)

```sql
-- ============================================================
-- RULE DEFINITIONS (la Library — catálogo global, versionado)
-- ============================================================
create table public.rule_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null,                        -- 'static_drawdown', 'consistency_rule'... estable, nunca renombrado
  version int not null default 1,            -- §8 — inmutable una vez usada por cualquier Rule Instance
  name text not null,
  description text,
  archetype text not null check (archetype in (
    'static_threshold','dynamic_threshold','progress_to_target',
    'set_membership','time_window','time_window_external_source','composite'
  )),
  category text not null check (category in ('compliance','calculation')),
  scope text not null check (scope in ('account_state','operation_event')),
  parameter_schema jsonb not null,            -- JSON Schema de los parámetros que exige una Instance
  depends_on_definition_key text,             -- solo archetype = 'composite' — referencia por key, no por id (§5)
  archetype_version text not null,            -- p.ej. "static_threshold.v1" — §8
  unique (key, version)
);

-- ============================================================
-- RULE PROFILES (propiedad de dominio: Empresa — CRUD: Rule Engine)
-- ============================================================
create table public.rule_profiles (
  id uuid primary key default gen_random_uuid(),
  prop_firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- RULE INSTANCES (una Definition + parámetros, dentro de un Profile)
-- ============================================================
create table public.rule_instances (
  id uuid primary key default gen_random_uuid(),
  rule_profile_id uuid not null references public.rule_profiles(id) on delete cascade,
  rule_definition_id uuid not null references public.rule_definitions(id),
  parameters jsonb not null,                  -- validados contra parameter_schema al componerse
  mode text not null default 'enforced' check (mode in ('enforced','shadow')),   -- §10, reglas experimentales
  effective_from timestamptz,                  -- §10, reglas temporales — null = siempre activa
  effective_until timestamptz,
  active_only_in_status text[],                 -- p.ej. {'challenge'} — §10, reglas temporales ligadas a fase de cuenta
  created_at timestamptz not null default now()
);

-- ============================================================
-- RULE PROFILE SNAPSHOTS (VO, identidad técnica — 32 §1)
-- ============================================================
create table public.rule_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_rule_profile_id uuid not null references public.rule_profiles(id),
  frozen_instances jsonb not null,             -- copia inmutable de rule_instances + su rule_definition resuelta
  created_at timestamptz not null default now()
);
-- Sin UPDATE ni DELETE permitido — mismo mecanismo de 15 §3.4 (trigger que rechaza ambas operaciones)

-- ============================================================
-- RULE EVALUATIONS (append-only — 32 §3.11)
-- ============================================================
create table public.rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  rule_profile_snapshot_id uuid not null references public.rule_profile_snapshots(id),
  rule_definition_key text not null,            -- de qué regla del snapshot congelado
  trade_id uuid references public.trades(id),    -- solo para scope = 'operation_event'
  verdict text not null check (verdict in ('compliant','violated','unavailable')),  -- §7
  margin numeric(18,4),
  triggering_event_sequence bigint not null,      -- §14.2 — inmune a escritura desordenada
  evaluated_at timestamptz not null default now(),
  evaluation_context jsonb not null                -- inputs usados — Explainable Quant-style, §9
);
-- Trigger BEFORE UPDATE/DELETE → rechaza siempre, igual que audit_log (15 §3.4)

create index rule_evaluations_account_idx on public.rule_evaluations(account_id, evaluated_at desc);
```

### 2.3 Subcomponentes

```
rule-engine/
├── library/            CRUD de Rule Definition, validación de esquema de parámetros
├── profiles/            CRUD de Rule Profile/Rule Instance, validación de composición (§5, §7)
├── snapshot/            Adopción de Snapshot (vía Snapshot Engine)
├── evaluators/           Los 7 arquetipos — funciones puras, sin estado, sin I/O (§3)
├── orchestrator/         Pipeline de evaluación completo (§4)
└── errors/               Catálogo de errores tipado
```

### 2.4 Qué referencia mínima de otra Operación guarda Rule Engine

Solo `trade_id` (para reglas `operation_event`) — nunca el resto de campos de la Operación. Es la aplicación literal de "nunca almacena hechos" (§1.2, punto 2): Rule Engine no duplica `symbol`, `risk_pct` ni ningún otro dato de Operations Engine; si `evaluation_context` (§9) necesita mostrar qué símbolo se evaluó, lo copia como valor de auditoría puntual dentro de ese JSON, no como una columna relacional que pretenda ser una segunda fuente de verdad.

---

## 3. Arquetipos de evaluador

Confirma los 7 arquetipos + 1 categoría de cálculo de 22 §4, con contrato de función pura:

```
type Evaluador<P> = (parametros: P, inputs: EvaluationInputs) => Veredicto

interface EvaluationInputs {
  account_facts: { current_capital: Money; peak_capital: Money; initial_capital: Money; status: EstadoCuenta }  // de Funding Management
  risk_magnitudes?: DrawdownState                                                                                  // de Risk Engine, solo si el arquetipo lo necesita
  operation_facts?: { symbol: string; side: string; opened_at: Timestamp; risk_pct: Percent; time_in_market_sec?: number }  // solo scope operation_event
  sibling_verdicts?: Record<string, Veredicto>                                                                     // solo archetype = 'composite', §5
}

type Veredicto =
  | { verdict: "compliant"; margin: RValue | Percent | Money }
  | { verdict: "violated"; margin: RValue | Percent | Money }
  | { verdict: "unavailable"; reason: string }    // §7 — nunca se infiere compliant/violated sin datos
```

| Arquetipo | Inputs que consume | Reglas de la Library (22 §6) |
|---|---|---|
| Umbral estático (`static_threshold`) | `account_facts` o `operation_facts` según scope | Static Drawdown, Maximum Loss, Daily Loss Limit, Position Size Restriction |
| Umbral dinámico (`dynamic_threshold`) | `account_facts.peak_capital`, `risk_magnitudes` | Trailing Drawdown, End Of Day Trailing |
| Progreso hacia objetivo (`progress_to_target`) | `account_facts` | Profit Target, Minimum Trading Days |
| Pertenencia a conjunto (`set_membership`) | `operation_facts` | Instrument Restriction |
| Ventana temporal (`time_window`) | `operation_facts.opened_at` | Time Restriction, Weekend Restriction, Overnight Restriction |
| Ventana temporal + fuente externa (`time_window_external_source`) | `operation_facts.opened_at` + calendario externo (diferido, 22 §9) | News Restriction |
| Compuesto (`composite`) | `sibling_verdicts` (§5) | Consistency Rule |
| — (`calculation`, sin veredicto) | `account_facts` | Profit Split — no produce `Veredicto`, alimenta `Beneficio_neto_estimado` (SPEC-003 §5.5) directamente, fuera del pipeline de evaluación de §4 |

**Invariante de pureza (nuevo, §14.3)**: todo evaluador es una función pura sin estado compartido entre invocaciones, mismo principio que Quant Engine (SPEC-001 §2.3) — es la garantía estructural de que el orden de evaluación entre Rule Instances *independientes* (sin relación de dependencia) nunca puede alterar el resultado de ninguna de ellas.

---

## 4. Pipeline de evaluación

### 4.1 Disparo

Asíncrono siempre (§6), consumiendo: `OperacionRegistrada`, `OperacionCerrada`, `OperacionEditada`, `OperacionCancelada` (SPEC-002 §3.1) y `CapitalRecalculado` (SPEC-003 §9.1).

### 4.2 Obtención de magnitudes — corrección sobre "Quant Engine" como consumo directo

**Hallazgo de esta especificación (§14.1, detallado más abajo)**: el pipeline **nunca** invoca a Quant Engine directamente. Cuando un arquetipo necesita `DrawdownState`, el orquestador lo solicita a Risk Engine (que internamente invoca a Quant Engine, 26 §8), nunca al paquete `quant-engine` en sí. El resultado observable es el mismo que si Rule Engine "consumiera Quant Engine" en sentido informal — la corrección es de frontera arquitectónica, no de comportamiento.

### 4.3 Pasos del pipeline

```
1. Cargar RuleProfileSnapshot vigente de la Cuenta (referencia opaca recibida de Funding Management, SPEC-003 §4.3)
2. Filtrar Rule Instances del snapshot:
   a. Por scope: operation_event solo si el evento trae un trade_id; account_state siempre
   b. Por mode: 'shadow' se evalúa igual, pero nunca emite ReglaIncumplida ni actualiza compliance_flag (§10)
   c. Por vigencia temporal: effective_from/effective_until, active_only_in_status (§10)
3. Para las de scope account_state: solicitar a Risk Engine el DrawdownState correspondiente (§4.2)
4. Ordenar topológicamente por dependencia de Definition (§5) — hoja primero, compuestas después
5. Evaluar cada Rule Instance con su arquetipo (§3), función pura, sin mutación compartida
6. Persistir cada resultado como Rule Evaluation (append-only, §2.2), con triggering_event_sequence (§14.2)
7. Actualizar accounts.compliance_flag (SPEC-003 §4.1) SOLO si triggering_event_sequence > la del último valor cacheado (§14.2)
8. Por cada Veredicto = violated en modo 'enforced' (nunca 'shadow'): emitir ReglaIncumplida
```

---

## 5. Resolución de dependencias entre reglas

**Simplificación deliberada, justificada por I16 (Zero Friction, §15)**: en vez de que el usuario deba conectar manualmente "esta Consistency Rule depende de aquella Profit Target" al componer un Rule Profile (una tarea de varios clics, exactamente lo que I16 exige evitar para cualquier tarea frecuente), la dependencia se declara **una sola vez, a nivel de Rule Definition** (`depends_on_definition_key`, §2.2) y se resuelve automáticamente por convención al componer: una Rule Instance de tipo `composite` busca, dentro del mismo Rule Profile, la Rule Instance cuyo `rule_definition.key` coincide con `depends_on_definition_key`. El usuario nunca ve ni configura un grafo — solo añade "Consistency Rule" a su perfil, y si ese perfil no tiene ya una instancia de "Profit Target", el sistema lo señala como composición inválida (`MISSING_DEPENDENCY_INSTANCE`, §7) en el momento de guardar, no al evaluar.

**Validación de ciclos — dónde ocurre y por qué es más barata de lo que 22 §5 anticipaba**: como la dependencia se declara a nivel de Library (un grafo pequeño y curado por el equipo, no por cada Empresa), la validación de aciclicidad ocurre **una sola vez, al añadir o editar una Rule Definition** (tiempo de administración del catálogo, evento raro) — nunca al componer un Rule Profile. Si el grafo de la Library es acíclico, ninguna composición de Rule Instances derivada de él puede generar un ciclo, porque la resolución por convención (párrafo anterior) es un espejo exacto de ese mismo grafo. Esto es una mejora real sobre el diseño conceptual de 22 §5 (que validaba el ciclo por cada Rule Profile compuesto): la validación se mueve de "cada vez que una Empresa configura sus reglas" (frecuente) a "cada vez que el equipo añade un arquetipo compuesto nuevo" (raro) — otra aplicación directa de I16.

Algoritmo: DFS con detección de back-edge (o Kahn's algorithm) sobre el grafo dirigido `rule_definitions.depends_on_definition_key`, ejecutado como parte de la validación de escritura de `library.crearDefinicion`/`library.editarDefinicion`.

---

## 6. Evaluaciones síncronas vs. asíncronas

**Distinción precisa, para no reintroducir accidentalmente un bloqueo del camino crítico de Operations Engine (SPEC-002 §4.2)**:

- **Escritura de una nueva evaluación**: siempre asíncrona, siempre parte del pipeline de §4, disparada por un evento de dominio ya persistido en otro módulo. No existe, en ningún punto del sistema, una llamada síncrona que espere a que Rule Engine termine de evaluar.
- **Lectura del estado de cumplimiento**: siempre síncrona y barata — es una lectura del campo cacheado `accounts.compliance_flag` (SPEC-003 §4.1) o de la última fila de `rule_evaluations` por `(account_id, rule_definition_key)`, ambas con índice directo (§2.2). El Dashboard Maestro (18 §6) y cualquier pantalla que muestre el semáforo leen esto de forma síncrona sin jamás disparar una evaluación nueva.

Dentro del propio pipeline asíncrono (§4), no existe una segunda cola separada entre reglas `operation_event` (evaluación local, sin llamada externa) y `account_state` (requieren `DrawdownState` de Risk Engine, §4.2) — ambas completan dentro del mismo paso de worker, porque `calcularDrawdownState` es O(1) (SPEC-001 §5.1, <1ms) y no justifica la complejidad de una segunda cola. Si en producción esa latencia dejara de cumplirse, es una revisión de rendimiento futura, no una razón para introducir complejidad especulativa ahora.

---

## 7. Gestión de errores

```
type RuleEngineError =
  | { code: "INVALID_PARAMETER_SCHEMA"; field: string; detail: string }        // al componer una Rule Instance
  | { code: "MISSING_DEPENDENCY_INSTANCE"; requires_definition_key: string }    // §5
  | { code: "CYCLIC_DEPENDENCY_IN_LIBRARY"; path: string[] }                    // §5, al editar la Library
  | { code: "DUPLICATE_DEFINITION_KEY_VERSION" }
  | { code: "SNAPSHOT_NOT_FOUND" }
  | { code: "RISK_ENGINE_UNAVAILABLE"; retry_after_ms: number }                 // §4.2 — nunca produce un veredicto falso
```

**Regla central de este catálogo**: cuando un arquetipo no puede obtener un input que necesita (Risk Engine no responde, el calendario externo de News Restriction no está disponible), el veredicto persistido es **`unavailable`** (§2.2/§3), nunca `compliant` por defecto ni `violated` por defecto — ambos serían una invención de dato en un sistema de cumplimiento, exactamente el tipo de aproximación que Challenge Mode rechaza (mismo principio que `UNDEFINED_RATIO` en SPEC-001 §3.3, aplicado aquí a un veredicto de cumplimiento en vez de a un cociente matemático).

---

## 8. Versionado

Dos ejes, extendiendo directamente la disciplina ya establecida en SPEC-001 §4.5:

1. **`archetype_version`** (p.ej. `"static_threshold.v1"`) — versiona la *lógica de evaluación* de un arquetipo. Inmutable una vez usada en cualquier `Rule Evaluation` persistida; un cambio de comportamiento publica `v2`, nunca sobrescribe `v1`.
2. **`rule_definitions.version`** (entero, por `key`) — versiona los *metadatos y el esquema de parámetros* de una Rule Definition. **Hallazgo de esta especificación**: sin esto, editar una Rule Definition ya usada por Rule Instances existentes reproduciría exactamente el problema que la regla 13 (Snapshot) ya resolvió para Plan/Perfil de Reglas — una Rule Instance compuesta hace un año podría "cambiar de significado" silenciosamente si se edita hoy la Definition que referencia. Se resuelve igual: una Rule Instance referencia `rule_definition_id` (una versión concreta, inmutable), nunca `key` a secas; editar una Definition crea una nueva fila con `version + 1`, la anterior sigue existiendo y sigue siendo referenciable por las Instances que ya la usan.

Ninguna versión se elimina mientras exista al menos una `Rule Instance` o `Rule Evaluation` que la referencie — mismo principio de retención que SPEC-001 §3.9/§4.5.

---

## 9. Auditoría (requisito propio del componente, distinto de la auditoría del capítulo, §16)

Dos mecanismos, cada uno append-only por diseño, nunca por convención (mismo patrón que `audit_log`, 15 §3.4):

1. **`rule_evaluations`** (§2.2) — cada veredicto individual, con `evaluation_context` (JSON) conteniendo los inputs exactos usados (Explainable Quant-style, SPEC-001 §7 — mismo principio: resultado + fórmula + versión + datos + confianza, adaptado aquí a "veredicto + arquetipo + `archetype_version` + inputs + margen").
2. **Cambios de composición de un Rule Profile** (añadir/quitar/editar una Rule Instance, cambiar su `mode` de `shadow` a `enforced`) — se registran en `audit_log` (15 §3.4, ya vigente, sin tabla nueva) porque, a diferencia de una evaluación (un hecho calculado), una composición es una decisión editable de la Empresa que puede cambiar qué significa "cumplir" hacia adelante — exactamente el tipo de mutación sensible que `audit_log` ya está diseñado para capturar.

---

## 10. Preparación para reglas futuras, temporales, experimentales y dependientes

Ya integrado en el esquema de §2.2, no como una capa aparte:

- **Reglas futuras**: cualquier regla que encaje en un arquetipo existente es pura composición de datos (§11). Una genuinamente nueva requiere un arquetipo nuevo — evento raro, aislado, documentado en §11.
- **Reglas temporales**: `effective_from`/`effective_until` (vigencia por fecha) y `active_only_in_status` (vigencia por fase de cuenta, p.ej. una restricción que solo aplica durante `challenge`) — ambos evaluados en el paso 2c del pipeline (§4.3), nunca requieren una segunda Rule Definition.
- **Reglas experimentales**: `mode: 'shadow'` — se evalúan y persisten igual que cualquier otra (mismo rigor de auditoría, §9), pero nunca emiten `ReglaIncumplida` ni afectan `compliance_flag` — permite al equipo validar una regla nueva contra datos reales antes de activarla, coherente con la cultura de validación empírica antes de comprometerse (TPOS, 31).
- **Reglas dependientes entre sí**: resuelto en §5 — declarado una vez en la Library, nunca configurado por el usuario.
- **Reglas parametrizables**: ya el mecanismo por defecto (`parameters` validado contra `parameter_schema`) — no es una capacidad añadida, es como toda Rule Instance funciona desde el diseño de 22.

---

## 11. Cómo se incorpora una prop firm nueva sin tocar código

**Camino normal (esperado, sin código)**: el equipo o la propia prop firm (vía el catálogo de plantillas, 20 Fase 2) compone un `Rule Profile` nuevo eligiendo `Rule Instances` de la Library existente y fijando parámetros — cero despliegue, cero revisión de código, coherente con 19 regla 4.

**Camino excepcional (una regla no encaja en ningún arquetipo de §3)**: se añade **un arquetipo nuevo** al núcleo — código nuevo, aislado, una sola vez, nunca una rama condicional por empresa dentro de un arquetipo existente. El criterio para reconocer que hace falta un arquetipo nuevo (no estaba explícito en 22, se formaliza aquí): la regla necesita un *tipo de comparación* que ninguno de los 7 arquetipos existentes puede expresar variando solo sus parámetros — no basta con que sea "una regla distinta", tiene que ser una **forma** de evaluación distinta. Ejemplo real de qué NO justifica un arquetipo nuevo: una prop firm con un "Daily Loss Limit" en importe fijo en vez de porcentaje es la *misma forma* (Umbral estático) con otra unidad — ya resuelto en 22 §6 como dos Definitions, no dos arquetipos.

**Lo que nunca ocurre, en ningún camino**: una implementación específica de una empresa dentro del código de un evaluador — es la instrucción del fundador convertida en la restricción de arquitectura más estricta de todo este documento, y el motivo por el que §3 modela los evaluadores como funciones puras sobre `parametros`/`inputs` genéricos, nunca sobre un identificador de empresa.

---

## 12. Interfaces públicas

```
library.crearDefinicion(input: CrearDefinicionInput): Result<RuleDefinition, RuleEngineError>
library.editarDefinicion(key: string, cambios: Partial<CrearDefinicionInput>): Result<RuleDefinition, RuleEngineError>  // crea nueva version, §8

profiles.crearPerfil(prop_firm_id: string, nombre: string): Result<RuleProfile, RuleEngineError>
profiles.anadirInstancia(rule_profile_id: string, rule_definition_id: string, parametros: Record<string, unknown>, opciones?: InstanceOptions): Result<RuleInstance, RuleEngineError>
profiles.clonarPerfil(source_rule_profile_id: string, nuevo_nombre: string): Result<RuleProfile, RuleEngineError>   // 22 §3.3 — clonar, nunca heredar en vivo

snapshot.adoptarPerfil(rule_profile_id: string): Result<{ rule_profile_snapshot_id: string }, RuleEngineError>       // invocado por Funding Management, SPEC-003 §2.4b

evaluar(account_id: string, evento: DomainEventRef): Result<RuleEvaluation[], RuleEngineError>   // siempre asíncrono, §6, nunca invocado por Operations Engine directamente

consultarEstadoCumplimiento(account_id: string): Result<{ compliance_flag: string; ultima_evaluacion: Timestamp }, RuleEngineError>  // siempre síncrono, §6

interface InstanceOptions {
  mode?: "enforced" | "shadow"           // default 'enforced'
  effective_from?: Timestamp
  effective_until?: Timestamp
  active_only_in_status?: EstadoCuenta[]
}
```

---

## 13. Eventos

### 13.1 Emitidos

| Evento | Ya existía | Condición de emisión |
|---|---|---|
| `ReglaIncumplida` | Sí (21.5 §7) | Veredicto = `violated`, `mode = 'enforced'` únicamente (§4.3, paso 8) |

### 13.2 Consumidos

| Evento | Origen | Efecto |
|---|---|---|
| `OperacionRegistrada` | Operations Engine | Evalúa Rule Instances `operation_event` (§4.1) |
| `OperacionCerrada` / `OperacionEditada` / `OperacionCancelada` | Operations Engine | Re-evalúa `account_state` (capital cambió) y, si aplica, `operation_event` de esa Operación |
| `CapitalRecalculado` | Funding Management | Re-evalúa Rule Instances `account_state` |

---

## 14. Auditoría — intentando destruir la arquitectura

### 14.1 Corrección de frontera: "Quant Engine" como consumo directo

**Problema detectado**: la instrucción de este documento lista "Quant Engine" entre lo que Rule Engine consume. Tomado literalmente, contradice la frontera ya congelada en 22.5 §2.3-2.4 y 26 §8: Risk Engine es quien invoca a Quant Engine y persiste/expone sus resultados; Rule Engine solo lee las magnitudes ya calculadas de Risk Engine (`DrawdownState`), nunca importa el paquete `quant-engine` ni construye un `RFinalInput` por su cuenta. **Resolución**: se mantiene la frontera ya aprobada — Rule Engine consume Risk Engine, que a su vez orquesta Quant Engine (§4.2). El resultado observable ("Rule Engine termina usando números que vienen de Quant Engine") es el mismo; lo que se corrige es que la llamada nunca salta directamente el nivel de Risk Engine, exactamente el mismo tipo de corrección que 26 §8 ya aplicó sobre 22.5 §2.3.

### 14.2 Dependencia de orden de ejecución encontrada (el hallazgo más importante de esta auditoría)

**Problema detectado**: si dos eventos que afectan a la misma Cuenta (p.ej. dos `OperacionCerrada` casi simultáneas) disparan dos pasadas del pipeline de §4 en paralelo (dos workers asíncronos), nada garantiza que sus escrituras a `rule_evaluations`/`accounts.compliance_flag` lleguen en el mismo orden en que ocurrieron los eventos que las originaron. Si la evaluación más reciente en términos de negocio se persiste *antes* que una evaluación más antigua que estaba en curso, una lectura de `compliance_flag` justo después podría quedarse con el veredicto **viejo**, sobrescrito por la llegada tardía de un cálculo que en realidad correspondía a un estado anterior — exactamente el tipo de inconsistencia dependiente del orden de ejecución que esta auditoría pide buscar explícitamente.

**Solución aplicada**: `triggering_event_sequence` (§2.2) — cada evaluación lleva el número de secuencia del evento de dominio que la disparó (monotónico por Cuenta, derivado del propio orden de eventos ya garantizado por Operations Engine/Funding Management). El paso 7 del pipeline (§4.3) actualiza `accounts.compliance_flag` **solo si** la secuencia entrante es mayor que la ya cacheada — una escritura tardía con secuencia menor se persiste igualmente en `rule_evaluations` (íntegro para auditoría, §9) pero nunca sobrescribe el estado visible. Esto hace innecesario un lock o una cola estrictamente serializada por cuenta (que penalizaría el rendimiento de cuentas muy activas, contra I16) — la corrección es de comparación en la escritura, no de exclusión mutua.

### 14.3 Inconsistencia de contexto cruzado encontrada — reglas `operation_event` que necesitan hechos de cuenta

**Problema detectado**: 22 §3.4 distingue con precisión *cuándo* se evalúa cada scope, pero no deja explícito que una regla `operation_event` (p.ej. Position Size Restriction, si se expresa como % del capital actual en vez de un lote fijo) puede necesitar un hecho de `account_state` (`current_capital`) como input, no solo los atributos propios de la Operación. Sin aclararlo, alguien podría interpretar que las reglas `operation_event` solo pueden leer `operation_facts` — un límite artificial que rompería un caso de regla real.

**Solución aplicada**: `EvaluationInputs` (§3) permite que cualquier arquetipo, sea cual sea su `scope`, lea `account_facts` como contexto de solo lectura — esto **no** es una arista del grafo de dependencias de §5 (que solo existe entre Rule Instances compuestas), es simplemente un input adicional, de la misma naturaleza que leer los atributos de la propia Operación. No introduce riesgo de ciclo ni de orden porque `account_facts` siempre se lee ya resuelto (viene de Funding Management, un hecho ya persistido), nunca de otra evaluación en curso.

### 14.4 Principio nuevo encontrado: Evaluar ≠ Actuar

**Problema detectado, al intentar romper el modelo con una regla hipotética real**: varias prop firms ofrecen "scaling" — una cuenta que cumple cierto progreso (p.ej. rentable en N meses consecutivos) se combina o aumenta de tamaño automáticamente. Modelada ingenuamente, esta seria una regla cuyo "cumplimiento" no produce solo un veredicto, sino una **acción** (fusionar cuentas, SPEC-003 §6.3) — y eso rompería el límite ya establecido de que Rule Engine nunca modifica nada fuera de su propio esquema (§1.2, punto 3).

**Solución aplicada**: toda regla de este tipo se descompone en dos piezas separadas, nunca una sola: (a) una Rule Instance normal (arquetipo `progress_to_target`) que produce el veredicto "criterio de escalado cumplido / no cumplido", igual que Profit Target; (b) un consumidor **fuera** de Rule Engine (hoy: el propio trader decidiendo manualmente tras ver el veredicto; en el futuro, posiblemente un módulo de automatización explícitamente fuera de alcance) que escucha ese veredicto y decide si actuar. Es la misma disciplina que Calcular ≠ Juzgar (19 regla 14) aplicada un nivel más allá: **Evaluar ≠ Actuar** — se documenta aquí como principio nuevo, candidato a regla permanente de metodología (19), pero no se eleva unilateralmente; queda anotado para que el fundador decida (§17, decisiones abiertas).

### 14.5 Rendimiento — confirmación, no hallazgo nuevo

`rule_evaluations` crece de forma append-only al mismo ritmo que los eventos de Operations Engine/Funding Management — potencialmente grande a la escala de 19 §7, pero nunca en el camino caliente de lectura (§6: toda lectura de UI usa `compliance_flag` cacheado, O(1)). Es exactamente el patrón que 22 §Riesgos #4 ya exigía ("mismo principio ya aplicado... el evaluador de reglas debe seguir el mismo patrón, no uno nuevo") — esta especificación lo cumple, no lo reinventa. No se añade un mecanismo de compactación de `rule_evaluations` sin datos reales de volumen que lo justifiquen (mismo criterio ya usado repetidas veces en este proyecto para no construir contra una demanda no validada).

---

## 15. Zero Friction (I16) aplicado a esta especificación

Revisión explícita, tal como I16 exige para toda especificación futura:

- **Componer un Rule Profile clonando una plantilla** (§12, `clonarPerfil`) sigue siendo 1 acción, sin cambios respecto a 22 §3.3.
- **Resolución de dependencias automática** (§5) elimina lo que habría sido la violación más directa de I16 en todo este documento: conectar manualmente el grafo de una Consistency Rule hubiera sido una tarea de varios clics para una acción que ocurre cada vez que se compone un perfil — se elimina por diseño, no se optimiza después.
- **Consultar el estado de cumplimiento** (§6, `consultarEstadoCumplimiento`) es una lectura O(1) — bien por debajo de cualquier presupuesto de tiempo, no aplica el umbral de 30s/10-12 acciones de I16 porque no es una tarea con pasos, es una consulta instantánea.
- Ninguna interacción de este componente es visible ni ejecutada por el trader final directamente — quien interactúa con Rule Engine es el equipo/la Empresa componiendo perfiles (una tarea infrecuente, no del bucle diario) — I16 se aplica con su matiz correcto: "toda funcionalidad **frecuente**" no incluye la composición de un Rule Profile, que ocurre una vez por Empresa, no cientos de veces por trader.

---

## 16. Limitaciones a 10 años

1. **El principio Evaluar ≠ Actuar (§14.4) queda identificado pero no resuelto como capacidad de producto** — si en el futuro se valida demanda real de automatización sobre veredictos de Rule Engine (scaling automático, payout automático), esa automatización necesita su propia especificación con su propio contrato de escritura hacia Funding Management — nunca construida dentro de Rule Engine.
2. **News Restriction sigue diferida** (22 §9, reafirmado) — cuando se construya, hereda como requisito explícito de esta especificación que su evaluación debe fijarse contra el estado del calendario externo *al momento del evento real* (`opened_at` de la Operación), nunca al momento en que el worker asíncrono efectivamente corre — mismo principio de reproducibilidad que SPEC-001 §4.4, para evitar que un retraso de cola cambie retroactivamente un veredicto.
3. **`rule_definitions.depends_on_definition_key` asume una relación de dependencia simple (una Definition depende como máximo de una lista de otras)** — si en el futuro aparece un arquetipo compuesto con lógica de dependencia más rica (p.ej. "cumple si al menos 2 de estas 3 reglas cumplen"), el esquema actual lo soporta como un array, pero la resolución automática de §5 debería revisarse para ese caso — no es una limitación bloqueante hoy porque Consistency Rule (el único caso real conocido) tiene una sola dependencia.

---

## Riesgos

1. **`triggering_event_sequence` (§14.2) depende de que los módulos productores (Operations Engine, Funding Management) expongan un número de secuencia monotónico consistente** — si alguno de los dos lo implementa como un timestamp de baja resolución en vez de una secuencia real, dos eventos muy próximos podrían empatar y reintroducir el mismo riesgo que esta sección resuelve. Se anota como requisito cruzado para la implementación de ambos módulos.
2. **El modo `shadow` (§10) podría acumularse sin gobernanza** — sin un proceso que revise periódicamente qué reglas experimentales siguen en `shadow` mucho después de validarse (o de descartarse), el catálogo puede llenarse de reglas "en pruebas" olvidadas — mismo tipo de riesgo de curación ya señalado en 22 §Riesgos #3, ahora también aplicable a `mode`.
3. **Evaluar ≠ Actuar (§14.4) no está todavía elevado a regla permanente de metodología** — si una futura especificación de automatización se construye sin que el fundador haya ratificado este principio explícitamente, existe el riesgo de que se implemente una excepción puntual "solo para esta regla de scaling" que rompa la separación.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Completa el sistema de cumplimiento normativo con un esquema y un pipeline implementables, y cierra dos deudas reales: el esquema de `RuleProfile`/`RuleProfileSnapshot` que SPEC-003 dejó pendiente, y la corrección de frontera sobre Quant Engine que la propia instrucción de este capítulo introducía por error de fraseo.

**¿Qué sobra?** Nada de los 7 arquetipos + 1 categoría de cálculo de 22 se elimina o se sustituye.

**¿Qué falta?** Antes de este documento faltaban: el mecanismo de resolución automática de dependencias (§5, evita una violación de I16), el manejo de reglas temporales/experimentales (§10), la protección contra escritura desordenada entre evaluaciones concurrentes (§14.2, el hallazgo más importante), y el principio Evaluar ≠ Actuar (§14.4) para reglas cuyo cumplimiento sugiere una acción.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §14.2: ningún sistema de cumplimiento profesional confía en que "la última escritura gana" cuando las escrituras pueden llegar desordenadas — se ordena por el evento de negocio que las originó, no por el momento en que la infraestructura terminó de procesarlas.

**Puntuación**: **97/100** — la más alta de Fase 1 hasta ahora. Los 3 puntos que faltan son los 3 Riesgos, todos de coordinación con otras especificaciones o de gobernanza de proceso, ninguno de diseño.

**Nivel de madurez**: 95%. Esquema, arquetipos, pipeline, resolución de dependencias, versionado y gestión de errores están completos y son directamente implementables; lo pendiente es exclusivamente la validación empírica contra reglas reales de múltiples prop firms (ya señalada como límite honesto en 22, no resuelta por diseño porque no puede resolverse sin datos).

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Rule Engine tal como está especificado.

**Decisiones abiertas**:
1. Si Evaluar ≠ Actuar (§14.4) se eleva a regla permanente de metodología (19), igual que Calcular ≠ Juzgar (regla 14) — recomendación: elevarla, pero es una decisión del fundador, no se asume aquí.
2. Gobernanza del modo `shadow` (Riesgo #2) — se decide junto con la gobernanza general de la Rule Library ya pendiente desde 22 §Riesgos #3.

**Recomendación profesional**: aprobar SPECIFICATION 004. Es la especificación mejor puntuada de Fase 1 hasta ahora, entrega el esquema que SPEC-003 dejó pendiente como requisito explícito, y su auditoría encontró un hallazgo de concurrencia real (§14.2) que, sin corregirse, habría producido semáforos de cumplimiento incorrectos en producción bajo carga real — exactamente el tipo de error silencioso que ninguna revisión manual detecta hasta que ya ha ocurrido con dinero real de por medio.
