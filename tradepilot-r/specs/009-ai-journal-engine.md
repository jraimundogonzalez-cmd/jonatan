# SPEC-009 · AI Journal Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 01 §2.1 ("TradingView analiza, TradePilot gestiona" — la línea fundacional del producto), 06 §3-4/§7 (Generador de explicaciones, lectura de capturas V3, coste/latencia), 17 §3.2 (Psychology, etiqueta ligera por operación — ya scoped como el MVP correcto), 21.5 §6 (Domain Services, sin estado propio), 22.5 §2.7 (AI Engine — contrato distinto, no se fusiona), 22.5 §2.12 (Media Engine — dueño ya existente de la lectura de capturas), 23 I9 ("TradePilot nunca evalúa ni opina sobre la calidad de una entrada de mercado" — **el invariante que esta especificación estuvo a punto de violar**, §2), 27 §2.2 (Quant Capabilities, comparación), 28 §2 (Market Session ya formalizado), 31 TPOS (aplicado explícitamente en §2 y §18, por instrucción directa del fundador), 19 I16/I17/I18, SPEC-001 (Explainable Quant), SPEC-002 (`editarOperacion`, `closure_reason`, PlanSnapshot), SPEC-003, SPEC-004, SPEC-005, SPEC-006 (Knowledge Engine — límite de no duplicación central de este documento), SPEC-007 (Catálogo de KPIs, gap de etiquetas de §12.1 resuelto aquí), SPEC-008 (Trade Capture Engine — `capture_field_provenance` reutilizado, no reinventado)
**No re-abre ninguna decisión conceptual ya aprobada.** Corrige el alcance de lo pedido antes de construirlo (§2-3) — es la instrucción explícita del fundador ("destruye esta propuesta... no aceptes ninguna decisión simplemente porque la proponga yo").

---

## 1. Objetivo del componente (precisado tras Challenge Mode, ver §2-3)

### 1.1 Misión

AI Journal Engine convierte el cierre de una operación en el final de una tarea, no en el principio de otra. Su misión es que completar el journal deje de competir por la atención del trader — la mayoría de los campos ya están resueltos cuando el trader llega a verlos, y lo que falta se pregunta en la menor cantidad de interacciones honestamente posible.

### 1.2 Qué nunca debe hacer

1. **Nunca evalúa ni opina sobre la calidad de una entrada de mercado.** Es I9 (23), la línea fundacional del producto desde el primer día — se detalla como el hallazgo central de esta especificación en §2, porque la propuesta original del fundador, tal como estaba escrita, se acercaba a cruzarla.
2. **Nunca duplica un cálculo, un veredicto o un descubrimiento que otro módulo ya produce.** Ningún campo de este documento se computa dos veces — es la aplicación de la misma disciplina que ya rige Quant Engine (formula drift), Rule Engine (Library única) y, sobre todo, Analytics (Catálogo de KPIs, SPEC-007 §3) — aquí extendida a contenido narrativo generado por IA.
3. **Nunca inventa un dato.** Instrucción explícita del fundador, y ya el mismo principio que gobierna todo Fase 1 desde SPEC-001 (`UNDEFINED_RATIO`), SPEC-004 (`unavailable`), SPEC-006 (confianza nunca inventada) y SPEC-008 (`null` nunca `0`) — esta es la séptima aplicación del mismo principio, no una nueva regla (§11).
4. **Nunca hace más lenta la salida que la entrada.** Si omitir una pregunta requiere más fricción que responderla, el diseño es un patrón oscuro, no un incentivo — se rechaza explícitamente esa lectura de "más rápido rellenar que ignorar" (§7.3).
5. **Nunca escribe fuera del contrato canónico de Operations Engine.** Igual que Trade Capture Engine (SPEC-008 §1.2, punto 4), toda escritura de este componente termina en `editarOperacion` (SPEC-002 §7) — nunca una tabla ni una vía propia.

### 1.3 Responsabilidades (ya corregidas por §2-3, lista definitiva)

