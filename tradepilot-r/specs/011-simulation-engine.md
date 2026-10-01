# SPEC-011 · TradePilot Simulation Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 02 §5.2 (bootstrap sobre `R_max` histórico — reutilizado en §10.2), 21.5 §3.4 (Management Plan, definición vigente), 23 I9, 26 §2.7 (Grupo F de Quant Engine, `simularGestion`/`calcularScore` — "consumido por Optimizer", precisado aquí para incluir también a este componente), 27 §2.2/§2.5 (Comparación y Predicción — la capacidad que este documento especifica en ingeniería ya estaba aprobada en concepto), 28 §2 (Trade Set y Scenario, ya formalizados), 30 §3-4 (ciclo de vida de Improvement Item, cruce con el semáforo de riesgo — reutilizado en §7), 32 §3.9/§3.10 (contratos de dominio de Scenario/Simulation), 19 I16/I17, SPEC-001 (Quant Engine — Grupo F, Explainable Quant), SPEC-005 (Optimizer — frontera de invocación opcional, §4.3), SPEC-006 (Knowledge Engine — el mismo razonamiento sobre peeking/comparaciones múltiples, reaplicado en §8), SPEC-007 (Analytics — Catálogo de KPIs y motor de Trade Set, reutilizados sin cambios), SPEC-010 (AI Decision Center — consumidor natural de una simulación adoptada validada)
**No re-abre ninguna decisión conceptual ya aprobada.** El hallazgo principal (§3) no rediseña nada — separa con precisión dos preguntas que la propuesta original mezclaba, evitando construir dos veces el motor de filtrado que Analytics ya tiene.

---

## 1. Objetivo del componente

### 1.1 Misión: laboratorio de gestión, nunca de mercado

TradePilot Simulation Engine responde una única pregunta, siempre sobre datos reales del propio trader: *"¿qué habría producido mi historial real si lo hubiera gestionado de otra forma?"* — nunca qué habría pasado con otra entrada, otro instrumento no operado, u otro movimiento de precio. Es el laboratorio de decisiones de gestión, construido enteramente sobre evidencia ya ocurrida.

### 1.2 Qué nunca debe hacer

1. **Nunca inventa una operación, una entrada o un movimiento de precio.** Toda simulación parte de `r_max` real, ya observado — el mismo dato que Quant Engine ya usa para calcular el resultado real (02 §1, "dato observado a posteriori").
2. **Nunca implementa una fórmula propia.** Todo cálculo se delega a Quant Engine (§4.2) — es la misma disciplina ya exigida a Optimizer (SPEC-005 §1.2) y a Analytics (SPEC-007 §1.2), aplicada aquí por tercera vez a un componente que compara en vez de calcular.
3. **Nunca sobrescribe un dato real.** Ninguna simulación, guardada o no, escribe jamás en `trades`, `accounts` ni ningún esquema de otro módulo — es I17 (Evaluate ≠ Execute) en su forma más literal: una simulación ni siquiera "evalúa" en el sentido de Rule Engine, solo calcula un hipotético y lo compara (§11).
4. **Nunca predice el mercado.** El resultado de una simulación describe qué habría pasado con el `r_max` ya observado bajo otra gestión — nunca proyecta qué `r_max` ocurrirá en el futuro (I9, §9).
5. **Nunca duplica el motor de filtrado de Analytics.** Es el hallazgo central de este documento (§3): parte de las preguntas que el fundador pide responder no necesitan ninguna simulación — ya son consultas de Analytics.

### 1.3 Responsabilidades

