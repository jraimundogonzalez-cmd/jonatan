# SPEC-007 · TradePilot Analytics Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 04 §5 (vistas materializadas), 05 §3 (vistas agregadas como vistas materializadas, no cómputo on-the-fly), 11 §2 (Dashboard como proyección de lectura pura), 18 §6 (Dashboard Maestro, ya aprobado), 22.5 §2.8 (contrato de Analytics — corregido aquí, §2), 22.5 §2.13 (Reporting Engine — frontera reafirmada, §9), 22.5 §5 (Analytics ≠ Reporting Engine, ya establecido), 25 §5 (riesgo de refresco de vistas materializadas a gran volumen, resuelto aquí), 26 §2 (catálogo matemático — única fuente de KPIs), 28 §2 (Trade Set, reutilizado como mecanismo de filtro), 32 §4 (mapa de comunicación), 19 I16 (Zero Friction — aplicado explícitamente en §10), SPEC-001 (Quant Engine, Explainable Quant), SPEC-002 (Operations Engine — hallazgo de etiquetas, §8), SPEC-003 (Funding Management), SPEC-004 (Rule Engine), SPEC-006 (Knowledge Engine)
**No re-abre ninguna decisión conceptual ya aprobada.** El hallazgo principal (§4) elimina redundancia antes de construirla — no rediseña nada ya aprobado.

---

## 1. Objetivo del componente

### 1.1 Misión

Analytics Engine es la capa oficial de lectura de TradePilot: transforma hechos y conocimiento ya producidos por otros módulos en información visual, comprensible y accionable. No es una fuente de verdad — es la única forma en que el resto del sistema **se ve a sí mismo**.

### 1.2 Qué nunca debe hacer

1. **Nunca modifica datos.** Cero escritura, en ningún módulo, incluido el suyo propio más allá de sus propias vistas materializadas de caché (§5) — reafirma 22.5 §2.8 ("incapaz de mutar nada, por contrato").
2. **Nunca calcula reglas.** No interpreta límites de una prop firm — eso es Rule Engine (SPEC-004); Analytics solo visualiza su veredicto ya calculado.
3. **Nunca genera conocimiento.** No descubre patrones — eso es Knowledge Engine (SPEC-006); Analytics solo visualiza lo ya descubierto. Esta es la separación que el fundador acaba de elevar a decisión permanente: *Knowledge descubre, Analytics presenta*.
4. **Nunca optimiza.** No busca mejores configuraciones — eso es Optimizer (SPEC-005).
5. **Nunca toma decisiones.** No prioriza, no recomienda, no sugiere — es I17 (Evaluate ≠ Execute) en su forma más pasiva de todo el blueprint: Analytics ni siquiera produce un veredicto, solo **muestra** los que otros ya produjeron.
6. **Nunca recalcula una fórmula que otro módulo ya calculó.** Es el requisito central de este documento (§2, §4) — una violación de esta regla es, por definición, la reaparición del riesgo de "formula drift" que SPEC-001 §Riesgos #1 ya advirtió, ahora en su forma más peligrosa: una segunda implementación de un KPI, visible directamente al trader.

### 1.3 Responsabilidades

- Mantener el **Catálogo Oficial de KPIs** (§3) — una única definición trazable por métrica, sin excepción.
- Mantener las vistas materializadas de lectura (§5), refrescadas de forma incremental, nunca recalculadas por completo en cada consulta.
- Proveer el motor de consulta genérico (filtros, agrupaciones, drill-down, series temporales — §6-7) sobre el que se construye cualquier dashboard.
- Mantener el catálogo de dashboards y visualizaciones (§8), cada uno con una pregunta que justifica su existencia — ninguno decorativo.
- Aplicar I16 de forma medible: cualquier dato importante accesible en ≤3 interacciones (§10).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Calcular cualquier fórmula del catálogo de Quant Engine | Quant Engine (SPEC-001) |
| Representar el estado real de capital | Funding Management (SPEC-003) |
| Juzgar cumplimiento de reglas | Rule Engine (SPEC-004) |
| Descubrir y mantener conocimiento sobre el comportamiento del trader | Knowledge Engine (SPEC-006) |
| Buscar mejores configuraciones | Optimizer (SPEC-005) |
| Generar artefactos exportables estáticos (CSV/PDF, TradeVault, resumen fiscal-ready) | Reporting Engine (22.5 §2.13) — Analytics provee el Catálogo de KPIs que Reporting Engine consume, nunca genera el artefacto final (§9, frontera reafirmada) |