- Orquestar la conversación de finalización — qué falta, en qué orden, con qué presupuesto de tiempo (§6-7).
- Generar narrativa (título, resumen) a partir de datos ya calculados por otros módulos — nunca a partir de datos inventados (§9).
- Sugerir etiquetas con nivel de confianza — resuelve el hueco que SPEC-007 §12.1 dejó explícitamente declarado (§9.3).
- Delegar la lectura de capturas a Media Engine (22.5 §2.12, ya existente) dentro de la frontera estricta de I9 (§10).
- Mantener trazabilidad de procedencia de cada campo completado (§11).

### 1.4 No-responsabilidades (el mapa corregido — ver §3 para el razonamiento completo)

| No responsabilidad | Quién la tiene |
|---|---|
| Detectar errores/aciertos de comportamiento | Knowledge Engine (SPEC-006) — AI Journal Engine solo **muestra** hallazgos ya descubiertos, nunca los descubre |
| Calcular "calidad de ejecución" | Ya existe: `%_beneficio_conservado` (Quant Engine, 02 §3) — no se inventa una métrica nueva con otro nombre |
| Juzgar "nivel de disciplina" | Un KPI de adherencia al Plan (comparación determinista PlanSnapshot vs. ejecución real, Analytics/Quant Capabilities 27 §2.2) — nunca un juicio subjetivo de IA |
| Clasificar el "tipo de setup" de entrada, o identificar liquidez/rangos/zonas relevantes en un gráfico | **Nadie, en ningún componente de TradePilot** — es análisis de mercado, prohibido por I9 (§2) |
| Leer entrada/stop/TP/parciales de una captura | Media Engine (22.5 §2.12, ya aprobado, V3) — AI Journal Engine consume su resultado, no lo recalcula |
| Derivar Market Session de un timestamp | Trade Capture Engine (SPEC-008 §5.1, "siempre inferible" — adición menor, §4) |
| Optimizar, priorizar mejoras | Optimizer (SPEC-005), Improvement Prioritization Engine (30) — ninguno de los dos necesita ser "alimentado" activamente por este componente (§4) |

---

## 2. TPOS aplicado — el gate binario que esta especificación estuvo a punto de no superar

**El fundador pide aplicar TPOS (31) explícitamente. Se aplica primero el paso más importante: el gate binario, antes que la puntuación.**

**Problema detectado**: la propuesta original pide que la IA, al procesar una captura de pantalla, identifique *"entrada, stop, tp, rangos, liquidez, parciales, zonas relevantes"*. De estos siete elementos, **cinco** (entrada, stop, tp, parciales, y por extensión la dirección) son hechos que el propio trader ya decidió y marcó en su plataforma — leerlos es fidelidad, ya aprobado desde 06 §4 como V3 de Media Engine. Pero **"rangos", "liquidez" y "zonas relevantes" no son hechos que el trader decidió — son juicios sobre la estructura del mercado**, exactamente lo que I9 prohíbe: *"TradePilot nunca evalúa ni opina sobre la calidad de una entrada de mercado — analiza exclusivamente la gestión posterior a la entrada"* (23). El propio capítulo 23, al analizar I9, anticipó con precisión inquietante este escenario exacto como el riesgo de incumplimiento a vigilar: *"una función futura de 'scoring de setup' se cuela dentro de una feature de IA aparentemente inocua"* — es, literalmente, lo que "identificar zonas de liquidez desde una captura" sería.

**Aplicación del gate binario de TPOS (31)**: un invariante roto descalifica sin importar la puntuación, mismo patrón ya usado en 30 (sobrecorrección) y en el propio TPOS. Esta especificación **no puede aprobarse** con esas tres capacidades incluidas tal como se pidieron — no es una cuestión de matiz o de prioridad, es un incumplimiento directo de la Constitución técnica.

**Solución aplicada, no una simple eliminación**: se separan con precisión los siete elementos pedidos en dos categorías, no se descarta la captura de pantalla como capacidad:

| Elemento pedido | Categoría | Tratamiento |
|---|---|---|
| Entrada, stop, TP, parciales, dirección | Hecho ya decidido por el trader, visible en su plataforma | **Aceptado** — ya es el contrato de Media Engine V3 (22.5 §2.12), aquí se añade `parciales` como extensión menor (§10.1) |
| Rangos, liquidez, zonas relevantes | Juicio sobre estructura de mercado | **Rechazado, sin excepción** — viola I9. Ninguna versión futura de este componente puede reintroducirlo sin antes derogar I9, y I9 es, junto con el resto de la Constitución técnica (23), la categoría de invariantes que este proyecto ha tratado siempre como no negociable |