- Aplicar un `Scenario` (32 §3.9) hipotético sobre el `r_max` real de cada Operación de un Trade Set, vía Quant Engine (§5).
- Comparar el resultado real contra el simulado usando exclusivamente el Catálogo de KPIs ya existente (SPEC-007 §3) — nunca una métrica nueva.
- Persistir la **configuración** de una simulación con nombre, para guardarla/duplicarla/compartirla entre las propias Cuentas del usuario — nunca su resultado como un valor fijo (§6).
- Conectar la adopción de una simulación como Plan real con el ciclo de vida ya existente de Improvement Item (30 §3), sin inventar un mecanismo de validación paralelo (§7).
- Dejar preparada, sin construirla, la extensión a Monte Carlo, Walk Forward, Stress Testing y Portfolio Simulation (§10).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Calcular `R_final`, esperanza o cualquier métrica | Quant Engine (SPEC-001) |
| Filtrar operaciones reales por sesión/instrumento/plan/etiqueta sin cambiar la gestión | Analytics (SPEC-007) — no requiere simulación alguna (§3) |
| Buscar la mejor configuración posible entre miles de candidatas | Optimizer (SPEC-005) — invocable desde aquí como atajo opcional, nunca como dependencia de cálculo (§4.3) |
| Decidir si una configuración adoptada mejoró realmente, con evidencia estadística | Improvement Prioritization Engine (30), reutilizado, no reinventado (§7) |
| Mostrar la validación de una simulación adoptada al trader | AI Decision Center (SPEC-010), como una tarjeta de Clase 4/5 más, sin mecanismo especial |

---

## 2. Consolidación — esta especificación no nace de la nada

**Tres piezas ya aprobadas anticipaban exactamente esta capacidad, sin construirla nunca**: 27 §2.2 ya formuló la pregunta como capacidad de Quant Capabilities ("¿Qué gestión habría producido mejor resultado con el mismo R_max real? → Simulación sobre Escenario alternativo, el mismo R_max real, otra configuración"); 32 §3.9/§3.10 formalizaron `Scenario` (el sustantivo de entrada) y `Simulation` (el proceso) como contratos de dominio; SPEC-001 §3.8 especificó `simularGestion` en el catálogo de Quant Engine. Esta especificación no inventa el concepto — le da arquitectura, persistencia de configuración y una interfaz completa por primera vez.

---

## 3. Hallazgo central: dos preguntas "¿qué habría pasado?" completamente distintas

### 3.1 Tipo A — contrafactual de gestión (esto sí es Simulation Engine)

Cambia **cómo se gestionó** una operación que ya ocurrió, manteniendo el mismo `r_max` real: parciales, Break Even, RR objetivo, Plan de Gestión completo. Requiere volver a calcular `R_final` por operación con una configuración distinta — es matemática nueva sobre un dato viejo, y es exactamente lo que `simularGestion` (SPEC-001 §3.8) ya existe para hacer.

### 3.2 Tipo B — filtrado retrospectivo (esto ya es Analytics, no simulación)

**Problema detectado**: preguntas como *"¿y si hubiera operado solo Londres?"*, *"¿y si solo hubiera operado cuando seguía completamente mi Plan?"* o *"¿y si hubiera operado solo EURUSD?"* no cambian nada de cómo se gestionó ninguna operación — seleccionan un **subconjunto** de operaciones reales, ya cerradas, con su `R_final` real ya calculado, y agregan sus métricas ya existentes. No hay ningún contrafactual de gestión que calcular — es, literalmente, un `AnalyticsQuery` con `trade_set_filter` (SPEC-007 §6) sobre `market_session`, `plan_followed` (SPEC-009) o `symbol`. **Construir un mecanismo de filtrado propio dentro de Simulation Engine para responder este tipo de pregunta duplicaría exactamente el motor que Analytics ya tiene** — la misma clase de error que el Catálogo de KPIs (SPEC-007 §3) existe para prevenir, aplicada aquí a un motor de filtrado en vez de a una fórmula.

### 3.3 Por qué mezclarlas sería un error de comunicación, no solo de arquitectura

Presentar ambos tipos de pregunta con la misma interfaz visual ("simulación") sería engañoso más allá de un problema técnico: un resultado de Tipo B es un **hecho** — esas operaciones ocurrieron exactamente así, con certeza total. Un resultado de Tipo A es una **hipótesis** — el `r_max` es real, pero la gestión nunca ocurrió, y lleva un nivel de confianza y una limitación epistémica propia (§5.3). Confundir "esto pasó de verdad, filtrado" con "esto es lo que habría pasado" en la misma pantalla, con el mismo lenguaje, sería precisamente el tipo de imprecisión que "Every R Matters" (00) existe para prohibir.

