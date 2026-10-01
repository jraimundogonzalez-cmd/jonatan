# SPEC-005 · TradePilot Optimizer

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 02 §5 (modelo original del optimizador, espacio de búsqueda, función objetivo `Score = E−λσ`), 12 §6 (demostración numérica de dominancia), 13 §6.3 (una recomendación nunca se aplica sola), 21.5 §6 (Optimizador como Domain Service, sin estado propio), 22.5 §2.7 (AI Engine como consumidor/orquestador de cuándo invocarlo), 26 §2.7 (Grupo F de Quant Engine — Optimizer lo consume **directamente**, sin pasar por Risk Engine, distinto del caso de Rule Engine), 27 §2.4 (Quant Capabilities, incl. optimización restringida por drawdown objetivo), 28 §2 (Scenario/Simulation formalizados como sustantivo/proceso, y **Trade Set** como sustantivo oficial de la muestra de entrada de toda función agregada — §6.1 declara expresamente que reemplaza el uso informal de "muestra"/"histórico filtrado" de 02/12/26/27), 32 §3.9/§3.10 (contratos de dominio de Scenario/Simulation), 19 I16 (Zero Friction), 19 I17 (Evaluate ≠ Execute, recién aprobado), SPEC-001 (Quant Engine — Explainable Quant, y el hallazgo del espacio de búsqueda en §8.4, origen directo de este documento)
**No re-abre ninguna decisión conceptual ya aprobada.** El modelo de 02 §5 (espacio, `Score`) se mantiene íntegro — lo que este documento resuelve es *cómo explorar ese espacio sin fuerza bruta*, que 02 §5.1 nunca llegó a resolver correctamente (SPEC-001 §8.4 ya lo demostró).

---

## 1. Objetivo del componente

### 1.1 Misión: descubrir, no calcular

TradePilot Optimizer busca, entre configuraciones de gestión posibles, aquellas que un trader concreto no habría encontrado por su cuenta — nunca calcula el valor de una configuración ya conocida (eso es exactamente lo que Quant Engine hace, SPEC-001). Es la diferencia entre "saber cuánto vale X" (Quant Engine) y "encontrar qué X vale más" (Optimizer) — dos preguntas distintas, dos componentes distintos, ninguno sustituye al otro.

### 1.2 Qué nunca debe hacer

1. **Nunca calcula una fórmula matemática por sí mismo.** Ni `E[R]`, ni `σ[R]`, ni `Score`, ni ningún valor del catálogo de SPEC-001 — todo cálculo se delega a Quant Engine, sin excepción, sin una "versión rápida interna" para casos triviales.
2. **Nunca explora el espacio de búsqueda de forma exhaustiva.** Es una prohibición de arquitectura, no una preferencia de rendimiento — SPEC-001 §8.4 demostró que el espacio real (≈2,3×10¹¹ combinaciones para 5 parciales) hace la fuerza bruta inviable incluso a la latencia mínima por evaluación; ninguna estrategia de búsqueda admitida en este componente puede requerir enumerar el espacio completo para garantizar su resultado (§2).
3. **Nunca es una caja negra.** Toda recomendación se entrega junto con la explicación de por qué es mejor, en términos de las mismas métricas objetivas que Quant Engine ya calcula — nunca una frase generada sin datos que la respalden (§10).
4. **Nunca aplica una recomendación por sí solo.** Es I17 (Evaluate ≠ Execute) aplicado aquí de forma literal, y ya estaba parcialmente anticipado en 13 §6.3: el trader decide si adopta una configuración recomendada como un nuevo Plan de Gestión — Optimizer nunca escribe en Management Plans ni en ningún otro módulo.
5. **Nunca depende de un algoritmo no aprobado.** Toda estrategia de búsqueda que este componente puede invocar está en un registro validado (§6) — TradePilot Labs investiga, Optimizer solo consume lo ya aprobado.

### 1.3 Responsabilidades