**Por qué esto no debilita el producto**: TradingView y cualquier plataforma de gráficos ya hacen esto, y lo hacen mejor, porque es su categoría de producto (00, 09 §6). Competir ahí diluye exactamente la diferenciación que 24 (Ventaja Competitiva) identificó como el foso real de TradePilot — la calibración bayesiana personal sobre gestión, no el análisis técnico. Es coherente, no una limitación impuesta desde fuera: es la misma razón por la que el producto entero existe con esta frontera desde el capítulo 00.

---

## 3. Qué NO es AI Journal Engine — deduplicación exhaustiva antes de construir nada

**Challenge Mode, aplicado a cada uno de los campos "que la IA debe completar automáticamente" pedidos por el fundador, uno por uno:**

| Campo pedido | Duplica a... | Resolución |
|---|---|---|
| Título del trade | Nada — genuinamente nuevo | Se construye (§9), reutiliza el Generador de explicaciones ya aprobado (06 §3) |
| Resumen | Nada — genuinamente nuevo, pero **compone** datos de otros módulos, no los calcula | Se construye (§9) |
| Etiquetas | El hueco declarado en SPEC-007 §12.1 | Se resuelve aquí (§9.3), no se inventa una segunda vía |
| Errores detectados / Aciertos detectados | Knowledge Engine (SPEC-006 §1.3, "descubrir patrones") | AI Journal Engine **consulta** (SPEC-006 §8), nunca descubre |
| Tipo de setup | I9 (§2) si se interpreta como patrón de entrada | **Rechazado** en esa forma; si el fundador quiere una etiqueta libre de estilo de gestión (no de patrón técnico de entrada), es una etiqueta más del sistema de §9.3, elegida por el trader, nunca clasificada por IA desde un gráfico |
| Plan utilizado | Ya es un hecho — `PlanSnapshot` (21.5 §2), capturado en el momento de crear la Operación (SPEC-002 §2.5, invariante 2) | **No requiere IA** — ya existe, siempre, con certeza total; pedir que la IA lo "complete" trataría un hecho ya conocido como una incógnita a adivinar |
| Market Session | Derivación determinista de un timestamp (28 §2, ya formalizado como dimensión) | Inferencia segura de Trade Capture Engine (SPEC-008 §5.1), no requiere IA — se añade como adenda menor (§4) |
| Nivel de disciplina | `%_beneficio_conservado` (Quant Engine, ya existente) más un nuevo KPI de adherencia al Plan (Analytics, 27 §2.2) | No se inventa una métrica nueva — se referencia la ya existente y se añade la que faltaba, ambas objetivas |
| Calidad de ejecución | Sinónimo de `%_beneficio_conservado` (02 §3, "la métrica más importante del producto a nivel individual") | **Mismo campo, otro nombre** — no se crea una segunda fórmula para el mismo concepto, mismo criterio que 26 §2.1 ya aplicó al consolidar tres nombres de `R_final` |
| Nivel de paciencia | `time_in_market_sec` frente a la media histórica propia del mismo bucket de RR | Se expresa como comparación (27 §2.2) sobre datos ya existentes, nunca como una puntuación inventada sin evidencia — si no hay muestra suficiente para esa comparación, no se presenta (mismo criterio de confianza que 13 §2) |

**El resultado de esta tabla es la responsabilidad real de AI Journal Engine**: no es un componente que "sabe" quince cosas nuevas sobre el trader — es el componente que **compone y redacta** lo que trece módulos ya aprobados saben, más dos o tres piezas genuinamente nuevas (título, resumen, sugerencia de etiquetas). Es una diferencia de arquitectura, no una reducción de ambición de producto: el trader sigue viendo exactamente todo lo que el fundador pidió, con el mismo nivel de riqueza — solo que cada dato tiene un único dueño verificable en vez de una segunda implementación oculta dentro de un componente de IA.

---

## 4. Consolidación — qué ya existe y se reutiliza sin cambios

