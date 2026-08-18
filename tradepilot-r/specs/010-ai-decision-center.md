# SPEC-010 · AI Decision Center

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 16 §7 (sin dark patterns, retención basada en valor), 17 §4 (semáforo de cuenta), 18 §6 (Dashboard Maestro, "Cuentas en riesgo"), 20 §Riesgos #2 (recordatorio pasivo, pendiente desde el inicio de Fase 0 — resuelto aquí, §5.4), 22 §1 (lección de Notion/Linear/Stripe/Shopify — reaplicada en §10), 29 §3/§5 (Coaching Card, el filtro de admisión de 5 condiciones, "cuándo TradePilot habla/calla"), 29 §Riesgos #3 (erosión de autonomía del trader — reafirmado y ampliado en §9.2), 30 (Improvement Prioritization Engine — no se duplica, §11), 31 TPOS, 32 §3.7 (Improvement Item), 19 I16/I17/I18, SPEC-004 (Rule Engine, veredictos), SPEC-005 (Optimizer, comparador — mismo patrón de "nunca recalcular" reaplicado), SPEC-006 (Knowledge Engine — distinción explícita con detección de hitos, §5.3), SPEC-007 (Analytics, Catálogo de KPIs — fuente de hechos, nunca recalculados), SPEC-009 (AI Journal Engine — mismo Generador de explicaciones reutilizado)
**No re-abre ninguna decisión conceptual ya aprobada.** No recalcula ni un solo valor que otro módulo ya produzca — es, por diseño, el componente de Fase 1 con menos superficie de cálculo propio y más superficie de arbitraje.

---

## 1. Objetivo del componente

### 1.1 Misión: árbitro de atención, nunca una fuente de verdad nueva

AI Decision Center decide qué información merece la atención del trader en cada momento — nunca produce esa información. Es, estructuralmente, un **comparador** de candidatas ya evaluadas por otros módulos (mismo papel que `comparator` ya cumple dentro de Optimizer, SPEC-005 §9, aplicado ahora entre módulos en vez de entre configuraciones).

### 1.2 Qué nunca debe hacer

1. **Nunca calcula una métrica.** Ni esperanza, ni drawdown, ni ningún valor de Quant Engine — los consume ya calculados.
2. **Nunca descubre un patrón.** Es responsabilidad exclusiva de Knowledge Engine (SPEC-006) — la distinción entre "detectar un hito determinista" (§5.3, sí es de este componente) y "descubrir un patrón estadístico" (nunca lo es) se traza con precisión en §5.3.
3. **Nunca optimiza ni prioriza dentro de un dominio que ya tiene su propio priorizador.** No re-puntúa el Improvement Backlog de 30 — lo consume ya filtrado (§11).
4. **Nunca se calibra contra el engagement.** Ninguna señal de "cuántas veces se tocó esta tarjeta" entra jamás en el arbitraje (§6.3) — es la salvaguarda estructural contra el riesgo que el propio fundador pide vigilar.
5. **Nunca supera 5 tarjetas.** Límite absoluto, no un objetivo — verificado en tiempo de arbitraje, nunca dejado a la composición de la pantalla (§6).
6. **Nunca inventa un motivo.** Toda tarjeta cita evidencia ya calculada por su módulo de origen — mismo principio ya vigente desde SPEC-001, aplicado aquí a la capa de decisión, no de cálculo.

### 1.3 Responsabilidades

- Recolectar candidatas de los seis módulos fuente (§5), sin recalcular nada de lo que reciben.
- Aplicar la jerarquía de clases de prioridad (§4) para decidir qué candidatas compiten realmente entre sí.
- Aplicar I19 (§2) como filtro final antes de mostrar cualquier tarjeta.
- Servir el modo silencioso como comportamiento por defecto (§7), nunca como un caso especial.
- Garantizar que cada tarjeta responda las seis preguntas obligatorias (§8).

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Calcular cualquier métrica | Quant Engine (SPEC-001) |
| Descubrir patrones estadísticos con evidencia | Knowledge Engine (SPEC-006) |
| Decidir qué Improvement Item está Activo y con qué prioridad | Improvement Prioritization Engine (30) |
| Juzgar cumplimiento de reglas | Rule Engine (SPEC-004) |
| Representar el estado real de capital | Funding Management (SPEC-003) |
| Redactar el texto final de una tarjeta | El Generador de explicaciones (06 §3, 21.5 §6), reutilizado tal cual, no reimplementado |