- Generar candidatas (Scenarios, 32 §3.9) dentro del espacio válido de configuración.
- Seleccionar qué candidatas evaluar, mediante una estrategia de búsqueda intercambiable (§3.2).
- Delegar cada evaluación a Quant Engine (Grupo F, `simularGestion`/`calcularScore`, 26 §2.7) — nunca reimplementar el cálculo.
- Comparar resultados evaluados y descartar los dominados, incluyendo el caso multiobjetivo (§9).
- Explicar toda recomendación con las métricas objetivas que la respaldan (§10).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Calcular `R_final`, esperanza, desviación, Score | Quant Engine (SPEC-001), consumido directamente (§3.3) |
| Decidir cuándo invocar a Optimizer y cómo presentar su resultado al trader | AI Engine (22.5 §2.7) — Optimizer responde a una solicitud, no decide por sí mismo cuándo ejecutarse |
| Aplicar una recomendación como el nuevo Plan de Gestión de una Cuenta | El propio trader, de forma explícita (I17, §1.2 punto 4) |
| Investigar y validar algoritmos de búsqueda genuinamente nuevos | TradePilot Labs (§6) |
| Juzgar si una configuración cumple un límite de una prop firm | Rule Engine — fuera del alcance total de este componente, que opera exclusivamente sobre matemática pura de R (mismo principio ya fijado en 22.5 §Riesgos para el optimizador) |

---

## 2. Por qué la fuerza bruta queda descartada por diseño (matemática, no preferencia)

SPEC-001 §8.4 demostró que el espacio de búsqueda real para `n=5` parciales es del orden de **2,3×10¹¹** combinaciones — evaluarlo por completo, incluso a 1 microsegundo por evaluación, tardaría más de 63.000 horas. Cualquier arquitectura que dependa de recorrer ese espacio, aunque sea de forma optimizada, hereda ese límite. Este componente lo descarta **por completo**, con una alternativa que tiene una garantía matemática propia, no solo "suele funcionar bien":

**Cobertura garantizada de búsqueda aleatoria (resultado estándar de optimización, no una intuición)**: si se toman `K` muestras independientes y uniformes de un espacio de búsqueda de cualquier tamaño, la probabilidad de que **ninguna** de ellas caiga dentro del mejor `q`-cuantil (p.ej. el 1% superior por `Score`) es `(1−q)^K`. Para garantizar una confianza `≥ 1−ε` de que al menos una muestra cae en ese `q`-cuantil:

```
K ≥ ln(ε) / ln(1−q)
```

Esta cota **no depende del tamaño del espacio** — es válida tanto si el espacio tiene 10⁵ combinaciones como si tiene 2,3×10¹¹. Ejemplos concretos:

| Objetivo | `q` | Confianza (`1−ε`) | `K` mínimo |
|---|---|---|---|
| Top 1% del espacio | 1% | 95% | 299 |
| Top 1% del espacio | 1% | 99% | 459 |
| Top 0.1% del espacio | 0.1% | 95% | 2.995 |
| Top 5% del espacio | 5% | 99% | 90 |

**Esto es la respuesta directa al mandato de "destruir la idea de fuerza bruta"**: no hace falta explorar 2,3×10¹¹ candidatas para tener una garantía estadística fuerte de encontrar una configuración cercana a la óptima — unos pocos cientos de muestras, evaluadas con Quant Engine (cada una <1ms, SPEC-001 §5.1), bastan. Es la estrategia de referencia de este componente (§5), no una aproximación sin justificar — es una aproximación con una cota de error explícita y configurable, exactamente lo que Challenge Mode exige en vez de rechazar cualquier método que no sea exhaustivo.

---

## 3. Arquitectura interna

### 3.1 Subcomponentes

```
optimizer/
├── problem/               Define OptimizationProblem: espacio, objetivos, restricciones (§4)
├── search-strategies/      Registro de estrategias intercambiables (Strategy pattern, ask/tell) — §3.2, §6
├── scenario-generator/      Traduce la propuesta de una estrategia a un Scenario válido (32 §3.9)
├── evaluator-bridge/         Único punto de contacto con Quant Engine — nunca calcula, solo traduce y delega (§3.3)
├── comparator/               Ranking single-objetivo y frente de Pareto multiobjetivo (§9)
├── explain/                  Construye la explicación de la recomendación ganadora (§10)
└── registry/                  Contrato de aprobación de estrategias (§6)
```

### 3.2 El ciclo *ask/tell* — por qué esta forma soporta diez años de evolución

**Decisión de arquitectura central de este documento**: toda estrategia de búsqueda, sin importar su naturaleza (aleatoria, heurística, evolutiva, bayesiana, Monte Carlo), se expresa bajo la misma interfaz iterativa de "preguntar/responder" (patrón *ask-tell*, estándar en optimización de caja negra):

```
interface SearchStrategy<TState> {
  id: string                                              // "bounded_random_search.v1", futuros: "genetic.v1", "bayesian.v1"...
  initState(problem: OptimizationProblem, seed: number): TState
  ask(state: TState): Scenario[]                            // qué candidatas evaluar a continuación
  tell(state: TState, evaluated: EvaluatedCandidate[]): TState  // la estrategia aprende del resultado
  isDone(state: TState): boolean                             // presupuesto agotado o convergencia
}
```

