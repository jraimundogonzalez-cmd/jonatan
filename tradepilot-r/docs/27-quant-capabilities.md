# 27 · Quant Capabilities — Catálogo de Capacidades del TradePilot Quant Engine

*Voz: Quant Trader + Matemático + Product Architect — Challenge Mode obligatorio (19 §1.1). Última fase de diseño del Quant Engine antes de las interfaces públicas. Sin firmas de función todavía — catálogo de preguntas, no de funciones.*

> **Nota de numeración**: el fundador nombró este documento "Capítulo 25" en su mensaje — ese número ya lo ocupa 25-arquitectura-tecnica-plataforma.md (aprobado). Se numera **27** para no romper la secuencia de capítulos ya aprobados; el contenido es exactamente el pedido.

## 0. Encuadre

No se listan funciones (`calcularRFinal`, etc. — eso es 26 §2). Se listan **preguntas** que un trader profesional debe poder hacerle al Quant Engine y obtener respuesta con precisión absoluta. Cada pregunta se resuelve, en el diseño técnico posterior, componiendo una o varias funciones del catálogo de 26 — este capítulo no inventa matemática nueva, ordena **qué debe ser capaz de responder** el motor antes de decidir cómo.

## 1. Challenge Mode — el hallazgo más importante: la categoría "Predicción" es peligrosa si no se acota antes de catalogar nada

**Problema detectado**: el fundador pide una categoría "Predicción" sin ejemplos que la ilustren. Es, de las nueve categorías pedidas, la única que puede chocar de frente con un invariante ya aprobado — I9 (23): *"TradePilot nunca evalúa ni opina sobre la calidad de una entrada de mercado."* Una categoría "Predicción" mal acotada invita, con el tiempo, a capacidades como "¿qué probabilidad tiene esta operación de llegar a mi TP?" — eso **es** predicción de mercado, prohibida sin excepción, y ningún nombre de categoría puede abrir esa puerta por accidente de vocabulario.

**Solución propuesta**: "Predicción", en el Quant Engine, significa exclusivamente **proyectar el comportamiento estadístico propio del trader hacia adelante**, nunca el precio. Concretamente: dado un Plan y el histórico de `R_max` del propio usuario en ese bucket, proyectar la distribución de `R_final` esperable en las próximas operaciones — es una extensión directa de `calcularEsperanza` (26 §2.4) aplicada de forma prospectiva sobre datos ya observados del propio usuario, nunca sobre datos de mercado no ocurridos todavía.

**Por qué es mejor que la alternativa (dejar la categoría abierta a interpretación)**: acotarla ahora, antes de catalogar una sola capacidad bajo ese nombre, evita que dentro de un año alguien proponga "predicción de si esta operación ganará" como una extensión natural de la categoría — no lo sería, sería una ruptura de I9 disfrazada de evolución incremental de una categoría ya aceptada.

**Impacto futuro sobre el producto**: toda capacidad de "Predicción" en el catálogo de §2 se construye exclusivamente sobre el histórico propio del usuario (13 §1, aprendizaje 100% privado) — nunca sobre datos de mercado, indicadores técnicos, ni el activo concreto de una operación futura.

## 2. Catálogo completo de capacidades

Cada fila: qué necesita · qué devuelve · quién la consume · si es determinista o depende de versión de algoritmo.

### 2.1 Cálculo

| Capacidad (pregunta) | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Cuál fue mi R final de esta operación? | `PlanSnapshot`, parciales ejecutados, `R_max` | `R_final` | Risk Engine, Analytics, Dashboard | Determinista, sin versión |
| ¿Cuál fue mi beneficio real / sacrificado en €? | `Riesgo€`, `R_final`, `RR_obj` | `Beneficio_real`, `Beneficio_sacrificado` | Risk Engine, Analytics, Dashboard, Reporting | Determinista, sin versión |
| ¿Qué % de mi recorrido a favor conservé? | `R_final`, `R_max` | `%_conservado` | Analytics, Dashboard, AI Engine (explicación) | Determinista, sin versión |
| ¿Cuál es mi Profit Factor / Win Rate / Recovery Factor de este período? | Muestra de `R_final`/`Beneficio_real` filtrada | Los tres agregados (26 §2.4) | Analytics, Dashboard, Reporting | Determinista, sin versión |