---

## 2. I19 — Attention Is the Most Valuable Currency (nuevo invariante permanente, operacionalizado)

**Se adopta**, con el mismo tratamiento que I16/I17/I18: no como eslogan, sino como una regla verificable.

> **I19**: Ninguna funcionalidad podrá competir por la atención del trader sin demostrar un beneficio esperado superior al coste cognitivo que introduce.

**Operacionalización, no solo aspiración**: "beneficio esperado" reutiliza el `Beneficio` ya definido en 30 §2.2 (impacto × confianza × frecuencia, en € o R) — no se inventa una segunda escala. "Coste cognitivo" se calibra sobre el mismo eje que I16 ya usa para fricción de interacción (número de tarjetas mostradas × tiempo de lectura estimado por tarjeta, ~10-15s, coherente con el diseño de Coaching Card de 29 §3) — es la escalada de un factor que 30 §2.3 ya reconocía como el más débil de su propio modelo ("coste psicológico... la aproximación más débil del modelo, riesgo aceptado y declarado") a un **gate arquitectónico de primera clase**, no una corrección menor: antes, el coste cognitivo era un término suave dentro de la fórmula de priorización de un solo módulo; ahora, con I19, ninguna funcionalidad de **ningún** módulo futuro puede reclamar espacio de atención sin pasar esta prueba explícitamente. Es la generalización correcta de un problema que este proyecto ya sabía que tenía, no una idea nueva sin precedente.

**Aplicación retroactiva declarada, no forzada**: I19 no reabre TPOS (31) ni ninguna especificación ya aprobada — se aplica hacia adelante, y se anota como criterio adicional que TPOS (31, dimensión de puntuación ya existente) debería incorporar en su próxima revisión, no se modifica 31 unilateralmente en este documento (decisión abierta, §17).

---

## 3. Arquitectura interna

### 3.1 Subcomponentes

```
ai-decision-center/
├── candidate-collectors/    Un colector por módulo fuente — traduce estado ya calculado en candidatas — §5
├── card-catalog/              Catálogo de tipos de tarjeta + jerarquía de clase — §4
├── milestone-detection/         Umbral determinista sobre KPIs existentes (Logros/Recordatorios) — §5.3-5.4
├── arbitration/                 Selección de ≤5 por clase + I19 — §6
├── silence/                      Modo silencioso — §7
└── explain/                       Las 6 preguntas obligatorias — §8
```

**Módulo**: se añade como **17º módulo oficial** (extiende 22.5 §1). Comparte el Generador de explicaciones con AI Engine y AI Journal Engine como infraestructura, pero su contrato es distinto de ambos: ninguno de los otros dos decide qué se muestra, ambos generan contenido que alguien más decide mostrar (AI Journal Engine narra una Operación ya cerrada; AI Engine explica una recomendación del Optimizer ya solicitada). AI Decision Center es el único módulo cuya responsabilidad completa es la decisión de visibilidad en sí misma.

### 3.2 Sexta aparición del patrón de catálogo pequeño

El catálogo de tipos de tarjeta (§4) y el catálogo de hitos (`milestone_definitions`, §5.3) son la sexta aparición confirmada, en este mismo blueprint, del patrón "catálogo pequeño de primitivas, extensible por datos, nunca por código" — tras los arquetipos de Rule Engine, las estrategias de Optimizer, los detectores de Knowledge Engine, los KPIs de Analytics y los Connectors de Trade Capture Engine. Añadir un tipo de tarjeta nuevo en el futuro es una fila de catálogo, nunca una rama de código nueva en `arbitration`.

### 3.3 Precomputación — nunca en el camino de lectura

Igual que las vistas materializadas de Analytics (SPEC-007 §5) y el `compliance_flag` cacheado de Rule Engine (SPEC-004), el conjunto de ≤5 tarjetas se recalcula de forma asíncrona ante los eventos relevantes (`OperacionCerrada`, `ReglaIncumplida`, `ConocimientoDescubierto`, `MejoraActivada`/`MejoraConsolidada`, `CapitalRecalculado`) — **nunca en el momento en que el trader abre la app**. Abrir TradePilot es siempre una lectura O(1) de un resultado ya arbitrado, coherente con I16 y con la propia advertencia de Linear (31, "el núcleo es sagrado... toda función nueva se mide por si degrada la velocidad del bucle central") — aquí el bucle central es abrir la app, no registrar una operación, y merece la misma protección.

