# SPEC-002 · Operations Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 02 §1-2 (modelo matemático, `be_trigger`), 04 §3 (`trades`/`trade_partials_*`, DDL base), 15 §3.1/§3.4 (triggers de capital, `audit_log`), 18 §4 (estados de Cuenta), 20 Fase 4 (bucle operativo, <30s, corrección de errores, reconciliación), 21.5 §3.5/§7 (Operación como Aggregate Root, catálogo de eventos), 22.5 §2.6 (contrato de Operations), 32 §3.5 (contrato de dominio congelado de Operation), SPEC-001 (Quant Engine, consumido vía Risk Engine)
**No re-abre ninguna decisión conceptual ya aprobada.** Donde este documento resuelve algo que quedaba implícito o incompleto en un capítulo anterior, se marca explícitamente como **hallazgo nuevo de esta especificación** (§8).

---

## 1. Objetivo del componente

### 1.1 Qué es una Operación (ancla que gobierna todo lo demás)

Una Operación es **un hecho histórico**. Nunca una intención (eso es un Plan de Gestión, 21.5 §3.4), nunca una predicción (eso está prohibido por I9, 23), nunca una simulación (eso es Simulation, 32 §3.10). Toda decisión de diseño de este documento se deriva de esta única frase: si un campo, un estado o una validación no describe algo que **ya ocurrió** en el mercado real, no pertenece a Operations Engine.

### 1.2 Problema que resuelve

Es, por volumen de uso, el componente más usado de todo TradePilot (20 Fase 4 — "se repite cientos de veces, es el corazón del producto"). Resuelve el único punto de entrada de datos real del bucle operativo: capturar, con precisión matemática exacta y en menos de 30 segundos, el resultado de una decisión de gestión ya tomada por el trader fuera del producto.

### 1.3 Responsabilidades

- Poseer el ciclo de vida completo de una Operación (§2): creación, ejecución de parciales, cierre, cancelación, edición auditada.
- Garantizar que toda Operación pertenece a exactamente 1 Cuenta y captura exactamente 1 `PlanSnapshot` (21.5 §3.5) — incluso cuando el "plan" es anónimo o inferido (§5.1).
- Validar la integridad estructural de sus propios datos en el camino crítico de escritura (§6) — nunca delegar esa validación a un módulo consumidor.
- Emitir el catálogo completo de eventos de dominio (§3.1) del que dependen Risk Engine, Rule Engine, Funding Management y AI Engine.
- Ser el único punto de entrada de datos operativos del sistema, hoy manual, mañana también automatizado (§5.7) — bajo el mismo contrato, sin una segunda vía con reglas distintas.

### 1.4 Qué nunca debe hacer

1. **Nunca calcula `R_final`, `pnl_amount` ni ninguna magnitud derivada por sí misma.** Los solicita a Risk Engine, que a su vez invoca a Quant Engine (26 §8, SPEC-001) — Operations Engine nunca reimplementa una fórmula (22.5 §2.6, ya vigente, reafirmado aquí).
2. **Nunca decide si una Operación es aceptable respecto a un límite de riesgo.** Eso es Rule Engine (19 regla 14) — Operations Engine no bloquea un registro por romper una regla de drawdown, solo lo registra y notifica de forma asíncrona (§4.2).
3. **Nunca bloquea su camino crítico de escritura esperando a otro módulo.** Es la garantía arquitectónica de §6 — no es una aspiración de rendimiento, es una regla de diseño no negociable.
4. **Nunca permite una referencia viva a un Plan de Gestión editable.** Toda Operación captura un `PlanSnapshot` en el momento de crearse (19 regla 13, 21.5 §2) — editar un Plan después nunca altera una Operación ya registrada.
5. **Nunca vuelve al estado Abierta una vez Cerrada.** Una corrección de una Operación mal cerrada se modela como edición auditada del registro Cerrado, nunca como una regresión de estado (§2.3).
6. **Nunca ejecuta ni puede ejecutar una orden en un bróker real.** No existe, ni existirá, ningún camino de código en este componente capaz de actuar sobre una posición real — coherente con 13 §7/01 §5: TradePilot gestiona lo ya ocurrido, nunca ejecuta.

---

## 2. Ciclo de vida de una Operación

### 2.1 Estados