- **Registro de errores/aciertos** → Knowledge Engine (SPEC-006), consultado de solo lectura (§8 de ese documento).
- **Lectura de capturas** → Media Engine (22.5 §2.12), ya aprobado como V3 desde 06 §4 — se extiende con `parciales` (§10.1), no se rediseña.
- **Generación de lenguaje natural** → el Domain Service "Generador de explicaciones" (21.5 §6, 06 §3), reutilizado para título/resumen, no un mecanismo nuevo.
- **Alimentación de Analytics/Optimizer/Improvement Engine** → **ya ocurre automáticamente sin intervención de este componente**: Analytics refresca sus vistas materializadas por evento (SPEC-007 §5), Optimizer lee el historial fresco en cada invocación (SPEC-005, sin mecanismo de "feed" continuo), Improvement Prioritization Engine consume eventos de Knowledge Engine (30, 32 §3.7). El pedido del fundador de que "cada trade alimente automáticamente" a los tres ya está satisfecho por diseño desde sus respectivas especificaciones — **no se construye nada nuevo aquí**, se confirma que ya funciona.
- **Market Session por timestamp** → adenda menor a Trade Capture Engine (SPEC-008 §5.1): se añade `market_session` a la lista de campos "siempre inferibles", mediante una tabla de horarios de sesión (Londres/NY/Asia, 28 §2) — no requiere IA, es aritmética de calendario.

---

## 5. Arquitectura interna

```
ai-journal-engine/
├── completion-orchestrator/    Sabe qué falta (lee capture_field_provenance, SPEC-008 §9) y en qué orden pedirlo — §6-7
├── plan-adherence/               Comparación determinista PlanSnapshot vs. ejecución real — §8
├── narrative/                     Invoca el Generador de explicaciones para título/resumen — §9
├── tag-suggestion/                 Sugiere etiquetas con confianza — §9.3
├── knowledge-surface/               Consulta Knowledge Engine (solo lectura) para insertar hallazgos relevantes en el resumen — §9.2
├── media-bridge/                    Único punto que invoca a Media Engine — nunca reimplementa visión — §10
└── write-bridge/                     Único punto que invoca editarOperacion (SPEC-002 §7) — nunca escribe directo
```

**Módulo**: se añade como **16º módulo oficial** (extiende 22.5 §1), con contrato propio y distinto de AI Engine (22.5 §2.7) — ambos comparten el Generador de explicaciones como infraestructura, pero tienen responsabilidades distintas: AI Engine recomienda mejores configuraciones (Optimizer), AI Journal Engine completa y narra un registro ya cerrado. No se fusionan por la misma razón que Knowledge Engine no se fusionó con AI Engine (SPEC-006 §2): responsabilidades genuinamente distintas, aunque compartan infraestructura.

---

## 6. El pipeline — Automation Before Interaction (I18) aplicado literalmente

```
1. OperacionCerrada (SPEC-002 §3.1) dispara completion-orchestrator
2. Lee capture_field_provenance (SPEC-008 §9) — qué está 'captured'/'inferred', qué falta
3. plan-adherence calcula la sugerencia de "¿seguiste tu plan?" (§8) — inferencia segura, nunca una pregunta abierta desde cero
4. Presenta la tarjeta de cierre (§7) — solo lo que ninguna captura ni inferencia resolvió
5. Tras confirmación del trader (≤2 respuestas en el camino normal):
   a. write-bridge persiste plan_followed/mood/news/nota vía editarOperacion
   b. narrative + tag-suggestion + media-bridge se ejecutan de forma asíncrona, nunca bloquean el paso 4-5a
   c. knowledge-surface añade, si existe, una línea del resumen anclada a un Knowledge Item ya vigente para ese Trade Set
```

El paso 5b es deliberadamente asíncrono — mismo principio ya fijado en 06 §7 ("reservar el modelo de visión... nunca en el camino crítico de guardado") y en SPEC-002 §6 (cascada reactiva siempre asíncrona): el trader ve "Operación registrada" de inmediato, y el título/resumen/etiquetas aparecen unos segundos después sin que el trader los haya esperado activamente.

---

## 7. Modo Cierre en Un Toque

### 7.1 La tarjeta

```
Operación registrada
✓ Todo completado automáticamente.
Solo necesito confirmar 2 cosas (~12s).

¿Seguiste tu plan?          [ya pre-seleccionado según §8, 1 toque para confirmar o cambiar]
  ○ Sí   ●Parcialmente (sugerido, 82% confianza)   ○ No

¿Cómo te sentiste?
  😀   🙂   😐   😕      [omitir]
```