---

## 2. Corrección de contrato (22.5 §2.8)

**Actualización**: la fila "Escucha" de 22.5 §2.8 decía "todos los eventos de dominio relevantes" sin enumerarlos — se precisa aquí, incorporando los eventos nuevos que SPEC-004 y SPEC-006 introdujeron después de que 22.5 se escribiera: `ReglaIncumplida` (SPEC-004), `ConocimientoDescubierto`/`ConocimientoDebilitado`/`ConocimientoDescartado` (SPEC-006), además de los ya vigentes de Operations Engine y Funding Management (21.5 §7). El contrato no cambia de forma, se cierra la lista que quedó abierta.

---

## 3. El Catálogo Oficial de KPIs — una métrica, una definición, un dueño

### 3.1 Por qué es el requisito central de este documento

El fundador lo dice sin ambigüedad: *"No podrán existir dos formas distintas de calcular la misma métrica."* Esto no es una aspiración de calidad de código — es una restricción de esquema. Cada KPI que cualquier dashboard puede mostrar existe como **una sola fila** en un registro, trazable a **una sola función de origen** en **un solo módulo**:

```sql
create table public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                    -- 'expectancy', 'consistency_ratio', 'profit_factor', 'r_final_distribution', ...
  name text not null,                            -- nombre oficial del diccionario (28)
  source_module text not null check (source_module in (
    'quant_engine','funding_management','operations_engine','rule_engine','knowledge_engine'
  )),
  source_function text not null,                  -- p.ej. 'calcularEsperanza' — trazabilidad exacta, nunca ambigua
  unit text not null check (unit in ('r','eur','pct','count','ratio','days','seconds')),
  aggregation_levels text[] not null,              -- {'operation','account','company','global'}
  valid_group_by text[] not null default '{}'       -- dimensiones válidas de desglose — §6
);
```

**Ningún subcomponente de Analytics puede calcular un valor que no provenga de una fila de esta tabla.** Es la cuarta vez que este mismo patrón arquitectónico — un catálogo pequeño de primitivas, con extensión por datos y nunca por código — resuelve el problema de variedad sin duplicación en este blueprint: los 7 arquetipos de Rule Engine (SPEC-004), las estrategias *ask/tell* de Optimizer (SPEC-005), los 4 arquetipos de detector de Knowledge Engine (SPEC-006), y ahora el Catálogo de KPIs de Analytics. No es casualidad — es la misma lección de 22 §1 (Notion/Linear/Stripe/Shopify: pocas primitivas, composición sin límite), aplicada por cuarta vez de forma independiente porque es, sencillamente, la respuesta correcta a este tipo de problema.

### 3.2 Contenido inicial del catálogo (extracto — no exhaustivo, reutiliza el nombre oficial de 26/28 sin excepción)

| `key` | Módulo origen | Función origen |
|---|---|---|
| `r_final` (por operación) | Quant Engine | `calcularRFinal` |
| `expectancy` | Quant Engine | `calcularEsperanza` |
| `consistency_ratio` | Quant Engine | `calcularRatioConsistencia` |
| `profit_factor` | Quant Engine | `calcularProfitFactor` |
| `win_rate` | Quant Engine | `calcularWinRate` |
| `recovery_factor` | Quant Engine | `calcularRecoveryFactor` |
| `max_streak` | Quant Engine | `calcularRachaMaxima` |
| `r_distribution` | Quant Engine | `calcularDistribucionR` |
| `equity_curve` / `capital_curve` | Quant Engine / Funding Management | `calcularCurvaEquity` / ledger de capital (SPEC-003 §6) — **dos KPIs distintos, nunca uno** (28 §3.2, ya vigente) |
| `drawdown_historico` | Quant Engine | `calcularDrawdownHistorico` |
| `drawdown_restante` | Risk Engine (orquesta Quant Engine) | `calcularDrawdownState` — vía Risk Engine, nunca calculado por Analytics (mismo principio ya fijado para Funding Management, SPEC-003 §5.3) |
| `current_capital` / `peak_capital` | Funding Management | Hechos directos (SPEC-003 §5.1) |
| `compliance_status` | Rule Engine | `consultarEstadoCumplimiento` (SPEC-004 §12) |
| `compliance_history` | Rule Engine | Lectura de `rule_evaluations` (SPEC-004 §2.2) |
| `active_knowledge_items` | Knowledge Engine | `consultar` (SPEC-006 §8) |