---

## 4. Catálogo de tipos de tarjeta y jerarquía de clases

### 4.1 Las clases, en orden fijo — nunca invertido por una puntuación

**Hallazgo de diseño**: comparar "un riesgo de drawdown" contra "una oportunidad de mejorar la esperanza" con una única fórmula numérica exigiría inventar una escala común entre magnitudes de naturaleza distinta — exactamente el tipo de cálculo nuevo que §1.2 prohíbe. La solución no es una fórmula: es una **jerarquía de clases**, el mismo diseño que cualquier sistema de riesgo profesional (mesa de control de un banco, terminal de Bloomberg) usa para alertas — crítico/advertencia/informativo, donde una alerta de severidad inferior **nunca** desplaza a una de severidad superior, sin importar cuántas de la inferior existan.

| Clase | Tipos de tarjeta | Fuente | Puede ser desplazada por una clase superior |
|---|---|---|---|
| 1 — Riesgo | Drawdown restante crítico, Cuenta a punto de incumplir una regla | Rule Engine (SPEC-004) / Funding Management (SPEC-003) | — (nunca se desplaza) |
| 2 — Advertencias | Riesgo relevante pero no crítico (semáforo 🟡) | Rule Engine / Funding Management | Solo por Clase 1 |
| 3 — Recordatorios realmente importantes | Estado de cuenta sin actualizar, reconciliación pendiente | Funding Management (staleness, §5.4) — **resuelve 20 §Riesgos #2** | Por Clase 1-2 |
| 4 — Experimentos listos para validar | Improvement Item en transición a "Validando" con muestra suficiente | Improvement Prioritization Engine (30 §2) | Por Clase 1-3 |
| 5 — Cambios confirmados | Improvement Item consolidado (`MejoraConsolidada`) | Improvement Prioritization Engine | Por Clase 1-4 |
| 6 — Mejora | El Improvement Item Activo vigente (ya filtrado a 1-2 máx. por 30 §3) | Improvement Prioritization Engine | Por Clase 1-5 |
| 7 — Logros | Hito determinista cruzado | `milestone-detection` (§5.3) | Por Clase 1-6 |

**Dentro de una misma clase**, el orden se decide por el valor ya calculado por el módulo de origen (`Beneficio` de 30 §2.2, `margen` de Rule Engine) — nunca por una fórmula nueva de este componente.

### 4.2 Por qué una clase inferior nunca desplaza a una superior

Es la respuesta directa al riesgo que una lectura ingenua de "solo las 5 mejores" introduciría: si el arbitraje fuera un ranking numérico único, cinco tarjetas de "Mejora" con `Beneficio` moderado podrían, en teoría, llenar las 5 posiciones y dejar fuera una única tarjeta de "Riesgo" con impacto menor en la métrica pero consecuencia potencialmente mucho más grave (perder una cuenta financiada). La jerarquía de clases hace esto estructuralmente imposible: Clase 1 siempre ocupa sus posiciones antes de que cualquier tarjeta de Clase 2+ se considere.

### 4.3 Contenido explícitamente rechazado (instrucción directa del fundador, aplicada como gate estructural)

| Rechazado | Por qué |
|---|---|
| Noticias de mercado | Fuera de alcance de todo TradePilot (I9, 23) — ni siquiera como contexto informativo |
| Contenido de marketing | Viola I19 por definición — cero beneficio esperado para la gestión del trader |
| Frases motivacionales sin datos | Viola §1.2 punto 6 — ninguna tarjeta existe sin evidencia calculada detrás |
| "La IA recomienda..." como frase | Viola el requisito de explicabilidad (§8) — se reemplaza siempre por la evidencia concreta |

Ningún tipo de tarjeta de este catálogo puede pertenecer a esta lista — es una validación estructural del `card-catalog` (§3.1), no solo una guía de redacción.

---

## 5. Recolección de candidatas — un colector por módulo fuente, nunca recalcula

### 5.1 Riesgo y Advertencias