### 7.2 Presupuesto de interacciones (mismo estándar de rigor que 10 §4)

| Camino | Toques | Tiempo estimado |
|---|---|---|
| Confirmar sugerencia + elegir emoji | 2 | ~10-12s |
| Cambiar la sugerencia de "¿seguiste tu plan?" + elegir emoji | 2 | ~10-12s (cambiar es 1 toque, no más) |
| Omitir ambas | 1 (deslizar/cerrar) | ~2-3s |
| Añadir nota o marcar noticia importante (opcional, expandible) | +1-2 por campo | +3-5s cada uno |

### 7.3 "Más rápido rellenar que ignorar" — corrección de interpretación

**Problema detectado**: leído literalmente, este objetivo podría interpretarse como "hacer que omitir cueste más toques que responder" — un patrón oscuro, exactamente lo que 16 §7 ya rechazó explícitamente para todo el producto ("retención basada en valor, sin dark patterns"). **Se rechaza esa lectura.** La forma correcta de cumplir el objetivo del fundador es la contraria: hacer que **responder** sea tan barato (1-2 toques, sugerencia ya pre-rellenada) que decidir omitir consuma más esfuerzo mental de decisión que simplemente tocar la opción ya sugerida — la velocidad se gana haciendo la respuesta trivial, nunca penalizando la salida. `[omitir]` en §7.1 tiene el mismo tamaño de toque que cualquier otra opción, nunca escondido ni retrasado.

---

## 8. Inferencia de "¿seguiste tu plan?" — corrección al propio ejemplo del fundador

**Problema detectado**: el ejemplo del fundador presenta "¿Seguiste tu plan?" como una pregunta abierta de tres opciones, hecha desde cero. Pero Operations Engine **ya tiene** todo lo necesario para sugerir la respuesta con certeza razonable: el `PlanSnapshot` (qué se planeó, 21.5 §2) y los parciales realmente ejecutados (SPEC-002 §5.2) — comparar ambos es aritmética, no una incógnita. Preguntarlo desde cero, sin usar datos que el sistema ya posee, es una violación literal de I18 (Automation Before Interaction) dentro del propio ejemplo que motivó este documento.

**Solución aplicada**: `plan-adherence` calcula una similitud entre lo planificado y lo ejecutado (número de parciales, niveles de RR, nivel de cierre del resto) y la traduce a una sugerencia pre-seleccionada con su confianza — el trader confirma con 1 toque en el caso común, o la corrige con 1 toque si el sistema se equivocó (p.ej. el trader sintió que "siguió el plan" pese a una desviación técnica menor, un matiz que ninguna comparación numérica puede capturar del todo — de ahí que siga siendo una confirmación, nunca una respuesta silenciosa sin que el trader la vea). Esto no elimina la pregunta — la convierte de una pregunta abierta a una confirmación, que es exactamente la diferencia de fricción entre "captura + inferencia" e "interacción manual" que I18 exige distinguir.

---

## 9. Generación de narrativa

### 9.1 Título y resumen

Reutiliza el Generador de explicaciones (06 §3) sin cambios de mecanismo: un prompt estrictamente acotado, con **todos los números ya inyectados** (nunca calculados por el modelo de lenguaje) — `R_final`, `%_beneficio_conservado`, `closure_reason`, adherencia al plan, y, si existe, la línea de un Knowledge Item relevante (§9.2). El modelo solo redacta 1-2 frases de título y 2-4 de resumen — mismo límite de alcance ya fijado en 06 §3 para explicaciones de recomendaciones.

### 9.2 Superficie de conocimiento (nunca descubrimiento)

Si existe un Knowledge Item activo (SPEC-006) cuyo Trade Set incluye esta Operación, `knowledge-surface` lo consulta (solo lectura, SPEC-006 §8) y lo ofrece como contexto opcional al Generador de explicaciones — nunca genera un hallazgo nuevo, nunca ejecuta su propio análisis estadístico. Si no existe ninguno relevante, el resumen se genera sin esa pieza, sin forzarla.

### 9.3 Sugerencia de etiquetas — resuelve el hueco de SPEC-007 §12.1

```sql
alter table public.trades
  add column tags text[] default '{}';
```