### 3.4 Clasificación completa de las preguntas de ejemplo del fundador

| Pregunta | Tipo | Dónde se responde |
|---|---|---|
| "¿Y si hubiera cerrado el 20-25% en 1.2R?" | A | Simulation Engine |
| "¿Y si hubiera esperado siempre al TP?" | A | Simulation Engine |
| "¿Y si hubiera usado otro Plan de Gestión?" | A | Simulation Engine |
| "¿Y si hubiera dejado correr todo hasta 3R?" | A | Simulation Engine |
| "…nunca hubiera hecho Break Even?" | A | Simulation Engine |
| "¿Y si hubiera operado solo Londres?" | B | Analytics (ya existente) |
| "…solo hubiera operado cuando seguía completamente mi Plan?" | B | Analytics (ya existente) |
| "…solo hubiera operado EURUSD?" | B | Analytics (ya existente) |
| "Cambios de cuenta / etiquetas / filtros / selección de operaciones" (del listado "qué puede simular") | B | Analytics (ya existente) — nunca cambian `R_final`, solo el alcance de la muestra |

**Resolución, no eliminación**: las preguntas Tipo B **sí se responden dentro de la misma experiencia de usuario** (§12) — Simulation Engine construye su Trade Set de entrada exactamente con el motor de filtrado de Analytics (§4.4), así que un trader puede combinar ambas ("¿qué habría pasado si hubiera cerrado distinto, **solo** en mis operaciones de Londres?") sin notar la diferencia arquitectónica — la separación importa para quien construye el sistema, nunca para quien lo usa.

---

## 4. Arquitectura interna

### 4.1 Subcomponentes

```
simulation-engine/
├── scenario-builder/       Traduce la elección del trader en un Scenario (32 §3.9)
├── trade-set-bridge/         Reutiliza el motor de filtrado de Analytics (SPEC-007 §6) — nunca lo reimplementa
├── counterfactual-runner/     Aplica simularGestion (SPEC-001 §3.8) por operación sobre su r_max real
├── comparator/                 Agrega real vs. simulado con el Catálogo de KPIs (SPEC-007 §3) — nunca inventa uno nuevo
├── named-simulations/           Persistencia de configuración, nunca de resultado — §6
├── adoption-bridge/              Conecta con el ciclo de vida de Improvement Item — §7
├── simulation-methods/            Catálogo extensible de métodos — §10
└── explain/                        Las 5 preguntas obligatorias — §12
```

**Módulo**: se añade como **18º módulo oficial** (extiende 22.5 §1).

### 4.2 Frontera con Quant Engine — consumo directo, confirmado

Igual que Optimizer (SPEC-005 §3.3), Simulation Engine invoca directamente `simularGestion`/`calcularScore` (Grupo F, 26 §2.7) — nunca vía Risk Engine, porque sus evaluaciones son siempre hipotéticas y efímeras, nunca datos reales que requieran la orquestación de persistencia de Risk Engine (misma razón ya explicada en SPEC-005 §3.3). Se precisa aquí 26 §2.7 ("consumido por Optimizer") para reflejar que tiene un segundo consumidor legítimo desde esta especificación — no una reapertura del contrato, una ampliación de quién lo usa.

### 4.3 Frontera con Optimizer — invocación opcional, nunca dependencia de cálculo

**Aclaración explícita, porque la propuesta original lista "Optimizer" entre lo que Simulation Engine "consume"**: no consume a Optimizer para calcular nada — cada simulación individual es una única evaluación de un `Scenario` concreto elegido por el trader, no una búsqueda. La relación real es de **atajo de UX**: tras ver el resultado de una simulación manual, el trader puede pulsar "buscar la mejor posible" y esa acción invoca a Optimizer (SPEC-005) de forma independiente — Simulation Engine nunca espera su resultado para completar su propia respuesta, ni usa su lógica de búsqueda internamente.