Orquestador (`optimizer/search-strategies` invoca esto, nunca al revés):

```
state = strategy.initState(problem, seed)
while not strategy.isDone(state):
  candidatas = strategy.ask(state)                          // ninguna candidata se genera fuera de este paso
  evaluadas  = candidatas.map(c => evaluator-bridge.evaluar(c))  // §3.3, siempre Quant Engine
  state = strategy.tell(state, evaluadas)
resultado = comparator.seleccionar(state.historial, problem.objetivos)  // §9
```

**Por qué esta forma cubre las seis capacidades pedidas sin construirlas hoy**: una búsqueda aleatoria acotada (§5) es la implementación más simple de `ask` (propone `K` candidatas de golpe, `isDone` tras la primera vuelta). Una búsqueda heurística (hill-climbing, recocido simulado) es la misma interfaz con `ask` proponiendo una vecindad de la mejor candidata vista hasta ahora. Un algoritmo evolutivo mantiene una población en `TState` y `ask` propone la siguiente generación. Una optimización bayesiana mantiene un modelo sustituto en `TState` y `ask` propone el punto de mayor ganancia esperada de información. Un muestreo Monte Carlo es, estructuralmente, un caso particular de búsqueda aleatoria con una distribución de muestreo distinta a la uniforme. **Ninguna de estas seis capacidades requiere cambiar el núcleo del orquestador** — todas implementan la misma interfaz de tres métodos. Es la aplicación de la misma lección que 22 §1 ya extrajo de Notion/Linear/Stripe/Shopify para el Rule Engine (primitivas pequeñas, composición sin límite), ahora aplicada a algoritmos de búsqueda en vez de a tipos de regla.

### 3.3 Frontera con Quant Engine — consumo directo, confirmado (distinto del caso Rule Engine)

**Aclaración explícita porque SPEC-004 estableció el patrón contrario para Rule Engine, y aquí no aplica de la misma forma**: Rule Engine nunca invoca a Quant Engine directamente porque necesita magnitudes ya persistidas y orquestadas por Risk Engine (datos reales de una Cuenta). Optimizer **sí invoca a Quant Engine directamente** (26 §2.7, ya establecido: "Quant Engine provee la fórmula de evaluación de una configuración candidata" al Optimizer) — porque sus evaluaciones son siempre hipotéticas y efímeras (`simularGestion`, nunca persistidas como un hecho real), no requieren la capa de persistencia/orquestación que Risk Engine aporta. `evaluator-bridge` (§3.1) es el único punto del componente que importa el paquete `quant-engine`; ningún otro subcomponente lo hace.

### 3.4 Frontera con AI Engine

AI Engine decide cuándo tiene sentido invocar a Optimizer (p.ej. al construir un Improvement Item, 32 §3.7) y qué hacer con el resultado (redactar la Coaching Card, 29 §3). Optimizer no sabe que existe una Coaching Card, ni un trader esperando una respuesta — recibe un `OptimizationProblem`, devuelve un `OptimizationResult` con su explicación (§10), y termina ahí.

---

## 4. Problema de optimización — modelo formal

### 4.1 Espacio de búsqueda

Sin cambios respecto a 02 §5.1: `n ∈ {0,...,5}`, `RR_i` en grid ascendente, `p_i` en grid de %, `Σp_i ≤ 100`. La validez estructural de una candidata (secuencia creciente, suma de porcentajes) se verifica localmente en `scenario-generator` **antes** de gastar una llamada a Quant Engine — es la misma validación que SPEC-001 §2.4 ya exige en la frontera de `calcularRFinal`, reutilizada aquí para no desperdiciar evaluaciones en candidatas inválidas por construcción.

### 4.2 Objetivos — de un único `Score` a multiobjetivo

```
interface Objective {
  metric: "expectancy" | "consistency_ratio" | "drawdown" | "recovery_factor" | "score"   // 26 §2.4, §2.7
  direction: "maximize" | "minimize"
}

interface OptimizationProblem {
  base_scenario_space: ScenarioSpaceParams        // §4.1
  objectives: Objective[]                          // 1 objetivo = caso clásico (Score); ≥2 = Pareto (§9)
  constraints: Constraint[]                         // §4.3
  bootstrap_trade_set: HistoricalTrade[]            // Trade Set de Operaciones reales cerradas (28 §2) — ver nota de alineación
  lambda?: RValue                                    // solo si objectives incluye "score" — siempre explícito (SPEC-001 §3.8)
}

interface HistoricalTrade {
  r_max: RValue          // contexto del contrafactual — dato observado, nunca inventado (02 §1)
  r_final: RValue        // resultado real ya calculado — es el baseline "trader_actual_behavior" de §10.2
  risk_amount: Money     // congelado en creación (SPEC-002 §2.5 invariante 3) — habilita las métricas denominadas en Money
  closed_at: Timestamp   // orden cronológico real de la curva de equity — nunca un orden sintético
}
```