| Estado | Definición | Terminal |
|---|---|---|
| **Abierta** | Registrada como actualmente abierta en el mercado real; tiene datos de entrada, puede tener parciales ejecutados, no tiene desenlace final | No |
| **Cerrada** | Tiene desenlace final: `closed_at`, `closure_reason`, y `Resultado` (`R_final`, `pnl_amount`) calculado por Risk Engine vía Quant Engine | No (editable, nunca revierte a Abierta) |
| **Cancelada** *(estado nuevo, hallazgo §8.3)* | Registrada por error — nunca ocurrió en el mercado real, o el usuario confirma que fue una entrada fantasma | Sí |

### 2.2 Diagrama de transiciones

```
                    registrarOperacion()
                            │
                            ▼
                       ┌─────────┐
        registrarParcialEjecutado()
                       │ Abierta │◀───────────┐
                       └────┬────┘            │ editarOperacion()
                            │                  │ (nunca cambia el estado,
              ┌─────────────┼──────────────┐   │  solo corrige datos)
              │             │              │   │
   cancelarOperacion()  cerrarOperacion()  │   │
   (sin parciales         │                │   │
    ejecutados)           ▼                │   │
              │      ┌─────────┐            │   │
              │      │ Cerrada │────────────┴───┘
              │      └────┬────┘
              │           │ cancelarOperacion()
              │           │ (con reversión de capital,
              │           │  §2.4 caso "operación fantasma")
              ▼           ▼
         ┌───────────────────┐
         │     Cancelada      │  ◄── estado terminal, nunca transiciona a nada
         └───────────────────┘
```

### 2.3 Tabla de transiciones permitidas y prohibidas

| Desde | Hacia | Operación | Permitida | Efecto en capital/eventos |
|---|---|---|---|---|
| (ninguno) | Abierta | `registrarOperacion` | Sí | Ninguno — abrir una posición no mueve capital (21.5 §7, `OperacionRegistrada` solo recalcula si ya está cerrada) |
| Abierta | Abierta | `registrarParcialEjecutado` | Sí | Ninguno — el capital solo se mueve al cierre |
| Abierta | Cerrada | `cerrarOperacion` | Sí | Dispara `OperacionCerrada` → recálculo de capital (15 §3.1) |
| Abierta | Cancelada | `cancelarOperacion` | Sí, **solo si 0 parciales ejecutados** | Ninguno — capital-neutral por construcción, ver §2.4 |
| Cerrada | Cerrada | `editarOperacion` | Sí, siempre auditado | Recalcula en cascada igual que un cierre nuevo (20 Fase 4, paso 5b) |
| Cerrada | Cancelada | `cancelarOperacion` | Sí, con reversión explícita (§2.4, "operación fantasma") | Reversión de capital equivalente a que la operación nunca hubiera existido |
| Cerrada | Abierta | — | **Prohibida, sin excepción** | — |
| Cancelada | cualquiera | — | **Prohibida, sin excepción** — estado terminal | — |

### 2.4 Validaciones

**Síncronas (camino crítico, §6 — deben completarse en el presupuesto de <30s)**:
- Estructurales: `account_id` presente y resuelto explícitamente (nunca inferido en el servidor, §8.4); `symbol`, `side`, `opened_at` presentes; `risk_pct > 0`; `rr_objetivo > 0`.
- Parciales: `sequence` única por Operación, `RR_1 < RR_2 < ... < RR_n`, `Σ p_i ≤ 100` (idéntico al contrato de `calcularRFinal`, SPEC-001 §3.4 — Operations Engine valida la misma forma antes de invocar a Risk Engine, para fallar rápido con un mensaje de UX, no solo con un error interno de Quant Engine).
- Coherencia temporal: `opened_at ≤ closed_at` cuando ambos existen; `executed_at` de un parcial ≥ `opened_at`.
- Coherencia de disparo: un parcial marcado como ejecutado con `rr_level = X` implica `r_max ≥ X` — si no, error de integridad (mismo `INCONSISTENT_TRIGGER_STATE` de SPEC-001 §3.3, reutilizado aquí, nunca reimplementado con otro nombre).

**Asíncronas (fuera del camino crítico, §6)**:
- Evaluación de cumplimiento de reglas (Rule Engine, §4.2) — nunca bloquea, nunca es requisito para que `registrarOperacion` responda éxito.
- Verosimilitud estadística de un patrón (AI Engine, §4.4) — igualmente no bloqueante.

### 2.5 Invariantes