Es exactamente el campo que Analytics (SPEC-007 §6, `group_by: "tag"`) esperaba sin tenerlo — esta especificación lo entrega. `tag-suggestion` propone 1-3 etiquetas (del catálogo ya existente del usuario, o nuevas si el patrón es genuinamente distinto) con nivel de confianza; el trader las confirma o edita en el mismo toque que confirma el resto de la tarjeta (§7.1, expandible) — nunca se aplican sin mostrarlas.

### 9.4 Esquema adicional

```sql
alter table public.trades
  add column title text,
  add column summary text,
  add column mood text check (mood in ('great','good','neutral','bad')),
  add column plan_followed text check (plan_followed in ('yes','partial','no')),
  add column important_news boolean,
  add column free_note text;
```

Todos escritos exclusivamente vía `editarOperacion` (SPEC-002 §7) — se extiende `OperacionEditable` (SPEC-002) para incluirlos, sin tocar ningún campo existente de ese contrato.

---

## 10. Fotos — frontera estricta con Media Engine e I9

### 10.1 Extensión menor de Media Engine (22.5 §2.12)

Se añade `parciales` a la salida estructurada de la lectura de capturas (06 §4: hoy `{entry, stop, tp, direction, confidence}`, pasa a incluir niveles de cierre parcial cuando son legibles) — extensión aditiva, no un rediseño. Sigue sin aplicarse nunca automáticamente (06 §4, punto 4, ya vigente) — se muestra como sugerencia con confianza, el trader confirma.

### 10.2 Lo que se rechaza, sin excepción

Rangos, zonas de liquidez, estructura de mercado — **fuera de alcance de todo TradePilot**, no solo de este componente (§2). AI Journal Engine nunca invoca a Media Engine pidiendo esta información, porque Media Engine mismo nunca la produce.

### 10.3 Asociación automática de imágenes

Dos casos, cada uno con su mecanismo ya existente, ninguno nuevo:
- **Subida durante el flujo de cierre** (§7): la asociación es trivial — es la Operación que se está cerrando en ese momento, sin ambigüedad.
- **Subida diferida o por lotes** (el trader sube capturas más tarde, de varias operaciones a la vez): se resuelve con el mismo mecanismo de correlación por timestamp/símbolo/cuenta que la reconciliación de Trade Capture Engine ya especifica (SPEC-008 §8) — reutilizado, no reinventado. Una coincidencia ambigua se presenta para confirmación manual, nunca se asigna al azar (mismo principio que SPEC-008 §4.2).

---

## 11. Confianza y trazabilidad — séptima instancia del mismo principio

Cada campo que este componente completa (plan_followed sugerido, mood si se infiriera en el futuro, título, resumen, etiquetas, valores de captura) se registra en `capture_field_provenance` (SPEC-008 §9), extendiendo su `source` para incluir `'ai_generated'`:

```sql
alter table public.capture_field_provenance
  drop constraint capture_field_provenance_source_check,
  add constraint capture_field_provenance_source_check
    check (source in ('captured','inferred','manual','ai_generated'));
```

Es, contando desde SPEC-001, la séptima vez que este mismo principio arquitectónico aparece en el blueprint: `UNDEFINED_RATIO` (SPEC-001), `unavailable` (SPEC-004), confianza nunca inventada (SPEC-006), `null` nunca `0` (SPEC-008 §7.3), y ahora la procedencia obligatoria de cualquier dato que una IA complete. Ya no es una coincidencia — es la firma arquitectónica de precisión de todo el sistema, y se documenta aquí como tal, no como una regla nueva de este componente.

---

## 12. Interfaces públicas

```
completarJournal(trade_id: string): Result<JournalCompletionCard, JournalError>

interface JournalCompletionCard {
  ya_resuelto: Record<string, FieldValue>              // lo que capture_field_provenance ya marcó captured/inferred
  pendiente: PendingPrompt[]                             // lo que requiere confirmación o entrada
  plan_followed_suggestion?: { value: "yes"|"partial"|"no"; confidence: number }
}

confirmarCierre(trade_id: string, respuestas: { plan_followed?: string; mood?: string; important_news?: boolean; free_note?: string }): Result<void, JournalError>

type JournalError =
  | { code: "TRADE_NOT_FOUND" }
  | { code: "TRADE_NOT_CLOSED" }          // solo aplica sobre Operaciones ya Cerradas (SPEC-002 §2.1)
  | { code: "AI_PROVIDER_UNAVAILABLE"; degraded: true }   // narrativa/etiquetas se posponen, nunca bloquean la tarjeta de §7
```

