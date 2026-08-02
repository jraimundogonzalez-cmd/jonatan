# SPEC-001 · TradePilot Quant Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 02 (modelo matemático), 12 (demostración numérica), 13 §2/§4 (Bayesiano, fuera de alcance de este componente), 15 §1.2/§3.5 (tipos de precisión, `algorithm_version`), 19 reglas 13/14, 22.5 §2.3 (Risk Engine como consumidor), 25 (empaquetado como librería compartida `quant-engine`), 26 (contrato y catálogo aprobados), 27 (capacidades), 32 §3.10 (contrato de dominio de Simulation)
**No re-abre ninguna decisión conceptual ya aprobada** — esta especificación traduce el contrato de 26 a algo que un equipo de ingeniería puede construir sin adivinar nada. Donde algo no estaba resuelto con suficiente precisión en 26, se resuelve aquí y se marca explícitamente como **hallazgo nuevo de esta especificación**.

---

## 1. Objetivo del componente

### 1.1 Problema que resuelve

TradePilot promete "Every R Matters" — que cada cifra de R, cada euro y cada porcentaje mostrado en el producto es exacto y consistente en cualquier pantalla, en cualquier momento, en cliente o en servidor. Sin una única implementación autoritativa de cada fórmula, ese compromiso es imposible de sostener: dos pantallas, dos desarrolladores o dos runtimes (cliente/servidor) acabarán, con el tiempo, calculando el mismo concepto de dos formas ligeramente distintas. Quant Engine existe para eliminar esa posibilidad por construcción, no por disciplina de equipo: es la **única** implementación permitida de toda fórmula matemática del producto, empaquetada como librería compartida (25 §2) que corre idéntica en cliente y servidor.

### 1.2 Qué nunca debe hacer

Traducido de 26 §1 a reglas de ingeniería verificables en revisión de código:

1. **Nunca realiza I/O.** Cero llamadas a red, cero acceso a base de datos, cero lectura de sistema de archivos. Toda entrada llega por parámetro; toda salida se retorna, nunca se persiste.
2. **Nunca usa números de coma flotante (IEEE-754) en ningún paso, ni siquiera intermedio.** Ver §4.3 — es la regla más frecuentemente violada por atajos de rendimiento y la que más rigurosamente se testea (§6).
3. **Nunca lee contexto implícito.** Ni `Date.now()`, ni variables de entorno, ni un valor por defecto oculto para `λ` o cualquier otro parámetro de diseño — todo llega explícito en el input (26 §1).
4. **Nunca compara un resultado contra un límite configurado.** Calcular ≠ Juzgar (19 regla 14) aplicado en su forma más estricta: Quant Engine no tiene ni un solo `if (resultado > limite)` en todo su código — eso vive en Rule Engine.
5. **Nunca depende de ningún otro módulo de TradePilot.** Cero imports desde `funding-management`, `rule-engine`, `operations`, `ai-engine` o cualquier otro paquete del monorepo — solo utilidades matemáticas/de fecha genéricas y externas al dominio (26 §4-5).
6. **Nunca introduce una segunda versión de una fórmula ya publicada.** Una vez que `formula_version: "score.v1"` ha sido usada en una recomendación real, su comportamiento es inmutable para siempre — una mejora se publica como `score.v2`, nunca sobrescribe `v1` (§4.5).
7. **Nunca lanza una excepción no tipada.** Todo fallo posible está en el catálogo de errores de §3 — no hay "error inesperado" en una librería matemática crítica.

### 1.3 Responsabilidades

- Proveer el catálogo completo de funciones matemáticas puras de §4, cada una con salida `QuantResult<T>` explicable (§7).
- Garantizar precisión decimal exacta (§4.3) y reproducibilidad determinista (§4.4) en cualquier runtime donde se ejecute.
- Validar la forma de sus propios inputs (rangos, invariantes estructurales: `Σp_i ≤ 100`, `RR_1 < RR_2 < ... < RR_n`) y fallar con un error tipado si no se cumplen — nunca calcular sobre datos inconsistentes en silencio.
- Exponer una API estable, versionada semánticamente como paquete (`quant-engine@MAJOR.MINOR.PATCH`) e independiente del versionado matemático de fórmulas individuales (`formula_version`, §4.5).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Persistir cualquier resultado | Risk Engine (22.5 §2.3, corregido por 26 §8) |
| Decidir si un resultado viola un límite | Rule Engine (22, 22.5 §2.4) |
| Buscar la mejor configuración entre miles de candidatas (grid search) | Optimizer — consumidor de Quant Engine, no parte de él (26 §2.7); ver hallazgo crítico en §8.4 |
| Calcular la posterior bayesiana o el decaimiento temporal de aprendizaje | AI Engine (13) — explícitamente fuera de alcance (26 §1) |
| Redactar la explicación en lenguaje natural de un resultado | AI Engine / generador de explicaciones (06 §3) — consume el `QuantResult` de §7, no lo reemplaza |
| Decidir qué mostrar al trader y cuándo | Rule Engine + Improvement Item (30, 32 §3.7) |

---

## 2. Arquitectura interna

### 2.1 Subcomponentes

```
quant-engine/
├── decimal-kernel/     Tipo FixedDecimal, aritmética exacta, redondeo, conversión — §4.3
├── validation/          Guards de entrada: rangos, invariantes estructurales, errores tipados — §3
├── core/                Grupo B — resultado de una operación individual (calcularRFinal y derivados)
├── stats/               Grupo C + G — agregados de cartera (esperanza, profit factor, desviación, etc.)
├── curves/              Grupo D — curvas de equity y drawdown histórico
├── risk-state/          Grupo E — calcularDrawdownState (estado prospectivo, solo lectura de config)
├── simulation/          Grupo F — simularGestion, calcularScore
├── explain/             Envelope QuantResult<T> — construye la explicación de §7 para cada función pública
└── errors/              Catálogo de errores tipados, compartido por todos los subcomponentes
```

**Regla de dependencia interna** (evita que Quant Engine repita, dentro de sí mismo, el problema que existe para prevenir hacia fuera): `decimal-kernel`, `validation` y `errors` no dependen de nada más dentro del paquete. `core` depende solo de `decimal-kernel`/`validation`/`errors`. `stats`, `curves`, `risk-state` dependen de `core` (nunca reimplementan `R_final`). `simulation` depende de `core` y `stats`. `explain` envuelve la salida de cualquier subcomponente y no es invocado directamente por el consumidor — es un decorador aplicado en la frontera pública (§7.2).

### 2.2 Flujo interno — dos pipelines canónicos

**(a) Recalcular una Operación cerrada** (invocado por Risk Engine tras `OperacionCerrada`/`OperacionEditada`, 22.5 §2.3):