**Nota de alineación con el vocabulario oficial (corrección documental, no de arquitectura)**: la versión 1.0 de esta especificación tipaba esta entrada como `bootstrap_sample: RValue[]` citando 02 §5.2. Esa cita reproducía la forma **informal anterior** a que 28 §6.1 la sustituyera: 02 §5.2 habla de reutilizar *"cada **operación** pasada"* filtrada por bucket, y 28 §2 formalizó exactamente eso como `Trade Set` — una colección de **Operaciones**, no un vector de escalares. Proyectar el Trade Set a `RValue[]` descartaba `r_final`, `risk_amount` y `closed_at`, y con ellos la posibilidad de calcular tres de las métricas que esta misma especificación declara en §4.2/§4.3 (`drawdown`, `recovery_factor`) y la comparación contra baseline que §10.2 declara obligatoria. Es la misma entrada que SPEC-011 §4.4 ya declara para el motor contrafactual, de modo que los dos consumidores de Grupo F comparten un único sustrato de evidencia. **Ningún cálculo, algoritmo, responsabilidad ni interfaz pública cambia por esta corrección** — solo deja de perderse información que el sistema ya poseía.

Con un único objetivo (`Score`), el problema es idéntico al ya descrito en 02 §5.2 — no se pierde compatibilidad, se generaliza. Con dos o más objetivos declarados explícitamente (p.ej. maximizar `Expectancy` y minimizar `Drawdown` a la vez, la pregunta "¿qué gestión mantiene el mismo beneficio con menor Drawdown?" pedida por el fundador), el resultado deja de ser una única ganadora — es un frente de Pareto (§9).

### 4.3 Restricciones — duras, nunca penalización

Reafirma 27 §2.4 (optimización restringida por drawdown objetivo): una restricción es una condición binaria, no un término añadido a la función objetivo.

```
interface Constraint {
  metric: "drawdown" | "consistency_ratio" | ...
  operator: "lte" | "gte"
  threshold: RValue
}
```

Una candidata que viola una `Constraint` se excluye por completo del conjunto que `comparator` puede seleccionar (§9) — nunca recibe una penalización numérica que la haga "competir en desventaja"; simplemente no es una solución válida, mismo principio ya fijado en 27 §2.4.

---

## 5. Estrategia de referencia (día 1): `bounded_random_search.v1`

No requiere investigación previa de TradePilot Labs — es la técnica base con la que este componente puede construirse y desplegarse hoy, con garantía matemática (§2), no una implementación temporal a sustituir con prisa.

### 5.1 Procedimiento de muestreo válido

Muestrear uniformemente sobre un espacio estructuralmente restringido (secuencia creciente + porcentajes que suman ≤100%) no es tan simple como muestrear cada parámetro por separado — se especifica el procedimiento exacto para que sea reproducible:

1. Muestrear `n ~ Uniforme{0,...,5}`.
2. Si `n > 0`: muestrear `n` valores del grid de `RR` **sin reemplazo** y ordenarlos ascendentemente (garantiza `RR_1 < ... < RR_n` sin necesidad de rechazo).
3. Muestrear los `n` porcentajes mediante el método del "palo roto" (`Dirichlet(1,...,1)` sobre `n+1` partes, la parte `n+1` es el remanente), redondeando cada parte al grid de 5% más cercano y ajustando el resto para que la suma sea exacta (evita el sesgo de rechazar muestras hasta que sumen justo).
4. Muestrear `be_trigger` de su conjunto de valores válidos (02 §1.4).

Ninguna candidata generada por este procedimiento puede ser estructuralmente inválida — el rechazo (§4.1) queda reservado para errores de implementación, no como mecanismo normal de generación.

### 5.2 Presupuesto — parámetro explícito, con la fórmula de §2 como guía de configuración

`K` (número de candidatas) es un parámetro de `OptimizationProblem`, nunca un valor oculto — el llamador (AI Engine) elige el punto de la tabla de §2 apropiado según el contexto (p.ej. `K=500` para una recomendación interactiva, `K=3000` para un análisis nocturno en batch sin restricción de latencia).

