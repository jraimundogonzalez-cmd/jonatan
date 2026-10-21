# SPEC-003 · Funding Management

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 04 §1-3 (esquema base), 15 §3.1 (ledger de capital), 18 (drawdown estático/trailing, Profit Split, máquina de estados, Dashboard Maestro), 19 regla 14 (Calcular ≠ Juzgar), 20 Fase 3/8 (creación de cuenta, eventos de ciclo de vida), 21.5 §3.2/§3.3 (Empresa/Cuenta como Aggregate Roots), 22.5 §2.2 (contrato Funding Management, fusión Empresa+Cuenta), 26 §2.6 (Grupo E, `calcularDrawdownState`), 32 §3.2/§3.3/§3.6/§3.8 (contratos de dominio congelados de Company/Account/Rule Profile/Snapshot), SPEC-001 (Quant Engine), SPEC-002 (Operations Engine, productor de `OperacionCerrada`)
**No re-abre ninguna decisión conceptual ya aprobada.** Donde este documento corrige algo que un capítulo anterior dejó modelado de forma incompatible con una decisión posterior, se marca explícitamente como **hallazgo nuevo de esta especificación** (§11) — el más importante de todos es la corrección de `account_rules` (§11.2), que este documento no puede evitar sin contradecir la instrucción explícita del fundador.

---

## 1. Objetivo del componente

### 1.1 Qué representa Funding Management

Funding Management es la memoria del **estado real de capital y ciclo de vida** de cada Empresa de Fondeo y cada Cuenta que un trader gestiona. Representa hechos de capital (cuánto hay, cuánto hubo como máximo, en qué fase de vida está la cuenta) — nunca reglas, nunca límites, nunca un juicio de si esos hechos son aceptables. Es, junto con Operations Engine (SPEC-002), uno de los dos componentes que sostienen la promesa central del producto: que el capital mostrado en cualquier pantalla sea siempre exacto y trazable a un evento real.

### 1.2 Qué nunca debe hacer (instrucción explícita del fundador, traducida a reglas verificables)

1. **Nunca almacena un límite de riesgo configurado por una prop firm.** Ni `max_daily_drawdown_pct`, ni `max_total_drawdown_pct`, ni `profit_target_pct`, ni `max_position_risk_pct`, ni `drawdown_type` — ninguno de estos vive en el esquema de Funding Management. Es el hallazgo central de esta especificación (§11.2) y corrige una parte del esquema ya escrito en 04/18 que precede a la existencia formal del Rule Engine.
2. **Nunca interpreta el contenido de un `RuleProfileSnapshot`.** Lo recibe, lo referencia, lo entrega a quien lo pida (Risk Engine, Rule Engine) — nunca abre sus campos para decidir nada por sí mismo (32 §3.8, "quién puede consumirlo" incluye a Account, pero consumir ≠ interpretar; ver §4.3).
3. **Nunca calcula si un drawdown, un profit target o cualquier otra magnitud de riesgo es aceptable.** Eso es Rule Engine, siempre (19 regla 14). Funding Management expone los hechos de capital brutos (`current_capital`, `peak_capital`) a quien necesite calcular algo sobre ellos.
4. **Nunca calcula `R_final`, esperanza, ni ninguna fórmula del catálogo de Quant Engine.** No tiene ninguna razón para hacerlo — su relación con el resultado de una Operación es de consumidor pasivo vía el evento `OperacionCerrada` (§9.2).
5. **Nunca conoce el nombre real de una prop firm como concepto de código.** Es dato de catálogo por usuario (04 §1.3, ya vigente) — ninguna prop firm concreta aparece en ninguna condición de código de este componente.

### 1.3 Responsabilidades

