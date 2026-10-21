# 28 · Quant Language — Diccionario Oficial del TradePilot Quant Engine

*Voz: Product Architect + Quant Trader + Matemático — Challenge Mode obligatorio (19 §1.1). Última capa de abstracción antes de las interfaces públicas del Quant Engine. No es una API — es un lenguaje.*

## 0. Regla de idioma, antes de cualquier término (hallazgo de partida)

La lista de ejemplos del fundador mezcla términos en inglés (Partial, Management Plan, Simulation, Scenario, Session, Strategy, Snapshot) con conceptos que todo el blueprint ha usado siempre en español (Parcial, Plan de Gestión, Cuenta, Empresa). No es un descuido — es la tensión real entre dos audiencias distintas: el código y las interfaces públicas del Quant Engine (audiencia técnica, convención internacional) frente a la documentación y la UI (audiencia en español). Se resuelve formalmente, no se deja implícita:

**Regla de idioma**: todo concepto tiene un **identificador técnico canónico en inglés** (el que usan funciones, eventos, nombres de tabla — ya precedente en 04 §6, "evita mezclar idiomas en identificadores técnicos") y un **término de producto en español** (el que usan la documentación, la UI y el propio Blueprint). Ambos significan exactamente lo mismo — nunca son sinónimos distintos, son la misma entrada del diccionario en dos idiomas. El diccionario de §2 los declara siempre juntos.

## 1. Reglas del lenguaje

1. Un concepto no puede significar dos cosas distintas en ningún contexto del sistema.
2. Dos conceptos distintos no pueden representar la misma métrica — si ocurre, se consolidan en uno y el otro se prohíbe como sinónimo (ya aplicado varias veces antes de este capítulo, ver §4).
3. Toda magnitud se expresa siempre con su unidad explícita — R, €, %, número de operaciones, tiempo — nunca un número desnudo, ni en código, ni en documentación, ni en UI.
4. Toda función, evento o campo del sistema usa exactamente el vocabulario de este diccionario — ninguna implementación introduce un sinónimo nuevo sin pasar primero por este capítulo.
5. **Bilingüismo estructurado** (§0): identificador técnico en inglés, término de producto en español, nunca mezclados dentro del mismo nombre.
6. Ningún término del Quant Engine puede coincidir con un término reservado de un dominio adyacente (matemáticas, estadística, finanzas) sin una calificación explícita que elimine la ambigüedad (ejemplo real, §3.1: "R" vs. coeficiente de correlación).
7. Ningún término puede, ni por aproximación, sugerir que TradePilot evalúa la calidad de una entrada de mercado o el precio futuro — es la aplicación de I9 (23) al vocabulario mismo, no solo a la funcionalidad.

## 2. Diccionario oficial