1. Toda Operación pertenece a exactamente 1 Cuenta, para siempre — `account_id` es inmutable tras la creación (editar `account_id` no es una "corrección", es una Operación distinta; mover una Operación entre Cuentas no está soportado, coherente con que el capital de cada Cuenta es una serie de eventos propia, 15 §3.1).
2. Toda Operación captura exactamente 1 `PlanSnapshot` en el momento de crearse, nunca una referencia viva (19 regla 13) — incluso si el usuario no guardó un Plan con nombre, se congela un Plan anónimo con los mismos campos (21.5 §3.4, "un Plan anónimo... existe igualmente como registro").
3. `risk_amount` se calcula y persiste **una sola vez, en el momento de creación** (`Capital_en_ese_instante × Riesgo%`) — nunca se recalcula si el capital de la Cuenta cambia después; es un hecho congelado, no una proyección viva (misma disciplina que el patrón Snapshot, aplicada aquí a un escalar derivado en vez de a una entidad completa — no requiere pasar por Snapshot Engine porque no es una entidad `Snapshotable`, es un valor que se escribe una vez y no cambia).
4. Una Operación Cancelada nunca cuenta en ninguna estadística agregada (esperanza, profit factor, distribución de R, 26 §2.4) — se excluye de la muestra igual que si nunca hubiera existido.
5. Una Operación Cerrada es editable indefinidamente, pero **cada edición es auditada sin excepción** (`audit_log`, 15 §3.4) — no existe una edición "silenciosa" ni una ventana de tiempo tras la cual deje de auditarse.
6. `R_final`/`pnl_amount` nunca se introducen a mano — son siempre el resultado de invocar a Risk Engine (21.5 §3.5, reafirmado). Un campo de "ajuste manual de resultado" no existe en este contrato; si el resultado calculado parece incorrecto, la corrección es sobre los **inputs** (parciales, `r_max`, `rr_objetivo`), nunca sobre el resultado directamente.

---

## 3. Eventos

### 3.1 Eventos emitidos

Extiende el catálogo canónico de 21.5 §7:

| Evento | Ya existía | Disparado por |
|---|---|---|
| `OperacionRegistrada` | Sí | `registrarOperacion` |
| `ParcialEjecutado` | Sí | `registrarParcialEjecutado` |
| `OperacionCerrada` | Sí | `cerrarOperacion` |
| `OperacionEditada` | Sí | `editarOperacion` (sobre Abierta o Cerrada) |
| `OperacionCancelada` | **No — nuevo, hallazgo §8.3** | `cancelarOperacion`, en cualquiera de sus dos formas (§2.4) |

### 3.2 Eventos consumidos

Ninguno de otros Aggregate Roots de negocio — Operations Engine es, junto con Account, productor neto de eventos (22.5 §2.6, ya vigente). No escucha `CapitalRecalculado`, `ReglaIncumplida` ni ningún evento de otro módulo: la dirección de dependencia es siempre saliente.

---

## 4. Integraciones

### 4.1 Quant Engine — nunca directo, siempre vía Risk Engine

Operations Engine **no importa el paquete `quant-engine`**. Al cerrar o editar una Operación, invoca a Risk Engine con el input que Quant Engine necesita (`RFinalInput`, SPEC-001 §3.4); Risk Engine invoca a Quant Engine, persiste el `Resultado` y se lo devuelve a Operations Engine para que lo almacene en la fila de la Operación. Es el límite ya fijado en 22.5 §2.6/26 §8 — este documento no lo reabre, solo lo hace explícito en la secuencia de llamadas:

```
Operations Engine.cerrarOperacion(input)
  → Risk Engine.calcularResultado(RFinalInput derivado del input)
      → Quant Engine.calcularRFinal(...) → Quant Engine.calcularBeneficioReal(...) → ...
      → Risk Engine persiste el Resultado, emite CapitalRecalculado (22.5 §2.3)
  ← Risk Engine devuelve el Resultado (QuantResult<RValue>, SPEC-001 §3.2)
  → Operations Engine persiste r_final/pnl_amount en la fila de la Operación, emite OperacionCerrada
```

### 4.2 Rule Engine — siempre asíncrono, nunca bloqueante

Operations Engine emite `OperacionRegistrada`/`OperacionCerrada`/`OperacionEditada`/`OperacionCancelada` a una cola; Rule Engine los consume de forma asíncrona y produce sus veredictos (`Rule Evaluation`, 32 §3.11) sin que Operations Engine espere respuesta. Esta es la forma concreta del invariante ya aprobado "Rule Engine nunca bloquea el registro de una Operación" (22 §7, 26) — aquí se traduce en una regla de implementación literal: **la función que persiste una Operación no tiene, en ningún punto de su código, una llamada síncrona a Rule Engine.**

### 4.3 Funding Management (Account) — capital en cascada