### 5.3 Determinismo — presupuesto por número de evaluaciones, nunca por tiempo de reloj

**Regla no negociable**: `isDone` de cualquier estrategia se define siempre en términos de un presupuesto de **evaluaciones consumidas** (o de un criterio de convergencia matemático), **nunca** de tiempo de reloj transcurrido (`isDone = elapsed > 5000ms`, por ejemplo, queda prohibido). Un presupuesto de tiempo real hace que el resultado de una optimización dependa de la velocidad de la máquina que la ejecuta — dos ejecuciones con la misma semilla en hardware distinto encontrarían candidatas distintas, rompiendo la reproducibilidad que todo el proyecto exige desde SPEC-001 §4.4 (hallazgo de esta especificación, §13.2).

---

## 6. Registro de estrategias — TradePilot Labs como origen, Optimizer como consumidor

### 6.1 Contrato de aprobación

```
interface SearchStrategyRegistration {
  id: string
  origin: "reference" | "tradepilot_labs"     // 'reference' = bounded_random_search.v1, ships con esta especificación
  approved_at: Timestamp
  criteria: {
    deterministic_given_seed: boolean          // misma semilla + mismo problema ⇒ mismo resultado, siempre
    evaluation_bounded: boolean                 // presupuesto expresado en nº de evaluaciones (§5.3), nunca en tiempo
    validated_against_benchmarks: boolean        // probado contra un conjunto de problemas de referencia con óptimo conocido
  }
}
```

Optimizer **rechaza invocar** cualquier `SearchStrategy` cuyo registro no tenga los tres criterios en `true` (`STRATEGY_NOT_APPROVED`, §11) — es el mecanismo concreto, no solo declarativo, de "Optimizer únicamente consume algoritmos ya aprobados".

### 6.2 Camino de incorporación de un algoritmo nuevo sin tocar el núcleo

TradePilot Labs investiga y valida una estrategia nueva (genética, bayesiana, Monte Carlo, o cualquier otra) contra los tres criterios de §6.1, de forma completamente desacoplada de este componente — ni el orquestador (§3.2), ni `comparator`, ni `explain` cambian una sola línea cuando se añade una estrategia nueva al registro, exactamente el mismo principio de extensión sin tocar el núcleo ya aplicado a Rule Engine (SPEC-004 §11) y a Quant Engine (implícito en su catálogo cerrado, SPEC-001).

---

## 7. Pipeline completo de una optimización

```
1. AI Engine construye un OptimizationProblem (§4.2) y lo envía con una SearchStrategy aprobada (§6) y una semilla
2. Optimizer valida: estrategia aprobada, problema estructuralmente válido (§4.1), λ explícito si aplica
3. Ejecuta el ciclo ask/tell (§3.2) hasta isDone
4. comparator selecciona (§9): single-objetivo → top-N; multiobjetivo → frente de Pareto
5. explain construye la explicación (§10) para cada candidata seleccionada
6. Devuelve OptimizationResult — nunca se persiste ni se aplica automáticamente (I17, §1.2 punto 4)
```

---

## 8. Rendimiento

- Cada evaluación individual delega en `simularGestion`/`calcularScore` — O(M) donde `M` es el tamaño de la muestra bootstrap (SPEC-001 §4.1), <1ms por el objetivo de latencia ya fijado.
- Una optimización completa con `K=500` y `M=300` (muestra histórica típica) implica del orden de 150.000 operaciones de Quant Engine — del orden de cientos de milisegundos a pocos segundos, muy por debajo de cualquier presupuesto de un proceso en background (no es un flujo interactivo de <30s como Operations Engine, SPEC-002 — es una solicitud que AI Engine dispara de forma asíncrona, sin que el trader la espere en pantalla).
- Cada candidata es independiente — trivialmente paralelizable (evaluación embarazosamente paralela), sin que esto forme parte del contrato de esta especificación (es una decisión de implementación de infraestructura, no de diseño de dominio).

---

## 9. Comparación y descarte de candidatas

### 9.1 Caso single-objetivo

Orden total simple por el valor del único objetivo declarado — reutiliza exactamente 02 §5.3 (top-1 + 2 siguientes mejores, nunca una única respuesta autoritaria).

### 9.2 Caso multiobjetivo — frente de Pareto