| # | Español (producto) | Inglés (técnico) | Definición oficial | Significado matemático | Unidad |
|---|---|---|---|---|---|
| 1 | R | R | Unidad de riesgo relativa, definida por operación | `Riesgo€ / Capital` en el momento de esa operación (02 §1) | Adimensional (relación) |
| 2 | R Final | `R_final` | Resultado ponderado final de una Operación cerrada o simulada | Suma ponderada de parciales + resto (02 §2, 21.5) | R |
| 3 | Parcial | `Partial` | Tramo de una Operación cerrado a un nivel de RR y % concretos | `(secuencia, RR_i, %_i)` (21.5 §4) | R + % |
| 4 | Plan de Gestión | `Management Plan` | Configuración reutilizable de gestión (RR objetivo, parciales, Break Even, condiciones) | Entity, Aggregate Root (21.5 §3.4) | — |
| 5 | Escenario | `Scenario` *(formalizado en este capítulo — no existía)* | Una configuración hipotética de entrada para una Simulación — Plan + contexto (`R_max` real o supuesto) | El *input* de `simularGestion` (26 §2.7) | — |
| 6 | Simulación | `Simulation` | El proceso de calcular un `R_final` hipotético a partir de un Escenario | La ejecución de la fórmula de R Final sobre un Escenario, no sobre un hecho real | — |
| 7 | Optimización | `Optimization` | Búsqueda de la configuración con mejor `Score` sobre un espacio de Escenarios candidatos | 02 §5, 27 §2.4 (incluye la variante restringida) | — |
| 8 | Esperanza / Expectativa | `Expectancy` | Media de `R_final` sobre una muestra (Trade Set) | `E[R]` (02 §4.2) | R o € |
| 9 | Consistencia | `Consistency` | Estabilidad de los resultados de una muestra, independiente de la preferencia de riesgo del usuario | `E[R] / σ[R]` (26 §2.4) | Adimensional |
| 10 | Riesgo (siempre calificado) | `Risk` *(nunca sin calificar, ver §3.3)* | Depende del calificador — nunca un término suelto | — | Depende del calificador |
| 11 | Drawdown Histórico | `Historical Drawdown` | Caída máxima de la curva de Equity ya ocurrida | 02 §4.4 | € o R |
| 12 | Estado de Drawdown | `Drawdown State` | Margen restante frente al piso vigente (estático/trailing/EOD) de una Cuenta, ahora mismo | 18 §2, 26 §2.6 | € y % |
| 13 | Recovery Factor | `Recovery Factor` | Retorno neto ajustado al máximo drawdown histórico | `Beneficio_neto / |Max_Drawdown_€|` (26 §2.4) | Adimensional |
| 14 | Curva de Equity | `Equity Curve` | Evolución acumulada del resultado de trading (solo operaciones, sin eventos de capital) | `Equity_t = Σ Beneficio_real_j` (02 §4.4) | € o R |
| 15 | Curva de Capital | `Capital Curve` *(distinguida de Equity Curve en este capítulo — ver §3.2)* | Evolución del `current_capital` real de la cuenta, incluyendo depósitos/retiradas/payouts | 15 §3.1 | € únicamente |
| 16 | Curva en R | `R Curve` | La Curva de Equity (nunca la de Capital) expresada en R acumuladas | Variante de unidad de #14 | R |
| 17 | Conjunto de Operaciones | `Trade Set` *(formalizado en este capítulo — no existía)* | Colección nombrada/filtrada de Operaciones usada como muestra de entrada de una función agregada | Input de Expectancy, Consistency, Distribución, etc. | N operaciones |
| 18 | Sesión de mercado | `Market Session` *(renombrado, ver §3.4)* | Franja horaria de mercado (Londres/NY/Asia) usada en análisis de comportamiento | 13 §5 | Tiempo |
| — | Sesión (autenticación) | `Session` | Sesión de usuario autenticado en el producto | 11 §9 | — |
| 19 | *(prohibido, ver §3.5)* | ~~`Strategy`~~ | — | — | — |
| 20 | Cuenta | `Account` | Unidad real de gestión de riesgo — capital, reglas, estado | 04, 18 | — |
| 21 | Perfil de Reglas | `RuleProfile` | Conjunto nombrado de reglas configurables que una Cuenta puede adoptar | 21.5 §3.6, 22 | — |
| 22 | Evaluación de Reglas | `Rule Evaluation` | El proceso de comparar un `Drawdown State` (y demás magnitudes) contra un `RuleProfileSnapshot` | 22 §5 | — |
| 23 | Instantánea / Snapshot | `Snapshot` | Copia inmutable de una Entity editable, capturada en el momento en que otra Entity la usa | 19 regla 13, 21.5 §2 | — |
| — | Operación | `Trade` | La ejecución real de un Plan en una Cuenta | 21.5 §3.5 | — |

## 3. Hallazgos de Challenge Mode (ambigüedades que no estaban resueltas antes de este capítulo)

### 3.1 "R" colisiona con el coeficiente de correlación estadístico

**Problema**: en estadística, "R"/"r" es la notación universal del coeficiente de correlación de Pearson. 27 §4 ya propone, como capacidad futura, "correlación entre cuentas" — el día en que se implemente, un desarrollador podría, sin pensarlo, llamar "R" al coeficiente de correlación, chocando de frente con el significado que "R" tiene en absolutamente todo el resto del producto.