```
validation.checkRFinalInput(input)
  → core.calcularRFinal(input)                       [único punto que decide la rama de R_cierre_resto]
    → core.calcularBeneficioReal(riesgo€, R_final)
    → core.calcularBeneficioMaximo(riesgo€, rr_obj)
    → core.calcularBeneficioSacrificado(benef_max, benef_real)
    → core.calcularPorcentajeConservado(R_final, R_max)
    → core.calcularImpactoPorParcial(parciales, R_final)
  → explain.wrap(resultado, formula_id, inputs)       [una sola vez, al final del pipeline]
```

**(b) Recalcular agregados de una Cuenta/cartera** (invocado por Risk Engine/Analytics sobre una muestra de N Operaciones ya cerradas):

```
validation.checkPortfolioInput(muestra)
  → stats.calcularEsperanza(muestra)
  → stats.calcularDesviacionR(muestra)                [§8.3 — nueva, evita duplicación con calcularScore]
  → stats.calcularRatioConsistencia(esperanza, desviacion)
  → stats.calcularProfitFactor(muestra)
  → stats.calcularWinRate(muestra)
  → stats.calcularRachaMaxima(muestra)
  → stats.calcularTiempoMedioEnMercado(muestra)
  → stats.calcularDistribucionR(muestra)
  → curves.calcularCurvaEquity(muestra, unidad)
  → curves.calcularDrawdownHistorico(curva_equity)
  → stats.calcularRecoveryFactor(beneficio_neto, max_drawdown)
  → explain.wrap(cada resultado, formula_id, inputs)
```