Con ≥2 objetivos, no existe garantía de que una única candidata domine en todos los ejes a la vez — es matemáticamente esperable (maximizar `Expectancy` y minimizar `Drawdown` a menudo compiten). `comparator` calcula el **frente de Pareto**: el subconjunto de candidatas evaluadas para las que ninguna otra candidata es simultáneamente igual o mejor en todos los objetivos y estrictamente mejor en al menos uno. El cálculo del frente es una comparación por pares sobre el conjunto ya evaluado — **independiente del orden en que las candidatas se evaluaron** (§13.3, confirmación de ausencia de dependencia de orden).

### 9.3 Desempate determinista

Si dos candidatas empatan exactamente en el/los objetivo(s) comparado(s) (mismo valor a la precisión completa del kernel decimal, SPEC-001 §4.3), se rompe el empate por, en este orden: (1) menor número de parciales `n` (una gestión más simple es preferible en igualdad de resultado — coherente con I16), (2) el identificador de candidata generado en orden canónico de evaluación (garantiza que el mismo problema con la misma semilla produce siempre el mismo ganador, incluso en un empate exacto).

---

## 10. Explicabilidad — nunca caja negra

### 10.1 Explicabilidad del resultado, no del proceso de búsqueda (resuelve la tensión con algoritmos futuros)

**Aclaración necesaria, porque "nunca caja negra" podría leerse como una prohibición de usar algoritmos evolutivos o bayesianos** (cuyo proceso interno — qué mutaciones probó una población, qué modelo sustituto usó una optimización bayesiana — no es intuitivamente explicable a un trader, ni falta que hace). **Se resuelve distinguiendo dos preguntas distintas**: "¿por qué el algoritmo exploró estas candidatas y no otras?" (proceso — irrelevante para el trader, y no se explica) frente a "¿por qué esta configuración es mejor que la que ya usas?" (resultado — siempre se explica, con las mismas métricas objetivas para cualquier estrategia, sea `bounded_random_search` o un futuro algoritmo genético). El compromiso del fundador de "nunca caja negra" se cumple sobre el **resultado**, que es lo único que el trader necesita entender y lo único que este documento se compromete a explicar — coherente con 02 §5.3, ya vigente antes de este documento.

### 10.2 Estructura de la explicación

```
interface OptimizationExplanation {
  candidate: Scenario
  metrics: QuantResult<RValue>[]                        // exactamente los QuantResult<T> ya devueltos por Quant Engine (SPEC-001 §7) — nunca un número nuevo inventado aquí
  comparison_vs_baseline: {
    baseline: "trader_actual_behavior"                    // la gestión real observada en el historial del propio usuario
    delta_per_objective: Record<string, RValue>
  }
  comparison_vs_runner_up?: { delta_per_objective: Record<string, RValue> }
  pct_of_historical_trades_that_would_improve: Percent    // 02 §5.3, ya vigente
  variance_delta: RValue                                    // 02 §5.3, ya vigente
}
```

**Ninguna palabra de esta explicación se genera sin un dato de `QuantResult<T>` detrás** (SPEC-001 §7) — el redactado en lenguaje natural (06 §3) es responsabilidad de AI Engine, que consume esta estructura, nunca la reemplaza por una narrativa sin respaldo numérico.

---

## 11. Interfaces públicas

```
optimizar(problem: OptimizationProblem, strategy_id: string, seed: number): Result<OptimizationResult, OptimizerError>

interface OptimizationResult {
  winners: OptimizationExplanation[]        // 1 elemento si single-objetivo (top-1 + runners-up dentro de cada explanation); N si Pareto (§9.2)
  strategy_id: string
  strategy_version: string
  seed: number
  evaluations_consumed: number
}

type OptimizerError =
  | { code: "STRATEGY_NOT_APPROVED"; strategy_id: string }             // §6.1
  | { code: "INVALID_SCENARIO_SPACE"; detail: string }                  // §4.1
  | { code: "MISSING_LAMBDA_FOR_SCORE_OBJECTIVE" }                       // §4.2, mismo principio que SPEC-001 §3.8
  | { code: "EMPTY_BOOTSTRAP_SAMPLE" }                                    // reexporta EMPTY_SAMPLE de Quant Engine, mismo criterio de nombrado consistente
  | { code: "NO_FEASIBLE_CANDIDATE"; detail: string }                     // todas las candidatas evaluadas violan alguna Constraint (§4.3)
```

---

## 12. Eventos

Ninguno propio. Optimizer no emite eventos de dominio — es un Domain Service invocado síncronamente por su llamador (AI Engine) dentro del propio flujo asíncrono que AI Engine ya gestiona (21.5 §6, ya vigente: "no tiene estado propio ni identidad").

---

## 13. Auditoría — intentando destruir la arquitectura

