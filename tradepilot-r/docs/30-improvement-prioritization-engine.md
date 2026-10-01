# 30 · Improvement Prioritization Engine — El Improvement Backlog

*Voz: Cofundador / Investigador de IA / Quant Trader — Challenge Mode obligatorio (19 §1.1). Último componente conceptual antes de las interfaces públicas del Quant Engine.*

## 0. Encuadre: por qué esto tampoco es un módulo nuevo

Mismo criterio que 29 §0: esto es la capa de **ranking** dentro de la política de AI Engine, no un componente nuevo. 29 §5 ya definía cinco condiciones de admisión (cuándo un patrón puede mostrarse) y una regla de desempate provisional ("se muestra el de mayor coste"). Este capítulo sustituye esa regla provisional por el modelo completo que el fundador pide — sigue sin añadir matemática nueva, solo compone Comparación (27 §2.3), Diagnóstico (27 §2.8) y el `DrawdownState` de Rule Engine (26 §2.6) en una función de prioridad explícita.

## 1. La pregunta central, formalizada

*"Si este trader solo pudiera mejorar una única cosa durante las próximas semanas, ¿cuál produciría el mayor impacto real?"* — se traduce en: de todos los candidatos que ya pasaron el filtro de admisión de 29 §5, ¿cuál tiene el mejor **ratio entre lo que se gana y lo que cuesta perseguirlo**, sin que perseguirlo empeore algo más importante en paralelo (§4)?

## 2. Modelo de priorización

### 2.1 Los ocho factores, agrupados por lo que miden

| Factor pedido | Qué mide | De dónde sale (sin matemática nueva) |
|---|---|---|
| Impacto esperado en R | Cuánto se recuperaría si el patrón se corrige | `Beneficio_sacrificado` agregado (26 §2.3) o Δ`E[R]` de la Comparación (27 §2.3) |
| Confianza estadística | Cuán fiable es el hallazgo | Ancho del intervalo de credibilidad (13 §2) |
| Frecuencia del error | Cuántas operaciones lo sufren | Tasa de Diagnóstico (27 §2.8) |
| Facilidad de cambio | Cuán grande es el ajuste pedido | Nº de parámetros del Plan que difieren entre el actual y el propuesto (26 §2.1) — a menor distancia, más fácil |
| Persistencia del problema | Si es un hábito sostenido o un evento puntual | Span temporal de las observaciones ponderadas por decaimiento (13 §4), no solo el conteo |
| Tiempo necesario para validar | Cuánto tardará en confirmarse el cambio | Operaciones/mes del trader en ese bucket ÷ tamaño de muestra necesario para confianza alta (13 §2) |
| Coste psicológico del cambio | Cuán incómodo es sostener el cambio | **Ver §2.3 — el factor menos fundamentado de los ocho, declarado como tal** |
| Riesgo de sobrecorrección | Si el cambio puede producir un problema nuevo peor | Magnitud del salto entre comportamiento actual y propuesto — **actúa como filtro, no como factor del ratio (§2.2)** |

### 2.2 Algoritmo conceptual

```
Beneficio(candidato) = Impacto_R × Confianza × Frecuencia
Coste(candidato)     = f(1/Facilidad, CostePsicológico, TiempoValidación)

Prioridad(candidato) = Beneficio(candidato) / Coste(candidato)
```

Un cociente, no una resta arbitraria de términos con pesos inventados — mismo estilo ya usado en `calcularRatioConsistencia` (26 §2.4): "cuánto se gana por unidad de esfuerzo/fricción", en vez de sumar magnitudes de naturaleza distinta como si fueran comparables directamente.

**El Riesgo de sobrecorrección no entra en el cociente — es una exclusión dura**: si un candidato supera un umbral de magnitud de cambio, no se penaliza numéricamente (bajaría su prioridad pero seguiría siendo elegible con suficiente Beneficio) — **se descalifica de mostrarse como está**. En su lugar, el sistema ofrece una versión **incremental** del mismo cambio (p. ej., no "pasa de cerrar el 100% en 1R a dejar correr hasta 6R", sino "prueba cerrar el 70% en 1R en vez del 100%, como primer paso") — más lento, pero sin el salto que dispara el riesgo de un problema nuevo. Es la respuesta directa a "busca situaciones donde una recomendación aparentemente correcta pueda perjudicar al trader" (Challenge Mode): un cambio que parece óptimo en el papel puede ser peligroso en la práctica si es demasiado grande de golpe, y limitar el tamaño del salto es más seguro que solo hacerlo "menos probable" de aparecer.

### 2.3 Honestidad sobre el "Coste psicológico" (Challenge Mode aplicado al propio modelo, no solo a la propuesta del fundador)