`candidate-collectors/rule-engine` lee `consultarEstadoCumplimiento` (SPEC-004 §12) y el `drawdown_restante` ya compuesto por Analytics (SPEC-007 §3.2, vía Risk Engine) — genera una candidata de Clase 1 cuando el drawdown restante cruza el umbral ya definido en 18 §6 (<20%) o cuando `compliance_flag` indica una regla incumplida; Clase 2 para el umbral intermedio (semáforo 🟡, 17 §4, ya existente). No se define ningún umbral nuevo — se reutilizan los ya aprobados.

### 5.2 Experimentos, Cambios confirmados y Mejora

`candidate-collectors/improvement-engine` lee directamente el Improvement Item Activo y sus transiciones de estado (32 §3.7) — `Validando` con muestra suficiente → Clase 4; `MejoraConsolidada` reciente → Clase 5; el propio Activo mientras no ha transicionado → Clase 6. El `Beneficio`, la evidencia y el texto ya vienen construidos por el Improvement Prioritization Engine (30 §3) — este colector no añade ni quita nada, solo traduce estado a candidata.

### 5.3 Logros — detección de hito, nunca descubrimiento estadístico

**Distinción explícita con Knowledge Engine, porque a primera vista ambos "encuentran algo sobre el trader"**: un Knowledge Item (SPEC-006) es un hallazgo **correlacional**, con evidencia estadística, intervalo de credibilidad, y sujeto a control de comparaciones múltiples (SPEC-006 §5.3) — requiere inferencia. Un Logro es un **cruce de umbral determinista** sobre un hecho ya conocido con certeza (p.ej. "30 días sin ninguna `ReglaIncumplida`" es un conteo, no una estadística; "primer mes con `expectancy` positiva" es una comparación de signo, no una inferencia). `milestone_definitions` es un catálogo de estas comprobaciones simples, cada una evaluada sobre KPIs ya existentes de Analytics — nunca introduce una fórmula nueva ni un test estadístico.

**Salvaguarda explícita, hallazgo de Challenge Mode (§9.1)**: ningún hito de este catálogo puede basarse en frecuencia o volumen de operaciones — solo en calidad (adherencia al plan, consistencia, cumplimiento, esperanza) — se justifica en detalle en §9.1, porque premiar volumen en un producto de gestión de riesgo sería incentivar exactamente lo contrario de su misión.

### 5.4 Recordatorios realmente importantes — resuelve 20 §Riesgos #2

**El riesgo detectado en el capítulo 20, al inicio mismo de Fase 0** ("la Fase 8 depende de que el usuario recuerde actualizar el estado de cuenta manualmente... se traslada como requisito de alcance a un capítulo de notificaciones que no existe todavía") **encuentra aquí, por fin, su lugar** — no en un componente de notificaciones push (explícitamente rechazado desde 29 §5 para el caso de coaching, mismo criterio aplicable aquí), sino como una tarjeta pasiva de Clase 3: `candidate-collectors/funding-management` detecta cuándo una Cuenta lleva un umbral de tiempo sin ningún evento de capital ni cambio de estado (staleness determinista, mismo tipo de comprobación que un Logro, §5.3) y genera una candidata "¿sigue siendo correcto el estado de esta cuenta?" — pasiva, dentro del propio Decision Center que el trader ya visita, nunca como notificación empujada.

---

## 6. Arbitraje

### 6.1 Selección de ≤5

```
candidatas = candidate-collectors.recolectarTodas()
candidatas_ordenadas = ordenar(candidatas, por: [clase asc, valor_origen desc])
candidatas_tras_i19 = filtrar(candidatas_ordenadas, i19.superaUmbral)      // §6.2
resultado = candidatas_tras_i19.tomar(5)
```

### 6.2 Aplicación de I19

Cada candidata debe superar `Beneficio_esperado > coste_cognitivo_marginal` (§2) — el coste cognitivo marginal de la N-ésima tarjeta **crece** con N (la primera tarjeta cuesta poco, la quinta compite con cuatro ya mostradas) — mismo principio que 30 §5 condición 5 ya aplicaba a la cadencia de coaching ("un máximo de intervenciones nuevas por periodo"), aquí aplicado dentro de una sola sesión de apertura de app en vez de a lo largo del tiempo.

### 6.3 Nunca calibrado contra engagement — salvaguarda estructural