### 13.1 Confirmación: no hay duplicación de cálculo

`comparator` y `explain` operan exclusivamente sobre `QuantResult<T>` ya producidos por `evaluator-bridge` — ninguno de los dos recalcula `Score`, `Expectancy` ni ningún valor. Es la verificación literal de "Optimizer nunca calcula fórmulas" a nivel de código, no solo de intención.

### 13.2 Determinismo bajo presupuesto de tiempo de reloj — hallazgo corregido en el propio diseño (§5.3)

Ya resuelto en §5.3 antes de convertirse en un defecto: un presupuesto de tiempo real introduciría no-determinismo dependiente del hardware — se prohíbe explícitamente como regla de arquitectura, no se deja como una posibilidad a evitar "con cuidado".

### 13.3 Dependencia de orden de ejecución — verificación explícita (mandato directo del fundador)

Tres subpreguntas, cada una verificada por separado:

1. **¿El resultado de una evaluación individual depende del orden en que se evalúan las candidatas?** No — cada llamada a `evaluator-bridge` es una invocación pura e independiente a Quant Engine (SPEC-001 §2.3, funciones puras) sobre un único Scenario; ninguna candidata puede leer el resultado de otra durante su propia evaluación.
2. **¿El frente de Pareto depende del orden de evaluación?** No — es una comparación por pares sobre el conjunto completo ya evaluado (§9.2), matemáticamente conmutativa respecto al orden de inserción.
3. **¿El resultado final de una estrategia estocástica (genética, Monte Carlo, futura) depende del orden interno de exploración?** **Sí, y es esperado, no un defecto** — es la naturaleza de una búsqueda estocástica: la trayectoria de exploración determina qué óptimo local se encuentra. La garantía que este documento exige no es *invariancia al orden de exploración* (eso anularía el propósito de un algoritmo heurístico), es **reproducibilidad**: la misma semilla (`seed`, §11) sobre el mismo `OptimizationProblem` y la misma `SearchStrategy` produce, siempre, exactamente el mismo `OptimizationResult` — verificado como criterio de aprobación obligatorio en el registro (§6.1, `deterministic_given_seed`). Distinguir estas dos propiedades (invariancia de orden vs. reproducibilidad por semilla) es el hallazgo central de esta sección — confundirlas habría llevado a rechazar cualquier algoritmo estocástico futuro por una razón equivocada.

### 13.4 Aplicación de I17 verificada

Ninguna interfaz pública de §11 escribe en Management Plans, Operations ni ningún otro módulo — `OptimizationResult` es un valor de retorno puro, nunca un efecto secundario. Es Evaluate ≠ Execute aplicado por construcción de tipos, no solo por disciplina de código (mismo patrón ya usado para excluir límites de riesgo de las interfaces de Funding Management, SPEC-003 §10).

### 13.5 Riesgo de rendimiento por mal uso del multiobjetivo

Un `OptimizationProblem` con muchos objetivos simultáneos (4-5 métricas a la vez) puede producir un frente de Pareto grande (potencialmente una fracción significativa de las `K` candidatas evaluadas, si los objetivos están poco correlacionados) — un frente de 200 "ganadoras" no es una recomendación útil para un trader ni cumple I16 (Zero Friction: elegir entre 200 opciones no es una tarea de baja fricción). **Mitigación de diseño, no solo de UX**: `comparator` debe acotar el frente devuelto a un máximo configurable (recomendado: 3-5, coherente con "2 siguientes mejores" de 02 §5.3) usando una técnica de reducción estándar (p.ej. distancia de *crowding* para preservar diversidad) cuando el frente real excede ese límite — se anota como requisito de `comparator`, no se implementa el algoritmo de reducción en detalle aquí (es una decisión de implementación acotada, no de contrato de dominio).

---

## 14. Limitaciones a 10 años

1. **La garantía probabilística de §2 asume que "mejor" varía de forma razonablemente suave sobre el espacio** (sin picos extremadamente aislados que un muestreo aleatorio tenga probabilidad casi nula de tocar) — es una asunción razonable para el dominio de gestión de parciales (pequeños cambios en `RR_i`/`p_i` producen pequeños cambios en `Score`), pero no una garantía matemática universal; si TradePilot Labs valida que el paisaje real tiene más rugosidad de la esperada, la estrategia de referencia debería complementarse con una heurística local (ya soportado por la interfaz `ask/tell`, §3.2, sin cambiar el núcleo).
2. **El registro de estrategias (§6) no define todavía un proceso de retirada** de una estrategia aprobada que deje de usarse o que se demuestre inferior a una más nueva — mismo tipo de gobernanza ya señalado como pendiente para la Rule Library (SPEC-004 §16) y para TradePilot Labs en general; se recomienda tratarlo con el mismo sistema de retirada de funcionalidades ya aprobado en TPOS (31), no reinventarlo aquí.
3. **La reducción del frente de Pareto (§13.5) queda como requisito, no como algoritmo especificado** — si la demanda real de optimización multiobjetivo resulta ser baja (la mayoría de los usos reales podrían seguir siendo single-objetivo, `Score`), no vale la pena sobre-especificar el algoritmo de *crowding* ahora; se revisa cuando exista uso real medido.

