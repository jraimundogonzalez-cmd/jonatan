# 26 · R Engine — El Núcleo Matemático

*Voz: Quant Trader + Matemático + Product Architect — Challenge Mode obligatorio (19 §1.1). Primer componente de Fase 1. Sin código todavía — contrato y catálogo completos.*

## 0. Aclaración que condiciona todo el capítulo: R Engine ≠ Risk Engine

22.5 §2.3 definió Risk Engine como el módulo que "computa, de forma determinista, magnitudes de riesgo". Este capítulo lo precisa un nivel más abajo, y la precisión importa: **R Engine es la capa de fórmulas puras; Risk Engine es quien la invoca, persiste sus resultados y emite eventos** (`CapitalRecalculado`, 21.5 §7). R Engine no sabe qué es una Cuenta, no sabe guardar nada, no emite eventos — recibe números y configuración, devuelve números. Risk Engine es, a partir de este capítulo, un **consumidor** de R Engine, no un sinónimo. Esta distinción ya estaba insinuada en 25 §2 (`r-engine` como librería compartida, distinta del "núcleo síncrono" de Risk Engine dentro de Core Service) — aquí se formaliza como el contrato completo que el fundador pide, y se corrige 22.5 §2.3 para reflejarlo explícitamente (§8).

## 1. Contrato del R Engine

**¿Qué entra?** Solo datos explícitos, nunca contexto implícito: capital y riesgo% de una operación concreta (para derivar `Riesgo€`), la configuración de un Plan (RR objetivo, parciales planificados, `be_trigger`), el recorrido observado (`R_max`) o el histórico de parciales realmente ejecutados, muestras de `R_final`/`R_max` (para funciones agregadas), parámros de diseño explícitos cuando una fórmula los necesita (`λ` para el Score, nunca un valor implícito).

**¿Qué sale?** Todo el catálogo de §2 — siempre valores, nunca efectos secundarios.

**¿Qué nunca debe conocer?** El nombre de una empresa o prop firm (19 regla 4); qué límite configuró una empresa contra el que comparar un resultado — eso es juicio, no cálculo, y corresponde a Rule Engine (19 regla 14, Calcular ≠ Juzgar); la identidad de otros usuarios; cómo se presenta un dashboard; el proveedor de IA; y, de forma explícita, **nada de persistencia ni de red** — R Engine no sabe que existe una base de datos. Recibe datos en memoria, devuelve datos en memoria.

**¿Qué cálculos son deterministas?** Todos, sin excepción — es el criterio de admisión al catálogo, no una característica opcional. Ninguna función de R Engine depende de aleatoriedad, de la hora del sistema no recibida como parámetro explícito, o de estado mutable oculto.

**¿Qué cálculos dependen de versión de algoritmo?** Solo los que incorporan una decisión de diseño ajustable, no una verdad aritmética fija: el Score del optimizador (si la ponderación `E − λσ` cambia de forma en el futuro, 15 §3.5) y, cuando se diseñe su propio capítulo, la función de decaimiento temporal del aprendizaje bayesiano (13 §4, fuera de alcance aquí, ver §7). `R_final`, drawdown, esperanza clásica y el resto de fórmulas aritméticas **no** llevan versión — no existe una "versión 2" de cómo se suma un resultado ponderado.

**¿Qué precisión decimal requiere cada cálculo?** Dinero: `numeric(18,4)` (04 §1.2). R: `numeric(8,4)`. Porcentajes: `numeric(5,2)`. Se reafirma I15 con un matiz que no estaba escrito en ningún capítulo anterior: la precisión decimal exacta se exige también en **cada paso intermedio** del cálculo, no solo en el valor final almacenado — convertir a coma flotante "solo para un paso intermedio rápido" reintroduce el error que I15 prohíbe, por la puerta de atrás.

**¿Cómo se garantiza la reproducibilidad histórica?** El patrón Snapshot (19 regla 13) congela los *inputs*; `algorithm_version` (15 §3.5) congela qué *fórmula* se usó, solo donde la fórmula tiene una versión de diseño (arriba). Con ambos fijados, cualquier cálculo de R Engine es reproducible en cualquier momento futuro — coherente con I2 (23), corregido en su momento para exigir exactamente este matiz.