**Ningún dato de interacción del trader con una tarjeta anterior (cuántas veces la tocó, cuánto tiempo la miró) es un input permitido de `arbitration` o de `card-catalog`.** Es la aplicación más directa posible del riesgo que el fundador pide vigilar explícitamente: un sistema que aprende a maximizar toques en vez de valor entregado degenera, con el tiempo, en el mismo mecanismo de un feed de redes sociales — el `Beneficio` que ordena las tarjetas es siempre el ya calculado por el módulo de origen sobre datos objetivos de mercado/gestión, nunca sobre comportamiento de atención del propio trader dentro de la app.

---

## 7. Modo silencioso

Comportamiento por defecto, no un caso especial de la lógica de arbitraje — si `candidatas_tras_i19` está vacío, el Decision Center muestra exactamente:

> *"Todo está funcionando correctamente. No existe ninguna acción con suficiente impacto para recomendar hoy."*

**Por qué este mensaje específico y no un espacio vacío**: comunica explícitamente que el sistema **sí** evaluó — no es ausencia de información, es una confirmación activa de que la evaluación ocurrió y no encontró nada que superara el umbral de I19. Un espacio en blanco generaría la duda razonable de si la app "olvidó revisar algo"; este mensaje la elimina.

---

## 8. Explicabilidad — las 6 preguntas obligatorias

```
interface DecisionCard {
  card_type: string                    // referencia a card_catalog, nunca texto libre
  class: 1 | 2 | 3 | 4 | 5 | 6 | 7       // §4.1
  why_it_appears: string                 // evidencia concreta, nunca "la IA recomienda"
  economic_impact: { value: RValue | Money; confidence: "alta"|"media"|"baja" }   // reutiliza QuantResult<T>/Beneficio ya calculado
  evidence: unknown                       // referencia directa al QuantResult<T>/Knowledge Item/Rule Evaluation de origen — nunca un resumen sin trazabilidad
  action: string                          // qué hacer, siempre concreto y verificable, nunca "sé más disciplinado" (mismo criterio que 29 §5 condición 3)
  time_to_validate?: string                // solo aplica a Clase 4 (Experimentos) — cuándo se sabrá si funcionó
  risk_of_change?: { value: RValue; source: "improvement_prioritization_engine" }  // reutiliza el gate de sobrecorrección de 30 §2.2, nunca inventado aquí
}
```

Ninguna tarjeta se construye sin que las seis preguntas tengan una respuesta trazable a un dato ya calculado — una tarjeta que no puede rellenar los seis campos con datos reales no se muestra, mismo estándar que 29 §6 ya exige para la Coaching Card ("si un hallazgo no puede rellenar los 6 campos con datos reales, no se muestra a medias").

---

## 9. Auditoría psicológica (Challenge Mode explícito, instrucción directa del fundador)

### 9.1 Riesgo de gamificación en "Logros"

**Problema detectado**: un sistema de logros/hitos es, por naturaleza, adyacente a mecánicas de enganche (rachas, "no rompas la cadena", recompensa variable) — exactamente el tipo de dark pattern que 16 §7 ya rechazó para todo el producto. **Mitigación estructural, no solo de tono**: ningún hito de este catálogo (§5.3) puede basarse en frecuencia o volumen de operaciones — un logro de tipo "20 operaciones esta semana" incentivaría perversamente el sobretrading, precisamente lo contrario de la misión de un producto de gestión de riesgo. Todos los hitos se basan en **calidad** (adherencia al plan, consistencia, cumplimiento sostenido, mejora de esperanza) — nunca en cantidad. Además, ningún hito se presenta con lenguaje de pérdida ("estás a punto de perder tu racha") — solo de logro cumplido, nunca de amenaza de perderlo.

### 9.2 Riesgo de dependencia de la IA

**Problema detectado, ampliando el riesgo ya identificado en 29 §Riesgos #3** ("erosión de la autonomía del trader"): un Decision Center que **suprime activamente** el 95%+ de los hallazgos posibles para mostrar solo 5 podría, con el tiempo, hacer que el trader deje de mirar la imagen completa (Dashboard Maestro, Analytics) y confíe ciegamente en el resumen curado — un riesgo distinto y más profundo que el de 29 (que se limitaba a la Coaching Card individual). **Mitigación**: cada tarjeta incluye siempre un enlace explícito a la vista completa correspondiente (Analytics, SPEC-007) — el Decision Center es un **punto de entrada**, nunca un sustituto, y esto se declara como requisito de interfaz (§12), no solo de intención de diseño.