### 2.2 Simulación (incluye la pregunta #2 y #5 del fundador — replay contrafactual)

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Qué R habría obtenido si hubiera cerrado un 20% en 1.2R? | `R_max` real de la operación, configuración hipotética de parciales | `R_final` hipotético (misma fórmula de 26 §2.3, aplicada a un input distinto) | Dashboard (Replay de gestión, 17 §3.1), AI Engine | Determinista, sin versión — es la misma fórmula, no una nueva |
| ¿Qué habría ocurrido si hubiera movido Break Even antes? | `R_max` real, `be_trigger` alternativo | `R_final` hipotético | Ídem | Ídem |
| ¿Cómo cambia mi curva de capital si aplico esta gestión a mi histórico? | Muestra de `R_max` históricos, Plan hipotético | `calcularCurvaEquity` recalculada sobre resultados simulados | Analytics, Dashboard | Determinista, sin versión |

**Nota de diseño**: toda capacidad de Simulación es, técnicamente, `simularGestion` (26 §2.7) aplicada a un input distinto del real — no se cataloga como matemática nueva, se cataloga como una pregunta de negocio que compone una función ya existente.

### 2.3 Comparación

**Aclaración de si es redundante o no (Challenge Mode)**: comparar dos números ya calculados no necesitaría catálogo propio — sería trivial. Lo que hace a "Comparación" una categoría real, no derivable sin más, es que una comparación seria debe responder también *"¿es esta diferencia real o es ruido dado mi tamaño de muestra?"* — usa el mismo aparato de intervalos de credibilidad ya construido en 13 §2, aplicado ahora a la diferencia entre dos resultados, no a un único resultado.

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Qué Plan tiene mejor esperanza, A o B? | Dos muestras de `R_final` (una por Plan, sobre el mismo histórico de `R_max`) | `E[R]` de cada uno + si la diferencia es significativa dado el tamaño de muestra | AI Engine (explicaciones, 06 §3), Analytics | Determinista, sin versión |
| ¿Cómo se compara mi gestión de este trimestre con el anterior? | Dos muestras de `R_final` por periodo | Ídem | Dashboard, Reporting | Determinista, sin versión |

### 2.4 Optimización

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Qué gestión maximiza mi esperanza matemática? | Muestra de `R_max` histórico, espacio de configuraciones candidatas, `λ` | Configuración con mejor `Score` (26 §2.7) | Optimizer (orquestador de la búsqueda), AI Engine | Depende de `algorithm_version` (fórmula de `Score`, 15 §3.5) |
| ¿Qué % de parcial es óptimo para este recorrido? | Igual, caso de una sola variable | Ídem, espacio reducido | Ídem | Ídem |
| ¿Qué configuración maximiza beneficio manteniendo un drawdown objetivo? *(capacidad nueva, distinta de las dos anteriores — ver nota)* | Igual + un límite de drawdown como **restricción dura**, no como penalización | Configuración que maximiza `E[R]` sujeta a `σ[R]` (o el drawdown simulado) ≤ límite | Optimizer, AI Engine | Depende de `algorithm_version` |

**Por qué la tercera fila es una capacidad genuinamente distinta, no una variación menor**: el `Score` existente (`E − λσ`, 02 §5.2) es optimización **penalizada** — la varianza resta puntos, pero ninguna configuración queda excluida por sí sola. Un trader con una regla dura de la prop firm ("nunca puedo superar el X% de drawdown, sin excepción") necesita optimización **restringida** — un problema matemático distinto (maximizar sujeto a una restricción, no a una penalización). Se cataloga como capacidad nueva porque exige una variante real del algoritmo de búsqueda, no solo un ajuste de `λ`.