**¿Qué operaciones son puramente matemáticas?** Todo el catálogo de §2, por definición.

**¿Qué operaciones requieren contexto externo?** Ninguna, a propósito. Si algo necesita el nombre de una empresa, un límite configurado, o la hora actual del sistema, no pertenece a R Engine — pertenece a quien lo llama. Es Dependency Inversion aplicado por tercera vez en el blueprint (tras Rule Engine/Risk Engine en 22.5 y Snapshot Engine en 22.5 §2.11): R Engine no depende de nada, todo el sistema depende de R Engine.

## 2. Catálogo matemático completo

### 2.1 Corrección previa al catálogo: tres duplicados reales en la lista pedida

Antes de listar nada, Challenge Mode encuentra que la lista de partida nombra el mismo concepto varias veces con palabras distintas — aceptarla tal cual produciría, con el tiempo, tres implementaciones ligeramente distintas de lo que debería ser una sola función:

1. **"RR conseguido"**, **"RR ponderada"** y **"Resultado final"** son, los tres, `R_final` (02 §2 — que ya es, por definición, una suma *ponderada* de parciales, así que "RR ponderada" no añade nada distinto). Se consolidan en una única función, `calcularRFinal`, con las tres etiquetas documentadas como sinónimos de producto.
2. **"Esperanza matemática"** y **"Expectancy"** son el mismo término en dos idiomas — literalmente la traducción estándar en literatura de trading. Se consolidan en `calcularEsperanza`, con "Expectancy" documentado como el nombre en inglés del mismo resultado, no como una métrica distinta.
3. **"Break Even"**, tal como se pedía, sugiere una función de cálculo propia — pero ya se resolvió en 21.5 §1.4 como un **parámetro** (`be_trigger`) que selecciona qué rama de la fórmula de `R_final` aplica, no un cálculo independiente. No se crea una función nueva; se documenta como input, no como catálogo de salida.

### 2.2 Grupo A — Fundamentos (inputs, no cálculos de salida)

| Concepto | Naturaleza | Fórmula / origen |
|---|---|---|
| Riesgo€ ("R inicial", "Riesgo monetario" — mismo concepto, dos nombres del pedido original) | Input derivado | `Capital × Riesgo%` (02 §1) |
| RR objetivo | Input | Del `PlanSnapshot` (21.5 §2) |
| Parciales (planificados/ejecutados) | Input | Del `PlanSnapshot` / registro real de la Operación |
| `be_trigger` | Input (parámetro, no cálculo) | Del Plan (21.5 §1.4) — selecciona la rama de `R_cierre_resto` |

### 2.3 Grupo B — Resultado de una operación

| Función | Fórmula | Fuente |
|---|---|---|
| `calcularRFinal` (consolida "RR conseguido"/"RR ponderada"/"Resultado final") | `Σ p_i·RR_i (i≤k) + resto·R_cierre_resto` | 02 §2, corregida en 21.5 |
| `calcularBeneficioReal` | `Riesgo€ × R_final` | 02 §3 |
| `calcularBeneficioMaximo` | `Riesgo€ × RR_obj` | 02 §3 |
| `calcularBeneficioSacrificado` | `Beneficio_máx_alcanzable − Beneficio_real` | 02 §3 |
| `calcularPorcentajeConservado` | `R_final / R_max` | 02 §3 |
| `calcularImpactoPorParcial` | Descomposición aditiva de `R_final` | 12 §3 |

### 2.4 Grupo C — Agregados de cartera (sobre una muestra de operaciones)