De los ocho factores, es el único que no tiene una medida directa observable — es un estado emocional, no un dato de `trades`. Se aproxima como el incremento de `σ[R]` (volatilidad, 26 §2.4) que produciría el cambio propuesto: sostener una posición más tiempo o aceptar un drawdown mayor aumenta la dispersión de resultados, que es lo más cercano a "incomodidad medible" que el sistema tiene sin preguntarle nada al trader. **Se declara explícitamente como la aproximación más débil del modelo** — no se le da el mismo peso de certeza que a Impacto_R o Confianza en ninguna comunicación al usuario, y se revisa como candidato a mejorar en cuanto exista una señal más directa (p. ej., si el trader alguna vez abandona un experimento a medias, eso es una señal real de coste psicológico que hoy no se está usando).

## 3. Improvement Backlog

Lista mantenida automáticamente, ordenada por Prioridad, de **todos** los candidatos que superan el filtro de admisión de 29 §5 y no están excluidos por el gate de sobrecorrección (§2.2).

**Reglas de exposición**:
- **Máximo 1-2 elementos "Activos" visibles para el trader, siempre — y esto es un límite global por usuario, no por cuenta ni por patrón.** Un trader con 8 cuentas no ve 8 experimentos en paralelo, sigue viendo 1-2 en total — la saturación se mide por carga cognitiva del trader, no por número de cuentas que gestiona.
- El resto del backlog está "En cola" — existe, se re-calcula, pero es invisible para el trader. Nadie ve una lista de veinte pendientes esperando su turno.
- **Un elemento Activo nunca se desplaza por un candidato nuevo de mayor prioridad** — una vez que el trader está en fase de validación de un cambio (29 §2), el sistema no le pide que cambie de foco a mitad de camino solo porque apareció algo con mejor ratio. La re-priorización afecta a la cola, nunca interrumpe lo que ya está activo. Es la decisión que evita que este capítulo produzca exactamente el "profesor pesado" que el capítulo 29 ya prohibió — un entrenador que cambia de ejercicio cada semana no forma a nadie.
- Cuando un Activo se Consolida o se descarta explícitamente, el siguiente de mayor Prioridad en la cola pasa a Activo.

**Cada elemento del backlog, sea Activo o En cola, mantiene los seis campos pedidos**:

| Campo | Contenido |
|---|---|
| Qué mejorar | El patrón detectado (Diagnóstico, 27 §2.8) |
| Por qué | Correlación causal (13 §5) |
| Cuánto cuesta no cambiarlo | `Impacto_R` en € y R |
| Qué ganancia potencial existe | `Beneficio` proyectado (§2.2), con la Predicción acotada de 27 §2.5/23 |
| Qué evidencia histórica lo respalda | Trade Set + intervalo de credibilidad (28 §2, 13 §2) |
| Cuándo considerar la mejora consolidada | El umbral de muestra/confianza necesario, comunicado **antes** de empezar el experimento — no solo al final (mejora respecto a 29, que no especificaba este momento de comunicación) |

## 4. Evitar optimizaciones locales que empeoren el rendimiento global

Dos salvaguardas concretas, no una declaración de intenciones:

1. **Cruce obligatorio contra el estado de riesgo de la Cuenta (18 §6, Rule Engine).** Ningún candidato que aumente `σ[R]` (más varianza, aunque mejore `E[R]`) puede activarse en una Cuenta cuyo semáforo esté en 🔴 (drawdown restante bajo) — aunque el candidato sea matemáticamente el de mejor Prioridad. Optimizar la esperanza de un bucket concreto mientras la cuenta entera está cerca de romper una regla de la prop firm es exactamente el tipo de optimización local que empeora el resultado global (perder la cuenta financiada pesa infinitamente más que cualquier mejora de esperanza puntual). El candidato permanece en la cola, no se descarta — se reactiva la evaluación en cuanto el semáforo mejore.
2. **La Frecuencia como salvaguarda ya incorporada contra micro-optimizaciones.** Un patrón con Impacto_R alto pero Frecuencia muy baja (ocurre en un bucket que el trader casi nunca usa) tiene un Beneficio total bajo por construcción (§2.2, Beneficio = Impacto × Confianza × Frecuencia) — el modelo ya evita, sin reglas adicionales, priorizar una mejora grande pero irrelevante sobre una mejora modesta en el patrón de gestión que el trader realmente usa la mayor parte del tiempo.

---

## Riesgos

1. **Coste psicológico es la aproximación más débil del modelo** (§2.3) — riesgo aceptado y declarado, no escondido; se revisa en cuanto exista una señal más directa.
2. **El gate de sobrecorrección podría excluir sistemáticamente los cambios de mayor impacto potencial** (los cambios grandes tienden a tener más distancia y, por tanto, más riesgo aparente) — mitigado por la respuesta de §2.2 (ofrecer la versión incremental en vez de descartar el hallazgo entero).
3. **Backlog invisible como fuente de desconfianza**: si el trader nunca sabe que el sistema "conoce" más patrones de los que le muestra, podría sentir que se le oculta información — se deja como decisión abierta (¿mostrar el tamaño del backlog aunque no su contenido?) en vez de forzar una respuesta sin datos de uso real.