Ambos pipelines son **stateless entre invocaciones** — no existe una "sesión de cálculo": cada llamada recibe todo lo que necesita y no deja rastro entre una llamada y la siguiente. Esto es lo que permite la ejecución dual cliente/servidor sin sincronización de estado (25 §5, riesgo #3).

### 2.3 Modelo de ejecución

- **Funciones puras, sin excepción** (26 §1): mismo input ⇒ mismo output, siempre, en cualquier runtime.
- **Empaquetado único**: un solo paquete `quant-engine`, publicado con versión semántica, importado sin transformación adicional tanto en el bundle de cliente (navegador/PWA, 11 §5) como en Core Service (servidor, 25 §2). Prohibido tener dos implementaciones (una "ligera" para cliente, una "completa" para servidor) — es exactamente el riesgo #2 de 25 §5 y #2 de 26 §Riesgos, y la única forma de eliminarlo por diseño es que no exista una segunda implementación que pueda divergir.
- **Sin efectos colaterales observables**: ninguna función muta su input; todo input se trata como `readonly` en el sentido de tipo, no solo de convención.

---

## 3. Interfaces públicas

### 3.1 Tipos base (compartidos por toda la API)

```
type FixedDecimal<Scale extends number>  // ver §4.3 — nunca un `number` nativo de JS/TS

type Money   = FixedDecimal<4>   // numeric(18,4) — 04 §1.2
type RValue  = FixedDecimal<4>   // numeric(8,4)
type Percent = FixedDecimal<2>   // numeric(5,2)

enum BETrigger {
  NONE,
  AFTER_NTH_PARTIAL,     // parametrizado con n
  CUSTOM_LEVEL,          // parametrizado con un RValue
}

interface ParcialPlanificado { sequence: 1|2|3|4|5; rr_level: RValue; pct_close: Percent }
interface ParcialEjecutado   { sequence: 1|2|3|4|5; rr_level: RValue; pct_close: Percent; executed_at: Timestamp }
```

### 3.2 Envelope público — `QuantResult<T>`

Toda función pública de Quant Engine retorna este tipo, nunca `T` directamente — es la forma concreta del requisito Explainable Quant, detallado en §7:

```
interface QuantResult<T> {
  value: T
  formula_id: string              // p.ej. "calcularRFinal" — nombre estable, nunca renombrado (§4.5)
  formula_version: string | null  // p.ej. "score.v1" — null si es aritmética sin versión de diseño (26 §1)
  inputs_echo: Record<string, unknown>   // copia de los inputs relevantes usados (§7.2)
  confidence: Confidence          // §7.3 — nunca inventado internamente
}

type Confidence =
  | { type: "exact" }                                          // aritmética determinista sobre datos reales
  | { type: "passthrough"; label: string; interval: [number, number] }  // eco de un IC recibido como input (13 §2), nunca calculado aquí
```

### 3.3 Catálogo de errores tipados

```
type QuantError =
  | { code: "INVALID_PARTIAL_SEQUENCE";  detail: string }   // RR_i no estrictamente creciente, o sequence duplicada
  | { code: "PARTIALS_EXCEED_100_PCT";   detail: string }   // Σ p_i > 100
  | { code: "EMPTY_SAMPLE";              detail: string }   // N = 0 en una función de agregado que lo requiere
  | { code: "UNDEFINED_RATIO";           detail: string; reason: "ZERO_R_MAX" | "ZERO_LOSSES" | "ZERO_DRAWDOWN" | "ZERO_VARIANCE" }
  | { code: "OUT_OF_RANGE";              field: string; detail: string }  // p.ej. Riesgo% ≤ 0
  | { code: "INCONSISTENT_TRIGGER_STATE"; detail: string }  // R_max no es compatible con los parciales marcados como ejecutados
```

Ninguna función retorna `null`/`NaN`/`Infinity` para un caso indefinido — retorna un `QuantError` explícito (§8.1). Es una decisión de diseño explícita: un `NaN` silencioso es el tipo de fallo que en una librería financiera pasa desapercibido hasta que corrompe un promedio aguas abajo.

### 3.4 Operaciones públicas — Grupo B (resultado de una operación)

```
calcularRFinal(input: RFinalInput): Result<QuantResult<RValue>, QuantError>

interface RFinalInput {
  riesgo_eur: Money
  rr_objetivo: RValue
  parciales_ejecutados: ParcialEjecutado[]        // 0..5
  r_max: RValue
  be_trigger: BETrigger
  cierre_manual_rr?: RValue                        // solo si el usuario cerró manualmente con R_max ≥ rr_objetivo
}
```
- **Determinismo**: total — mismo input, mismo `R_final`, en cualquier runtime (§4.4).
- **Versionado**: `formula_version: null` — es aritmética fija, no una decisión de diseño ajustable (26 §1).
- **Errores posibles**: `INVALID_PARTIAL_SEQUENCE`, `PARTIALS_EXCEED_100_PCT`, `INCONSISTENT_TRIGGER_STATE`, `OUT_OF_RANGE` (`riesgo_eur ≤ 0`).

`calcularBeneficioReal`, `calcularBeneficioMaximo`, `calcularBeneficioSacrificado`, `calcularImpactoPorParcial` siguen el mismo patrón — firma completa en el catálogo matemático de §4.1 (tabla), no repetida aquí para no duplicar la única fuente de verdad del catálogo.

`calcularPorcentajeConservado(r_final: RValue, r_max: RValue): Result<QuantResult<Percent>, QuantError>` — retorna `UNDEFINED_RATIO { reason: "ZERO_R_MAX" }` si `r_max = 0` (hallazgo de auditoría, §8.1).

### 3.5 Operaciones públicas — Grupo C+G (agregados de cartera)

```
calcularEsperanza(muestra: RValue[]): Result<QuantResult<RValue>, QuantError>
calcularDesviacionR(muestra: RValue[]): Result<QuantResult<RValue>, QuantError>       // §8.3, nueva
calcularRatioConsistencia(muestra: RValue[]): Result<QuantResult<RValue>, QuantError>  // internamente reutiliza calcularEsperanza + calcularDesviacionR, nunca reimplementa
calcularProfitFactor(muestra: Money[]): Result<QuantResult<RValue>, QuantError>
calcularWinRate(muestra: RValue[]): Result<QuantResult<Percent>, QuantError>
calcularRecoveryFactor(beneficio_neto: Money, max_drawdown: Money): Result<QuantResult<RValue>, QuantError>
calcularRachaMaxima(muestra: RValue[]): Result<QuantResult<{longitud: number; signo: "positiva"|"negativa"}>, QuantError>
calcularTiempoMedioEnMercado(muestra_segundos: number[]): Result<QuantResult<number>, QuantError>
calcularDistribucionR(muestra: RValue[], bucket_width: RValue): Result<QuantResult<Histogram>, QuantError>
```

Todas retornan `EMPTY_SAMPLE` si `N = 0`. `calcularRatioConsistencia` y `calcularDesviacionR` retornan `UNDEFINED_RATIO { reason: "ZERO_VARIANCE" }` si `N = 1` (varianza muestral no definida). `calcularProfitFactor` retorna `UNDEFINED_RATIO { reason: "ZERO_LOSSES" }` si no hay pérdidas en la muestra — nunca `Infinity`. `calcularRecoveryFactor` retorna `UNDEFINED_RATIO { reason: "ZERO_DRAWDOWN" }` si `max_drawdown = 0`.

### 3.6 Operaciones públicas — Grupo D (curvas)

```
calcularCurvaEquity(muestra_ordenada: Money[], unidad: "EUR"|"R"): Result<QuantResult<TimeSeries<Money|RValue>>, QuantError>
calcularDrawdownHistorico(curva_equity: TimeSeries<Money|RValue>): Result<QuantResult<{serie: TimeSeries<Money|RValue>; max_drawdown: Money|RValue}>, QuantError>
```

`muestra_ordenada` **debe** llegar pre-ordenada por el consumidor (orden cronológico canónico, §4.4) — Quant Engine valida el orden y retorna `INCONSISTENT_TRIGGER_STATE` si detecta timestamps no crecientes, nunca reordena en silencio (reordenar sería una decisión de negocio disfrazada de utilidad).

### 3.7 Operaciones públicas — Grupo E (estado de riesgo, solo lectura de configuración)

```
calcularDrawdownState(input: DrawdownStateInput): Result<QuantResult<DrawdownState>, QuantError>

interface DrawdownStateInput {
  current_capital: Money
  peak_capital: Money
  initial_capital: Money
  drawdown_type: "static" | "trailing" | "eod"
  max_total_drawdown_pct: Percent
  max_daily_drawdown_pct?: Percent
}
interface DrawdownState { piso_vigente: Money; drawdown_restante_eur: Money; drawdown_restante_pct: Percent }
```

Nunca decide si `drawdown_restante` es aceptable — eso es Rule Engine (§1.2, regla 4). `formula_version: null` — es lectura/derivación aritmética de configuración, no una decisión de diseño ajustable.

### 3.8 Operaciones públicas — Grupo F (simulación, consumido por Optimizer)

```
simularGestion(input: RFinalInput): Result<QuantResult<RValue>, QuantError>   // idéntica firma que calcularRFinal — "simular" es "calcular sin persistir" (26 §2.7)

calcularScore(input: ScoreInput): Result<QuantResult<RValue>, QuantError>

interface ScoreInput {
  muestra_r_final_candidata: RValue[]   // R_final simulado sobre cada muestra bootstrap de R_max, ya calculado vía simularGestion por el llamador
  lambda: RValue                         // SIEMPRE explícito — nunca un valor por defecto oculto (26 §Riesgos #3)
}
```
- **Versionado**: `formula_version: "score.v1"` — es una decisión de diseño ajustable (26 §1).
- Internamente: `Score = calcularEsperanza(muestra) − lambda × calcularDesviacionR(muestra)` — reutiliza, nunca reimplementa (§8.3).
- **Nota de alcance crítica** (26 §2.7, reafirmada): esta función evalúa **una** configuración candidata. La búsqueda entre miles de candidatas es responsabilidad del Optimizer — ver el hallazgo de rendimiento en §8.4 antes de asumir que un grid search exhaustivo sobre este catálogo es viable tal como 02 §5.1 lo describía.

### 3.9 Versionado y compatibilidad futura

- **Versionado del paquete**: SemVer estándar (`quant-engine@MAJOR.MINOR.PATCH`). `MAJOR` solo si cambia la forma de un input/output ya publicado (breaking); `MINOR` para funciones nuevas; `PATCH` para corrección de bug interno que no cambia ningún resultado ya calculado correctamente (si corrige un bug matemático que **sí** cambiaba resultados, es `MAJOR` + nueva `formula_version`, nunca un `PATCH` silencioso — precedente ya sentado por la corrección real de `R_cierre_resto` en 02 §2 durante este mismo proyecto).
- **`formula_version` es un eje independiente del versionado del paquete** — vive en el dato (15 §3.5), no en el código desplegado. El paquete puede subir de `2.3.1` a `2.4.0` sin que `score.v1` cambie de comportamiento.
- **Nunca se elimina una función pública** sin período de deprecación de al menos 2 versiones `MINOR`, marcada con un flag `deprecated_since` en la documentación de tipo — coherente con 23, principio "Evolución sin romper compatibilidad".
- **Cliente y servidor deben ejecutar exactamente la misma versión del paquete en todo momento** — despliegue coordinado obligatorio, nunca independiente (25 §5 riesgo #3, reafirmado aquí como requisito de release, no solo de arquitectura).

---

## 4. Motor matemático

### 4.1 Catálogo completo con complejidad y dependencias

| Función | Fórmula | Depende de | Complejidad | `formula_version` |
|---|---|---|---|---|
| `calcularRFinal` | `Σ_{i=1..k} p_i·RR_i + (100%−Σp_i)·R_cierre_resto` (02 §2) | — | O(n), n≤5 | null |
| `calcularBeneficioReal` | `Riesgo€ × R_final` | `calcularRFinal` | O(1) | null |
| `calcularBeneficioMaximo` | `Riesgo€ × RR_obj` | — | O(1) | null |
| `calcularBeneficioSacrificado` | `Benef_máx − Benef_real` | ambas anteriores | O(1) | null |
| `calcularPorcentajeConservado` | `R_final / R_max` | `calcularRFinal` | O(1) | null |
| `calcularImpactoPorParcial` | descomposición aditiva de `R_final` | `calcularRFinal` | O(n) | null |
| `calcularEsperanza` | `E[R] = (1/N)·Σ R_final` | — | O(N) — O(1) amortizado en modo streaming, §5.3 | null |
| `calcularDesviacionR` *(nueva, §8.3)* | `σ[R] = sqrt( (1/(N−1))·Σ(R_i − E[R])² )`, algoritmo de Welford (§5.6) | `calcularEsperanza` (comparten el paso de acumulación en modo streaming) | O(N) — O(1) amortizado streaming | null |
| `calcularRatioConsistencia` | `E[R] / σ[R]` | `calcularEsperanza`, `calcularDesviacionR` | O(1) sobre resultados ya calculados | null |
| `calcularProfitFactor` | `Σ ganancias / |Σ pérdidas|` | — | O(N) | null |
| `calcularWinRate` | `nº(R_final>0) / N` | — | O(N) | null |
| `calcularRecoveryFactor` | `Beneficio_neto / |Max_Drawdown|` | `calcularDrawdownHistorico` | O(1) sobre resultado ya calculado | null |
| `calcularRachaMaxima` | longitud máx. de signo constante consecutivo | — | O(N) | null |
| `calcularTiempoMedioEnMercado` | media de `time_in_market_sec` | — | O(N) | null |
| `calcularDistribucionR` | histograma por bucket | — | O(N) | null |
| `calcularCurvaEquity` | `Equity_t = Σ_{j≤t} Beneficio_real_j` | `calcularBeneficioReal` | O(N) | null |
| `calcularDrawdownHistorico` | `Drawdown_t = Equity_t − max_{s≤t}(Equity_s)` | `calcularCurvaEquity` | O(N), un solo paso (running max) | null |
| `calcularDrawdownState` | según `drawdown_type` (18 §2) | — | O(1) | null |
| `simularGestion` | idéntica a `calcularRFinal` | `calcularRFinal` | O(n) | null |
| `calcularScore` | `E[R_final|c] − λ·σ[R_final|c]` | `calcularEsperanza`, `calcularDesviacionR` | O(N) por candidata `c` — ver §8.4 sobre el número de candidatas | **score.v1** |

**Regla de dependencia explícita**: ninguna función del catálogo reimplementa el cálculo de otra — donde una fórmula usa el resultado de otra (p.ej. `calcularScore` usa `calcularEsperanza`), lo hace por composición de función, nunca copiando la expresión matemática. Es la mitigación estructural, no solo documental, del riesgo de "formula drift" (26 §Riesgos #1).

### 4.2 Orden de ejecución canónico

Determinado por el grafo de dependencias de §4.1 — no hay ambigüedad porque el grafo es un DAG estricto (verificado en §8.2, sin ciclos). Para cualquier pipeline compuesto, el orden es: `core` (Grupo B) → `stats` primitivos (`calcularEsperanza`, `calcularDesviacionR`) → `stats` derivados (`calcularRatioConsistencia`, `calcularRecoveryFactor`) → `curves` → `simulation`. Los dos pipelines de §2.2 ya expresan este orden de forma concreta.

### 4.3 Precisión decimal — el kernel decimal

**Problema de partida**: `quant-engine` corre en JavaScript/TypeScript tanto en cliente como en servidor (25 §2) — y JS no tiene un tipo decimal nativo; su único tipo numérico (`number`) es un IEEE-754 double, exactamente lo que I15 (23) y 26 §1 prohíben en cada paso, no solo en el valor final.

**Solución especificada**:
1. Todo el paquete usa un único tipo `FixedDecimal<Scale>`, respaldado internamente por `BigInt` escalado (p.ej. `Money` almacena euros × 10⁴ como entero), nunca `number`.
2. La aritmética de suma/resta/multiplicación es exacta por construcción sobre `BigInt`. La división (necesaria en `calcularPorcentajeConservado`, `calcularEsperanza`, `calcularProfitFactor`, etc.) se implementa con **precisión de guarda**: se calcula internamente a `scale + 10` dígitos y se redondea una única vez, al final, al `scale` público de la función — nunca se redondea en un paso intermedio (26 §1, matiz explícito).
3. **Redondeo**: `ROUND_HALF_EVEN` (bancario) en el límite público de cada función — elegido explícitamente sobre `HALF_UP` porque minimiza el sesgo acumulado cuando se agregan millones de resultados redondeados (19 §7, escala del producto); `HALF_UP` introduce un sesgo sistemático positivo detectable a partir de miles de operaciones agregadas.
4. **Un único punto de entrada al kernel decimal** (`decimal-kernel/`, §2.1): ningún otro subcomponente instancia aritmética decimal por su cuenta. Esto es la mitigación real (no solo documental) de que dos partes del propio Quant Engine usen configuraciones de precisión/redondeo distintas sin darse cuenta.
5. **Orden de suma canónico**: donde una fórmula suma una serie (parciales, curva de equity), el orden de suma es siempre el orden ascendente por `sequence`/tiempo — nunca el orden de inserción en memoria ni un orden paralelo no determinista. La suma en coma flotante no es asociativa; aunque aquí se opera en `BigInt` exacto (sí es asociativo), fijar el orden es lo que garantiza que un futuro cambio de implementación (p.ej. paralelización) no pueda alterar el resultado sin que el test de regresión de §6.5 lo detecte.

### 4.4 Reproducibilidad

Dos mecanismos, ya aprobados por separado, que juntos garantizan reproducibilidad total (26 §1):
- El patrón Snapshot (19 regla 13) congela los **inputs** — un `PlanSnapshot` de hace un año se recalcula hoy con `calcularRFinal` y produce exactamente el mismo `R_final` que produjo entonces, porque el input no cambió.
- `algorithm_version` (15 §3.5), expuesto en la API como `formula_version` (§3.2), congela qué **fórmula** se usó — solo relevante para las funciones que sí tienen una versión de diseño ajustable (hoy, únicamente `calcularScore`; ver tabla §4.1).
- El kernel decimal (§4.3) elimina la tercera fuente posible de no-reproducibilidad: diferencias de redondeo entre runtimes.

### 4.5 Versionado matemático — reglas exactas

1. Una función sin decisión de diseño ajustable (aritmética fija, verificada contra 02/12) nunca lleva `formula_version` — no existe "una versión 2" de cómo se suma un R ponderado (26 §1).
2. Una función con un parámetro de diseño ajustable (hoy: `calcularScore`, mañana: la función de decaimiento bayesiano cuando se especifique en AI Engine, 13 §4) lleva `formula_version` con formato `<nombre_corto>.v<N>` (p.ej. `score.v1`).
3. **Inmutabilidad de versión publicada**: una vez que una `formula_version` ha sido usada en al menos un resultado persistido (una recomendación, una explicación mostrada al trader), su comportamiento queda congelado para siempre. Un cambio de diseño se publica como `v<N+1>`; `v<N>` sigue existiendo en el código y sigue siendo invocable para reproducir resultados históricos.
4. **Ninguna versión se elimina** del código mientras exista al menos un registro persistido que la referencie — coherente con I2 (23) y con la política general de deprecación de paquete (§3.9).

---

## 5. Rendimiento

### 5.1 Objetivos de latencia

| Clase de operación | Objetivo (p95, cliente móvil de gama media) |
|---|---|
| Grupo B (una operación, n≤5 parciales) | < 1 ms |
| Grupo C/G sobre cartera de hasta 10.000 operaciones (modo streaming, §5.3) | < 15 ms |
| Grupo D (curvas) sobre 10.000 puntos | < 20 ms |
| Grupo E (`calcularDrawdownState`) | < 1 ms |
| Grupo F, una llamada a `simularGestion`/`calcularScore` | < 1 ms por llamada — ver §8.4 sobre el número de llamadas necesarias para una búsqueda completa, que **no** es responsabilidad de esta latencia individual |

### 5.2 Complejidad temporal

Ya tabulada por función en §4.1. Ninguna función pública del catálogo excede O(N) sobre el tamaño de la muestra recibida — es una propiedad verificable y forma parte de los tests de rendimiento (§6.4).

### 5.3 Escalabilidad — modo streaming para agregados

19 §7 exige soportar "millones de operaciones" por producto y "miles de cuentas por usuario". Recalcular `calcularEsperanza`/`calcularDesviacionR` desde cero sobre el histórico completo en cada `OperacionCerrada` sería O(N) por evento — inaceptable a esa escala si N crece sin límite.

**Especificación de la solución**: `calcularEsperanza` y `calcularDesviacionR` exponen, además de la forma "batch" de §3.5 (recibe `muestra: RValue[]` completa), una **forma incremental** basada en el algoritmo de Welford (numéricamente estable, sin el error de cancelación catastrófica de la fórmula ingenua `E[X²] − E[X]²`):

```
interface WelfordAccumulator { n: number; mean: RValue; m2: RValue }

calcularEsperanzaIncremental(acc: WelfordAccumulator, nuevo: RValue): WelfordAccumulator
calcularDesviacionDesdeAcumulador(acc: WelfordAccumulator): Result<QuantResult<RValue>, QuantError>
```

El `WelfordAccumulator` es el objeto que Risk Engine persiste por Cuenta (fuera de Quant Engine, que no persiste nada, §1.2) y actualiza con O(1) por operación cerrada — nunca vuelve a leer el histórico completo salvo auditoría o recuperación tras corrupción. Esto traslada el coste de O(N) por evento a O(1) amortizado, que es lo que la escala de 19 §7 exige. Se documenta aquí como parte del contrato porque el **algoritmo** (Welford, no la suma ingenua) es una decisión matemática que pertenece a Quant Engine, aunque el **acumulador persistido** pertenezca a Risk Engine.

### 5.4 Memoria

Ninguna función retiene estado entre llamadas (§2.3) — el consumo de memoria de cualquier función es lineal en el tamaño de su input y se libera al retornar. Límite práctico recomendado para el modo batch (no streaming): muestras de hasta ~100.000 operaciones en memoria del cliente antes de exigir modo streaming/paginado por parte del consumidor — no es un límite del propio Quant Engine, es una recomendación operativa para quien lo invoca desde un dispositivo móvil (19 §6, prioridad #3, experiencia móvil).

### 5.5 Cache

Quant Engine no cachea nada internamente (sería estado oculto, prohibido por §1.2/§2.3). Sí **habilita** el cacheo seguro por parte del consumidor: al ser puro y determinista, cualquier resultado es válido para memoización externa con clave `hash(formula_id, formula_version, inputs)` — se documenta como **contrato de pureza**, no como implementación, exactamente el mismo principio que 26 §Riesgos #1 ya dejaba implícito.

### 5.6 Optimización

1. **Welford sobre suma ingenua** para toda estadística de segundo momento (§5.3) — no solo por rendimiento, también por estabilidad numérica a N grande.
2. **Reutilización de resultados intermedios dentro de un mismo pipeline** (§2.2) — `calcularScore` nunca vuelve a sumar la muestra completa si `calcularEsperanza`/`calcularDesviacionR` ya se calcularon en la misma invocación compuesta.
3. **Minimizar asignación de objetos `FixedDecimal`** en bucles internos O(N) — operar sobre el `BigInt` subyacente dentro del bucle y envolver en `FixedDecimal` solo en la frontera de entrada/salida de la función pública.
4. **Sin paralelización especulativa dentro de una sola llamada** — a la escala de latencia objetivo (§5.1), el coste de coordinación superaría el ahorro; la paralelización real de la carga de trabajo (miles de cuentas) vive en el nivel de Risk Engine/Workers (25), no dentro de una función pura individual.

---

## 6. Testing

### 6.1 Unit tests (por función, mínimo obligatorio)

- Cada función del catálogo de §4.1: al menos un caso "camino feliz" verificado a mano contra 02/12, más un caso por cada rama de la fórmula (p.ej. `calcularRFinal` requiere un caso por cada una de las tres ramas de `R_cierre_resto`, 02 §2).
- Cada `QuantError` del catálogo de §3.3: al menos un test que lo dispara deliberadamente.

### 6.2 Property-based tests

Invariantes que deben cumplirse para **cualquier** input válido generado aleatoriamente (no solo los casos escritos a mano):

1. **Determinismo**: `f(x) === f(x)` en 1.000 invocaciones repetidas con el mismo input, incluida una ejecución cruzada cliente/servidor en CI.
2. **Acotación de `R_final`**: `R_final ≥ −1` siempre (nunca se puede perder más del riesgo asumido) y `R_final ≤ RR_obj` cuando `p_r` cierra en `RR_obj` (nunca se puede ganar más de lo planificado en esa rama).
3. **Monotonía**: incrementar `R_max` manteniendo el resto de inputs fijos nunca puede **disminuir** `R_final` (más recorrido a favor nunca empeora el resultado, dado el mismo plan).
4. **Conservación de `Σp_i`**: `calcularImpactoPorParcial` siempre suma exactamente a `R_final` (sin pérdida ni sobra por redondeo — verifica el kernel decimal de §4.3 de forma indirecta).
5. **Invariancia de orden de suma**: para `calcularEsperanza`/`calcularCurvaEquity`, permutar el orden de entrada de una muestra sin timestamps ordenados debe fallar con `INCONSISTENT_TRIGGER_STATE` (curvas) o producir el mismo resultado exacto (esperanza, que es conmutativa por construcción sobre `BigInt`, §4.3 punto 5).

### 6.3 Edge cases (catálogo obligatorio, derivado de §8.1)

| Caso | Función afectada | Comportamiento exigido |
|---|---|---|
| `n = 0` (ningún parcial) | `calcularRFinal` | Se reduce al caso "todo o nada" clásico (02 §2) |
| `k = 0` (ningún parcial disparado) | `calcularRFinal` | `R_cierre_resto = −1` |
| `R_max = 0` | `calcularPorcentajeConservado` | `UNDEFINED_RATIO { reason: "ZERO_R_MAX" }`, nunca `NaN` |
| `N = 0` en cualquier agregado | Grupo C/G | `EMPTY_SAMPLE` |
| `N = 1` en `calcularDesviacionR`/`calcularRatioConsistencia` | Grupo C | `UNDEFINED_RATIO { reason: "ZERO_VARIANCE" }` |
| Sin pérdidas en la muestra | `calcularProfitFactor` | `UNDEFINED_RATIO { reason: "ZERO_LOSSES" }`, nunca `Infinity` |
| `Max_Drawdown = 0` (curva siempre creciente) | `calcularRecoveryFactor` | `UNDEFINED_RATIO { reason: "ZERO_DRAWDOWN" }`, nunca `Infinity` |
| `Σp_i` exactamente 100% | `calcularRFinal` | Válido — el remanente `p_r = 0` no participa, sin división por cero |
| `RR_i` duplicado o no estrictamente creciente | `calcularRFinal` | `INVALID_PARTIAL_SEQUENCE` |
| `Riesgo€ ≤ 0` | `calcularRFinal` y derivados | `OUT_OF_RANGE` |

### 6.4 Stress tests

- Agregados de cartera con `N = 1.000.000` operaciones sintéticas, modo streaming (§5.3): verificar que el tiempo por actualización individual permanece O(1) y no se degrada con el tamaño del acumulador.
- `calcularScore`/`simularGestion` invocadas 100.000 veces consecutivas (simulando un fragmento del espacio de búsqueda del Optimizer, §8.4): verificar que la latencia p95 por llamada individual no se degrada con el número de llamadas previas (sin fugas de memoria, sin estado acumulado entre llamadas).
- Curvas de equity/drawdown sobre 500.000 puntos: verificar memoria lineal, sin crecimiento cuadrático.

### 6.5 Regression tests y golden datasets

- **Golden dataset obligatorio**: un conjunto fijo de operaciones (mínimo 50, incluyendo explícitamente el caso que expuso el bug histórico de `R_cierre_resto`, 02 §2/12 §2) con sus resultados esperados congelados a la precisión completa de `numeric(8,4)`/`numeric(18,4)`. Vive versionado junto al código, no en una base de datos externa.
- **Gate de CI**: cualquier cambio al código de `quant-engine` que altere un solo dígito de un resultado del golden dataset falla el build automáticamente, salvo que el commit también incremente `formula_version` (para las funciones versionadas) o documente explícitamente que es la corrección deliberada de un bug matemático (§3.9 — el precedente de `R_cierre_resto`).
- **Test cruzado cliente/servidor**: el mismo golden dataset se ejecuta en el bundle de cliente (entorno de navegador simulado) y en Core Service (Node) en cada CI — cualquier divergencia entre ambos falla el build. Es el test que hace cumplir §2.3 ("empaquetado único") de forma automática, no solo por revisión de código.

---

## 7. Explainable Quant

### 7.1 Alcance: por qué se aplica a todas las funciones públicas, no solo a las "importantes"

El fundador pidió explicabilidad para "cada cálculo importante". **Challenge Mode**: definir una lista de excepción ("estas sí, estas no") crea, con el tiempo, exactamente el mismo problema que 32 §2 ya resolvió para Coaching Card/Improvement Backlog — dos formas de un mismo contrato que hay que mantener sincronizadas, y una API fragmentada donde el consumidor (AI Engine) tiene que saber de antemano cuáles de las ~20 funciones del catálogo devuelven explicación y cuáles no. El coste de envolver también las funciones triviales (`calcularBeneficioReal`, una multiplicación) es marginal — un objeto adicional, no un cálculo adicional — mientras que el beneficio es una API uniforme y una regla simple: **toda función pública de Quant Engine devuelve `QuantResult<T>`, sin excepción**. Se aplica ya en la firma de §3.

### 7.2 Qué contiene la explicación

Los cinco elementos pedidos por el fundador, mapeados a campos concretos de `QuantResult<T>` (§3.2):

| Elemento pedido | Campo |
|---|---|
| Resultado | `value` |
| Cómo se obtuvo | `formula_id` (identifica de forma inequívoca cuál de las ~20 funciones del catálogo de §4.1 se ejecutó) |
| Qué datos utilizó | `inputs_echo` (copia de los inputs relevantes — no todos: se excluyen los que ya son públicos por otra vía, como el propio `muestra` completa en agregados de N grande, donde se referencia por tamaño y rango, no se copia entera) |
| Qué fórmula aplicó | Implícito en `formula_id` + la fórmula exacta documentada en el catálogo de §4.1, que es la referencia pública y estable |
| Qué versión del algoritmo utilizó | `formula_version` |
| Nivel de confianza | `confidence` — ver regla estricta en §7.3 |

### 7.3 La regla del campo `confidence` — hallazgo de Challenge Mode

**Problema detectado**: una lectura ingenua del requisito "nivel de confianza" tentaría a implementar dentro de Quant Engine algo como "si N < 30, confianza baja" — exactamente la estimación bayesiana que 13 §2/§6.2 ya diseñó, y que 26 §1 dejó **explícitamente fuera** del alcance de Quant Engine ("el aprendizaje bayesiano... fuera de alcance aquí"). Hacerlo aquí duplicaría esa lógica en dos módulos y, peor, mezclaría "calcular" con "juzgar la fiabilidad estadística de un cálculo" — una variante del mismo error que la regla 14 (19 §8.0) ya prohíbe para límites de riesgo, aplicada ahora a confianza estadística.

**Solución especificada**: `confidence` tiene exactamente dos formas posibles (§3.2), y Quant Engine nunca *calcula* ninguna de las dos, solo las **reporta**:
- `{ type: "exact" }` para cualquier función que opera sobre datos reales ya cerrados (todo el Grupo B, y los agregados del Grupo C/G/D cuando la muestra es el histórico real completo) — es aritmética exacta sobre hechos, no una estimación, así que no hay nada que "tener confianza" sobre ello más allá de "es correcto por construcción".
- `{ type: "passthrough", label, interval }` únicamente cuando el propio input de la función ya incluye un intervalo de credibilidad calculado por otro módulo (AI Engine, 13 §2) — Quant Engine lo copia al output tal cual, nunca lo genera. Aplica, por ejemplo, cuando `simularGestion` se invoca sobre una muestra bootstrap cuya probabilidad de ocurrencia ya viene etiquetada con un IC calculado en 13.

Esta regla mantiene a Quant Engine puro (§1.2, punto 3: "nunca lee contexto implícito", y por extensión, nunca *inventa* un juicio de confianza que no le fue dado).

### 7.4 Consumo por AI Engine

El `QuantResult<T>` de cualquier función del catálogo es exactamente el insumo que la Coaching Card (29 §3) necesita para sus 6 campos: "qué evidencia histórica lo demuestra" se resuelve mostrando `inputs_echo` + `confidence`; "qué probabilidad de mejora existe" se resuelve con el `confidence.interval` de una llamada a `simularGestion` sobre una muestra ya etiquetada por 13. AI Engine no necesita ninguna lógica adicional de explicación matemática — solo redacta en lenguaje natural (06 §3) lo que `QuantResult<T>` ya le entrega estructurado. Es la forma concreta en que Explainable Quant cierra el círculo con 29 §3 sin inventar una segunda fuente de verdad.

---

## 8. Auditoría — intentando destruir el diseño

### 8.1 Errores matemáticos encontrados

Los seis casos indefinidos de §6.3 (`ZERO_R_MAX`, `ZERO_VARIANCE`, `ZERO_LOSSES`, `ZERO_DRAWDOWN`, `N=0`, secuencias inválidas) no estaban resueltos con esta precisión en 26 — el catálogo conceptual daba la fórmula pero no el comportamiento en el punto de indefinición matemática. Es un hallazgo real: sin esta especificación, cada desarrollador habría decidido por su cuenta si un `ProfitFactor` sin pérdidas es `Infinity`, `null` o `999999` — tres implementaciones distintas del mismo caso, la definición misma de "formula drift" (26 §Riesgos #1) aplicada a un caso límite en vez de a la fórmula principal.

### 8.2 Dependencias ocultas — verificación del grafo

El grafo de §4.1 se verificó explícitamente como DAG (sin ciclos): `core` no depende de `stats`/`curves`/`simulation`; `stats` depende solo de `core`; `curves` depende solo de `core`; `simulation` depende de `core` y `stats`, nunca al revés. No se encontró ninguna dependencia oculta hacia otro módulo del sistema (Risk Engine, Rule Engine, etc.) — el catálogo completo de §4.1 solo referencia entre sí funciones del propio paquete.

### 8.3 Cálculo duplicado encontrado — `σ[R]` sin función propia

**Problema detectado**: 26 §2 nunca catalogó una función pública para la desviación estándar de `R_final` sobre una muestra — pero **dos** funciones del propio catálogo la necesitan internamente: `calcularRatioConsistencia` (`E/σ`, 26 §2.4) y `calcularScore` (`E − λσ`, 26 §2.7). Sin una función explícita y compartida, la implementación real habría tenido dos copias del cálculo de varianza muestral — con el riesgo concreto de que una use `N` en el denominador (varianza poblacional) y la otra `N−1` (varianza muestral, la correcta para una estimación a partir de una muestra), produciendo dos cifras de "consistencia" sutilmente distintas sin que nadie lo note hasta una auditoría.

**Solución aplicada en esta especificación**: se añade `calcularDesviacionR` como función pública de primera clase (§3.5, §4.1, Grupo G nuevo), implementada una sola vez con el algoritmo de Welford (`N−1` en el denominador, estimador insesgado) y consumida por composición tanto por `calcularRatioConsistencia` como por `calcularScore`. Es exactamente el mismo patrón de mitigación que 26 §Riesgos #1 pedía en general, aplicado aquí a un caso concreto que el propio catálogo conceptual no había detectado.

### 8.4 Problema de rendimiento encontrado — el espacio de búsqueda del Optimizer está mal dimensionado en 02 §5.1

**Este es el hallazgo más importante de la auditoría.** 02 §5.1 afirma que el espacio de búsqueda del optimizador, para `RR_obj` típico (2–6R) con grid de 0.1R y grid de parciales de 5%, es "del orden de 10⁴–10⁵ combinaciones... trivialmente evaluable en milisegundos". **Esa cifra es incorrecta**, y el error importa porque condiciona directamente cómo debe construirse el futuro componente Optimizer sobre este mismo Quant Engine.

**El cálculo real**: con `RR_obj = 6R` y grid de 0.1R hay 60 valores posibles de `RR_i`. Elegir una secuencia estrictamente creciente de hasta `n = 5` niveles de esos 60 valores ya son, solo para `n = 5`, `C(60,5) = 5.461.512` combinaciones de niveles — antes de considerar siquiera cómo repartir el porcentaje entre ellos. Añadiendo el grid de 5% para los porcentajes (composiciones de hasta 100% en pasos de 5% sobre 5 tramos, del orden de `C(24,5) ≈ 42.504` reparticiones), el total para `n = 5` es del orden de `5.461.512 × 42.504 ≈ 2,3 × 10¹¹` combinaciones — **siete órdenes de magnitud más que la cifra de 02 §5.1**, no una diferencia menor de redondeo. Evaluar 2,3×10¹¹ candidatas incluso a 1 microsegundo por evaluación (mejor que el objetivo de latencia de §5.1 para una sola llamada) tardaría más de 63.000 horas — inviable por completo como búsqueda exhaustiva.

**Por qué esto no invalida esta especificación, pero sí exige una decisión explícita para la futura Specification 002 (Optimizer)**: Quant Engine cumple su contrato — `calcularScore`/`simularGestion` evalúan **una** candidata en O(1)-O(N) y a la latencia objetivo de §5.1, exactamente como especifica 26 §2.7 ("Quant Engine nunca sabe que existe una búsqueda en curso"). El error está en cuántas veces hace falta llamarlo, que es una decisión de estrategia de búsqueda del Optimizer, no de Quant Engine. Se deja registrado aquí, de forma explícita y bloqueante para el diseño del Optimizer, que la búsqueda **no puede ser fuerza bruta exhaustiva tal como 02 §5.1 la describe** para `n ≥ 3` con esta resolución de grid — el Optimizer necesitará una estrategia de poda/heurística acotada (p.ej. programación dinámica sobre el hecho de que `E[R_final]` es aditiva en las decisiones tomadas en orden creciente de `RR_i`, aunque `σ[R_final]` no lo sea y por tanto no admite una descomposición exacta trivial — o una reducción del grid para `n` alto, o un límite explícito de candidatas evaluadas con muestreo aleatorio del espacio en vez de enumeración completa). Ninguna de estas opciones se decide en esta especificación — es, explícitamente, la primera pregunta que Specification 002 debe responder antes de construir nada.

### 8.5 Limitaciones a 10 años

1. **El kernel decimal sobre `BigInt` no tiene límite práctico de tamaño** (a diferencia de un `float`, no pierde precisión con valores grandes) — soporta sin cambios el crecimiento de capital/volumen de 19 §7.
2. **El modo streaming de §5.3 es la única vía viable a la escala de "millones de operaciones"** — el modo batch (§3.5, recibir la muestra completa) debe tratarse como una utilidad de desarrollo/depuración o para carteras pequeñas, nunca como el camino de producción para una Cuenta con historial extenso. Se deja anotado como requisito no negociable para quien implemente Risk Engine sobre este contrato.
3. **El catálogo de fórmulas es estable a 10 años por diseño** (§4.5, inmutabilidad de versión) — el riesgo real a 10 años no es que una fórmula deba cambiar, es que el número de `formula_version` acumuladas para una misma función crezca (p.ej. `score.v7`) y nadie limpie versiones ya sin uso; se recomienda una auditoría periódica de qué versiones ya no tienen ningún registro persistido que las referencie, candidatas a eliminación segura (coherente con el sistema de retirada de TPOS, 31).

---

## Riesgos

1. **El hallazgo de §8.4 bloquea implícitamente el diseño del Optimizer** hasta que Specification 002 (o la que corresponda) resuelva la estrategia de búsqueda — no bloquea esta especificación, pero si se ignora, el primer intento de implementar el Optimizer tal como 02 §5.1 lo describe fallará en producción de forma dramática (o nunca terminará una búsqueda). Mitigación: este documento dejará constancia explícita, y el punto se replantea como el primer tema obligatorio de la siguiente especificación.
2. **El modo streaming (Welford, §5.3) traslada responsabilidad a Risk Engine** (persistir y mantener el acumulador) que no existía en el contrato conceptual de 26 — riesgo de que se implemente Quant Engine sin que Risk Engine implemente su mitad del contrato, degradando silenciosamente a O(N) por evento a gran escala. Mitigación: este requisito debe figurar explícitamente en la especificación técnica de Risk Engine cuando se escriba.
3. **La decisión de envolver el 100% de las funciones en `QuantResult<T>` (§7.1)** añade un coste de serialización/memoria marginal pero no nulo en llamadas de muy alta frecuencia (p.ej. dentro de un futuro Optimizer llamando millones de veces) — si el perfilado real revela que este coste es significativo en el punto caliente del Optimizer, se recomienda una variante interna "sin explicación" de uso exclusivo entre subcomponentes del propio Quant Engine (nunca expuesta como API pública), decisión que se deja abierta para cuando existan datos de perfilado reales, no antes.
4. **`ROUND_HALF_EVEN` (§4.3) es distinto del redondeo intuitivo `HALF_UP`** que un ingeniero nuevo podría asumir por defecto al implementar sin leer esta sección — riesgo de una implementación inicial silenciosamente incorrecta. Mitigación: el test de regresión de §6.5 lo detectaría de inmediato si el golden dataset incluye al menos un caso en el punto exacto de redondeo `x.xx5`.

---

## Auditoría del capítulo (19 §5.1, aplicado en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Convierte el contrato conceptual de 26 (aprobado, correcto en su forma) en algo que un equipo puede construir sin decisiones ambiguas — cada caso indefinido, cada elección de redondeo, cada estrategia de escalabilidad que 26 dejaba implícita queda resuelta aquí con una única respuesta correcta.

**¿Qué sobra?** Nada del catálogo de 26 se elimina. Se añade una función (`calcularDesviacionR`, §8.3) que no estaba explícita pero que ya era una dependencia oculta de dos funciones existentes.

**¿Qué falta?** Antes de esta especificación, faltaban: el comportamiento exacto en los seis casos indefinidos (§8.1), el algoritmo de escalabilidad para agregados (§5.3), y la corrección de la estimación del espacio de búsqueda del Optimizer (§8.4) — los tres son hallazgos nuevos de este documento, no repeticiones de 26.

**¿Qué haría un banco de inversión para hacerlo más robusto?** Exactamente el ejercicio de §8: encontrar el punto donde la aritmética se indefine matemáticamente (división por cero, varianza sin muestra) y decidir su comportamiento de forma explícita en vez de dejar que el runtime decida por defecto (`NaN`, `Infinity`) — es la diferencia entre una librería financiera auditable y una que "normalmente funciona".

**Puntuación**: **96/100**. Los 4 puntos que faltan son los 4 Riesgos — ninguno es un defecto de diseño, los cuatro son decisiones correctamente identificadas pero que dependen de un componente que todavía no se ha especificado (Risk Engine, Optimizer) o de datos de perfilado que no existen todavía.

**Nivel de madurez**: 95%. Interfaces, catálogo matemático, precisión decimal, rendimiento, testing y explicabilidad están completos y son directamente implementables; lo pendiente (§Riesgos) es coordinación con especificaciones futuras, no ambigüedad de esta.

---

## Cierre de la especificación

**Riesgos pendientes**: los 4 de "Riesgos" — ninguno bloquea la implementación de Quant Engine tal como está especificado aquí; los 4 son puntos de coordinación con componentes que se especificarán después.

**Decisiones abiertas**:
1. Estrategia de búsqueda del Optimizer (§8.4) — se resuelve en la siguiente especificación, no aquí; es la decisión más importante que queda pendiente en todo el sistema de cálculo.
2. Si la variante interna "sin explicación" de §Riesgos #3 llega a ser necesaria — se decide con datos de perfilado reales tras la primera implementación, no antes.

**Recomendación profesional**: aprobar SPECIFICATION 001. Es implementable directamente por un equipo de ingeniería sin decisiones ambiguas pendientes, y el ejercicio de Challenge Mode encontró un hallazgo genuinamente importante (§8.4) que, de no detectarse ahora, habría producido un Optimizer inconstruible tal como estaba descrito desde el capítulo 02. Recomiendo que SPECIFICATION 002 aborde el Optimizer partiendo explícitamente de la corrección de §8.4, no de la cifra original de 02 §5.1.