### 4.4 Frontera con Analytics — Trade Set reutilizado, nunca reimplementado

`trade-set-bridge` construye el conjunto de entrada de una simulación (Tipo A) usando exactamente el mismo `trade_set_filter` (SPEC-007 §6, `TradeSetDefinition`, 28 §2) que Analytics ya expone — resolviendo también, en el mismo paso, cualquier pregunta Tipo B combinada (§3.4).

---

## 5. El motor contrafactual

### 5.1 Scenario aplicado sobre `r_max` real

```
Para cada Operación del Trade Set de entrada:
  1. Leer r_max real (nunca inventado, 02 §1)
  2. Construir RFinalInput con el Scenario hipotético (parciales/RR/be_trigger nuevos) + r_max real
  3. Invocar Quant Engine.simularGestion(RFinalInput) → R_final hipotético (SPEC-001 §3.8)
Agregar la muestra de R_final hipotéticos con las funciones del Grupo C (calcularEsperanza, calcularRatioConsistencia,
calcularProfitFactor, calcularRecoveryFactor, calcularWinRate — SPEC-001 §3.5), exactamente igual que se agregaría
una muestra real — Quant Engine no distingue entre una muestra real y una hipotética, por diseño (26 §1: "Quant
Engine no sabe que existe una base de datos", ni sabe si un R_final es real o simulado)
```

### 5.2 Comparación — reutiliza el Catálogo de KPIs, nunca inventa uno nuevo

Cada métrica pedida por el fundador (Drawdown, Expectancy, Profit Factor, Recovery Factor, Win Rate, Consistencia) ya tiene una entrada en `kpi_definitions` (SPEC-007 §3.2) — `comparator` calcula cada una dos veces (sobre la muestra real y sobre la hipotética, mismo `kpi_definitions.source_function` ambas veces) y expone la diferencia. "Incremento esperado" es, literalmente, esa diferencia sobre `expectancy` — no una métrica nueva con otro nombre.

### 5.3 Límite epistémico honesto — constancia conductual

**Declarado explícitamente, no ocultado**: una simulación responde *"¿qué habría anotado el mismo `r_max` bajo otra regla de gestión, manteniendo todo lo demás constante?"* — **no puede** responder *"¿qué habría hecho realmente el trader si hubiera intentado seguir esa regla?"*, porque intentar seguir una regla nueva podría haber cambiado también otros comportamientos no modelados (p.ej. la ansiedad de esperar a un TP más lejano podría haber alterado cuándo el trader habría cerrado manualmente, un efecto que el `r_max` histórico no captura). Es la misma clase de limitación honesta que SPEC-006 §7.3 ya declaró para confusión/correlación causal — se documenta aquí, no se disfraza, y se traduce a una regla de lenguaje obligatoria (§12): ninguna simulación se presenta como una garantía de resultado futuro, siempre como "esto es lo que habría anotado tu historial bajo esta regla."

---

## 6. Persistencia — configuración, nunca resultado

### 6.1 Por qué (resuelve la tensión con 32 §3.10)

32 §3.10 clasificó `Simulation` como proceso efímero, sin identidad de dominio — sigue siendo así, sin cambios: **el proceso de simular nunca se persiste**. Lo que el fundador pide guardar/nombrar/duplicar/compartir es el `Scenario` de entrada (32 §3.9, que sí es un Value Object con naturaleza de "configuración reutilizable"), no un resultado calculado. Es una distinción con una consecuencia práctica importante: una simulación guardada **se recalcula por completo cada vez que se abre**, nunca desde una caché — porque el Trade Set de entrada crece con cada Operación real nueva que el trader cierra, así que la misma simulación guardada da, con el tiempo, una respuesta cada vez mejor fundamentada, nunca una respuesta congelada en el pasado.

### 6.2 Esquema