- Poseer el ciclo de vida completo de Empresa (§3) y Cuenta (§4): creación, cambios de estado, archivado.
- Mantener el ledger de eventos de capital y derivar de él `current_capital`/`peak_capital`, siempre por trigger, nunca por edición directa (§6).
- Adoptar y referenciar (nunca poseer el contenido de) un `RuleProfileSnapshot` por Cuenta (§4.3).
- Distinguir con precisión qué campos de "el estado de una cuenta" son hechos propios de Funding Management y cuáles son proyecciones cruzadas que otros módulos calculan a partir de sus hechos (§5 — la clarificación más importante para quien construya el Dashboard Maestro, 18 §6).
- Escalar de 1 a 100+ cuentas por usuario sin ningún cambio estructural (§7).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Mantener la Rule Library, los Rule Profiles y sus reglas configurables | Rule Engine (22.5 §2.4) — aunque el Rule Profile pertenezca *conceptualmente* a una Empresa (21.5 §3.6), su CRUD y almacenamiento son responsabilidad de módulo de Rule Engine, no de Funding Management (§3.2, distinción explícita entre propiedad de dominio y responsabilidad de módulo) |
| Decidir si el drawdown restante, el profit target o cualquier límite se cumple | Rule Engine, orquestado sobre datos de Risk Engine (19 regla 14) |
| Calcular `DrawdownState`, `R_final`, esperanza o cualquier fórmula | Quant Engine, vía Risk Engine (26 §2.6, 26 §8, SPEC-001) |
| Registrar el hecho histórico de una Operación | Operations Engine (SPEC-002) |
| Componer la vista "Objetivo: 10.000€ (96%)" o "DD restante: 3,2%" del Dashboard Maestro | Analytics/Reporting Engine, agregando hechos de Funding Management + el veredicto de Rule Engine (§5.3-5.4, corrige la lectura de 18 §6) |

---

## 2. Arquitectura interna

### 2.1 Aggregate Roots

Dos, ya congelados en 32 §3.2/§3.3, sin reabrir: **Company** (Empresa de Fondeo) y **Account** (Cuenta). Ninguna entidad nueva se introduce en esta especificación — se detalla su implementación, no se amplía su catálogo.

### 2.2 Subcomponentes

```
funding-management/
├── companies/        Ciclo de vida de Empresa — §3
├── accounts/          Ciclo de vida de Cuenta, máquina de estados — §4
├── capital-ledger/    Eventos de capital, derivación de current_capital/peak_capital — §6
├── snapshot-ref/       Adopción y referencia opaca a RuleProfileSnapshot — §4.3
└── errors/             Catálogo de errores tipado
```

### 2.3 La frontera con Rule Engine (el diagrama que gobierna todo este documento)

```
┌─────────────────────────┐   adopta (referencia opaca)   ┌──────────────────────┐
│   Funding Management      │ ──────────────────────────▶ │   Rule Engine          │
│                            │                              │                        │
│  • current_capital         │                              │  • Rule Library         │
│  • peak_capital             │                              │  • Rule Profile (CRUD)  │
│  • initial_capital           │                              │  • RuleProfileSnapshot  │
│  • status (máquina de       │ ◀── nunca lee su contenido   │    (contenido real:     │
│    estados, §4.2)            │                              │    drawdown_type,       │
│  • profit_split_pct          │                              │    max_*_drawdown_pct,  │
│  • rule_profile_snapshot_id  │ ── pasa la referencia ───▶  │    profit_target_pct,   │
│    (puntero opaco, §4.3)     │    a quien la pida          │    max_position_risk_pct)│
└─────────────────────────┘                              └──────────────────────┘
```

Esta es la traducción literal del mandato del fundador a arquitectura: Funding Management sostiene la mitad izquierda (hechos de capital y ciclo de vida), Rule Engine sostiene la mitad derecha (reglas y su interpretación) — y la única flecha que cruza en el sentido "Funding Management → Rule Engine" es una referencia opaca, nunca una consulta sobre su contenido.

### 2.4 Flujo interno — dos pipelines canónicos

**(a) Recálculo de capital** (disparado por `OperacionCerrada`, SPEC-002, o por un evento de capital manual, §6):

```
capital-ledger.registrarEvento(account_id, event_type, amount)
  → capital-ledger.recomputeCapital(account_id)     [suma determinista de eventos, 15 §3.1]
    → accounts.current_capital = resultado
    → accounts.peak_capital = greatest(peak_capital, current_capital)
  → emite CapitalRecalculado
```

**(b) Adopción de un Rule Profile por una Cuenta** (alta, o cambio de fase que aplica un perfil distinto, 20 Fase 2):

```
accounts.adoptarPerfil(account_id, rule_profile_id)
  → Rule Engine.crearSnapshot(rule_profile_id)        [vía Snapshot Engine, 22.5 §2.11]
  ← recibe rule_profile_snapshot_id (opaco)
  → accounts.rule_profile_snapshot_id = referencia recibida
```

Funding Management nunca construye el Snapshot — lo solicita a Rule Engine (dueño del Rule Profile) y solo almacena la referencia devuelta.

---

## 3. Empresas (Company)

### 3.1 Definición y campos

Ya fijado en 32 §3.2 — se detalla aquí su estado mínimo: `id`, `user_id`, `name`, `is_personal`, `color` (UI), estado (Creada→Activa→Archivada). `is_personal = true` representa capital propio, no una prop firm real — mismo registro, sin bifurcar el modelo (04 §1.3, ya vigente).