**Ningún KPI de esta tabla se calcula dos veces con dos nombres.** Si un futuro dashboard necesita "Rentabilidad", esa palabra debe resolverse a exactamente uno de los `key` de arriba antes de aceptarse — nunca se introduce como una etiqueta nueva sin verificar contra el diccionario oficial (28), mismo principio que 28 ya estableció para todo el producto, aplicado aquí a nivel de esquema.

---

## 4. Hallazgo principal: seis "pantallas" pedidas son una sola, parametrizada distinto

**Problema detectado, aplicando Challenge Mode antes de construir nada**: el fundador pide preparar visualización para "una cuenta, varias cuentas, empresas completas, comparativas entre empresas, evolución histórica, evolución por Market Session, evolución por instrumento, evolución por Plan de Gestión, evolución por etiquetas" — leído literalmente, invita a construir hasta nueve pantallas distintas. No hace falta, y construirlas todas sería la definición exacta de "dashboards redundantes" que el propio fundador pide encontrar y eliminar.

**Solución aplicada**: todas estas variantes son la **misma consulta genérica** (§6, `AnalyticsQuery`) con distintos valores de `scope` y `group_by` — nunca pantallas ni lógica de agregación independientes:

| Petición del fundador | Cómo se resuelve |
|---|---|
| Una cuenta / varias cuentas / empresa completa | `scope: { level, ids }` — mismo motor, distinto alcance |
| Comparativa entre empresas | `group_by: "company"` sobre el mismo motor — **no es una pantalla nueva**, es la vista por empresa que el Dashboard Maestro (18 §6) ya mostraba en su tabla, ahora generalizada como agrupación reutilizable en cualquier consulta |
| Evolución histórica | `time_series: { granularity }` sobre cualquier KPI — no una pantalla, un parámetro |
| Evolución por Market Session / instrumento / Plan de Gestión / etiqueta | `group_by: "market_session" \| "instrument" \| "management_plan" \| "tag"` — cuatro valores del mismo parámetro, no cuatro mecanismos |

**Por qué es mejor que la alternativa**: construir una pantalla por combinación multiplicaría el mantenimiento (nueve implementaciones de agregación a probar y mantener sincronizadas) sin ganar ninguna capacidad — el motor genérico cubre las nueve combinaciones y cualquier combinación futura no prevista (p.ej. "evolución por símbolo dentro de una sola sesión") sin código nuevo. Es la aplicación directa de Core First (19 §8, reglas 10-12): el núcleo pequeño y estable de este componente es el motor de consulta, no el catálogo de pantallas.

---

## 5. Vistas materializadas — mecanismo de lectura

Reafirma 04 §5/05 §3/11 §2, con la resolución concreta del riesgo ya anticipado en 25 §5 ("refresco de vistas materializadas a gran volumen de escritura"):

- **Refresco incremental, nunca recálculo total**, disparado por los mismos eventos que Analytics escucha (§2) — mismo principio ya aplicado repetidamente en este blueprint (Welford en SPEC-001 §5.3, `compliance_flag` cacheado en SPEC-004, Trade Set recalculado por pasada en SPEC-006 §12.2). Un `OperacionCerrada` actualiza únicamente las filas de vista materializada afectadas por esa Cuenta/Empresa/Usuario — nunca reconstruye la vista completa de todos los usuarios.
- **Ninguna consulta interactiva del trader dispara cómputo pesado.** Es la misma garantía que ya protege el camino crítico de Operations Engine (SPEC-002 §6): Analytics es, por diseño, incapaz de bloquear con una agregación cara — todo lo caro ya ocurrió de forma asíncrona antes de que el trader abriera la pantalla.