### 2.5 Predicción (acotada según §1 — nunca sobre mercado)

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Cuál es mi beneficio esperado usando este Plan durante las últimas 300 operaciones? | Plan, muestra de las últimas 300 `R_max` del propio usuario | `E[R]`/`E[€]` proyectado sobre esa muestra (simulación + estadística compuestas) | AI Engine, Dashboard | Determinista, sin versión |
| Dado mi patrón histórico, ¿qué esperanza es probable que obtenga en mis próximas operaciones con este Plan? | Muestra histórica propia, bucket de RR (13 §2) | Proyección con intervalo de credibilidad (nunca un número seco) | AI Engine (explicaciones) | Depende de `algorithm_version` si cambia la función de decaimiento (13 §4) |

**Lo que esta categoría nunca responde, explícitamente**: la probabilidad de que una operación concreta llegue a su TP, o cualquier variante de "¿va a ganar esta operación?" — eso es predicción de mercado, prohibida por I9 sin excepción, y ninguna capacidad de este catálogo la ofrece bajo ningún nombre.

### 2.6 Estadística

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Cuál es la distribución estadística de mis resultados? | Muestra de `R_final` | `calcularDistribucionR` (26 §2.4) | Analytics, Dashboard, Replay de gestión | Determinista, sin versión |
| ¿Cuál es la volatilidad de mis R? | Muestra de `R_final` | `σ[R]` (ya usado internamente por el Score y el Ratio de Consistencia, 26 §2.4 — aquí se expone como capacidad de primera clase, no solo como término intermedio) | Analytics, Dashboard | Determinista, sin versión |
| ¿Cuál es mi consistencia real? | Muestra de `R_final` | `calcularRatioConsistencia` (`E[R]/σ[R]`, 26 §2.4) | Analytics, Dashboard, AI Engine | Determinista, sin versión |

### 2.7 Riesgo (reafirma Calcular ≠ Juzgar, 19 regla 14, una vez más)

**Aclaración obligatoria**: esta categoría calcula magnitudes de riesgo — nunca decide si son aceptables. "¿Cuál es mi drawdown restante?" es Quant Engine; "¿estoy incumpliendo una regla de mi prop firm?" es Rule Engine, que consume el resultado de esta categoría sin recalcularlo (19 regla 14, 26 §0).

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Cuál es mi drawdown restante ahora mismo? | `current_capital`, `peak_capital`, `RuleProfileSnapshot` (tipo estático/trailing/EOD) | `calcularDrawdownState` (26 §2.6) | Rule Engine (para juzgar), Dashboard (semáforo, 17 §4) | Determinista, sin versión |
| ¿Cuál fue mi máximo drawdown histórico, en € y en R? | Curva de equity | `calcularDrawdownHistorico` (26 §2.5) | Analytics, Dashboard, Reporting | Determinista, sin versión |
| ¿Cuál es mi Recovery Factor? | Beneficio neto acumulado, Max Drawdown | `calcularRecoveryFactor` (26 §2.4) | Analytics, Dashboard | Determinista, sin versión |

### 2.8 Diagnóstico

**Por qué no es lo mismo que Comparación (Challenge Mode, distinción explícita)**: Comparación necesita que el usuario elija qué comparar (dos Planes, dos periodos). Diagnóstico busca, dentro de una sola fuente de datos, **dónde está el problema** sin que el usuario tenga que saber qué preguntar — es la categoría más cercana a lo que hace valioso al producto frente a un journal genérico (09 §6).