### 3.2 El catálogo de Rule Profiles — propiedad de dominio vs. responsabilidad de módulo

**Aclaración necesaria, porque una lectura superficial de "una Empresa ofrece Perfiles de Reglas" (21.5 §3.2) sugeriría que Funding Management debe guardar esos Perfiles.** No es así, y distinguirlo es la aplicación más directa de la instrucción del fundador en este documento: la Empresa es el **propietario de dominio** del Rule Profile (es "de ella", conceptualmente — 21.5 §3.6), pero el **módulo responsable de su CRUD y almacenamiento es Rule Engine** (22.5 §2.4, "mantener la Rule Library"), no Funding Management. Es la misma distinción que ya existe en cualquier sistema con separación de bounded contexts: el dueño del dato de negocio y el módulo que lo persiste no tienen por qué coincidir cuando el segundo requiere una taxonomía (Library→Definition→Instance, 22) que el primero no necesita conocer.

Funding Management solo mantiene `prop_firm_id` como clave foránea en `accounts` (ya existente, 04 §3) — nunca una tabla de Perfiles de Reglas propia.

### 3.3 Ciclo de vida

Creada → Activa → Archivada (21.5 §3.2, ya vigente). No se elimina si tiene Cuentas con Operaciones registradas (mismo invariante ya aprobado).

---

## 4. Cuentas (Account)

### 4.1 Definición y campos mínimos

```sql
-- Confirma y corrige 04 §3 / 18 §4 tras el hallazgo de §11.2
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prop_firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null,
  currency char(3) not null default 'USD',

  initial_capital numeric(18,4) not null,
  current_capital numeric(18,4) not null,     -- derivado por trigger, §6 — nunca editable a mano
  peak_capital numeric(18,4) not null,         -- derivado por trigger, §6

  status text not null default 'live'
    check (status in ('challenge','funded','live','paused','terminated','merged')),
                                                 -- 'merged' es nuevo, §6.3 — extension point, no implementado

  profit_split_pct numeric(5,2),                -- null si no aplica — hecho puro, sí pertenece aquí (§5.5)
  rule_profile_snapshot_id uuid,                 -- referencia OPACA, nunca interpretada aquí (§4.3)

  compliance_flag text,                          -- caché de solo lectura del último veredicto de Rule Engine, §9.2 — nunca calculado aquí

  created_at timestamptz not null default now()
);
```

**Lo que se elimina respecto al esquema anterior**: `account_rules` como tabla propia de Funding Management (04 §3, 18 §2) — sus columnas (`max_daily_drawdown_pct`, `max_total_drawdown_pct`, `profit_target_pct`, `max_position_risk_pct`, `drawdown_type`) migran al esquema de Rule Engine como parte de `RuleProfile`/`RuleProfileSnapshot`, fuera del alcance de este documento (§11.2 detalla el porqué y el impacto).

### 4.2 Ciclo de vida — máquina de estados completa

Confirma 18 §4, con la adición de `merged` (§6.3, extension point):

```
Cuenta de prop firm:
  Challenge ──(supera evaluación)──▶ Funded ──(pausa)──▶ Pausada ──(reanuda)──▶ Funded
      │                                 │                                        │
      └──(falla el challenge)──▶ Terminada    └──(incumple regla / cierre)──▶ Terminada
                                        │
                                        └──(fusión con otra cuenta, §6.3)──▶ Merged

Cuenta de capital propio (is_personal = true):
  Live ──(pausa)──▶ Pausada ──(reanuda)──▶ Live
  (nunca pasa por Challenge/Funded/Merged; Profit Split permanece null)
```

`Merged` es, como `Terminated`, un estado final sin retorno — pero semánticamente distinto: `Terminated` es un cierre no exitoso (blow-up, fin de evaluación fallida), `Merged` es una graduación (dos cuentas se combinan en una nueva de mayor tamaño). Confundirlos corrompería agregados de la misma forma que 18 §4 ya advirtió para Pausada/Terminada — se separan por la misma razón, ahora anticipando el caso de fusión (§6.3).

Cada transición se registra en `audit_log` (15 §3.4, ya vigente, sin tabla nueva).

### 4.3 `rule_profile_snapshot_id` — referencia opaca, nunca contenido

Funding Management almacena el identificador técnico del `RuleProfileSnapshot` vigente de una Cuenta (32 §3.8: Snapshot es un Value Object con identidad técnica, no de dominio). Lo que esto significa en términos de código, sin ambigüedad:

- Funding Management **puede** pasar `rule_profile_snapshot_id` a Risk Engine o Rule Engine cuando estos lo solicitan.
- Funding Management **nunca** hace un `SELECT` sobre el contenido de ese Snapshot ni lo deserializa para tomar ninguna decisión propia. Ni siquiera para mostrar "drawdown permitido: 5%" — esa composición de pantalla pertenece a Analytics (§5.3).
- Cambiar de Rule Profile (adopción de uno nuevo, 20 Fase 2) reemplaza esta referencia — nunca modifica un Snapshot ya existente (19 regla 13, invariante ya vigente).

---

## 5. Modelo de capital

### 5.1 Capital inicial, actual, Peak Capital

Sin cambios respecto a 18 §2, reafirmado: `initial_capital` se fija al crear la Cuenta y nunca cambia. `current_capital`/`peak_capital` son siempre derivados del ledger de eventos (§6), nunca editables directamente — es el invariante más antiguo y más repetido de todo el blueprint (15 §3.1) porque es, literalmente, la garantía de que el número que el trader ve es siempre reconstruible.

### 5.2 Balance vs. Equity — hallazgo de esta especificación

**Problema detectado**: el fundador pide "Balance" y "Equity" como dos campos del modelo de capital. En trading, Equity clásicamente significa `Balance ± PnL flotante de posiciones abiertas ahora mismo` — un número que solo es correcto si el sistema conoce el precio de mercado actual y la posición abierta en tiempo real. **TradePilot no tiene, ni tendrá en el MVP, ningún feed de precio en vivo ni integración de ejecución con ningún bróker** (01 §5, 13 §7, reafirmado en SPEC-002 §1.4 punto 6) — Operations Engine registra una Operación Abierta sin PnL flotante calculado (SPEC-002 §2.3: "Abierta" no tiene desenlace, y no tiene ningún mecanismo de actualización continua de precio). Exponer un campo `equity` calculado sin esos datos produciría uno de dos resultados, ambos inaceptables para la prioridad #1 del producto (19 §6, precisión matemática): un número inventado, o un número que silenciosamente siempre es idéntico a `Balance` mientras el trader cree que refleja algo más.

**Solución especificada**: Funding Management expone un único campo de capital en tiempo real, `current_capital` ("Balance"), que es exacto porque se deriva solo de hechos ya cerrados (§6). **`Equity` no se implementa en esta especificación** — se documenta explícitamente como una capacidad futura, condicionada a que exista un Import Adapter con feed de precio en vivo (SPEC-002 §5.7/§8.5), momento en el cual Equity dejaría de ser "Balance + una aproximación" y pasaría a ser un número real. Ofrecerlo antes sería exactamente el tipo de aproximación que Challenge Mode debe rechazar (SPEC-001, "no acepto aproximaciones", aplicado aquí a un campo de capital en vez de a una fórmula).

**Por qué es mejor que la alternativa**: la alternativa de "mostrar Equity = Balance mientras no haya posiciones abiertas, y ocultar el número cuando sí las haya" introduce una inconsistencia de UI (un campo que aparece y desaparece) para exponer, en el mejor caso, la misma información que Balance ya da. No añade valor real, solo la ilusión de una capacidad que el producto no tiene todavía.

**Impacto futuro**: cuando exista un conector con feed de precio en vivo, `Equity` se añade como un campo derivado y explícitamente marcado como dependiente de esa integración — nunca mezclado silenciosamente con `Balance` en ninguna pantalla ni fórmula.

### 5.3 Drawdown restante — proyección cruzada, no propiedad de Funding Management

**Corrige la lectura de 18 §1/§6**, que listaba "Drawdown restante" como un campo de cuenta. No lo es: es el resultado de `calcularDrawdownState` (Quant Engine, Grupo E, 26 §2.6), que consume `peak_capital`/`current_capital` (hechos que sí pertenecen a Funding Management) **y** el contenido del `RuleProfileSnapshot` (que Funding Management nunca abre, §4.3). Funding Management expone los dos hechos de capital que ese cálculo necesita y su referencia opaca al Snapshot; Risk Engine ensambla la llamada real a Quant Engine. El campo "Drawdown restante" que aparece en el Dashboard Maestro (18 §6) es, con esta especificación, una vista compuesta por Analytics leyendo el resultado ya calculado por Risk Engine — nunca una columna propia de `accounts`.

### 5.4 Profit Target — mismo tratamiento