---

## 6. Filtros, agrupaciones y drill-down — un único modelo de consulta

**Reutiliza Trade Set (28 §2) en vez de inventar un mecanismo de filtro nuevo** — un filtro aplicado en cualquier pantalla de Analytics *es* una definición de Trade Set, el mismo sustantivo que Knowledge Engine (SPEC-006 §4.2) y Optimizer (vía Scenario, indirectamente) ya usan como evidencia:

```
interface AnalyticsQuery {
  scope: { level: "account" | "company" | "global"; ids: string[] }
  trade_set_filter?: TradeSetDefinition          // 28 §2 — instrumento, sesión, plan, etiqueta, rango temporal, combinables
  kpis: string[]                                   // kpi_definitions.key[], nunca una fórmula ad-hoc
  group_by?: "symbol" | "market_session" | "management_plan" | "tag" | "company" | "week" | "month"
  time_series?: { granularity: "day" | "week" | "month" }
}
```

**Drill-down no es un mecanismo aparte** — es la misma `AnalyticsQuery` reemitida con un `scope`/`trade_set_filter` más estrecho (Dashboard Maestro → una Empresa → una Cuenta → una Operación es, en cada paso, la misma consulta con un filtro adicional, nunca una pantalla con lógica propia de "profundizar"). Esta uniformidad es lo que permite responder cualquier combinación de las nueve variantes de §4 sin siquiera necesitar el concepto de "modo drill-down" como algo especial.

---

## 7. Series temporales, heatmaps y rankings — arquetipos de visualización, no widgets sueltos

Tres formas de presentación, cada una construida sobre `AnalyticsQuery` (§6), nunca sobre una consulta propia:

| Arquetipo | Qué muestra | Pregunta que responde (ejemplo concreto) |
|---|---|---|
| **Serie temporal** | Un KPI sobre `time_series` | "¿Mi esperanza matemática está mejorando o empeorando en los últimos 6 meses?" |
| **Heatmap** | Un KPI cruzado sobre dos `group_by` a la vez (p.ej. sesión × día de la semana) | "¿Cuándo obtengo sistemáticamente mejor resultado — qué combinación de sesión y día?" |
| **Ranking** | Un KPI ordenado sobre un `group_by` (p.ej. instrumentos por esperanza) | "¿En qué instrumento debería concentrar volumen, no solo en cuál opero más?" |

**Cada uno de los tres exige un KPI de §3 y una pregunta explícita en su definición de catálogo (§8) — ninguno se instancia "porque queda bien visualmente".**

---

## 8. Catálogo de dashboards y visualizaciones — auditoría de existencia obligatoria

Mismo principio que 10 §5 ya aplicó a cada botón del registro rápido, aplicado aquí a cada visualización:

```sql
create table public.visualization_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  archetype text not null check (archetype in ('kpi_tile','time_series','heatmap','ranking','table','curve')),
  question_answered text not null,          -- obligatorio, no puede ser una descripción, debe ser una pregunta real
  kpis text[] not null                       -- referencias a kpi_definitions.key
);
```

**Ninguna visualización se admite en este catálogo sin `question_answered` no vacío** — es el mecanismo estructural, no solo la disciplina de revisión, que impide un gráfico decorativo.

### 8.1 Dashboards ya existentes, reafirmados

| Dashboard | Pregunta que responde |
|---|---|
| Dashboard de Cuenta (14 §3, pantalla 6) | "¿Cómo va esta cuenta concreta ahora mismo?" |
| Dashboard Maestro (18 §6) | "¿Estoy a salvo, y estoy mejorando, en todas mis cuentas y empresas a la vez?" — ya incluye agrupación por empresa, ahora expresada como `group_by: "company"` (§4) |