| Capacidad | Necesita | Devuelve | Consumida por | Determinismo |
|---|---|---|---|---|
| ¿Qué parcial de mi Plan actual aporta menos a mi esperanza? | Historial de operaciones con ese Plan | Ranking de contribución por parcial (extensión de `calcularImpactoPorParcial`, 26 §2.3, agregado sobre muestra) | AI Engine, Dashboard | Determinista, sin versión |
| ¿En qué bucket de RR objetivo pierdo más beneficio sacrificado? | Historial completo, segmentado por bucket (13 §2.1) | Ranking de `Beneficio_sacrificado` agregado por bucket | AI Engine, Analytics | Determinista, sin versión |
| ¿Mi patrón se parece más a "cierro pronto" o "dejo correr de más"? | `%_conservado` medio, distribución de `R_final` vs. `R_max` | Clasificación descriptiva (no juicio, solo dato — coherente con I14, nunca bloquea ni opina) | AI Engine (explicaciones) | Determinista, sin versión |

### 2.9 IA (consumidora, nunca calculadora)

No añade capacidades nuevas — es una restricción sobre cómo se consumen las anteriores, reafirmada aquí porque el fundador la pidió como categoría explícita: **AI Engine puede leer cualquier salida de las categorías 2.1-2.8, nunca puede recalcularlas por su cuenta ni con su propia lógica** (19 regla 14, 06 §1). Su única capacidad propia es traducir esas salidas a lenguaje natural (06 §3) — no computar ninguna de ellas.

## 3. Dependencias (qué componente consume qué categoría)

| Categoría | Consumidores principales |
|---|---|
| Cálculo | Risk Engine, Analytics, Dashboard, Reporting |
| Simulación | Dashboard (Replay de gestión), AI Engine |
| Comparación | Analytics, AI Engine, Reporting |
| Optimización | Optimizer, AI Engine |
| Predicción | AI Engine, Dashboard |
| Estadística | Analytics, Dashboard, AI Engine |
| Riesgo | Rule Engine, Dashboard, Analytics, Reporting |
| Diagnóstico | AI Engine, Dashboard |
| IA (consumidora) | AI Engine únicamente, y solo como lector |

Ningún componente fuera de esta tabla puede llamar directamente al Quant Engine sin pasar por su propio contrato (22.5 §4) — la tabla no crea excepciones a las dependencias prohibidas ya fijadas.

## 4. Capacidades futuras (horizonte de 5 años, no se construyen ahora)

- **Análisis de sensibilidad**: ¿cuánto cambia mi esperanza si ajusto un solo parámetro del Plan un 10%? — útil para entender qué parámetro importa más antes de cambiarlo.
- **Correlación entre cuentas**: ¿mis cuentas ganan/pierden los mismos días, exponiéndome a un riesgo agregado mayor del que parece viendo cada una por separado? — capacidad natural para el Dashboard Maestro (18 §6) que no existía en ningún catálogo anterior.
- **Simulación Monte Carlo sobre la distribución histórica**: en vez de un único cálculo de Max Drawdown histórico, miles de re-muestreos aleatorios de la propia distribución de `R_max` para estimar la probabilidad de una racha de drawdown severa — más robusto que un solo dato histórico.
- **Detección de degradación de la ventaja ("edge decay")**: ¿está bajando mi esperanza matemática de forma sostenida más allá del ruido normal? — alerta temprana, no predicción de mercado (sigue el mismo límite de §1: analiza el propio historial, nunca el precio).

## Riesgos de diseño

1. **La categoría Predicción sigue siendo la de mayor riesgo de deriva futura** — cualquier capacidad nueva propuesta bajo ese nombre debe pasar explícitamente por el filtro de §1 antes de aceptarse, no solo la primera vez.
2. **Solape aparente entre Comparación y Diagnóstico** — ya distinguido en §2.8, pero es una frontera que un ingeniero nuevo puede volver a confundir; se recomienda que el criterio quede en el glosario técnico del propio Quant Engine, no solo en este capítulo.
3. **Explosión combinatoria de capacidades compuestas**: preguntas como la de "beneficio esperado con este Plan en las últimas 300 operaciones" combinan Simulación + Estadística + un filtro temporal — el riesgo es que cada combinación futura se trate como una capacidad nueva en vez de una composición de las ya existentes. Mitigación: toda capacidad propuesta se justifica primero como composición del catálogo actual antes de aceptarse como primitiva nueva.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno de forma directa — asegura que, cuando se diseñen las interfaces públicas del Quant Engine, ninguna pregunta razonable de un trader profesional se quede sin respuesta ni se resuelva reimplementando matemática ya existente.