Idéntico razonamiento que §5.3: `profit_target_pct` vive en `RuleProfileSnapshot` (Rule Engine), no en `accounts`. "Objetivo: 10.000€ (96%)" (18 §1/§6) es una composición de Analytics: el % viene del Snapshot (leído por quien tiene permiso de interpretarlo — Rule Engine/Risk Engine, nunca Funding Management), el importe en € se deriva de aplicarlo sobre `initial_capital` (que sí es un hecho de Funding Management).

### 5.5 Profit Split — hecho puro, sí pertenece a Funding Management

**Distinción explícita, porque a primera vista Profit Split parece "una regla más" y no lo es**: a diferencia de un límite de drawdown o un profit target, el Profit Split no tiene una condición de cumplimiento — no existe un "¿se ha violado el Profit Split?" que Rule Engine deba juzgar. Es un hecho contractual puro (qué % del beneficio corresponde al trader), exactamente como `currency` o `initial_capital`. Por eso, y solo por eso, `profit_split_pct` permanece en `accounts` (§4.1), reafirmando 18 §3 sin cambios: nunca entra en `R_final`/esperanza/Score, se usa solo para `Beneficio_neto_estimado` (18 §3, fórmula ya vigente, sin cambios).

---

## 6. Ledger de eventos de capital

### 6.1 Tipos de evento

Reafirma 15 §3.1 + 18 §3, sin cambios: `initial`, `deposit`, `withdrawal`, `payout`, `reset`, `adjustment`. Cada uno es un hecho append-only en `account_capital_events` — nunca se edita ni se borra una entrada (15 §3.4).

### 6.2 Reglas de recálculo

`current_capital` = suma determinista de todos los eventos del ledger de esa Cuenta, en orden cronológico, más el `pnl_amount` de cada Operación Cerrada (SPEC-002 §4.3) desde el evento `initial`/último `reset`. `peak_capital` = máximo histórico de `current_capital` observado, actualizado en la misma transacción (18 §2, trigger ya vigente). Ninguno de los dos es editable por una vía distinta a estos eventos — un "ajuste" de reconciliación (20 Fase 8, hedge fund lens) es también un evento (`adjustment`), nunca un `UPDATE` directo a la columna.

### 6.3 Fusiones futuras (arquitectura preparada, no construida)

**Principio de diseño, no implementación completa**: algunas prop firms ofrecen combinar dos cuentas evaluadas en una sola de mayor tamaño ("scaling"). Se prepara, sin construirla todavía, la forma de no perder historial al modelarla:

- Nunca se destruye una Cuenta fusionada — transiciona a `merged` (§4.2), estado terminal distinto de `terminated`.
- Una futura Cuenta resultante de la fusión inicia su propio ledger con un evento `initial` cuyo origen referencia las Cuentas fusionadas (`merged_from_account_ids`, campo todavía sin esquema definitivo) — nunca hereda directamente el ledger de las cuentas origen, para no mezclar dos series de eventos con `peak_capital` calculado bajo reglas potencialmente distintas.
- Las Operaciones históricas de las Cuentas fusionadas **permanecen** asociadas a su Cuenta original (SPEC-002 §2.5, invariante 1: `account_id` es inmutable) — una fusión nunca reasigna Operaciones pasadas a la Cuenta nueva, solo el capital hacia adelante.

No se especifica más porque construirlo ahora sería diseñar contra un caso de uso todavía sin validar con datos reales — mismo criterio ya aplicado a TradePilot Labs y a los Import Adapters (SPEC-001 §8.4, SPEC-002 §5.7).

---

## 7. Escalabilidad — 1, 5, 20, 100+ cuentas sin modificar arquitectura

No requiere ningún cambio estructural porque ya está resuelto por decisiones tomadas en capítulos anteriores, confirmadas aquí:

- El modelo `prop_firms (1:N) → accounts (1:N)` (04 §2) no tiene límite de cardinalidad por diseño — 1, 5, 20 o 100+ Cuentas son la misma consulta indexada (`accounts_user_idx`, 04 §3), no un caso especial.
- `current_capital`/`peak_capital` son columnas cacheadas mantenidas por trigger (§6.2) — el Dashboard Maestro (18 §6) ya se auditó como "consulta indexada sobre columnas ya cacheadas, sin cómputo pesado en el momento de la consulta", válido sin cambios hasta cualquier número de cuentas del rango pedido.
- El único coste que crece con el número de cuentas es el de lectura para renderizar una lista — un problema de paginación de UI (fuera de alcance de este componente), nunca un problema de este modelo de datos.
- **Confirmación explícita para 100+ cuentas**: a esa escala por usuario, el cuello de botella teórico no es Funding Management (unas pocas filas por cuenta, consulta trivial) — sería, si existiera, el volumen de Operaciones asociadas (SPEC-002), ya resuelto ahí vía modo streaming (SPEC-001 §5.3). Funding Management no necesita su propio mecanismo de streaming porque su propio volumen de datos por Cuenta es constante, no proporcional al número de Operaciones.