---

## Riesgos

1. **Que `evaluator-bridge` se convierta, con el tiempo, en el único lugar realmente probado del componente**, mientras `search-strategies`/`comparator` acumulan lógica no cubierta por los mismos tests de reproducibilidad estrictos que Quant Engine exige (SPEC-001 §6) — mitigación: los tests de este componente deben incluir, como mínimo, un test de reproducibilidad por semilla (§13.3) equivalente en rigor al de determinismo de SPEC-001 §6.2.
2. **El criterio `validated_against_benchmarks` (§6.1) no define todavía el conjunto de problemas de referencia** contra los que se valida una estrategia nueva — es responsabilidad de TradePilot Labs definirlo la primera vez que proponga una estrategia más allá de `bounded_random_search.v1`, no de esta especificación.
3. **Un `OptimizationProblem` mal formado por AI Engine** (p.ej. objetivos contradictorios sin que ninguna `Constraint` los acote) podría producir un `NO_FEASIBLE_CANDIDATE` con demasiada frecuencia en producción — no es un defecto de Optimizer, pero exige que AI Engine valide la razonabilidad del problema antes de enviarlo, requisito que se traslada a la futura especificación de AI Engine.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** El más caro de todo el blueprint en términos de riesgo técnico: sin esta especificación, la primera implementación del Optimizer habría intentado seguir el modelo de fuerza bruta de 02 §5.1, ya demostrado inviable por SPEC-001 §8.4 — esta especificación es la que impide que ese error llegue a producción.

**¿Qué sobra?** Nada del modelo de 02 §5 se descarta — `Score`, `λ`, el espacio de búsqueda, todo se conserva; lo que cambia es exclusivamente cómo se explora.

**¿Qué falta?** Antes de este documento faltaba: una estrategia de búsqueda concreta y construible hoy con garantía matemática (§2, §5), un mecanismo real de extensión para las seis capacidades futuras pedidas (§3.2, el ciclo ask/tell), y la resolución explícita de la tensión entre "nunca caja negra" y algoritmos futuros genuinamente heurísticos (§10.1).

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §13.3: distinguir con precisión entre "reproducible" (misma semilla, mismo resultado, exigible siempre) y "determinista en su trayectoria de exploración" (no exigible a un algoritmo estocástico sin destruir su propósito) — es la misma disciplina que separa backtesting reproducible de estrategias de trading estocásticas en un fondo profesional real.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — ninguno es una ambigüedad de diseño, los tres dependen de trabajo futuro de TradePilot Labs o de la especificación de AI Engine, todavía no escrita.

**Nivel de madurez**: 94%. Arquitectura, modelo formal del problema, estrategia de referencia con garantía matemática, registro de estrategias, pipeline, comparación multiobjetivo y explicabilidad están completos y son directamente implementables; lo pendiente es exclusivamente investigación futura de TradePilot Labs (algoritmos más allá de la referencia) y coordinación con la especificación de AI Engine.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Optimizer tal como está especificado; los tres son de gobernanza futura o de coordinación con AI Engine.

**Decisiones abiertas**:
1. Algoritmo concreto de reducción del frente de Pareto (§13.5, *crowding* u otro) — se decide con datos reales de uso multiobjetivo, no antes.
2. Conjunto de problemas de referencia para validar futuras estrategias de TradePilot Labs (§6.1) — responsabilidad de Labs, no de esta especificación.

**Recomendación profesional**: aprobar SPECIFICATION 005. Resuelve, con una demostración matemática concreta (§2) y no solo con una promesa de arquitectura, el problema más serio identificado en todo el blueprint hasta ahora — y lo hace sin sacrificar ninguna de las seis capacidades futuras pedidas, todas ellas expresables sobre la misma interfaz `ask/tell` sin tocar el núcleo. Es, junto con SPEC-004, de las dos especificaciones con puntuación más alta de toda la Fase 1.