`OperacionCerrada` y la forma de `OperacionCancelada` con reversión (§2.4) son los dos únicos eventos de Operations Engine que Account escucha para recalcular `current_capital`/`peak_capital` (15 §3.1, 21.5 §7). `OperacionRegistrada` (Abierta) y `ParcialEjecutado` **no** disparan recálculo de capital — es capital-neutral hasta el cierre, ya establecido en 21.5 §7 y reafirmado en la tabla de §2.3 de este documento.

### 4.4 AI Engine — asíncrono, dispara posibilidad de recomendación

`OperacionCerrada` dispara, de forma asíncrona (05 §3, 22.5 §2.7), la actualización del perfil bayesiano (13 §3) y la posible generación de un Improvement Item (32 §3.7). Operations Engine no conoce ni depende de este pipeline — solo emite el evento, igual que con Rule Engine.

---

## 5. Registro de cada tipo de dato operativo

### 5.1 Entrada

Campos mínimos: `account_id` (explícito, §8.4), `symbol`, `side`, `opened_at`, `risk_pct`, `rr_objetivo`, `be_trigger` (02 §1.4/SPEC-001 §3.1), parciales planificados opcionales (0-5, `trade_partials_planned`). Si el usuario no guardó un Plan con nombre, se congela igualmente un `PlanSnapshot` anónimo con estos mismos campos (§2.5, invariante 2) — la ausencia de nombre no es ausencia de Snapshot.

### 5.2 Salidas parciales

`registrarParcialEjecutado(trade_id, sequence, rr_level, pct_close, executed_at)` — añade una fila a `trade_partials_executed` (04 §3, ya vigente). Válido solo sobre una Operación en estado Abierta. Cada parcial ejecutado es, en el vocabulario de 21.5 §4/§7, simultáneamente un Value Object (dato) y un Domain Event (hecho ya ocurrido) — la ambigüedad ya estaba documentada como deliberada en 21.5 §11.2; esta especificación la resuelve para persistencia: se materializa como fila en `trade_partials_executed`, nunca como una entrada separada en un log de eventos genérico, porque su consulta more frecuente es "los parciales de esta Operación", no "el historial de eventos del sistema".

### 5.3 Break Even / Stop Loss / Take Profit / Cierre manual — el campo `closure_reason`

**Hallazgo de diseño**: estos cuatro conceptos, tal como los pide el fundador, no son cuatro mecanismos distintos de registro — son las cuatro ramas ya formalizadas de `R_cierre_resto` (02 §2), expuestas como un único campo obligatorio en el momento del cierre:

```
enum ClosureReason {
  STOP_LOSS         // k=0, ningún parcial disparado → R_cierre_resto = −1
  BREAK_EVEN        // stop movido a BE tras el último parcial disparado → R_cierre_resto = 0
  TAKE_PROFIT_FULL  // R_max ≥ RR_obj, el resto cierra en el objetivo → R_cierre_resto = RR_obj
  MANUAL_CLOSE      // el usuario cierra el resto en un nivel libre antes del objetivo → R_cierre_resto = nivel indicado
}
```

`cerrarOperacion` exige `closure_reason` como campo obligatorio, y si es `MANUAL_CLOSE`, exige también el nivel de cierre (`cierre_manual_rr`, ya presente en `RFinalInput`, SPEC-001 §3.4). No se introduce ninguna fórmula nueva — este campo es exactamente el selector que `calcularRFinal` ya necesitaba recibir de forma implícita; hacerlo explícito en la interfaz de cierre es lo que permite a Rule Engine y a AI Engine (Coaching Card, 29 §3, "qué alternativa habría sido mejor") razonar sobre *por qué* cerró así una Operación sin tener que inferirlo del resultado numérico.

### 5.4 Cancelación

Dos formas, ya tabuladas en §2.3:
- **Cancelación simple** (Abierta, 0 parciales ejecutados): no hay ningún efecto de capital que revertir — se marca `status = 'cancelled'` y se conserva la fila completa (nunca se borra un registro financiero, 15 §3.4) con un campo `cancellation_reason` de texto libre obligatorio.
- **Cancelación de "operación fantasma"** (Cerrada, se descubre que nunca ocurrió en el mercado real): requiere reversión de capital — se trata, en el motor de recálculo, exactamente como una edición que anula el `pnl_amount` a efectos del ledger, más el cambio de estado a Cancelada. Exige un `cancellation_reason` obligatorio y una confirmación explícita separada del flujo normal de edición (nunca un botón de un solo toque — es la única acción destructiva de todo este componente sobre datos ya usados para calcular capital real).