### 8.2 Vistas nuevas, justificadas (no pantallas — variantes de consulta con su propia entrada de catálogo)

| Vista | Pregunta que responde | Por qué es nueva y no redundante |
|---|---|---|
| Tendencia de cumplimiento | "¿Qué tan cerca he estado de incumplir una regla en los últimos N meses?" | Hoy Rule Engine solo expone un estado puntual (semáforo, SPEC-004 §6) — nunca una serie temporal; sin esta vista, esa información existiría en `rule_evaluations` pero sería invisible para el trader |
| Conocimiento del sistema | "¿Qué sabe hoy TradePilot sobre mí?" | Knowledge Engine (SPEC-006) expone una interfaz de consulta (§8 de ese documento) pero no tiene superficie visual propia — es responsabilidad de Analytics dársela, coherente con la separación recién aprobada (Knowledge descubre, Analytics presenta) |

### 8.3 Visualizaciones explícitamente rechazadas (auditoría, no solo declaración)

| Propuesta descartada | Por qué falla la auditoría |
|---|---|
| Gráfico circular de operaciones ganadoras vs. perdedoras (conteo) | Sin ponderar por R, un conteo de victorias/derrotas puede ser activamente engañoso — una sola operación de +5R pesa más que cinco de −0.5R, y el gráfico las trataría como iguales. No supera "¿ayuda a mejorar al trader?": invita a optimizar la métrica equivocada (frecuencia de acierto) sobre la que ya existe consenso en 02/12 de que no es lo que importa. **Rechazado** |
| Mapa de calor de "actividad" (nº de operaciones por día, sin ningún KPI) | No tiene `question_answered` real — "cuánto operé" no es, por sí solo, una pregunta que mejore una decisión de gestión (19 §5.2, principio rector: "cada dato introducido debe convertirse en una decisión mejor"). **Rechazado**, salvo que se combine con un KPI real (p.ej. heatmap de Expectancy por día, §7, que sí se admite) |

---

## 9. Frontera con Reporting Engine — reafirmada, no rediseñada

**El pedido del fundador incluye "Informes" y "Exportaciones"** — ambos ya tienen dueño: Reporting Engine (22.5 §2.13), separado explícitamente de Analytics desde 22.5 §5 ("Analytics ≠ Reporting Engine, ambos leen los mismos datos pero para consumidores y formatos distintos, y no dependen entre sí para evitar una cadena de acoplamiento oculta"). Esta especificación no disuelve esa frontera — la hace concreta: **Reporting Engine consume el mismo Catálogo de KPIs (§3) que Analytics**, nunca recalcula un valor por su cuenta, exactamente la misma disciplina que este documento exige puertas adentro. La diferencia entre ambos sigue siendo la de siempre: Analytics sirve vistas interactivas y vivas; Reporting Engine genera artefactos estáticos (CSV/PDF, TradeVault) a demanda, sin vida propia después de generados.

---

## 10. Zero Friction (I16) aplicado — auditoría de interacciones

| Dato importante | Camino | Interacciones |
|---|---|---|
| Drawdown restante de una cuenta con alerta | Abrir app → ya visible en la lista de Cuentas (semáforo, 17 §4) | **0** |
| Detalle completo de una Cuenta | Abrir app → tocar la Cuenta | **1** |
| Comparativa entre Empresas | Abrir app → Dashboard Maestro (ya agrupado por empresa por defecto, 18 §6) | **1** |
| Evolución de un KPI por instrumento/sesión/plan | Cuenta o Dashboard Maestro → tocar "Evolución" → elegir agrupación | **2-3** |
| Qué sabe el sistema sobre mí | Dashboard de Cuenta o Maestro → tocar "Conocimiento" (§8.2) | **1-2** |
| Tendencia de cumplimiento de una regla concreta | Cuenta → tocar el semáforo/regla → ver su historial | **2** |

Todas las consultas de este catálogo caben dentro del umbral de I16 sin excepción — no fue necesario rediseñar ninguna, porque el motor de consulta único (§6) ya evita la fricción que aparecería si cada variante fuera una pantalla distinta con su propia navegación.