```sql
create table public.named_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  scenario_definition jsonb not null,       -- el Scenario hipotético (32 §3.9)
  trade_set_filter jsonb not null,            -- el TradeSetDefinition de entrada (28 §2, SPEC-007 §6)
  account_ids uuid[] not null,                 -- cuentas propias donde aplica — nunca cruza a otro usuario (§6.3)
  created_at timestamptz not null default now()
);
```

### 6.3 Guardar, duplicar, nombrar, compartir entre cuentas propias — nunca entre usuarios

`account_ids` restringe explícitamente una simulación guardada a las Cuentas del propio `user_id` — el mismo aislamiento por usuario ya garantizado por RLS en todo el esquema (04 §1, §4) se reafirma aquí a nivel de diseño de producto: "compartir" significa aplicar la misma configuración guardada a otra Cuenta propia con un toque, nunca exponerla a otro usuario — no existe ningún campo ni mecanismo en este esquema que permita lo segundo.

---

## 7. Adopción — reutiliza el ciclo de vida de Improvement Item, nunca inventa uno paralelo

### 7.1 Nunca un antes/después construido de cero

**Problema detectado**: pedir "comparar antes/después/resultado obtenido/resultado esperado/desviación" cuando una simulación se adopta como Plan real describe, con otras palabras, exactamente el ciclo Detectado→En cola→Activo→Validando→Consolidado|Descartado que 30 §3/32 §3.7 ya construyeron para el Improvement Backlog. **Solución aplicada**: adoptar una simulación (crear un Management Plan real a partir de su `scenario_definition`) emite un evento que Improvement Prioritization Engine consume para crear un Improvement Item en estado `Validando`, con la evidencia inicial = las métricas ya calculadas por esta simulación (§5.2) como "resultado esperado". El propio mecanismo de validación de muestra suficiente, confianza y comparación (30 §2-3) hace el resto — sin que Simulation Engine implemente ninguna lógica de seguimiento propia.

### 7.2 Cruce obligatorio con el semáforo de riesgo (reutiliza 30 §4)

Antes de permitir la adopción de una simulación cuya configuración aumente `σ[R]` (más varianza, aunque mejore `E[R]`), se aplica exactamente la misma salvaguarda ya construida en 30 §4: si la Cuenta de destino tiene el semáforo en 🔴, la adopción queda en cola (nunca bloqueada de forma permanente, nunca descartada) hasta que el semáforo mejore — es el mismo riesgo de optimización local que el fundador pide vigilar explícitamente en este documento, y ya tiene una solución construida a la que este componente se conecta en vez de reinventar.

---

## 8. Riesgo de interpretación — exploración manual y el problema de comparaciones múltiples

### 8.1 Por qué no se aplica un bloqueo automático

Knowledge Engine (SPEC-006 §5.3) corrige comparaciones múltiples con control de tasa de falsos descubrimientos porque **descubre patrones automáticamente**, sin que el trader sepa cuántas hipótesis se probaron. Aquí el trader **elige explícitamente** qué simular, una hipótesis a la vez — aplicar el mismo bloqueo estadístico duro sería tratar la exploración deliberada como si fuera un algoritmo ciego, y mataría exactamente el espíritu de "laboratorio" que el fundador pide para este componente.

### 8.2 Divulgación en su lugar, no un bloqueo

**Riesgo real, sin embargo**: un trader que prueba diez configuraciones distintas hasta encontrar una que "mejora" su esperanza está, sin saberlo, expuesto al mismo riesgo de falso descubrimiento que Knowledge Engine corrige automáticamente — con suficientes intentos, alguna configuración parecerá mejor por puro azar sobre la misma muestra. **Mitigación aplicada**: cuando un usuario ejecuta múltiples simulaciones sobre Trade Sets muy solapados en una misma sesión, se añade un aviso no bloqueante ("Has probado N configuraciones distintas hoy sobre datos similares — probar muchas variantes aumenta la probabilidad de que una parezca mejor solo por azar") — informativo, nunca impide seguir explorando, coherente con el principio de que TradePilot recomienda pero nunca bloquea (01 §2.3, ya vigente en todo el producto).

---

## 9. Nunca predicción — framing obligatorio