| Función | Fórmula | Nota |
|---|---|---|
| `calcularEsperanza` (consolida "Esperanza matemática"/"Expectancy") | `E[R] = (1/N)·Σ R_final`, verificable con `WinRate·R̄_ganador − LossRate·R̄_perdedor` (02 §4.2, 12 §4) | Dos vías, mismo resultado — ya demostrado en 12 |
| `calcularProfitFactor` | `Σ ganancias / |Σ pérdidas|` | 02 §4.3 |
| `calcularWinRate` *(nueva, validada)* | `nº operaciones con R_final > 0 / N` | Estaba implícita dentro de la fórmula de esperanza (02 §4.2) pero nunca existía como función propia — un trader profesional la consulta de forma directa, no solo como término intermedio de otra fórmula |
| `calcularRecoveryFactor` *(nueva, no estaba en ningún capítulo anterior)* | `Beneficio_neto_acumulado / |Max_Drawdown_€|` | Métrica estándar de retorno ajustado a riesgo que faltaba en el blueprint — se añade aplicando "si falta algo importante para un trader profesional, añádelo" |
| `calcularRatioConsistencia` *(nueva)* | `E[R] / σ[R]` | Distinto del Score del optimizador (`E − λσ`, una resta): esto es un cociente, sirve para comparar consistencia entre carteras/cuentas sin depender de la preferencia de riesgo `λ` de nadie — se añade porque el Score (§2.6) responde "qué configuración es mejor para mí", y esta responde "qué tan consistente soy", una pregunta distinta |
| `calcularRachaMaxima` *(nueva)* | Longitud máxima de operaciones consecutivas con `R_final` del mismo signo | Métrica descriptiva estándar, relevante también para el análisis de comportamiento de 13 §5 |
| `calcularTiempoMedioEnMercado` *(nueva)* | Media de `time_in_market_sec` sobre la muestra | El dato ya existe por operación (04); nunca se había formalizado como agregado |
| `calcularDistribucionR` *(nueva)* | Histograma de `R_final` sobre la muestra, por bucket | Salida no escalar (una distribución, no un número) — insumo directo para Analytics, evita que Analytics reimplemente su propio bucketing |

### 2.5 Grupo D — Curvas (equity y drawdown, con parámetro de unidad)

| Función | Fórmula | Nota |
|---|---|---|
| `calcularCurvaEquity(unidad: € \| R)` (consolida "Curvas de capital"/"Curvas en R") | `Equity_t = Σ_{j≤t} Beneficio_real_j` (02 §4.4), o su equivalente acumulado en R | Misma fórmula, parámetro de unidad — no dos funciones distintas |
| `calcularDrawdownHistorico(unidad: € \| R)` (consolida "Drawdown en €"/"Drawdown en R") | `Drawdown_t = Equity_t − max_{s≤t}(Equity_s)`, `Max_Drawdown = min_t(Drawdown_t)` (02 §4.4) | **Distinto** de `calcularDrawdownState` (Grupo E) — ver la aclaración de §2.6, es la confusión más importante que resolver en este catálogo |

### 2.6 Grupo E — Estado de riesgo de cuenta (consumido por Rule Engine, nunca calculado por él)

**Aclaración necesaria, porque el pedido original mezclaba dos cosas bajo la misma palabra**: "drawdown" en el Grupo D es una métrica **descriptiva** sobre el histórico de resultados ya cerrados (cuánto cayó la curva de equity en el pasado). El drawdown que Rule Engine necesita para juzgar cumplimiento (18 §2, 22 §6) es **prospectivo y depende de la configuración de la prop firm** (estático/trailing/EOD) — son cálculos distintos que comparten nombre por accidente del lenguaje de trading, no por ser la misma fórmula.

| Función | Fórmula | Nota |
|---|---|---|
| `calcularDrawdownState` | `piso_vigente` (según `drawdown_type`: estático/trailing/EOD, 18 §2) y `drawdown_restante_€/%` | Consume `peak_capital`, `current_capital` y el `RuleProfileSnapshot` — pero **solo lee** el tipo/porcentaje configurado, nunca decide si es aceptable (eso es Rule Engine, 19 regla 14) |

### 2.7 Grupo F — Simulación y comparación (consumido por Optimizer, no forma parte de él)