### 9.3 Sobrecarga cognitiva

Ya resuelta por diseño: el límite de 5 (absoluto, §1.2 punto 5) y la jerarquía de clases (§4) son, en conjunto, la mitigación — no se necesita un mecanismo adicional. Se reafirma aquí solo para dejar constancia de que la auditoría lo revisó explícitamente, no que quedó pendiente.

### 9.4 Dark patterns — auditoría explícita

Se revisó cada mecanismo del documento contra el criterio de 16 §7: sin urgencia artificial (§7, el silencio nunca se disfraza de alerta), sin escasez fabricada, sin logros basados en manipulación conductual (§9.1), sin optimización contra engagement (§6.3). No se encontró ningún patrón oscuro tras las correcciones de §5.3/§6.3/§9.1-9.2 — antes de esas correcciones, sí habría existido el riesgo real en "Logros" y en cualquier arbitraje calibrado contra toques.

---

## 10. Comparación contra productos de referencia

- **Linear**: "el núcleo es sagrado" (31) — aplicado aquí como precomputación obligatoria (§3.3): abrir la app nunca puede ser más lento por la existencia de este componente.
- **Notion**: pocas primitivas, composición sin límite — el catálogo de tipos de tarjeta (§3.2) es la sexta confirmación de que esta lección, ya extraída explícitamente en 22 §1 para el Rule Engine, sigue siendo la respuesta correcta cada vez que este proyecto enfrenta variedad.
- **Stripe (Radar)**: un motor de riesgo profesional nunca oculta por qué marcó algo — cada señal tiene un factor nombrado y visible. Es exactamente el estándar de §8 (seis preguntas obligatorias, evidencia trazable).
- **Productos financieros profesionales (mesas de riesgo, terminales de mercado)**: la jerarquía de severidad de alertas (§4) — crítico nunca desplazado por informativo — es el estándar de la industria que motiva §4.2, no una invención de este documento.

---

## 11. Redundancia con Improvement Prioritization Engine — resuelto explícitamente

**No hay dos priorizadores compitiendo.** 30 decide qué Improvement Item está Activo, con qué prioridad, y filtra sobrecorrección — sigue siendo la única autoridad dentro de su dominio (mejora conductual). AI Decision Center nunca re-puntúa ese resultado — lo recibe ya resuelto (§5.2) y solo decide si, comparado con candidatas de Riesgo/Recordatorios/Logros de otros dominios, merece una de las ≤5 posiciones de hoy. Es la misma relación que Analytics tiene con Quant Engine (consume, nunca recalcula) trasladada a la capa de priorización cruzada — no una responsabilidad duplicada, una responsabilidad nueva y distinta (arbitrar **entre** dominios, no **dentro** de uno).

---

## 12. Interfaces públicas

```
obtenerTarjetasDeHoy(user_id: string): Result<DecisionCard[], DecisionCenterError>   // siempre ≤5, siempre incluye enlace a vista completa (§9.2)

type DecisionCenterError =
  | { code: "USER_NOT_FOUND" }
```

Ninguna función de escritura — este componente, igual que Analytics (SPEC-007), es un sumidero de lectura puro; no emite eventos de dominio propios (mismo criterio que 22.5 §2.8 ya fija para Analytics).

---

## 13. Rendimiento

Lectura O(1) sobre el conjunto ya arbitrado (§3.3) — el coste real está en la recolección/arbitraje asíncrono, disparado por los mismos eventos que ya disparan el resto de Fase 1, sin ningún mecanismo de polling ni recálculo periódico innecesario.

---

## 14. Limitaciones a 10 años

1. **La jerarquía de 7 clases (§4.1) es fija hoy** — si en el futuro aparece un tipo de tarjeta que no encaja claramente en ninguna clase existente, se añade una clase nueva en la posición correcta de la jerarquía (evento raro, admin-time, mismo criterio que un arquetipo nuevo de Rule Engine) — no se fuerza dentro de una clase existente solo por conveniencia.
2. **I19 depende de que "coste cognitivo" siga siendo aproximable con tiempo de lectura y número de tarjetas** — si el producto evoluciona a superficies de interacción más ricas (voz, notificaciones ambientales en un wearable), la operacionalización de §2 necesitará revisión — anotado, no resuelto especulativamente aquí.
3. **La salvaguarda anti-engagement (§6.3) exige disciplina de producto sostenida** — es la limitación más importante del documento: nada en el código impide que un futuro equipo, bajo presión de métricas de retención, añada una señal de "toques" al arbitraje "solo para probar" — la única protección real es que este documento, y I19, existan como referencia obligatoria de revisión, igual que cualquier otro invariante permanente.