**¿Qué funcionalidades sobran?** Ninguna capacidad del pedido original se descartó — las nueve categorías se mantienen, con dos (Predicción, Comparación/Diagnóstico) acotadas explícitamente para que no se conviertan en fuente de ambigüedad o de riesgo filosófico.

**¿Qué funcionalidades faltan?** La optimización restringida por drawdown objetivo (§2.4, tercera fila) es una capacidad genuinamente nueva que el pedido original mencionaba pero que no encajaba en el Score existente sin una variante real de algoritmo — identificada y añadida con su justificación.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que estas 9 categorías y ~20 capacidades nunca deben ser visibles como taxonomía para el usuario — se traducen en botones y frases naturales ("Simula otro cierre", "Compara con el trimestre pasado"), nunca en un menú "Diagnóstico vs. Estadística".

**¿Qué haría Linear para hacerlo más rápido?** Confirmaría que las capacidades de Simulación (§2.2) son baratas por diseño — son la misma fórmula de `R_final` aplicada a un input distinto, así que un usuario puede probar 10 escenarios de "qué habría pasado si" sin percibir ninguna espera.

**¿Qué haría TradingView para hacerlo más intuitivo?** Reutilizaría la misma visualización sobre el eje de R (17 §3.1, Replay de gestión) para las capacidades de Simulación y Diagnóstico — mismo lenguaje visual para "qué pasó" y "qué habría pasado si", coherencia entre pantallas sin coste adicional de diseño.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente lo que motivó §1: cualquier fondo profesional traza una línea infranqueable entre "estadística sobre mi propio libro" (permitido, valioso) y "predicción de mercado" (un negocio completamente distinto, con su propia regulación y su propio riesgo) — y no deja que una categoría de producto mal nombrada difumine esa línea con el tiempo.

**Puntuación del capítulo**: **96/100**. El hallazgo de la categoría Predicción es exactamente el tipo de riesgo que Challenge Mode debe encontrar antes de que se convierta en una funcionalidad real — y la optimización restringida es una capacidad genuina que el catálogo anterior no cubría. Los 4 puntos restantes son los riesgos de deriva de nomenclatura (§Riesgos), inevitables en un catálogo conceptual sin implementación todavía.

**Nivel de madurez del capítulo**: 93%. El catálogo está completo, clasificado y con sus fronteras filosóficas explícitas; falta la composición formal de capacidades complejas a partir de primitivas (Riesgo #3), que pertenece al diseño técnico detallado, no a este documento.

---

## Cierre de capítulo

**Riesgos pendientes**: los 3 de "Riesgos de diseño" — ninguno bloquea aprobar el catálogo, los 3 son disciplina de gobernanza a vigilar según el catálogo crezca.

**Decisiones abiertas**:
1. Si la optimización restringida por drawdown (§2.4) se implementa en el mismo componente Optimizer que la optimización penalizada actual, o si merece un sub-componente propio — se decide en el diseño técnico detallado del Optimizer, no aquí.
2. Si alguna de las "Capacidades futuras" (§4) entra en el alcance del MVP técnico o queda genuinamente pospuesta — sujeto al roadmap de 07, no se fuerza aquí.

**Recomendación profesional**: aprobar el catálogo de capacidades. Es la validación final de que el Quant Engine, antes de escribir una sola interfaz pública, sabe responder cualquier pregunta razonable que un trader profesional pueda hacerse — y, más importante, sabe con precisión cuáles preguntas **no** debe responder nunca (predicción de mercado, juicio de cumplimiento). Con esto aprobado, el siguiente paso es el diseño de las interfaces públicas del Quant Engine, tal como el fundador indicó al cierre de su mensaje.