---

## 8. Integraciones

### 8.1 Rule Engine

Dirección de dependencia: **Funding Management → Rule Engine**, nunca al revés en el sentido de contenido (22.5 §3, ya vigente). Funding Management solicita la creación de un Snapshot al adoptar un Rule Profile (§2.4b) y pasa `rule_profile_snapshot_id` cuando Risk Engine lo requiere para `calcularDrawdownState`. Rule Engine, tras evaluar, emite `ReglaIncumplida`, que Funding Management escucha únicamente para actualizar un campo caché de solo lectura (`compliance_flag`, §4.1) — nunca para decidir nada él mismo (§1.2, punto 3).

### 8.2 Risk Engine / Quant Engine (indirecta)

Funding Management nunca importa `quant-engine` ni llama a Risk Engine para "calcular" nada de forma proactiva — expone sus hechos de capital (`current_capital`, `peak_capital`) para que Risk Engine los use cuando orquesta un cálculo (26 §8, SPEC-001 §4.1). Es un proveedor pasivo de datos, no un invocador.

### 8.3 Operations Engine

Consume `OperacionCerrada` (SPEC-002 §3.1) para recalcular capital (§6.2) — es el único evento de negocio de otro módulo que Funding Management escucha activamente además de `ReglaIncumplida`.

### 8.4 AI Engine / Analytics

Ambos son consumidores de solo lectura de los hechos de Funding Management (capital, estado, Profit Split) — ninguno escribe en este componente. Analytics es, además, quien compone las vistas cruzadas de §5.3-5.4 (Drawdown restante, Objetivo) combinando hechos de Funding Management con veredictos de Rule Engine — responsabilidad de Analytics, no de Funding Management, reafirmado.

---

## 9. Eventos

### 9.1 Emitidos

Confirma 21.5 §7, sin adiciones: `EmpresaCreada`, `EmpresaArchivada`, `CuentaCreada`, `CuentaEstadoCambiado`, `CapitalRecalculado`.

### 9.2 Consumidos

| Evento | Origen | Efecto en Funding Management |
|---|---|---|
| `OperacionCerrada` | Operations Engine (SPEC-002) | Recalcula `current_capital`/`peak_capital` (§6.2) |
| `ReglaIncumplida` | Rule Engine | Actualiza `compliance_flag` (caché de solo lectura, nunca un juicio propio) |

---

## 10. Interfaces públicas

```
crearEmpresa(input: CrearEmpresaInput): Result<EmpresaCreada, FundingError>
archivarEmpresa(prop_firm_id: string): Result<EmpresaArchivada, FundingError>

crearCuenta(input: CrearCuentaInput): Result<CuentaCreada, FundingError>
cambiarEstadoCuenta(account_id: string, nuevo_estado: EstadoCuenta, motivo?: string): Result<CuentaEstadoCambiado, FundingError>
adoptarPerfilDeReglas(account_id: string, rule_profile_id: string): Result<{ rule_profile_snapshot_id: string }, FundingError>

registrarEventoCapital(account_id: string, input: EventoCapitalInput): Result<CapitalRecalculado, FundingError>

interface EventoCapitalInput {
  event_type: "initial" | "deposit" | "withdrawal" | "payout" | "reset" | "adjustment"
  amount: Money            // con signo — positivo incrementa, negativo decrementa (15 §3.1, ya vigente)
  occurred_at: Timestamp
  note?: string             // obligatorio en la práctica para 'adjustment' (20 Fase 8, reconciliación)
}

type FundingError =
  | { code: "PROP_FIRM_NOT_FOUND" }
  | { code: "ACCOUNT_NOT_FOUND" }
  | { code: "INVALID_STATE_TRANSITION"; from: EstadoCuenta; to: EstadoCuenta }
  | { code: "PROP_FIRM_ARCHIVE_WITH_ACTIVE_TRADES" }
  | { code: "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT" }   // is_personal = true con profit_split_pct no nulo
  | { code: "SNAPSHOT_ADOPTION_FAILED"; detail: string }    // Rule Engine no pudo generar el Snapshot solicitado
```