**Regla**: cualquier coeficiente de correlación que el Quant Engine calcule en el futuro se llama siempre `Coeficiente de Correlación` (`CorrelationCoefficient`), en texto completo, nunca abreviado a "R" o "r" — ni en código, ni en UI, ni en documentación. Es una prohibición fijada antes de que la capacidad exista, no una corrección posterior.

### 3.2 "Curva de Capital" y "Curva de Equity" no son la misma curva

**Problema**: 02 §4.4 define `Equity_t` como la suma acumulada de solo el resultado de operaciones cerradas. 15 §3.1 mantiene `current_capital` como el capital real de la cuenta, que también se mueve con depósitos, retiradas y payouts (`account_capital_events`). Son la misma curva únicamente si la cuenta nunca tuvo un evento de capital — en cualquier cuenta con al menos un depósito o payout, divergen. Usar "Curva de Capital" y "Curva de Equity" como sinónimos (como el propio catálogo de 26 §2.5 hacía, sin decirlo explícitamente) es una ambigüedad real, no una elección de estilo.

**Regla**: se formalizan como dos entradas de diccionario distintas (#14 y #15). "Curva en R" (#16) es siempre una variante de la Curva de Equity — el capital depositado/retirado no tiene una expresión natural en R (R es relativo al riesgo de una operación, no al capital total de la cuenta), así que nunca existe una "Curva de Capital en R".

### 3.3 "Riesgo"/"Risk" nunca se usa sin calificar

**Problema**: "Riesgo" aparece en el blueprint como `Riesgo€` (02 §1), `Riesgo%` (input), "reglas de riesgo" (genérico, 18/22), y como parte del nombre `Risk Engine` (22.5/26) — cuatro significados relacionados pero distintos bajo la misma palabra suelta.

**Regla**: "Riesgo"/"Risk" jamás se usa como término aislado en código, eventos o interfaces — siempre con su calificador (`Riesgo€`, `Riesgo%`, `Estado de Drawdown`, o como parte del nombre propio `Risk Engine`, que es un nombre de módulo, no un término de vocabulario general).

### 3.4 "Session" es la ambigüedad más peligrosa del listado original

**Problema, el más serio de todo el capítulo**: "Session" ya tiene dos significados activos y no relacionados en el blueprint — sesión de mercado (Londres/NY/Asia, 13 §5, relevante para análisis de comportamiento) y sesión de autenticación de usuario (11 §9, "gestión de sesiones activas"). Son conceptos de dominios completamente distintos que compartirían el mismo nombre sin ninguna razón — el tipo de colisión que, dentro de dos o tres años, produce un bug real: alguien construye una función `getActiveSessions()` pensando en autenticación y otro desarrollador la reutiliza por error para franjas horarias de mercado.

**Regla**: `Session` (sin calificar) queda reservada en exclusiva para sesión de autenticación (11 §9) porque es el uso ya establecido en la práctica de la industria (gestión de sesiones de usuario). El concepto de franja horaria de mercado se renombra a `Market Session` (`Sesión de mercado` en español) — nunca "Session" a secas en ese contexto, sin excepción.

### 3.5 "Strategy" se prohíbe por completo — protege el invariante fundacional

**Problema, el de mayor riesgo filosófico**: el fundador incluyó "Strategy" en la lista de ejemplos a definir. Bajo Challenge Mode, no se define — **se prohíbe**. 01 §2.1 y 01 §5 ya establecieron que TradePilot "no es un backtester de estrategias" y que la línea fundacional del producto es no evaluar nunca la calidad de una entrada de mercado (I9, 23). Llamar "Strategy" a un Plan de Gestión, o a cualquier concepto del Quant Engine, sugiere — aunque sea sin querer — que el producto analiza o clasifica estrategias de entrada. No lo hace, y el vocabulario no puede sugerir lo contrario.

**Regla**: `Strategy`/"Estrategia" es un término prohibido en todo el vocabulario del Quant Engine, sin excepción y sin caso de uso legítimo — no es una ambigüedad que se resuelve calificándola (como "Riesgo" o "Session"), es un concepto que no debe existir en este dominio en absoluto.

### 3.6 "Funding Profile" se rechaza por proximidad peligrosa con "Funding Management"

**Problema**: el fundador no lo pidió como término nuevo explícitamente, pero es una alternativa razonable que alguien podría proponer más adelante para nombrar el `RuleProfile` (21.5 §3.6). Se rechaza aquí, antes de que se use: "Funding Profile" y "Funding Management" (el módulo de 22.5 que administra Empresa+Cuenta) comparten la primera palabra sin compartir responsabilidad — un `RuleProfile` es propiedad conceptual de Rule Engine (22.5 §2.4), Funding Management solo lo consume vía Snapshot. Nombrarlo "Funding Profile" invitaría a pensar que Funding Management lo genera o lo posee.

**Regla**: se mantiene `RuleProfile`/"Perfil de Reglas" (ya establecido desde 21.5) como único nombre válido — "Funding Profile" queda documentado aquí como término prohibido preventivamente, no como una corrección de algo que ya se usara mal.

### 3.7 "Expectation" es el cuarto nombre encontrado para la misma métrica

**Problema**: 26 §2.1 ya consolidó "Esperanza matemática"/"Expectancy" en una sola entrada. El listado de este capítulo introduce un tercer/cuarto nombre en inglés para el mismo concepto estadístico — "Expectation" es, en literatura general de estadística, el término formal para `E[X]`; "Expectancy" es el término específico de literatura de trading para la misma idea aplicada a resultados de operaciones. Son el mismo número.

**Regla**: se canoniza `Expectancy` (no "Expectation") como término técnico en inglés, por ser el estándar de la literatura de trading a la que este producto pertenece — "Expectation" queda prohibido como sinónimo, igual que ya lo estaban "RR conseguido"/"RR ponderada"/"Resultado final" desde 26 §2.1.

## 4. Ambigüedades eliminadas (resumen)

| Ambigüedad | Resuelta en | Solución |
|---|---|---|
| `R_final` con tres nombres distintos | 26 §2.1 | Consolidado, sinónimos prohibidos |
| Esperanza / Expectancy | 26 §2.1 | Consolidado |
| Break Even como función vs. parámetro | 21.5 §1.4, 26 §2.1 | Es parámetro (`be_trigger`), no función |
| Drawdown histórico vs. Drawdown de cumplimiento | 26 §2.6 | Dos entradas de diccionario distintas (#11, #12) |
| "Reglas" (Rule Engine) vs. "condiciones de ejecución" (Plan) | 21.5 §1.3 | Renombrado del campo del Plan |
| "Perfil de gestión" (Plan) vs. `profiles`/perfil bayesiano | 21.5 §1.3 | Renombrado a "Etiqueta de riesgo" |
| "R" vs. coeficiente de correlación | Este capítulo, §3.1 | Prohibición preventiva |
| Curva de Capital vs. Curva de Equity | Este capítulo, §3.2 | Dos entradas distintas |
| "Riesgo" sin calificar | Este capítulo, §3.3 | Regla de calificación obligatoria |
| "Session" (mercado vs. autenticación) | Este capítulo, §3.4 | Renombrado a "Market Session" para mercado |
| "Strategy" | Este capítulo, §3.5 | Prohibido por completo |
| "Funding Profile" vs. "Funding Management" | Este capítulo, §3.6 | Rechazado preventivamente |
| "Expectation" vs. "Expectancy" | Este capítulo, §3.7 | Canonizado "Expectancy" |

## 5. Términos prohibidos (lista consolidada)

`RR conseguido` · `RR ponderada` · `Resultado final` (como función) · `Expectation` · `Strategy`/`Estrategia` · `Funding Profile` · `Session` (para franja horaria de mercado) · `Riesgo`/`Risk` sin calificar · `Drawdown` sin calificar · `Recovery` (sin "Factor") · `Break Even` (como nombre de función de cálculo).

## 6. Cambios de nomenclatura recomendados (nuevos en este capítulo)

1. Formalizar `Trade Set`/"Conjunto de Operaciones" como tipo de dato de entrada oficial — reemplaza el uso informal de "muestra"/"histórico filtrado" repetido sin nombre propio en 02, 12, 26 y 27.
2. Formalizar `Scenario`/"Escenario" como el sustantivo de entrada de una Simulación, distinto del verbo/proceso "Simular" — no existía esta distinción antes de este capítulo.
3. Separar `Equity Curve` de `Capital Curve` en cualquier función o documentación que hoy las trate como intercambiables (revisar 26 §2.5 cuando se diseñen las firmas de función, sin cambiar su matemática).

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno directamente — protege que, dentro de 2-3 años, ningún desarrollador nuevo introduzca un bug de significado (llamar "Session" a lo que no es, o "R" a un coeficiente de correlación) que ningún test automático detectaría porque no es un error de sintaxis, es un error de vocabulario.

**¿Qué funcionalidades sobran?** No aplica — es un diccionario, no una lista de funciones.

**¿Qué funcionalidades faltan?** Dos conceptos que se usaban de forma informal sin nombre propio — `Trade Set` y `Scenario` — formalizados en §2 y §6.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que este diccionario es una herramienta de equipo, nunca algo que el usuario final perciba — ningún término técnico de esta lista (`Trade Set`, `RuleProfile`) debe aparecer literalmente en una pantalla del producto.

**¿Qué haría Linear para hacerlo más rápido?** Confirmaría que fijar este vocabulario ahora, antes de las interfaces públicas, ahorra exactamente el tipo de refactor de nombres que más tiempo consume tarde en la vida de un proyecto — renombrar un concepto usado en cien sitios es mucho más caro que nombrarlo bien una vez.

**¿Qué haría TradingView para hacerlo más intuitivo?** No aplica directamente — sin usuario final, la pregunta con sentido es si el propio equipo puede navegar el diccionario rápido; la tabla de §2 con Español/Inglés/Definición/Unidad en una fila está pensada exactamente para eso.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Confirmaría §3.5 sin dudarlo: ningún fondo profesional dejaría que su vocabulario interno sugiriera, aunque fuera sin querer, una capacidad que su producto no tiene y no debe tener (evaluar estrategias de entrada) — el lenguaje es parte del control de riesgo, no un detalle cosmético.

**Puntuación del capítulo**: **97/100**, empatando con 26 como la puntuación más alta del blueprint. Encontró siete ambigüedades reales no resueltas antes de este capítulo (§3.1-3.7), dos de ellas (Session, Strategy) con riesgo real de producir un error de producto o de posicionamiento, no solo de código.

**Nivel de madurez del capítulo**: 95%. El diccionario y las reglas están completos; falta únicamente la aplicación retroactiva de esta nomenclatura a los nombres de función informales usados en 26 (§6, punto 3), que se resuelve al diseñar las interfaces públicas, el siguiente paso.

---

## Cierre de capítulo

**Riesgos pendientes**: ninguno de las ambigüedades queda sin resolver — el riesgo transversal es de gobernanza (que el diccionario se respete en la implementación real), no de diseño.

**Decisiones abiertas**:
1. Si se retrofita el nombrado exacto de este diccionario sobre 26 (renombrar `calcularCurvaEquity` etc. a los nombres técnicos en inglés de §2) antes o durante el diseño de interfaces públicas — se recomienda hacerlo como parte del mismo paso, no como un capítulo aparte.
2. Si el diccionario se extiende a los módulos periféricos (Analytics, Notification, Media, Reporting, 22.5) en un capítulo propio, o si se cubre según se diseñe cada uno — no se fuerza aquí.

**Recomendación profesional**: aprobar el diccionario y las reglas del lenguaje. Es la pieza que faltaba para que "diseñar el Quant Engine" signifique lo mismo para cualquier persona que se incorpore al proyecto dentro de diez años — el objetivo exacto que el fundador fijó al abrir este capítulo. Con esto aprobado, el siguiente paso es, por fin, el diseño de las interfaces públicas del Quant Engine.