---

## 13. Rendimiento

- La tarjeta de cierre (§7) se construye solo con datos ya resueltos (lecturas O(1) de `capture_field_provenance` y del `PlanSnapshot`) — nunca espera a un proveedor externo de IA, coherente con 06 §7.
- `narrative`/`tag-suggestion`/`media-bridge` son estrictamente asíncronos — su latencia (llamadas a un proveedor externo, potencialmente 1-3 segundos) nunca forma parte del presupuesto de §7.2.
- El coste marginal por operación (una llamada de texto corto +, si hay captura, una llamada de visión) sigue el mismo criterio de control de coste ya fijado en 06 §7 — modelo más pequeño que cumpla la tarea, cacheo cuando el input no cambió.

---

## 14. Auditoría — hallazgos adicionales (más allá del gate de §2)

### 14.1 Comparación contra productos profesionales de referencia (instrucción explícita del fundador)

Los journals de trading más establecidos del mercado (categoría que incluye productos como Edgewonk, TraderSync, Tradezella) comparten una limitación estructural que TradePilot no tiene por diseño: **piden al trader introducir manualmente el RR planificado y compararlo con el resultado**, porque no poseen un `PlanSnapshot` capturado en el momento de abrir la operación — solo pueden trabajar con lo que el trader teclea al cerrar. TradePilot, al tener el Plan de Gestión como concepto de primera clase desde 21.5 (antes incluso de que existiera un Rule Engine), puede comparar planificado vs. ejecutado con datos que ya existían desde el minuto uno de la Operación (§8) — es una ventaja estructural, no una feature añadida encima, y es coherente con el hallazgo de 24 (Ventaja Competitiva) de que el foso real de TradePilot es de datos propios, no de superficie de producto.

### 14.2 Contradicción encontrada y corregida en el orden de prioridades del propio mensaje

El fundador enumera para esta especificación: *"1. Precisión matemática. 2. Mejorar al trader. 3. Automatización. 4. Rapidez. 5. Simplicidad. 6. Escalabilidad"* — un orden distinto al ya fijado como regla permanente en 19 §6 (*Precisión, Rapidez, Experiencia móvil, Escalabilidad, Automatización, Aprendizaje mediante IA*). No se asume cuál prevalece — se aplica el criterio ya usado en todo el proyecto ante una tensión de este tipo (19 §1.1, Challenge Mode: decidir y documentar, no dejar abierto por cortesía): esta especificación **respeta el orden permanente de 19 §6** para cualquier decisión de diseño de este documento (de hecho, §7.3 ya resuelve una tensión precisión-vs-rapidez a favor de la precisión sin corregir agresivamente hacia la velocidad), y dejar como **decisión abierta explícita** (§17) si el fundador quiere que el orden de este mensaje sustituya permanentemente al de 19 §6 — no se asume silenciosamente ninguna de las dos.

### 14.3 Duplicidad evitada: "Sesión de revisión" (21.5 §12)

21.5 §12 ya anticipó que Psychology podría necesitar su propia entidad ("Sesión de revisión") si evolucionaba más allá de una etiqueta ligera por operación. El diseño de §7 (mood de 4 emojis, opcional, por operación) se mantiene deliberadamente dentro del alcance ligero ya aprobado en 17 §3.2 — no se construye una "Sesión de revisión" aquí; si en el futuro se valida demanda de un review psicológico más profundo (semanal, no por operación), es una especificación distinta, no una ampliación silenciosa de esta.

---

## 15. Limitaciones a 10 años