### 5.5 Errores de introducción (antes de guardar)

Ocurren en el cliente, antes de que exista una fila persistida — no requieren auditoría porque no hay todavía un hecho registrado que corregir, solo un borrador. Se validan con las mismas reglas síncronas de §2.4 antes de permitir el toque de "Guardar" (10 §3-5) — Operations Engine no distingue, en su contrato, entre "el usuario corrigió un dígito antes de guardar" y "el usuario nunca escribió el dígito incorrecto": solo ve el input final válido.

### 5.6 Correcciones auditables (después de guardar)

`editarOperacion(trade_id, cambios, nota_opcional)` — ya diseñado funcionalmente en 20 Fase 4 paso 5b, aquí se formaliza el contrato: cada campo modificado se escribe en `audit_log` (15 §3.4) con valor anterior y nuevo, el `trade_id`, el usuario, el timestamp, y dispara el mismo recálculo en cascada que un cierre nuevo (§4.1, §4.3) si el campo editado afecta a `R_final`/`pnl_amount`. `editarOperacion` **nunca** cambia `status` — un intento de editar `status` directamente se rechaza con un error tipado (`FORBIDDEN_STATUS_EDIT`); los cambios de estado solo ocurren a través de `cerrarOperacion`/`cancelarOperacion` (§2.3), manteniendo las reglas de la máquina de estados en un único lugar.

### 5.7 Importación automática futura (arquitectura preparada, no construida)