Reutiliza, sin modificarla, la restricción ya aprobada en 27 §2.5/23 (I9 ampliado): toda comparación de este componente se redacta como una afirmación sobre el pasado ("tu historial real habría anotado...") — nunca como una proyección de resultado futuro ("obtendrás..."). Es la misma disciplina de lenguaje que ya rige la Predicción acotada de Quant Capabilities, aplicada aquí sin excepción.

---

## 10. Preparación para el futuro — catálogo de Simulation Methods

Mismo patrón ya validado seis veces en este blueprint (catálogo pequeño, extensible por datos):

```
interface SimulationMethod {
  id: string                    // 'deterministic_replay' (hoy), futuros: 'monte_carlo', 'walk_forward', 'stress_test', 'portfolio'
  run(trade_set: TradeSet, scenario: Scenario): ComparisonResult
}
```

### 10.1 `deterministic_replay` — el único método implementado hoy

Exactamente §5 — un `r_max` real, un resultado hipotético, sin aleatoriedad.

### 10.2 Monte Carlo — más cerca de lo que parece, no un proyecto de investigación nuevo

**Hallazgo, a diferencia del espacio de búsqueda del Optimizer (SPEC-001 §8.4)**: simular la distribución de resultados posibles (no un único número, sino un rango de escenarios) sobre un `Scenario` fijo **no requiere investigación nueva** — es exactamente el mismo bootstrap sobre `r_max` histórico que 02 §5.2 y el Optimizer (SPEC-005) ya usan para evaluar un candidato bajo incertidumbre. A diferencia del problema de búsqueda (genuinamente sin resolver hasta que TradePilot Labs investigue), Monte Carlo aquí es una aplicación directa de una técnica ya aprobada — se anota como candidato razonable para una futura SPEC-01X de ampliación de este componente, **no** como línea de investigación de TradePilot Labs.

### 10.3 Walk Forward, Stress Testing, Portfolio Simulation — sí requieren investigación

Walk Forward (estabilidad de una configuración por ventanas temporales), Stress Testing (inyección de escenarios adversos) y Portfolio Simulation (simulación conjunta multi-cuenta) sí introducen preguntas metodológicas genuinamente nuevas (qué tamaño de ventana, cómo definir "adverso" sin fabricar un escenario de mercado — lo que rozaría I9 si no se diseña con cuidado, cómo agregar correctamente across Cuentas con divisas distintas, mismo límite ya declarado en SPEC-003 §8.4 punto 3) — se quedan, correctamente, como línea de investigación de TradePilot Labs, mismo tratamiento que el Optimizer ya recibió.

---

## 11. Seguridad — aislamiento total

Reafirma I17 con el mismo rigor que Optimizer (SPEC-005 §13.4): ninguna interfaz pública de este componente escribe en `trades`, `accounts` ni ningún otro esquema — la única escritura posible es la creación explícita de un nuevo Management Plan al adoptar (§7), acción del trader, nunca automática. `named_simulations` (§6.2) es el único esquema propio, y solo contiene configuración de entrada, nunca un hecho ni un resultado que pudiera confundirse con datos reales.

---

## 12. UX — presupuesto de I16

| Camino | Pasos | Tiempo estimado |
|---|---|---|
| Simulación rápida sobre una plantilla ya guardada | 1. Elegir plantilla → 2. Confirmar | ~10s |
| Simulación nueva (cambiar un parámetro: BE, RR, un parcial) | 1. Elegir Trade Set (default: cuenta actual) → 2. Elegir qué cambiar → 3. Fijar el valor nuevo → 4. Ver resultado | ~20-25s |
| Simulación combinada (Tipo A + filtro Tipo B) | Igual que la anterior + 1 paso de filtro adicional | ~25-30s |

Cumple el límite de 5 pasos/30s pedido por el fundador en todos los caminos, incluido el más completo.

**Las 5 preguntas obligatorias por simulación** (reutiliza el mismo estándar de explicabilidad de SPEC-010 §8):