Ninguna de estas funciones acepta ni retorna un límite de riesgo — es, por construcción de tipos, imposible pasarle a Funding Management un `max_total_drawdown_pct` (§1.2, punto 1, convertido en restricción de interfaz, no solo de disciplina de código).

---

## 11. Auditoría — intentando destruir el diseño

### 11.1 Duplicación encontrada

Ninguna nueva. Se confirma que Profit Split (§5.5) y Beneficio neto estimado (18 §3) no duplican ningún cálculo de Quant Engine — operan sobre `pnl_amount` ya calculado, sin reimplementar la suma.

### 11.2 Acoplamiento encontrado — el hallazgo central de esta especificación

**Problema detectado**: el esquema tal como quedó en 04 §3/18 §2 (`account_rules` con `max_daily_drawdown_pct`, `max_total_drawdown_pct`, `profit_target_pct`, `max_position_risk_pct`, `drawdown_type`, en tabla 1:1 con `accounts`) **es exactamente el acoplamiento que el fundador acaba de prohibir explícitamente en esta instrucción, y que 20 §0 ya había señalado como un conflicto pendiente de resolver "en su propio capítulo" desde el arranque de Fase 0**. Ese capítulo (22, Rule Engine) se diseñó conceptualmente y estableció la jerarquía Library→Definition→Instance→Evaluation, y 32 §3.6 formalizó `Rule Profile` como Aggregate Root separado — pero ningún documento anterior llegó a corregir explícitamente el DDL de 04/18, que seguía representando los límites como columnas fijas dentro del dominio de Funding Management. Esta especificación es la primera en tocar ese esquema desde que el Rule Engine quedó formalmente diseñado, y por tanto la primera con la responsabilidad de corregirlo.

**Solución aplicada**: eliminación de `account_rules` del dominio de Funding Management (§4.1); sus columnas migran al esquema de Rule Engine (Rule Profile/RuleProfileSnapshot), fuera de alcance de este documento. Funding Management retiene únicamente `rule_profile_snapshot_id` como referencia opaca (§4.3).

**Por qué esto no es una ampliación de alcance, es una corrección obligatoria**: no implementar esta corrección ahora significaría construir Funding Management sobre un esquema que la propia instrucción de este documento ("el componente nunca debe conocer las reglas internas... solo almacena información") declara inválido en el mismo mensaje que lo encarga. Postergarlo produciría el mismo patrón que 20 §0 ya advirtió: cada prop firm nueva con una regla distinta forzaría una migración de columnas — la razón original por la que el Rule Engine se diseñó.

**Impacto futuro**: la especificación de Rule Engine (futura, no numerada todavía) hereda como requisito explícito el diseño del esquema real de `RuleProfile`/`RuleProfileSnapshot` con, como mínimo, los cinco campos que salen de `account_rules` aquí — no es un descubrimiento nuevo para esa especificación, ya está anotado.

### 11.3 Limitaciones para futuras prop firms

Con el hallazgo de §11.2 aplicado, **ninguna prop firm futura con reglas completamente distintas requiere un cambio en Funding Management** — es precisamente el resultado que la corrección produce: Funding Management no sabe hoy, ni sabrá nunca, qué reglas existen, así que una regla nueva (o una prop firm con un concepto de evaluación nunca visto) es, por construcción, un problema exclusivo de Rule Engine. Antes de esta corrección, cada prop firm con un tipo de drawdown no contemplado (como el *End Of Day Trailing* que 20 §0 ya mencionaba) habría exigido tocar el esquema de este componente — después de esta corrección, no.

### 11.4 Verificación de escala 100+ cuentas, distintas prop firms

Ya cubierta en §7. Verificación adicional específica de "distintas prop firms": cada Cuenta referencia exactamente 1 `prop_firm_id` y 1 `rule_profile_snapshot_id` — dos Cuentas de dos prop firms con reglas radicalmente distintas (una con drawdown estático al 5%, otra con un concepto de evaluación que hoy no existe) son, para Funding Management, filas estructuralmente idénticas — la variedad vive enteramente en el contenido opaco del Snapshot, nunca en el esquema de `accounts`.

---

## 12. Limitaciones a 10 años