1. **La sugerencia de "¿seguiste tu plan?" (§8) es una comparación cuantitativa de una decisión que tiene un componente irreducible subjetivo** — seguirá habiendo casos donde el trader corrija la sugerencia por una razón que el sistema no puede modelar (una desviación justificada por una noticia, por ejemplo) — es un límite honesto, no un defecto a corregir, mismo tipo de límite ya aceptado para `be_trigger` en SPEC-008 §5.3.
2. **El catálogo de etiquetas (§9.3) puede crecer sin gobernanza** — sexta aparición del mismo riesgo de curación ya identificado cinco veces en Fase 1 (Rule Library, estrategias del Optimizer, dimensiones de Knowledge Engine, KPIs de Analytics, especificaciones de instrumento de Trade Capture Engine) — se suma a la recomendación ya repetida de resolverlo una sola vez para todo el sistema, no siete veces por separado.
3. **La frontera de I9 (§2) exige vigilancia activa, no solo diseño correcto hoy** — cualquier futura propuesta de "enriquecer" la lectura de capturas (aquí o en Media Engine) debe pasar explícitamente por el gate binario de TPOS antes de aceptarse, no solo por una revisión de código.

---

## Riesgos

1. **Que una futura iteración de Media Engine reintroduzca análisis de estructura de mercado "solo para mejorar la detección de niveles"** — el riesgo que I9 y 23 ya anticiparon con precisión; mitigación: cualquier cambio al prompt de visión de Media Engine debe revisarse explícitamente contra I9 antes de desplegarse, no solo probarse por precisión técnica.
2. **Que el catálogo de etiquetas (§9.3, límite 2) crezca sin curación** — mismo riesgo ya aceptado repetidamente en Fase 1.
3. **Que la tensión de prioridades de §14.2 no se resuelva explícitamente** y cada especificación futura interprete el orden de forma distinta — se dejó como decisión abierta a propósito, pero no debería quedar así indefinidamente.

---

## Auditoría del capítulo (19 §5.1 + TPOS 31, en su forma de ingeniería)

**Gate binario (TPOS)**: superado tras la corrección de §2 — sin esa corrección, esta especificación habría sido descalificada sin importar su puntuación.

**¿Qué problema real resuelve esta especificación?** El que el propio fundador nombra como el mayor problema de la categoría: traders que operan pero nunca completan su journal — y lo resuelve reduciendo lo que realmente hace falta preguntar a, en el caso común, una confirmación de 1 toque más un emoji opcional.

**¿Qué sobra?** Las tres capacidades rechazadas en el gate (§2) y la duplicación de seis campos ya resueltos por otros módulos (§3) — ninguna de las nueve se construye.

**¿Qué falta?** Antes de este documento faltaba: dónde vive la comparación planificado-vs-ejecutado que hace posible pre-rellenar "¿seguiste tu plan?" (§8), y el campo de etiquetas que SPEC-007 ya había dejado pendiente (§9.3).

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente el gate de §2: ninguna función de "insight" se acepta sin verificar primero, de forma explícita, que no cruza la frontera de negocio que define la categoría del producto — es la misma disciplina de compliance que revisa cualquier función nueva contra el mandato regulatorio del fondo antes de la revisión de calidad técnica.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — el más importante (vigilancia continua de I9 en Media Engine) es de proceso, no de diseño de este documento.

**Nivel de madurez**: 94%. El pipeline, la tarjeta de cierre, la inferencia de adherencia al plan, la generación de narrativa y la frontera con Media Engine están completos y son directamente implementables; lo pendiente es la decisión abierta de §14.2 (orden de prioridades) y la gobernanza de catálogos ya repetidamente señalada.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación tal como está especificada tras la corrección del gate binario.

**Decisiones abiertas**:
1. Si el orden de prioridades de este mensaje (§14.2) sustituye permanentemente al de 19 §6, o queda como una ponderación específica de este documento — se deja explícitamente para que el fundador decida, no se asume.
2. Gobernanza común de catálogos de Fase 1 (ahora seis) — misma recomendación repetida, cada vez con más urgencia de resolverse una sola vez.

**Recomendación profesional**: aprobar SPECIFICATION 009 **con la corrección de §2 ya incorporada** — no como estaba originalmente redactada. Es la especificación de Fase 1 con el hallazgo de mayor severidad hasta ahora: no una duplicación ni una laguna de esquema, sino un riesgo real y específico de violar la Constitución técnica, detectado y corregido antes de escribir una sola línea de código. El propio capítulo 23 predijo este escenario casi con las mismas palabras dos años de trabajo de blueprint antes de que ocurriera — es la prueba más fuerte, hasta ahora, de que la disciplina de invariantes permanentes de este proyecto funciona exactamente para lo que se diseñó.