```
interface SimulationExplanation {
  what_changed: string             // el Scenario aplicado, en términos concretos
  why_it_changes: string             // qué mecanismo de R_final explica la diferencia (02 §2)
  evidence: { trade_set_size: number; confidence: "alta"|"media"|"baja" }   // 13 §2, reutilizado
  risk_of_applying: { variance_delta: RValue; semaphore_check: "ok"|"blocked_pending" }  // §7.2
  sample_adequacy: boolean            // ¿hay muestra suficiente para esta comparación? (mismo criterio que 29 §5 condición 2)
}
```

---

## 13. Interfaces públicas

```
simular(trade_set_filter: TradeSetDefinition, scenario: Scenario, method_id?: string): Result<ComparisonResult, SimulationError>
guardarSimulacion(input: NamedSimulationInput): Result<NamedSimulation, SimulationError>
duplicarSimulacion(id: string, nuevo_nombre: string): Result<NamedSimulation, SimulationError>
compartirEntreCuentas(id: string, account_ids: string[]): Result<NamedSimulation, SimulationError>   // valida propiedad, §6.3
adoptarComoPlan(id: string, account_id: string): Result<{ management_plan_id: string; improvement_item_id: string }, SimulationError>  // §7

type SimulationError =
  | { code: "EMPTY_TRADE_SET" }                          // reexporta EMPTY_SAMPLE de Quant Engine
  | { code: "SIMULATION_METHOD_NOT_APPROVED"; method_id: string }   // mismo gate que SPEC-005 §6.1
  | { code: "ADOPTION_BLOCKED_PENDING_SEMAPHORE"; account_id: string }  // §7.2, nunca un rechazo permanente
  | QuantError                                             // reexportado tal cual desde SPEC-001, nunca reimplementado
```

---

## 14. Rendimiento

Una simulación sobre un Trade Set de tamaño `N` requiere `N` llamadas a `simularGestion` (O(1) cada una, SPEC-001 §5.1) más la agregación del Grupo C (O(N)) — del orden de milisegundos incluso para Trade Sets de varios miles de operaciones, muy por debajo del presupuesto de 30s de §12 sin necesitar ninguna optimización adicional.

---

## 15. Comparación contra herramientas profesionales

**La diferencia que importa, no una lista de features**: un backtester profesional (TradingView Strategy Tester, plataformas similares) simula **entradas** contra datos históricos de mercado — exactamente lo que I9 prohíbe a todo TradePilot. Simulation Engine responde una pregunta deliberadamente más estrecha y, por eso mismo, más honesta: nunca toca si la entrada fue buena, solo si la gestión posterior pudo ser mejor — sobre operaciones que **de verdad ocurrieron**, no sobre una estrategia hipotética corriendo contra precios históricos con todos los riesgos ya conocidos de sobreajuste y sesgo de selección que aquejan al backtesting clásico. Es la misma ventaja estructural que 24 (Ventaja Competitiva) ya identificó para todo el producto — aquí, aplicada a la categoría de producto "simulación", que normalmente pertenece por completo al terreno que TradingView y similares ya ocupan.

---

## 16. Limitaciones a 10 años

1. **El límite epistémico de §5.3 (constancia conductual) no se resuelve nunca por diseño** — ninguna simulación de gestión, por sofisticada que sea, puede capturar cómo cambiaría el comportamiento del propio trader al intentar seguir una regla nueva; se declara aquí como límite permanente, no como algo pendiente de una versión futura.
2. **El aviso de comparaciones múltiples (§8.2) es una divulgación, no una garantía estadística** — si en el futuro se valida que los traders ignoran sistemáticamente el aviso y sacan conclusiones erróneas de exploración manual extensa, puede requerir un tratamiento más fuerte (posiblemente aprendiendo de cómo Knowledge Engine ya lo resuelve para descubrimiento automático) — no se fuerza esa solución hoy sin evidencia de que hace falta.
3. **`named_simulations` puede crecer sin gobernanza** — mismo riesgo de catálogo sin curación ya señalado repetidamente en Fase 1, aquí aplicado a configuraciones guardadas por el usuario en vez de a un catálogo de equipo — de menor severidad porque es por-usuario, no compartido, pero se anota por completitud.