---

## Riesgos

1. **El umbral de I19 (§2) no tiene un valor numérico validado todavía** — se define el mecanismo, no la calibración exacta; se ajusta con datos reales de uso, mismo criterio ya aplicado repetidamente en este proyecto.
2. **`milestone_definitions` puede crecer sin gobernanza** — séptima aparición del mismo riesgo de curación de catálogo ya señalado en las seis especificaciones anteriores de Fase 1 — la recomendación de resolverlo una sola vez para todo el sistema es ya, a estas alturas, urgente.
3. **La salvaguarda anti-engagement (§6.3, §14 punto 3) depende de disciplina de proceso, no solo de arquitectura** — es el riesgo más importante del documento, ya razonado en §14.

---

## Auditoría del capítulo (19 §5.1 + TPOS 31, en su forma de ingeniería)

**Gate binario (TPOS)**: superado — no se detectó ninguna violación de invariante en el diseño final (a diferencia de SPEC-009, aquí la corrección fue de arquitectura y de riesgo psicológico, no de un invariante ya roto en la propuesta original).

**¿Qué problema real resuelve esta especificación?** El que el fundador nombra directamente: que un trader con acceso a quince módulos de información nunca sepa, sin esfuerzo, cuál de ellos importa hoy. Es también la especificación que finalmente da un hogar al recordatorio pasivo pendiente desde el capítulo 20 (§5.4).

**¿Qué sobra?** Nada del catálogo pedido — las ocho categorías de tarjeta del fundador quedan cubiertas por las 7 clases (Advertencias y Riesgo comparten fuente con distinto umbral, ya existente).

**¿Qué falta?** Antes de este documento faltaba: una jerarquía que impida que el ruido de baja severidad desplace al riesgo real (§4.2), una operacionalización concreta de "coste cognitivo" (§2) en vez de dejarlo como aspiración, y la salvaguarda explícita contra que el propio arbitraje se convierta en un motor de engagement (§6.3) — ninguna de las tres estaba resuelta en la propuesta original.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §4: ninguna mesa de riesgo profesional deja que una alerta de severidad baja "gane" el espacio de un dashboard por tener mejor puntuación en una fórmula compuesta — la severidad manda primero, siempre, y la puntuación solo desempata dentro del mismo nivel.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — el más importante (disciplina anti-engagement sostenida) es, honestamente, un riesgo que ninguna especificación puede eliminar por completo con solo arquitectura.

**Nivel de madurez**: 94%. Jerarquía de clases, recolección por módulo fuente, modo silencioso, explicabilidad y las tres auditorías psicológicas explícitas están completas y son directamente implementables; lo pendiente es calibración empírica de I19 y la gobernanza de catálogos ya repetidamente señalada.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación tal como está especificada.

**Decisiones abiertas**:
1. Si I19 se incorpora formalmente como dimensión de puntuación de TPOS (31) en su próxima revisión — recomendación: sí, pero se deja como decisión del fundador, no se modifica 31 unilateralmente aquí (§2).
2. Gobernanza común de catálogos de Fase 1 (ahora siete) — misma recomendación repetida por séptima vez; a estas alturas del proyecto, se recomienda tratarla como la primera tarea de la fase de implementación, no como una nota más.

**Recomendación profesional**: aprobar SPECIFICATION 010. Es, junto con SPEC-009, de las dos especificaciones de Fase 1 donde el ejercicio de Challenge Mode encontró más que corregir en la propuesta original — no porque la idea fuera mala, sino porque "decidir qué merece atención" es, por naturaleza, el tipo de problema donde los errores de diseño son invisibles hasta que ya han entrenado un mal hábito en el usuario. La idea del "Modo 1 toque" y la propia propuesta de I19 son, ambas, contribuciones del fundador que sobreviven intactas al escrutinio — la disciplina de este documento no fue rechazar la visión, fue asegurarse de que la arquitectura no traicione esa visión con el tiempo.