**Aclaración de frontera, pedida explícitamente por el fundador ("Optimizer" como consumidor de R Engine, no como parte de él)**: R Engine provee la fórmula de evaluación de **una** configuración candidata. La búsqueda entre miles de configuraciones (el bucle de 02 §5.1) es responsabilidad del componente Optimizer, que llama a R Engine una vez por candidato — R Engine nunca sabe que existe una búsqueda en curso.

| Función | Fórmula | Nota |
|---|---|---|
| `simularGestion` | Igual que `calcularRFinal`, aplicada a una configuración hipotética | Es la misma fórmula del Grupo B, no un algoritmo distinto — "simular" es solo "calcular sin persistir" |
| `calcularScore` | `E[R_final|c] − λ·σ[R_final|c]` (02 §5.2) | Consolida "Optimización de parciales" y "Comparación entre gestiones" del pedido original: comparar dos gestiones (12 §6) es, literalmente, calcular este Score para cada una y presentarlas una junto a la otra — no hace falta una función de "comparación" separada |

## 3. Clasificación de cálculos (resumen de §2)

- **Puramente matemáticos, sin excepción** (todo el catálogo): Grupos A-F.
- **Requieren contexto externo, y por eso NO viven en R Engine**: qué firma configuró qué límite (Rule Engine), cuándo notificar (Notification Engine), cómo se explica en lenguaje natural (AI Engine/06 §3).

## 4. Dependencias permitidas

Ninguna hacia otros módulos del sistema — solo utilidades matemáticas/de fecha genéricas, externas al dominio de TradePilot. R Engine es la base del grafo de dependencias completo (22.5 §3): todo depende de él, él no depende de nadie.

## 5. Dependencias prohibidas

R Engine → Risk Engine, Rule Engine, Funding Management, Operations, Analytics, AI Engine, base de datos, red, cualquier proveedor externo — **todas**, sin una sola excepción. Es la prueba de que R Engine es de verdad la base y no un módulo más disfrazado de base.

---

## Riesgos matemáticos