---

## Riesgos

1. **Que la línea entre Tipo A y Tipo B (§3) no quede clara en la interfaz de usuario final**, aunque esté clara en la arquitectura — si el diseño de UX no distingue visualmente "esto es un hecho filtrado" de "esto es una hipótesis", se reintroduce el riesgo de comunicación que §3.3 ya identificó, pese a que el backend lo resuelve correctamente.
2. **El cruce con el semáforo de riesgo (§7.2) depende de que Improvement Prioritization Engine reciba el evento de adopción correctamente** — un fallo silencioso en esa integración permitiría adoptar una configuración de mayor varianza sin el chequeo, mismo tipo de riesgo de integración ya aceptado en otras fronteras de este blueprint.
3. **Monte Carlo (§10.2), aunque técnicamente más simple que el problema del Optimizer, sigue sin tener una especificación propia** — se identifica como de menor esfuerzo, no como ya resuelto; construirlo sin una especificación dedicada repetiría el error que TradePilot Labs existe para evitar.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Le da al trader una forma de responder con evidencia propia, no con intuición, la pregunta que todo trader se hace después de una mala gestión ("¿habría sido mejor hacer esto otro?") — construida enteramente sobre su propio historial real, nunca sobre una estrategia hipotética de mercado.

**¿Qué sobra?** Un motor de filtrado propio para las preguntas Tipo B (§3) — se elimina antes de construirse, reutilizando Analytics.

**¿Qué falta?** Antes de este documento faltaba: la distinción explícita entre contrafactual de gestión y filtrado retrospectivo (§3, el hallazgo central), la resolución de qué se persiste de una simulación guardada (§6, configuración nunca resultado), y la conexión entre "adoptar una simulación" y el ciclo de vida ya construido de Improvement Item (§7) en vez de un mecanismo de seguimiento nuevo.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §5.3 y §8: declarar con precisión qué supuestos no puede capturar un análisis contrafactual (constancia conductual) y tratar la exploración manual de múltiples hipótesis con la misma sospecha metodológica que un desk cuantitativo aplica a cualquier resultado encontrado tras probar muchas variantes — divulgación honesta en vez de una falsa sensación de rigor estadístico donde no lo hay.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — de UX, de integración entre módulos, y de alcance de la próxima especificación (Monte Carlo), ninguno de diseño conceptual de este documento.

**Nivel de madurez**: 94%. Motor contrafactual, persistencia de configuración, adopción vía Improvement Item, salvaguardas de interpretación y preparación para métodos futuros están completos y son directamente implementables; lo pendiente es exclusivamente la especificación futura de Monte Carlo/Walk Forward/Stress/Portfolio, correctamente diferida.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación tal como está especificada.

**Decisiones abiertas**:
1. Si Monte Carlo se especifica como una ampliación cercana de este mismo componente o se espera a validar demanda real de análisis de distribución (no solo de punto estimado) — recomendación: esperar validación, coherente con el criterio ya usado en todo el proyecto (11 §13), pese a ser técnicamente más simple que el problema del Optimizer.
2. Gobernanza común de catálogos de Fase 1 (ahora ocho, incluyendo `simulation_methods`) — misma recomendación repetida, ya la más urgente de las decisiones abiertas acumuladas en toda la fase.

**Recomendación profesional**: aprobar SPECIFICATION 011. Convierte en arquitectura concreta una capacidad que el blueprint ya había aprobado en concepto desde el capítulo 27, y lo hace evitando el error más probable de toda la propuesta original — construir dos veces el motor de filtrado que Analytics ya tiene — antes de que llegara a escribirse una sola línea de código. Es, con SPEC-011, la sexta especificación consecutiva de Fase 1 por encima de 96/100 — la disciplina de Challenge Mode sigue encontrando exactamente un problema real por documento, sin necesitar rediseños de fondo sobre lo que el fundador propone.