## Casos límite

1. **Trader nuevo sin historial suficiente**: el backlog está vacío porque ningún candidato supera el filtro de confianza de 29 §5 — el sistema no fuerza contenido para no dejar el backlog "vacío de apariencia", coherente con el arranque en frío honesto de 13 §2.
2. **Múltiples cuentas, un solo backlog**: el límite de 1-2 Activos es del Usuario, no de cada Cuenta — ya resuelto en §3, se repite aquí como caso límite explícito porque es la pregunta más probable que alguien haga al implementar esto.
3. **Un Activo deja de ser válido a mitad de validación** (p. ej., el trader cambia de instrumento o de mercado de forma que la muestra posterior ya no es comparable con la anterior): el experimento se aborta sin penalizar al trader, y el patrón vuelve al backlog para reevaluarse con datos frescos cuando corresponda — no se fuerza una validación con datos que ya no son homogéneos.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Cierra el hueco que 29 dejó abierto a propósito: qué hacer cuando hay más de un patrón válido a la vez — sin esto, el sistema podría, sin querer, mostrar varios hallazgos válidos simultáneamente y convertirse en el "profesor pesado" que todo el capítulo 29 se esforzó en evitar.

**¿Qué funcionalidades sobran?** Ninguna de los ocho factores pedidos se descartó — los ocho entran en el modelo, con el Riesgo de sobrecorrección tratado de forma distinta (gate, no factor del ratio) por una razón explícita, no por conveniencia.

**¿Qué funcionalidades faltan?** El momento de comunicar "cuándo se considera consolidado" **antes** de empezar el experimento (§3) — 29 lo calculaba pero no especificaba cuándo se le decía al trader; se añade aquí como mejora de transparencia.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que el trader nunca vea "Prioridad: 3.4" ni ningún número del ranking — ve un único candidato Activo, sin competencia visible con otros, como si fuera la única cosa que existe en ese momento. Toda la maquinaria de ranking es invisible por diseño, coherente con 29.

**¿Qué haría Linear para hacerlo más rápido?** Confirmaría que recalcular el backlog completo en cada evento (13 §3, actualización incremental) es barato — es una re-evaluación de un ratio sobre datos ya cacheados, no una búsqueda pesada.

**¿Qué haría TradingView para hacerlo más intuitivo?** Preguntaría si mostrar la posición del candidato Activo dentro del backlog completo (aunque sea "hay 2 más esperando, después de este") ayuda a que el trader confíe en que el sistema tiene más que ofrecer sin saturarlo ahora — es exactamente el Riesgo #3, aquí spawneado como sugerencia de diseño, no resuelto.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §4: nunca optimizar una métrica local (la esperanza de un bucket) sin comprobar contra el estado de riesgo global (si la cuenta está cerca de un límite de la prop firm) — es la misma disciplina de gestión de riesgo de cartera que un desk profesional aplicaría antes de perseguir cualquier "mejora" aislada.

**Puntuación del capítulo**: **95/100**. El gate de sobrecorrección con respuesta incremental (en vez de exclusión pura) y el cruce contra el semáforo de Rule Engine (§4) son las dos piezas que de verdad responden a "evita optimizaciones locales que empeoren lo global" con un mecanismo concreto, no una declaración. Los 5 puntos restantes son la honestidad declarada sobre el coste psicológico (§2.3) y la decisión de transparencia del backlog sin resolver (Riesgo #3).

**Nivel de madurez del capítulo**: 93%. El modelo, el backlog y las salvaguardas están completos; falta calibrar los umbrales exactos (qué cuenta como "salto grande" en el gate de sobrecorrección, qué nivel de semáforo bloquea qué tipo de candidato) con datos reales de uso, no con estimaciones de diseño.

---

## Cierre de capítulo

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea aprobar el modelo; el #1 y el #3 requieren datos reales de uso para resolverse con certeza, no diseño adicional.

**Decisiones abiertas**:
1. Si se muestra al trader el tamaño del backlog en cola (Riesgo #3) — no se fuerza aquí, es una decisión de transparencia de producto, no de arquitectura.
2. Calibración exacta de los umbrales del gate de sobrecorrección y del cruce con el semáforo de cuenta (§4) — se fija con la primera cohorte de datos reales, no a priori.

**Recomendación profesional**: aprobar el Improvement Prioritization Engine. Con este capítulo, el Trader Improvement Engine (29) deja de depender de una regla de desempate provisional y pasa a tener un modelo de priorización completo, con una salvaguarda real contra el mayor riesgo que Challenge Mode podía encontrar en un sistema de este tipo: optimizar una cosa mientras se ignora que otra, más importante, está en peligro. No queda ningún capítulo conceptual pendiente — el diseño de las interfaces públicas del TradePilot Quant Engine puede comenzar.