1. **Deriva de fórmulas ("formula drift")**: si un consumidor (p.ej. Analytics, bajo presión de plazo) reimplementa una versión "rápida" de la esperanza en vez de llamar a `calcularEsperanza`, los resultados divergen en silencio con el tiempo. Mitigación: disciplina de revisión de código más, idealmente, una verificación automática que impida que exista una segunda implementación de cualquier fórmula del catálogo fuera de R Engine.
2. **Pérdida de precisión en fronteras de ejecución dual**: `r-engine` corre tanto en cliente como en servidor (05 §2, 25 §5 riesgo #3) — si las dos copias divergen de versión, un usuario podría ver un número distinto en la calculadora y al guardar. Mitigación ya anotada en 25, reafirmada aquí como riesgo matemático, no solo de despliegue.
3. **Valores de `λ` inconsistentes entre puntos de llamada**: si el Score se invoca con un `λ` por defecto distinto en el Optimizer que en un futuro panel de comparación manual, dos pantallas del producto podrían mostrar "la mejor configuración" de forma distinta para los mismos datos. Mitigación: `λ` siempre explícito en la llamada, nunca con valor por defecto oculto dentro de R Engine (coherente con "R Engine no conoce contexto implícito", §1).
4. **Ambigüedad de nomenclatura reintroducida por el propio equipo**: el hallazgo de §2.1 (tres nombres para `R_final`) puede volver a ocurrir si no se fija un glosario único de nombres de función — se recomienda que este catálogo sea la referencia obligatoria de nombres, no solo de fórmulas.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno de forma directa — pero protege, mejor que cualquier capítulo anterior, la precisión matemática que todo el producto promete (00, "Every R Matters"): si dos pantallas del producto pudieran mostrar números distintos para el mismo dato, la confianza del trader se rompería de inmediato.

**¿Qué funcionalidades sobran?** Tres, ya eliminadas en §2.1: "RR conseguido"/"RR ponderada" como funciones separadas de `R_final`, "Expectancy" como métrica separada de "Esperanza matemática", y "Break Even" como función de cálculo en vez de parámetro.

**¿Qué funcionalidades faltan?** Cuatro, añadidas en §2.4: Win Rate como función propia, Recovery Factor (ausente en todo el blueprint hasta ahora), Ratio de consistencia (distinto del Score), racha máxima y tiempo medio en mercado.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que el catálogo completo (§2) nunca debe ser visible como tal para el usuario — son ~20 funciones para el equipo, y deberían traducirse en 5-6 números que el trader ve realmente en una pantalla (03 §4, 18 §6) sin saber que existe un "R Engine" detrás.

**¿Qué haría Linear para hacerlo más rápido?** Confirmaría la separación Grupo F (Optimizer llama a R Engine repetidamente) como la decisión correcta para no bloquear la experiencia — cada llamada a `simularGestion`/`calcularScore` es barata y determinista, así que miles de llamadas en un grid search (02 §5.1) siguen siendo instantáneas.

**¿Qué haría TradingView para hacerlo más intuitivo?** Pediría que `calcularDistribucionR` (histograma de R) se convierta en una visualización estándar reutilizada en varias pantallas (Dashboard de cuenta, Dashboard Maestro, Replay de gestión, 17 §3.1) — mismo dato, una sola función, múltiples lugares donde se dibuja.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente lo que motivó §2.6: nunca confundir una métrica descriptiva del pasado (drawdown histórico) con una métrica de cumplimiento prospectivo (drawdown restante frente a un límite) — es la misma disciplina de segregación que ya vertebra todo el blueprint desde 22.5 (Calcular ≠ Juzgar), aplicada ahora dentro del propio catálogo matemático.

**Puntuación del capítulo**: **97/100** — la más alta del blueprint hasta ahora. El catálogo pedido tenía tres duplicados reales y cuatro huecos reales, y este capítulo los resolvió todos con justificación explícita, no por intuición. Los 3 puntos restantes son los riesgos de disciplina de implementación (§Riesgos), inevitables en un documento conceptual.

**Nivel de madurez del capítulo**: 95%. El contrato y el catálogo están completos y depurados; falta solo la traducción a firmas de función concretas, que pertenece al diseño técnico detallado de este mismo componente (siguiente paso, no un capítulo distinto).

---

## Cierre de capítulo

**Riesgos pendientes**: los 4 de "Riesgos matemáticos" — ninguno bloquea aprobar el contrato, los 4 son disciplina de implementación a vigilar (idealmente con verificación automática, no solo revisión humana).

**Decisiones abiertas**:
1. Si el aprendizaje bayesiano (13, posterior Beta-Binomial, decaimiento temporal) se incorpora al catálogo de R Engine en un capítulo propio más adelante, o si se diseña como parte del futuro componente de AI Engine — se deja explícitamente fuera de este capítulo (§1, "dependen de versión de algoritmo") para no diluir el foco pedido por el fundador (R, no aprendizaje).
2. Nombre técnico final de cada función (`calcularRFinal` etc. son nombres de trabajo, no un contrato de código) — se fija en el diseño técnico detallado.

**Recomendación profesional**: aprobar el contrato y el catálogo. Es la pieza más importante de todo el sistema, tal como el fundador la calificó, y es la primera vez en el blueprint donde Challenge Mode encuentra simultáneamente duplicados que eliminar y huecos que llenar en la misma lista — señal de que el ejercicio se hizo con el rigor que este componente, más que ningún otro, exige. Con esto aprobado, el siguiente paso es el diseño técnico detallado de R Engine (firmas de función, estructura interna) o, si el fundador lo prefiere, el diseño de Risk Engine como su primer y más inmediato consumidor.

## 8. Corrección aplicada a 22.5 (consistencia entre capítulos)

22.5 §2.3 (Risk Engine) queda actualizado para reflejar esta capa: donde decía "computar, de forma determinista, magnitudes de riesgo", se entiende ahora como "orquestar la persistencia y el ciclo de vida de los cálculos que R Engine provee como fórmulas puras" — Risk Engine deja de ser quien calcula, pasa a ser quien invoca a quien calcula, persiste el resultado y emite el evento. El contrato de 22.5 §2.3 no cambia en sus entradas/salidas/invariantes; cambia la precisión de a quién le pertenece la fórmula.