---

## 11. Interfaces públicas

```
consultar(query: AnalyticsQuery): Result<AnalyticsResult, AnalyticsError>

interface AnalyticsResult {
  kpis: Record<string, QuantResult<unknown> | FactValue>   // cada valor trazable a su kpi_definitions.key y su módulo origen
  group_by_breakdown?: Record<string, Record<string, unknown>>
  time_series?: TimeSeriesPoint[]
}

type AnalyticsError =
  | { code: "UNKNOWN_KPI"; key: string }                    // el KPI solicitado no existe en el catálogo — nunca se inventa uno al vuelo
  | { code: "INVALID_GROUP_BY_FOR_KPI"; kpi: string; group_by: string }   // no toda combinación kpi × group_by es válida (kpi_definitions.valid_group_by)
  | { code: "SCOPE_NOT_FOUND" }
  | { code: "TAG_FILTER_UNAVAILABLE"; detail: string }        // §12 — hasta que Operations Engine implemente etiquetas
```

Ninguna función pública admite una fórmula libre — solo referencias a `kpi_definitions.key` — es la restricción de interfaz que hace estructuralmente imposible que Analytics "recalcule por su cuenta" (mismo patrón ya usado en Funding Management, SPEC-003 §10, para impedir por tipos que un límite de riesgo cruzara su frontera).

---

## 12. Auditoría — hallazgos adicionales

### 12.1 "Evolución por etiquetas" depende de una capacidad que todavía no existe

**Problema detectado**: el fundador pide preparar visualización por etiquetas, pero ningún capítulo ni especificación anterior ha añadido un campo de etiquetas a una Operación — `trades` (04 §3, confirmado en SPEC-002) no tiene ningún campo de tags, y Analytics **nunca genera hechos**, solo los visualiza (§1.2). **Solución aplicada**: `group_by: "tag"` queda definido en el modelo de consulta (§6) como preparación de contrato, pero cualquier llamada que lo use retorna `TAG_FILTER_UNAVAILABLE` hasta que Operations Engine (SPEC-002) añada el campo correspondiente — se documenta aquí como requisito heredado para una futura revisión de SPEC-002, no se inventa el campo desde Analytics para "completar" la lista pedida. Es la aplicación honesta del mismo principio que SPEC-006 §7.3 ya usó para la limitación causal: declarar la brecha, no disfrazarla.

### 12.2 Verificación de que ningún KPI del catálogo tiene una sombra

Se revisó el catálogo completo de 26 §2 y 28 (diccionario oficial) contra §3.2 — cero términos nuevos introducidos, cero sinónimos añadidos. Cualquier nombre "amigable" que un futuro diseño de UI quiera usar (p.ej. "Rendimiento" en vez de "Expectancy") debe mapear 1:1 a un `key` existente en la capa de presentación, nunca crear una fila nueva en `kpi_definitions` con una fórmula distinta para el mismo concepto.

### 12.3 Rendimiento a escala — confirmación, no hallazgo nuevo

Con vistas materializadas de refresco incremental (§5) y un motor de consulta que nunca opera sobre el historial completo sin un `trade_set_filter` acotado, el coste de cualquier `AnalyticsQuery` es proporcional al tamaño del resultado solicitado, no al volumen total de operaciones del sistema — mismo principio de escalabilidad ya verificado en cada componente anterior de Fase 1, aplicado aquí sin necesidad de un mecanismo nuevo.

---

## 13. Limitaciones a 10 años

1. **El campo de etiquetas (§12.1) es una dependencia externa real** — esta especificación queda parcialmente bloqueada en esa dimensión hasta que SPEC-002 se revise; se anota como decisión abierta (cierre).
2. **El catálogo de KPIs (§3) puede crecer sin gobernanza formal**, mismo riesgo ya identificado tres veces en Fase 1 (Rule Library, registro de estrategias del Optimizer, catálogo de dimensiones de Knowledge Engine) — cuarta aparición del mismo riesgo, refuerza la recomendación ya hecha en SPEC-006 §16 de resolverlo una vez, no cuatro veces por separado.
3. **Heatmaps de dos dimensiones cruzadas (§7) pueden crecer combinatoriamente** si se permite cruzar cualquier `group_by` con cualquier otro sin curación — se recomienda mantener el catálogo de combinaciones válidas explícito en `visualization_catalog` (§8), nunca generar cruces arbitrarios bajo demanda sin un `question_answered` que los respalde.