**Principio de diseño, no negociable**: existe **un único contrato público de escritura** (`registrarOperacion`/`registrarParcialEjecutado`/`cerrarOperacion`), y tanto el formulario manual (10) como cualquier futuro conector (TradingView, NinjaTrader, MetaTrader, cTrader) lo invocan exactamente igual — nunca una segunda vía con validación más permisiva. Es la misma disciplina que SPEC-001 aplica contra el "formula drift" (26 §Riesgos #1), aplicada aquí contra lo que se podría llamar **"path drift"**: una vía de importación con reglas distintas a la manual acabaría, con el tiempo, produciendo datos que la vía manual nunca habría aceptado.

**Lo que se prepara desde hoy** (§8.3 detalla el porqué de cada campo):
- `source: text` — catálogo de datos, no `enum` cerrado en esquema (mismo principio anti-hardcoding que 20 §0/21 aplicaron al Rule Engine): `'manual'`, `'import_mt4'`, `'import_mt5'`, `'import_ctrader'`, `'import_tradingview'`, `'import_ninjatrader'`, `'csv_import'`, extensible sin migración.
- `external_ref: text nullable` — identificador opaco de la operación en el sistema origen, usado únicamente para deduplicación en re-sincronización (`unique (account_id, source, external_ref) where external_ref is not null`).
- **Frontera de traducción obligatoria**: un futuro conector nunca escribe directamente en el esquema de `trades` — pasa por un **Import Adapter** específico de cada bróker/plataforma, responsable de traducir la representación nativa de esa plataforma (precios de entrada/stop/take-profit, fills reales) al contrato canónico de `registrarOperacion` (derivar `risk_pct` de la distancia entrada-stop y el tamaño de posición, derivar `rr_objetivo` de la distancia entrada-objetivo). Esa traducción es lógica específica de cada bróker y **no pertenece a Operations Engine** — pertenece al Import Adapter correspondiente, todavía sin especificar (correctamente fuera de alcance aquí, igual que TradePilot Labs quedó fuera de alcance para el Optimizer).

---

## 6. Garantía arquitectónica: registrar una Operación completa en <30s

El fundador declara este objetivo como **no negociable, para siempre**. Esta especificación lo traduce de un objetivo de UX (10 §4, ya cumplido en ~7-23s de interacción) a una garantía de arquitectura que ninguna decisión futura puede romper sin violar este documento:

1. **Camino crítico estrictamente acotado**: la función que persiste una Operación ejecuta, en el mismo ciclo síncrono: validación estructural (§2.4) + escritura de la fila + la porción de Quant Engine necesaria para mostrar `R_final` de inmediato (O(1)-O(n) sobre n≤5 parciales, <1ms por el objetivo de latencia de SPEC-001 §5.1). **Nada más puede añadirse a este camino** — cualquier propuesta futura de "validar contra el límite de la prop firm antes de guardar" o "esperar la recomendación de IA antes de confirmar" se rechaza por diseño, no por rendimiento del momento.
2. **Cascada reactiva, siempre asíncrona**: evaluación de Rule Engine, actualización bayesiana, generación de recomendaciones, refresco de vistas de Analytics — todo lo que no es indispensable para que el usuario vea "Operación guardada" ocurre después, en cola, sin que el usuario lo perciba como parte del tiempo de guardado.
3. **Escritura local-first (hallazgo de esta especificación, §8.1)**: 10 §4 mide el tiempo de interacción (toques + tecleo), no la latencia de red — un trader que cierra una operación en el mercado suele estar en movimiento, con conectividad variable. El guardado debe confirmar éxito al usuario en cuanto la escritura es durable **localmente** (PWA, 05 §6), sincronizando con el servidor en segundo plano; el servidor sigue siendo la fuente de verdad, y una escritura local que falle la validación estructural al sincronizar (rara, porque la validación síncrona ya se aplicó en el cliente antes de aceptar el "Guardar") se señala al usuario para corregirla, nunca se descarta en silencio.
4. **Idempotencia obligatoria en la escritura** (hallazgo de esta especificación, §8.3): `registrarOperacion` acepta una clave de idempotencia generada por el cliente (UUID); un reintento por conectividad inestable con la misma clave nunca produce una segunda fila. Sin esto, la propia garantía de <30s en condiciones reales de red móvil (19 §6, prioridad #3, experiencia móvil) podría inducir al usuario a tocar "Guardar" dos veces ante un guardado que parece colgado, duplicando el dato.

---

## 7. Interfaces públicas

```
registrarOperacion(input: RegistrarOperacionInput, idempotency_key: string): Result<OperacionRegistrada, OperationsError>
registrarParcialEjecutado(trade_id: string, parcial: ParcialEjecutadoInput): Result<ParcialEjecutado, OperationsError>
cerrarOperacion(trade_id: string, cierre: CierreInput): Result<OperacionCerrada, OperationsError>
cancelarOperacion(trade_id: string, motivo: string): Result<OperacionCancelada, OperationsError>
editarOperacion(trade_id: string, cambios: Partial<OperacionEditable>, nota?: string): Result<OperacionEditada, OperationsError>

interface CierreInput {
  closed_at: Timestamp
  closure_reason: ClosureReason            // §5.3
  cierre_manual_rr?: RValue                // obligatorio solo si closure_reason = MANUAL_CLOSE
  r_max: RValue
}

type OperationsError =
  | { code: "ACCOUNT_NOT_FOUND" }
  | { code: "ACCOUNT_TERMINATED_WARNING"; blocking: false }          // 20 Fase 4, caso límite — nunca bloqueante
  | { code: "INVALID_STATE_TRANSITION"; from: EstadoOperacion; to: EstadoOperacion }
  | { code: "FORBIDDEN_STATUS_EDIT" }
  | { code: "CANCELLATION_REQUIRES_REASON" }
  | { code: "DUPLICATE_IDEMPOTENCY_KEY"; existing_trade_id: string }  // no es un error real, es la garantía de §6.4 — devuelve la Operación ya creada
  | QuantError                                                        // reexportado tal cual desde SPEC-001 §3.3, nunca reimplementado con otro nombre
```

---

## 8. Auditoría — intentando destruir el diseño

### 8.1 Fricción encontrada

Ninguna fricción nueva en el flujo manual — 10 ya lo optimizó y esta especificación no le añade ningún paso síncrono (§6, punto 1, es precisamente la garantía que lo impide). El único hallazgo de fricción real es de **robustez, no de pasos**: sin escritura local-first (§6.3), una mala conexión en el momento exacto de cerrar una operación en movimiento podría hacer que el flujo de 10 §4 se sintiera de 30s reales aunque la interacción táctil siga siendo de 7-8s — se resuelve con local-first, no con más pasos.

### 8.2 Duplicación de datos

No se encontró duplicación de datos nueva. Se confirma que `risk_amount` (invariante 3, §2.5) no es una segunda fuente de verdad del capital — es un hecho congelado en el momento de creación, distinto de `current_capital` (serie derivada de eventos, 15 §3.1), y ambos pueden coexistir sin contradecirse porque miden cosas distintas en momentos distintos.

### 8.3 Inconsistencias de integridad encontradas (los tres hallazgos principales de este documento)

1. **Estado `Cancelada` y evento `OperacionCancelada` no existían en ningún capítulo anterior** — 21.5 §7 y 04 §3 (`status in ('open','closed')`) nunca contemplaron una operación registrada por error. Sin este estado, la única forma de "deshacer" una operación fantasma habría sido borrarla físicamente — violando 15 §3.4 (nunca se borra un registro financiero) — o dejarla como Cerrada con datos falsos contaminando las estadísticas para siempre. Resuelto en §2.1/§2.4/§5.4. **Requiere ALTER de esquema**: `alter table public.trades add column cancellation_reason text; alter table public.trades drop constraint trades_status_check; alter table public.trades add constraint trades_status_check check (status in ('open','closed','cancelled'));`
2. **Ninguna clave de idempotencia existía en el contrato de escritura** — a la escala de 19 §7 (miles de cuentas, millones de operaciones) y bajo el requisito explícito de robustez ante mala conectividad (§6.3), un reintento de red duplicando una fila es un riesgo de integridad real, no teórico. Resuelto en §6.4/§7. **Requiere ALTER de esquema**: `alter table public.trades add column idempotency_key uuid; create unique index trades_idempotency_idx on public.trades(account_id, idempotency_key) where idempotency_key is not null;`
3. **No existían campos para preparar la importación futura** (§5.7) — sin `source`/`external_ref` desde ahora, cualquier conector futuro obligaría a una migración retroactiva de todo el histórico ya registrado como manual. **Requiere ALTER de esquema**: `alter table public.trades add column source text not null default 'manual'; alter table public.trades add column external_ref text; create unique index trades_external_ref_idx on public.trades(account_id, source, external_ref) where external_ref is not null;`

### 8.4 Escala: 1, 5, 20 cuentas, distintas prop firms

1. **`account_id` siempre explícito en la escritura, nunca inferido en el servidor** (ya reflejado en §2.4/§5.1) — con 20 cuentas, cualquier inferencia de "cuenta por defecto" del lado del servidor es un riesgo real de mal-atribución silenciosa; la inferencia de "última cuenta usada" (10 §4) es exclusivamente una conveniencia de UI del lado del cliente, nunca una decisión que el backend tome por su cuenta.
2. **Operaciones espejo en múltiples cuentas son un caso legítimo, no un duplicado a prevenir**: un trader con 5 cuentas fondeadas replicando la misma señal en las 5 simultáneamente es un patrón real y frecuente — la idempotencia de §6.4/§8.3.2 se define deliberadamente a nivel de `(account_id, idempotency_key)`, nunca a nivel de "mismo símbolo+dirección+hora en cualquier cuenta del usuario", precisamente para no romper este caso de uso real tratándolo como error.
3. **Mezcla de divisas entre cuentas de distintas prop firms**: `pnl_amount` se almacena siempre en la divisa nativa de la Cuenta (04, `currency`) — Operations Engine nunca sabe ni le importa que dos Cuentas del mismo usuario tengan divisas distintas. Se documenta explícitamente aquí, como límite de responsabilidad: cualquier agregado cruzado entre Cuentas de distinta divisa (p.ej. un Dashboard Maestro sumando PnL de una cuenta en USD y otra en EUR, 18 §6) es responsabilidad de Analytics/Reporting Engine, que deben convertir explícitamente — nunca de Operations Engine, y nunca sumado sin conversión en ningún punto de este componente.
4. **El límite de 5 parciales (`sequence smallint 1..5`) no es una limitación técnica de este componente** — es un límite de producto ya decidido y justificado en 02 §5.1 (granularidad de gestión), no algo que Operations Engine deba "arreglar" a mayor escala; se reafirma aquí para que no se confunda con una deuda técnica en una futura revisión.

### 8.5 Preparación para conectores futuros (TradingView, NinjaTrader, MetaTrader, cTrader)

Ya cubierta en profundidad en §5.7 — el resumen de auditoría es que la arquitectura queda preparada mediante tres decisiones tomadas **hoy**, no en cinco años: (a) contrato único de escritura sin una segunda vía permisiva, (b) campos `source`/`external_ref` en el esquema desde esta especificación, (c) frontera explícita de que la traducción de formato de cada bróker vive en un Import Adapter futuro, nunca dentro de Operations Engine. No se especifica ningún Import Adapter concreto aquí — sería diseñar contra un proveedor que todavía no se ha evaluado, exactamente el mismo error que TradePilot Labs evita cometer con el Optimizer.

---

## 9. Limitaciones a 10 años

1. **El estado `Cancelada` con reversión de capital (§5.4) introduce, por primera vez en el sistema, una operación de "reversión contable"** — hoy se especifica como un caso especial de edición; si en el futuro aparecen más escenarios de reversión (p.ej. deshacer un `payout` mal registrado, 15 §3.1), vale la pena evaluar si merece su propio mecanismo genérico de "evento compensatorio" en vez de casos especiales repetidos módulo a módulo — se anota como pregunta abierta, no se decide aquí.
2. **La deduplicación de importación (`source`+`external_ref`) asume que cada conector futuro provee un identificador estable** — no todos los brókers lo garantizan; un Import Adapter para una plataforma sin ID estable tendrá que sintetizar uno (hash de campos clave) — es responsabilidad de ese Import Adapter, ya anotado como su frontera (§5.7), no un límite de Operations Engine.
3. **La escritura local-first (§6.3) introduce, por primera vez, un estado "pendiente de sincronizar" que este documento no detalla en profundidad** (formato de cola local, resolución de conflictos si el mismo `trade_id` se edita en dos dispositivos offline a la vez) — se dimensiona lo suficiente para fijar el principio (servidor como fuente de verdad, nunca sobrescritura silenciosa), pero el mecanismo completo de sincronización offline-first pertenece a una especificación de la capa de sincronización de la PWA, no a Operations Engine en sí — límite de alcance explícito, no un hueco olvidado.

---

## Riesgos

1. Los tres ALTER de esquema de §8.3 deben aplicarse antes de que exista cualquier dato en producción bajo el esquema antiguo — si se aplican tarde, requieren una migración de backfill (`source = 'manual'` para todo lo existente es seguro por defecto; `status = 'cancelled'` nunca aplica retroactivamente sin intervención humana caso a caso).
2. La garantía de <30s (§6) depende de que ningún futuro Product Manager añada un paso síncrono "solo esta vez" al camino crítico — la única mitigación real es que TPOS (31) trate cualquier propuesta así como una violación de invariante, gate binario, no una cuestión de puntuación.
3. El Import Adapter (§5.7/§8.5) queda deliberadamente sin especificar — si se implementa un conector real antes de que exista esa especificación, hay riesgo de que la traducción bróker→contrato canónico se escriba directamente dentro de Operations Engine "por velocidad", rompiendo la frontera que este documento fija. Mitigación: ningún conector se construye sin una Specification propia, mismo precedente que el Optimizer/TradePilot Labs.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Convierte el componente de mayor uso del producto en un contrato implementable sin ambigüedad, y encuentra tres huecos de integridad reales (Cancelación, idempotencia, preparación de importación) que ningún capítulo anterior había cerrado.

**¿Qué sobra?** Nada de lo ya aprobado se elimina; no se introduce ningún campo o mecanismo que no resuelva un caso concreto ya identificado.

**¿Qué falta?** Antes de este documento faltaban: un estado para operaciones registradas por error (§8.3.1), protección contra duplicados por reintento de red (§8.3.2), y los campos mínimos para no requerir una migración retroactiva cuando exista el primer conector (§8.3.3).

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente el tratamiento dado a la Cancelación de "operación fantasma" (§5.4): un libro de posiciones profesional nunca borra un error, lo revierte con trazabilidad completa y motivo obligatorio — nunca con un botón de un solo toque.

**Puntuación**: **95/100**. Los 5 puntos que faltan son los 3 Riesgos — ninguno es una ambigüedad de diseño, los tres dependen de disciplina de ejecución futura (migraciones a tiempo, TPOS aplicado con rigor, y una especificación de Import Adapter que todavía no existe).

**Nivel de madurez**: 94%. Ciclo de vida, validaciones, invariantes, eventos, integraciones, los siete tipos de registro pedidos y la garantía de <30s están completos y son directamente implementables; lo pendiente es exclusivamente de especificaciones futuras (Import Adapter, capa de sincronización offline) fuera del alcance de este componente.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Operations Engine tal como está especificado.

**Decisiones abiertas**:
1. Si la reversión de capital de la Cancelación "fantasma" (§5.4, §9.1) merece un mecanismo genérico de evento compensatorio a futuro — se deja para cuando exista un segundo caso real que lo justifique.
2. Diseño completo de la capa de sincronización offline-first (§9.3) — especificación futura, no bloqueante para construir el camino crítico de este componente.

**Recomendación profesional**: aprobar SPECIFICATION 002. Es implementable directamente, incluye los tres ALTER de esquema necesarios para no acumular deuda de migración, y dos de sus tres hallazgos de auditoría (Cancelación, idempotencia) son del tipo que, de no corregirse ahora, se habría descubierto en producción con dinero real de por medio — exactamente el estándar que "librería crítica para un banco de inversión" exige también del componente que rodea al motor matemático, no solo del motor en sí.