1. **`Equity` real (§5.2) sigue sin resolver** — no es una limitación de este diseño, es una limitación de que el producto no tiene feed de precio en vivo; el día que lo tenga (vía un futuro Import Adapter con datos de posición en tiempo real), esta especificación necesitará una revisión explícita para añadir el campo, no antes.
2. **`merged` (§6.3) es un estado reservado, no un mecanismo completo** — si la demanda real de fusiones aparece, la especificación completa (formato de `merged_from_account_ids`, tratamiento del `RuleProfileSnapshot` de la cuenta resultante) requiere su propio documento, coherente con cómo TradePilot Labs y los Import Adapters ya se trataron en SPEC-001/002.
3. **El `compliance_flag` (§4.1, §8.1) es una caché de un solo valor** — si Rule Engine evoluciona a reportar múltiples veredictos simultáneos relevantes por Cuenta (hoy: un semáforo agregado, 17 §4), este campo puede quedarse corto; se anota como punto de revisión conjunta con la futura especificación de Rule Engine, no se amplía especulativamente aquí.

---

## Riesgos

1. **Migración de datos real**: si ya existieran filas de `account_rules` en producción bajo el esquema antiguo, la corrección de §11.2 requiere una migración de backfill hacia el esquema de Rule Engine antes de poder eliminar la tabla — no es un riesgo de diseño, es un riesgo de secuencia de despliegue que debe coordinarse con la especificación de Rule Engine cuando exista.
2. **Tentación de "solo esta vez" de leer el Snapshot desde Funding Management** — exactamente el mismo tipo de riesgo que SPEC-002 §Riesgos #3 identificó para el Import Adapter: sin disciplina de revisión de código (o una verificación automática de que `funding-management` no importa ningún deserializador del contenido de `RuleProfileSnapshot`), un desarrollador bajo presión de plazo podría romper la frontera de §2.3 "por velocidad".
3. **`profit_target_pct` fuera del alcance de Funding Management** significa que la composición de "Objetivo: X€ (Y%)" (§5.4) depende de que Analytics tenga acceso de lectura tanto a Funding Management como al veredicto de Rule Engine — si esa composición no se especifica con el mismo cuidado en la futura especificación de Analytics, el Dashboard Maestro (18 §6) podría implementarse con un atajo que reintroduzca el acoplamiento que este documento acaba de eliminar.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** El más importante: cierra una contradicción real que llevaba abierta desde el capítulo 20 (§0) — el esquema de reglas por columnas fijas seguía existiendo en el dominio de Funding Management pese a que el Rule Engine llevaba varios capítulos formalmente aprobado como su dueño legítimo.

**¿Qué sobra?** La tabla `account_rules` completa, tal como estaba modelada en 04/18 — se elimina de este dominio en esta misma especificación.

**¿Qué falta?** Antes de este documento faltaba: una respuesta honesta a qué es "Equity" para un producto sin feed de precio en vivo (§5.2), y un estado de cuenta distinto para una fusión futura (§4.2/§6.3) que no exista todavía en el vocabulario del producto.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente la separación de §2.3: ningún sistema de gestión de posiciones profesional mezcla el libro de capital (back office) con el motor de cumplimiento de límites (compliance) en el mismo esquema — es la misma segregación de funciones que 22.5 §1 ya aplicó a nivel de módulo, ahora forzada también a nivel de esquema de base de datos.

**Puntuación**: **96/100**. Los 4 puntos que faltan son los 3 Riesgos más la naturaleza inevitablemente incompleta de `merged` (§6.3, correctamente deferido, no una laguna).

**Nivel de madurez**: 93%. El modelo de capital, la máquina de estados, el ledger y la frontera con Rule Engine están completos y son directamente implementables; lo pendiente (Equity real, fusiones completas) depende de capacidades que el producto no tiene todavía, no de ambigüedad de este documento.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Funding Management tal como está especificado; los tres son de coordinación con especificaciones futuras (Rule Engine, Analytics) o de disciplina de despliegue.

**Decisiones abiertas**:
1. Formato final de `merged_from_account_ids` (§6.3) — se decide cuando exista demanda real validada, no antes.
2. Si `compliance_flag` necesita evolucionar a una estructura de múltiples veredictos — se decide junto con la especificación de Rule Engine.

**Recomendación profesional**: aprobar SPECIFICATION 003. Es la especificación que más deuda conceptual acumulada resuelve de un solo golpe — la contradicción de `account_rules` llevaba abierta, sin resolver, desde el capítulo 20 al inicio mismo de Fase 0, y esta es la primera vez que el proyecto tenía tanto la instrucción explícita como el capítulo correcto (uno centrado en Funding Management, no en Rule Engine) para cerrarla con propiedad. Recomiendo que la próxima especificación (Rule Engine) parta explícitamente heredando el diseño del esquema real de `RuleProfile`/`RuleProfileSnapshot` como su primer requisito, ya anotado en §11.2.