---

## Riesgos

1. **Que un futuro desarrollador, bajo presión de plazo, añada un cálculo "rápido" directamente en una vista materializada sin pasar por `kpi_definitions`** — mismo tipo de riesgo de disciplina ya aceptado en otros componentes (SPEC-001 §Riesgos #1, "formula drift"); aquí el riesgo es más visible porque afecta directamente a lo que el trader ve, no solo a un cálculo interno.
2. **La dependencia de etiquetas (§12.1) puede generar presión para que Analytics "adivine" una taxonomía de etiquetas antes de que Operations Engine la construya** — se rechaza explícitamente esa opción en este documento; el error correcto es esperar, no inventar.
3. **El catálogo de visualizaciones rechazadas (§8.3) no es exhaustivo** — nuevas propuestas decorativas aparecerán con el tiempo; la mitigación real es el gate estructural (`question_answered` obligatorio), no una lista fija de rechazos.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Evita que TradePilot termine con dos números distintos para el mismo concepto en dos pantallas — el riesgo de confianza más caro para un producto cuya promesa central es "Every R Matters" — y evita construir hasta nueve pantallas cuando una sola, bien parametrizada, cubre el mismo alcance.

**¿Qué sobra?** Las pantallas redundantes identificadas en §4 y las dos visualizaciones rechazadas en §8.3 — ninguna se construye.

**¿Qué falta?** Antes de este documento faltaba: un catálogo de KPIs con trazabilidad obligatoria a un módulo y función de origen (§3), y el reconocimiento honesto de que "evolución por etiquetas" depende de una capacidad que Operations Engine todavía no tiene (§12.1).

**¿Qué haría Apple para simplificar este capítulo?** Confirmaría la decisión de §4 — nueve peticiones de visualización resueltas con un único motor parametrizado es exactamente el tipo de reducción de superficie que Apple exige antes de aprobar cualquier pantalla nueva.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente el Catálogo de KPIs (§3): ningún sistema de reporting profesional permite que dos mesas calculen "PnL" de forma distinta — cada métrica tiene un único dueño y una única fórmula de referencia, y cualquier discrepancia se trata como un incidente, no como una variación aceptable.

**Puntuación**: **96/100**. Los 4 puntos que faltan son los 3 Riesgos más la dependencia externa no resuelta de §12.1 (correctamente declarada, no forzada).

**Nivel de madurez**: 93%. Catálogo de KPIs, motor de consulta unificado, catálogo de visualizaciones con gate estructural, frontera con Reporting Engine y auditoría de fricción están completos; lo pendiente es exclusivamente la dependencia de etiquetas en Operations Engine y la gobernanza de catálogo compartida con los otros tres componentes de Fase 1.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Analytics Engine tal como está especificado.

**Decisiones abiertas**:
1. Cuándo se revisa SPEC-002 para añadir un campo de etiquetas a Operación — recomendación: en cuanto exista demanda validada, coherente con el criterio ya usado en todo el proyecto (11 §13).
2. Gobernanza común de los cuatro catálogos de Fase 1 (Rule Library, estrategias del Optimizer, dimensiones de Knowledge Engine, KPIs de Analytics) — se recomienda resolverla como una única pieza de proceso, no siguiendo acumulando la misma nota en cada especificación.

**Recomendación profesional**: aprobar SPECIFICATION 007. Cierra la capa de lectura del producto con la misma disciplina que ya rige el resto del sistema: un catálogo único, trazable y sin duplicación, y una decisión temprana (§4) que evita construir redundancia antes de que exista — la forma más barata de eliminar un dashboard redundante es no construirlo nunca, no descubrir después que dos pantallas dicen cosas ligeramente distintas del mismo número.
