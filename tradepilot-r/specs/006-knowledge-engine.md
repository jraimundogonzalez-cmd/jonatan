# SPEC-006 · TradePilot Knowledge Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 13 (aprendizaje bayesiano continuo — Beta-Binomial, decaimiento exponencial τ, umbrales de confianza por ancho de intervalo), 22.5 §2.7 (AI Engine, corregido aquí — §2), 26 §2.4 (Grupo C, agregados de cartera que Knowledge Engine consume, nunca recalcula), 27 §2.8 (capacidad de Diagnóstico, absorbida aquí — §2), 28 §2 (Trade Set, formalizado como el sustantivo de evidencia), 29 §4 (re-ejecución continua de Diagnóstico, absorbida aquí — §2), 19 I9 (nunca predecir mercado — reafirmado en §7.3), 19 I16 (Zero Friction), 19 I17 (Evaluate ≠ Execute — reafirmado con máxima fuerza en este componente), SPEC-001 (Quant Engine, Explainable Quant — toda evidencia de Knowledge Engine es un `QuantResult<T>`)
**No re-abre ninguna decisión conceptual ya aprobada.** El hallazgo principal de este documento (§2) es de consolidación, no de rediseño: reconoce formalmente un módulo que ya era necesario y estaba disperso en tres capítulos distintos.

---

## 1. Objetivo del componente

### 1.1 Misión: memoria estructurada, nunca recomendación

Knowledge Engine transforma el historial de un trader en **conocimiento persistido, con evidencia y estado propio** — nunca en una recomendación, nunca en un cálculo nuevo, nunca en un veredicto de cumplimiento. Responde exactamente una pregunta: *"¿qué sabemos hoy sobre este trader?"* — y la responde siempre con datos verificables, nunca con una sugerencia de qué hacer al respecto.

### 1.2 Qué nunca debe hacer

1. **Nunca calcula una fórmula matemática por sí mismo.** Toda estadística (esperanza, ratio de consistencia, drawdown, distribución de R) se solicita a Quant Engine (26 §2.4) — Knowledge Engine la consume, la organiza, le da contexto temporal y de confianza, nunca la reimplementa.
2. **Nunca optimiza.** No busca la mejor configuración — eso es Optimizer (SPEC-005). Si un consumidor necesita "qué configuración sería mejor", Knowledge Engine no responde esa pregunta.
3. **Nunca interpreta reglas de cumplimiento.** No sabe qué es un límite de drawdown configurado por una prop firm — eso es Rule Engine (SPEC-004).
4. **Nunca emite una recomendación, decide un cambio o sugiere una mejora.** Es I17 (Evaluate ≠ Execute) aplicado en su forma más estricta hasta ahora: Knowledge Engine ni siquiera evalúa en el sentido de Rule Engine (comparar contra un límite) — solo **describe** lo que los datos muestran. La frontera entre "describir un patrón" y "sugerir un cambio" es la más delicada de todo este documento y se trata con el máximo rigor en §1.4 y §9.
5. **Nunca predice el mercado.** Cualquier conocimiento sobre "evolución temporal" o "tendencia" describe el comportamiento propio del trader ya observado, nunca una proyección de precio (I9, 23, reafirmado).

### 1.3 Responsabilidades

- Descubrir, almacenar y mantener actualizado conocimiento estructurado sobre el comportamiento histórico de un trader, en las 15 dimensiones pedidas (§3.3).
- Ser la única fuente de verdad de ese conocimiento — ningún otro componente vuelve a recalcularlo (§9).
- Adjuntar a todo conocimiento su evidencia, nivel de confianza, fecha de descubrimiento, fecha de última validación y estado (§4).
- Detectar automáticamente cuándo un patrón deja de representar el comportamiento actual del trader y "olvidarlo" (§6).
- Proteger activamente contra conocimiento espurio, redundante o contradictorio (§7) — no es un efecto secundario deseable, es un requisito de primera clase de este componente.

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Calcular cualquier fórmula del catálogo de Quant Engine | Quant Engine (SPEC-001) |
| Buscar la mejor configuración de gestión | Optimizer (SPEC-005) |
| Juzgar cumplimiento contra un límite configurado | Rule Engine (SPEC-004) |
| Decidir qué conocimiento mostrar al trader, cuándo, y con qué tono pedagógico | AI Engine / Trader Improvement Engine (29) — Knowledge Engine expone conocimiento, AI Engine decide su presentación (Coaching Card) |
| Decidir si un patrón detectado justifica una intervención priorizada | Improvement Prioritization Engine (30) — consume Knowledge Engine como una de sus fuentes de evidencia, nunca al revés |

---

## 2. Hallazgo de consolidación: Knowledge Engine no nace de la nada

**Problema detectado**: el pedido del fundador describe un componente nuevo, pero tres capítulos ya aprobados llevaban tiempo necesitando exactamente esta pieza sin que nadie la nombrara formalmente:

1. **13 (Aprendizaje bayesiano continuo)** ya mantiene un posterior Beta-Binomial por bucket de RR, con decaimiento temporal (`τ`) y una etiqueta de confianza derivada del ancho del intervalo de credibilidad — es, literal y exactamente, conocimiento estructurado con evidencia, confianza y capacidad de "olvidar" (el decaimiento exponencial). Vivía descrito como "proceso core-adjacent" de AI Engine (22.5 §2.7: "estado del perfil de aprendizaje bayesiano"), sin componente propio ni esquema de persistencia formal.
2. **27 §2.8 (capacidad de Diagnóstico)** de Quant Capabilities formuló la pregunta "¿qué patrón de comportamiento explica este resultado?" como una capacidad de consulta, pero nunca definió dónde vive el resultado de esa consulta una vez calculado — cada vez que se necesitaba, se recalculaba.
3. **29 §4 (sistema de aprendizaje del Trader Improvement Engine)** ya describía, en prosa, exactamente el ciclo de vida que este documento formaliza: *"el sistema re-ejecuta Diagnóstico de forma continua... y, para cada patrón ya señalado antes, comprueba en cada revisión si se validó... o sigue vigente"* — sin nombrar nunca el lugar donde ese patrón "ya señalado antes" se almacena entre una revisión y la siguiente.

**Solución aplicada**: estas tres piezas se consolidan en Knowledge Engine, que se añade formalmente como **14º módulo oficial** del sistema (extiende el mapa de 22.5 §1). No es una ampliación de alcance de este documento — es la corrección de una omisión real: sin un componente propio, cada consumidor (AI Engine, Rule Engine indirectamente vía el semáforo, Improvement Prioritization Engine) habría estado forzado a reconstruir el mismo conocimiento por su cuenta, exactamente lo que el fundador acaba de prohibir explícitamente ("nunca volverán a reconstruirlo").

**Impacto en 22.5 §2.7**: la fila "Recibe" de AI Engine ("estado del perfil de aprendizaje bayesiano, proceso core-adjacent") se corrige para leer "conocimiento estructurado de Knowledge Engine (solo lectura)" — mismo patrón de corrección ya usado en 26 §8 sobre Risk Engine. El contrato de AI Engine no cambia en su forma, cambia la precisión de quién produce ese dato.

**Por qué es mejor que la alternativa**: la alternativa de "dejar el aprendizaje bayesiano dentro de AI Engine y tratar el Diagnóstico como una función de utilidad sin estado propio, recalculada cada vez" es exactamente lo que ya ocurría de forma implícita — funciona a poca escala, pero es el mismo tipo de deuda que 20 §0 identificó para `account_rules`: cuanto más tarde se corrija, más consumidores habrá que migrar. Consolidarlo ahora, con Rule Engine y Optimizer ya construidos como precedente de "catálogo pequeño de primitivas, extensible sin tocar el núcleo", es el momento correcto.

---

## 3. Arquitectura interna

### 3.1 Subcomponentes

```
knowledge-engine/
├── dimensions/         Catálogo de categorías de conocimiento (dato, no código) — §3.3
├── detectors/            4 arquetipos de detector — §3.2
├── significance/          Corrección de comparaciones múltiples antes de promover un hallazgo — §5.3
├── decay/                 Reponderación temporal, reutiliza 13 §4 — §6
├── lifecycle/              Máquina de estados activo/debilitado/descartado — §4.3
├── consolidation/          Detección de redundancia y contradicción — §7.4, §7.5
├── store/                  Persistencia de Knowledge Item, historial append-only de validaciones
└── query/                   Interfaz de solo lectura — §8
```

### 3.2 Los 4 arquetipos de detector (mismo patrón ya validado dos veces en este blueprint)

**Es la tercera vez que el proyecto llega a la misma conclusión arquitectónica de forma independiente**: Rule Engine (SPEC-004) cubre 15 tipos de regla con 7 arquetipos; Optimizer (SPEC-005) cubre seis capacidades de búsqueda futuras con una sola interfaz *ask/tell*; aquí, las 15 dimensiones pedidas se cubren con **4 arquetipos de detector**, no 15 implementaciones específicas:

| Arquetipo | Qué hace | Dimensiones que cubre |
|---|---|---|
| **Comparación de segmento** | Compara una métrica de Quant Engine entre un subconjunto de operaciones (un Trade Set, 28 §2) y su complemento o la línea base de la cuenta | Horarios, Market Sessions, Instrumentos, Duración, Frecuencia |
| **Posterior de comportamiento** | Reutiliza el modelo Beta-Binomial de 13 §6.2 sobre un bucket — probabilidad de que el trader dispare/gestione de una forma concreta | RR, Gestión, Parciales, Break Even |
| **Métrica trazada con tendencia** | Sigue el valor de una métrica agregada de Quant Engine (Grupo C, 26 §2.4) a lo largo del tiempo, con re-ponderación por decaimiento (§6) | Consistencia, Drawdown, Expectancy, Recuperación |
| **Patrón repetitivo** | Busca una secuencia de acciones/desenlaces que se repite con frecuencia mayor a la esperable por azar sobre un Trade Set | Patrones repetitivos |

**Evolución temporal no es un quinto arquetipo** — es una propiedad transversal: cualquier Knowledge Item, de cualquier arquetipo, lleva su propia serie histórica de reevaluaciones (§4.3) de la que se deriva si el patrón es estable, se está fortaleciendo o se está debilitando. Tratarla como un arquetipo aparte habría duplicado lógica de tendencia en los otros cuatro — se modela una sola vez, en `lifecycle`, y se hereda por todos.

### 3.3 Catálogo de dimensiones (dato, no código)

Las 15 dimensiones pedidas viven como filas de una tabla de catálogo (`knowledge_dimensions`), cada una apuntando a uno de los 4 arquetipos — igual que `rule_definitions.archetype` en SPEC-004. Añadir una dimensión nueva en el futuro (p.ej. "correlación entre cuentas", ya anticipada en 28 §2 nota sobre `R` como coeficiente) es una fila nueva, nunca una implementación de arquetipo nueva, salvo que la dimensión requiera una *forma* de comparación genuinamente distinta a las 4 existentes — mismo criterio de extensión ya fijado en SPEC-004 §11 para Rule Engine.

```sql
create table public.knowledge_dimensions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,              -- 'schedule', 'market_session', 'instrument', 'rr', ...
  name text not null,
  detector_archetype text not null check (detector_archetype in (
    'segment_comparison','behavioral_posterior','tracked_metric_trend','repeated_pattern'
  )),
  parameter_schema jsonb not null
);
```

---

## 4. Knowledge Item — modelo de dominio

### 4.1 Campos (los cinco pedidos explícitamente por el fundador, más el mínimo estructural)

```sql
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension_key text not null references public.knowledge_dimensions(key),
  trade_set_definition jsonb not null,        -- 28 §2 — el filtro exacto que define la evidencia (§4.2)

  statement jsonb not null,                     -- hallazgo estructurado, no texto libre — §4.1.1
  evidence jsonb not null,                       -- QuantResult<T> completo (SPEC-001 §7) que respalda el statement
  confidence_label text not null check (confidence_label in ('alta','media','baja')),   -- 13 §2, reutilizado, nunca reinventado
  confidence_interval jsonb not null,             -- [límite_inferior, límite_superior], mismo formato que 13 §2

  discovered_at timestamptz not null default now(),
  last_validated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','weakening','discarded')),

  contradicts uuid[] default '{}',                -- §7.5
  redundant_with uuid[] default '{}'               -- §7.4
);

create table public.knowledge_item_history (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  validated_at timestamptz not null default now(),
  confidence_label text not null,
  confidence_interval jsonb not null,
  status_at_this_point text not null
);
-- append-only, mismo mecanismo que rule_evaluations (SPEC-004 §2.2) — nunca UPDATE/DELETE
```

**4.1.1 `statement` estructurado, nunca texto libre**: un Knowledge Item nunca almacena una frase — almacena una estructura mínima (`{ metric, segment, comparison, magnitude }`, p.ej. `{ metric: "expectancy", segment: "london_session", comparison: "higher_than_baseline", magnitude: "+0.34R" }`). Es lo que lo hace, en palabras del fundador, "reutilizable" — cualquier consumidor puede componer su propia frase en su propio idioma o tono (AI Engine, 06 §3) sin depender de un texto ya redactado que tendría que volver a parsear.

### 4.2 Evidencia = Trade Set + `QuantResult<T>`

**Ninguna pieza de evidencia se inventa aquí** — reutiliza dos conceptos ya aprobados: el **Trade Set** (28 §2, el sustantivo ya formalizado para "un subconjunto filtrado y nombrado de operaciones") define exactamente sobre qué muestra se calculó el hallazgo, y el **`QuantResult<T>`** (SPEC-001 §7, Explainable Quant) es la evidencia numérica completa — resultado, fórmula, versión, datos, confianza — devuelta por Quant Engine al evaluar esa métrica sobre ese Trade Set. Un Knowledge Item sin uno de los dos no es válido por construcción de esquema (ambos campos son `not null`).

### 4.3 Máquina de estados — activo / debilitado / descartado

```
(detección inicial, supera la corrección de significancia, §5.3)
        │
        ▼
    ┌─────────┐   confianza cae un nivel completo (alta→media, media→baja)
    │ Active  │──────────────────────────────────────────────▶ ┌────────────┐
    └────┬────┘                                                  │ Weakening   │
         │                                                        └──────┬─────┘
         │  se re-valida y la confianza vuelve a subir                    │
         │◀───────────────────────────────────────────────────────────────┘
         │                                                                 │
         │                                    confianza "baja" persiste N        │
         │                                    reevaluaciones consecutivas,       │
         │                                    o el signo del hallazgo se         │
         │                                    invierte por completo             │
         │                                                                       ▼
         │                                                                 ┌────────────┐
         └────────────────────────────────────────────────────────────────▶│ Discarded   │
                                                                             └────────────┘
                                                                          (estado final —
                                                                    una nueva detección sobre el
                                                                    mismo patrón crea un Knowledge
                                                                    Item nuevo, nunca revive el viejo,
                                                                    mismo principio que Snapshot: el
                                                                    historial descartado no se reescribe)
```

`N` (reevaluaciones consecutivas en confianza "baja" antes de descartar) es un parámetro configurable, no hardcodeado — evita descartar un patrón real por una única racha de ruido (mismo cuidado que 30 §5 condición 4, "sin experimento activo... si ya se sugirió y no ha pasado suficiente muestra").

---

## 5. Pipeline de descubrimiento

### 5.1 Disparo

Asíncrono, consumiendo `OperacionCerrada` (SPEC-002 §3.1) — mismo patrón de disparo ya usado por Rule Engine (SPEC-004 §4.1) y por el propio 13 §3. Nunca síncrono, nunca en el camino crítico de registro de una Operación (I16).

### 5.2 Generación de candidatos

Cada detector activo (instancia de uno de los 4 arquetipos, §3.2, parametrizada por una fila de `knowledge_dimensions`) se ejecuta sobre el Trade Set correspondiente y produce un **Knowledge Candidate** — la misma estructura que un Knowledge Item (§4.1) pero todavía no persistida ni promovida.

### 5.3 Corrección de comparaciones múltiples — el hallazgo estadístico central de esta especificación

**Problema detectado, exactamente el que el fundador pide buscar ("sobreajuste... correlaciones falsas")**: en cada pasada del pipeline, Knowledge Engine no evalúa un solo detector — evalúa potencialmente docenas (15 dimensiones × múltiples segmentaciones posibles por dimensión: por símbolo, por sesión, por día de la semana, por bucket de RR...). Si cada detector individual usa el mismo umbral de confianza que 13 §2 definió para **una** hipótesis aislada ("Confianza alta" cuando el IC es estrecho), el sistema completo comete el error estadístico clásico de comparaciones múltiples: evaluando, por ejemplo, 40 segmentaciones simultáneas con un criterio individual de "95% de confianza", es matemáticamente esperable que **2 de ellas** parezcan un patrón real por puro azar, incluso si el trader no tiene ningún patrón genuino en absoluto. Promover automáticamente cualquier detector que supere su propio umbral, sin ajustar por cuántos se evaluaron a la vez, produciría precisamente el conocimiento espurio que este documento existe para prevenir.

**Solución aplicada**: antes de promover cualquier Knowledge Candidate de una misma pasada del pipeline a Knowledge Item, se aplica un procedimiento de **control de tasa de falsos descubrimientos** (Benjamini-Hochberg o su equivalente bayesiano sobre probabilidades posteriores, según corresponda al tipo de evidencia del detector) sobre el conjunto completo de candidatos generados en esa pasada — no sobre cada uno de forma aislada. Concretamente: se ordenan los candidatos por su fuerza de evidencia (de más a menos extrema), y solo se promueven los que superan un umbral que se vuelve más estricto cuantos más candidatos se evaluaron simultáneamente — el mismo principio, aplicado aquí por primera vez en el proyecto de forma explícita, que ya evitaba conclusiones prematuras a baja muestra en 13 §6.2, ahora extendido de "una hipótesis con poca muestra" a "muchas hipótesis evaluadas a la vez".

**Por qué no se resuelve simplemente subiendo el umbral de confianza global**: subir el umbral para todos los detectores (p.ej. exigir siempre "Confianza alta") penalizaría igual a un trader con muy pocos patrones detectables a la vez (poco riesgo de falso positivo, umbral innecesariamente duro) que a uno donde se evalúan muchas segmentaciones simultáneas (mucho riesgo, mismo umbral) — la corrección debe ser proporcional al número de comparaciones de esa pasada concreta, no un valor fijo.

### 5.4 Promoción y actualización

Un candidato que supera §5.3: si no existe un Knowledge Item activo para esa combinación `(dimension_key, trade_set_definition)`, se crea uno nuevo (`discovered_at = ahora`). Si ya existe, se actualiza (`last_validated_at`, nueva fila en `knowledge_item_history`, posible transición de estado, §4.3) — nunca se duplica.

---

## 6. Olvido automático — reutiliza 13 §4, no inventa un mecanismo nuevo

**El "olvido" pedido por el fundador es, matemáticamente, el mismo problema que 13 §4 ya resolvió para el aprendizaje bayesiano** ("un trader que mejora o empeora su disciplina con el tiempo" — la razón original del decaimiento exponencial): cada vez que un detector se re-ejecuta (§5.1), las operaciones que forman su Trade Set se reponderan con `peso(operación) = exp(−Δt/τ)` (13 §4, mismo `τ` configurable, valor por defecto 6 meses). Un patrón que fue real hace un año pero ha dejado de manifestarse en el comportamiento reciente ve su intervalo de credibilidad ensancharse progresivamente (menos peso efectivo de muestra reciente que lo sostenga) hasta cruzar los umbrales de §4.3 y transicionar a `weakening` y, eventualmente, a `discarded` — sin que ningún código nuevo decida "esto ya no aplica", es una consecuencia matemática directa de la misma fórmula ya aprobada.

**Por qué reutilizar el marco bayesiano de 13, y no un test de hipótesis frecuentista repetido, protege además contra un segundo problema estadístico (peeking / optional stopping)**: si Knowledge Engine re-evaluara cada patrón con un test de hipótesis clásico cada vez que llega una operación nueva, y decidiera "confirmar" el patrón la primera vez que el test cruza significancia, estaría cometiendo el error de "mirar y decidir" repetidamente — con suficientes miradas, cualquier ruido cruza significancia alguna vez, por azar. La actualización bayesiana continua (13 §6.2, ya vigente) no tiene este problema: el intervalo de credibilidad en cualquier momento es una descripción válida del estado de conocimiento en ese momento, sin importar cuántas veces se haya mirado antes — es una propiedad conocida de la inferencia bayesiana secuencial que este documento hereda gratuitamente por reutilizar 13 en vez de diseñar un mecanismo de re-testeo propio. Se documenta explícitamente porque es una razón adicional, no solo de simplicidad, para no haber diseñado un sistema de decaimiento nuevo.

---

## 7. Contra sesgos y patrones espurios (Challenge Mode formal, punto por punto)

### 7.1 Comparaciones múltiples

Resuelto en §5.3 — es el hallazgo central de este documento.

### 7.2 Peeking / optional stopping

Resuelto en §6 — mitigado por herencia del marco bayesiano de 13, no por un mecanismo nuevo.

### 7.3 Confusión y correlación falsa — limitación honesta, no resuelta por diseño

**Problema detectado, y declarado sin disfrazarlo**: un detector de "Comparación de segmento" (§3.2) es marginal/univariado por construcción — compara una métrica entre un segmento y su complemento, una dimensión a la vez. Si un trader opera peor los viernes *porque* opera con mayor frecuencia los viernes (y la frecuencia alta, no el día, es la causa real), un detector de "Horarios" y un detector de "Frecuencia" podrían señalar dos hallazgos "distintos" que en realidad son la misma causa subyacente vista desde dos ángulos — ninguno de los dos detectores, por diseño, controla por la otra variable. **No se resuelve en esta especificación** — resolverlo requeriría análisis multivariado o causal, explícitamente fuera de alcance (mismo criterio que TradePilot Labs para el Optimizer: no se construye sin investigación validada). **Mitigación aplicada, no una solución**: todo `statement` (§4.1.1) se etiqueta estructuralmente como correlacional — ningún Knowledge Item afirma causalidad — y cualquier consumidor (AI Engine, 06 §3) tiene prohibido redactar un hallazgo de Knowledge Engine con lenguaje causal ("porque") en vez de descriptivo ("cuando... tiende a..."), mismo tipo de disciplina de lenguaje que I9 ya exige para no cruzar a predicción de mercado.

### 7.4 Redundancia — solape de Trade Set

**Problema detectado**: dos Knowledge Items de dimensiones distintas pueden describir, sin saberlo, el mismo fenómeno real si sus Trade Sets se solapan casi por completo (el ejemplo de §7.3: "sesión de Londres" y "EURUSD" si el trader casi solo opera EURUSD en Londres). Mostrar ambos como si fueran dos hallazgos independientes exagera la evidencia percibida. **Solución aplicada**: `consolidation` calcula la similitud de Jaccard entre los Trade Sets de cualquier par de Knowledge Items activos sobre el mismo usuario; un solape por encima de un umbral configurable marca ambos con `redundant_with` (§4.1) — no se fusionan automáticamente (fusionar sin criterio humano podría perder matices reales), se marcan para que AI Engine los presente como una sola observación, nunca como dos.

### 7.5 Contradicción

**Problema detectado**: dos Knowledge Items con Trade Sets solapados pueden tener `statement`s lógicamente opuestos (uno dice "tiende a cerrar pronto en este segmento", otro dice "tiende a dejar correr en el mismo segmento", sobre evidencia parcialmente superpuesta) — posible si las ventanas temporales de validación difieren o si el comportamiento del trader genuinamente cambió a mitad del periodo cubierto. **Solución aplicada**: cuando `consolidation` detecta dos `statement`s con `magnitude` de signo opuesto sobre el mismo `metric` y Trade Sets solapados, ambos se marcan mutuamente en `contradicts` (§4.1) — ninguno se descarta automáticamente ni se prioriza sobre el otro; ambos permanecen visibles con la marca de contradicción hasta que una reevaluación futura (§5.4) resuelva cuál sigue vigente. Nunca se oculta información para presentar una historia más limpia de lo que los datos realmente muestran.

### 7.6 Sesgo de confirmación estructural

**Problema detectado, específico de este dominio**: si los detectores solo buscan patrones "negativos" (dónde el trader pierde valor) porque son los que alimentan la Coaching Card (29 §3), Knowledge Engine terminaría siendo, de facto, un catálogo sesgado hacia el déficit, nunca hacia la fortaleza. **Mitigación**: los 4 arquetipos de detector (§3.2) son neutrales por diseño — "Comparación de segmento" puede producir tanto un hallazgo de bajo como de alto rendimiento en un segmento; la selección de qué mostrar y con qué énfasis pedagógico es responsabilidad de AI Engine (29 §3, ya diseñado para nunca decir "has cometido un error"), no de Knowledge Engine, que almacena ambos tipos de hallazgo con el mismo tratamiento estadístico.

---

## 8. Interfaz pública — consulta de solo lectura

```
consultar(user_id: string, filtros?: { dimension_key?: string; status?: EstadoConocimiento[]; trade_set_id?: string }): Result<KnowledgeItem[], KnowledgeEngineError>

consultarUno(knowledge_item_id: string): Result<KnowledgeItem, KnowledgeEngineError>

consultarHistorial(knowledge_item_id: string): Result<KnowledgeItemHistoryEntry[], KnowledgeEngineError>

type KnowledgeEngineError =
  | { code: "USER_NOT_FOUND" }
  | { code: "KNOWLEDGE_ITEM_NOT_FOUND" }
```

No existe ninguna función de escritura pública más allá del propio pipeline interno (§5) — ningún consumidor externo puede crear, editar ni forzar el estado de un Knowledge Item directamente, ni siquiera AI Engine. Es la aplicación más estricta de I17 en todo el blueprint: ni siquiera "evaluar" está expuesto como acción invocable por otro módulo, solo como un proceso interno disparado por eventos (§5.1).

---

## 9. Integraciones

| Módulo | Dirección | Qué cruza |
|---|---|---|
| Quant Engine | Knowledge Engine → Quant Engine | Solicita cálculo de métricas (Grupo C, 26 §2.4) sobre un Trade Set — nunca al revés |
| Operations Engine | Operations Engine → Knowledge Engine (evento) | `OperacionCerrada` dispara el pipeline (§5.1) |
| AI Engine | Knowledge Engine → AI Engine, solo lectura | AI Engine consulta (§8) para construir la Coaching Card (29 §3) — nunca escribe en Knowledge Engine |
| Improvement Prioritization Engine | Knowledge Engine → Improvement Item, solo lectura | Un Knowledge Item activo con confianza suficiente es una de las fuentes de evidencia de un candidato de mejora (30 §3, "Qué evidencia histórica lo respalda") — Knowledge Engine nunca decide si algo se prioriza |
| Rule Engine | Ninguna | Dominios completamente independientes — Knowledge Engine no conoce reglas de cumplimiento, Rule Engine no conoce patrones de comportamiento |

---

## 10. Eventos

### 10.1 Emitidos

| Evento | Condición |
|---|---|
| `ConocimientoDescubierto` *(nuevo)* | Se crea un Knowledge Item nuevo (§5.4) |
| `ConocimientoDebilitado` *(nuevo)* | Transición Active → Weakening (§4.3) |
| `ConocimientoDescartado` *(nuevo)* | Transición → Discarded (§4.3) |

Ninguno de los tres dispara una acción automática en otro módulo — son puramente informativos, consumidos de forma pasiva por quien los necesite (p.ej. Improvement Prioritization Engine podría reaccionar a `ConocimientoDescartado` re-evaluando un candidato que dependía de ese conocimiento, pero la decisión de reaccionar es enteramente suya).

### 10.2 Consumidos

| Evento | Origen | Efecto |
|---|---|---|
| `OperacionCerrada` | Operations Engine | Dispara el pipeline de descubrimiento (§5.1) |

---

## 11. Rendimiento

- El pipeline completo (§5) es asíncrono, nunca en el camino crítico de Operations Engine (I16, SPEC-002 §6).
- Cada detector opera sobre un Trade Set acotado (filtro por dimensión, nunca el historial completo sin segmentar) — mismo principio de escalabilidad ya aplicado en SPEC-001 §5.3 (modo streaming) y SPEC-004 §14.5 (append-only con lectura cacheada).
- La corrección de comparaciones múltiples (§5.3) es O(D log D) sobre el número de candidatos `D` de una pasada (ordenar y aplicar el umbral escalonado) — trivial incluso con varias decenas de detectores simultáneos.
- Las lecturas (`consultar`, §8) son consultas indexadas sobre `knowledge_items` por `(user_id, status)` — mismo patrón de lectura O(1)/O(log N) ya usado en todos los componentes anteriores para no cargar el historial completo en cada consulta.

---

## 12. Auditoría — hallazgos adicionales

### 12.1 Riesgo de sobreajuste temporal con `τ` demasiado corto

Un `τ` (13 §4) configurado demasiado bajo haría que Knowledge Engine "olvide" patrones genuinos tras rachas cortas de varianza normal, generando ciclos de descubrir→descartar→redescubrir el mismo patrón repetidamente — ruido operativo, no conocimiento. Mitigación: el valor por defecto de `τ` (6 meses, ya fijado en 13 §4) se hereda sin cambios; cualquier ajuste queda sujeto a validación empírica, no a intuición, mismo criterio ya aplicado repetidas veces en este proyecto.

### 12.2 Verificación de independencia de orden

Mismo tipo de verificación que SPEC-004 §14.2 y SPEC-005 §13.3 exigieron para sus respectivos componentes: ¿puede el orden en que se procesan los eventos `OperacionCerrada` de distintas Cuentas de un mismo usuario alterar el resultado final de un Knowledge Item? No, porque cada detector opera sobre el Trade Set completo disponible en el momento de la evaluación (una suma/agregación conmutativa sobre las operaciones que lo componen, igual que `calcularEsperanza`, SPEC-001), nunca sobre un acumulador que dependa del orden de llegada de eventos individuales — a diferencia de Rule Engine (SPEC-004 §14.2), aquí no existe un "estado cacheado que una escritura tardía pueda sobrescribir con un valor viejo", porque cada pasada del pipeline recalcula el Trade Set completo vigente, no aplica un delta incremental. Se confirma, no se corrige — no había ningún hallazgo que resolver en este eje.

---

## 13. Limitaciones a 10 años

1. **La confusión/correlación falsa (§7.3) sigue sin resolverse por diseño** — es la limitación más honesta y más importante de todo el documento; si en el futuro se valida demanda real de análisis multivariado o causal, requiere su propia especificación, posiblemente como línea de investigación de TradePilot Labs (mismo tratamiento que el Optimizer recibió para algoritmos avanzados).
2. **El umbral de solape de Jaccard para redundancia (§7.4) es un parámetro sin validación empírica todavía** — se dimensiona razonablemente pero se revisa con datos reales de uso, no se afina especulativamente aquí.
3. **La corrección de comparaciones múltiples (§5.3) asume que los detectores de una misma pasada son razonablemente independientes** — si dos detectores comparten Trade Sets casi idénticos (el mismo caso de §7.4), tratarlos como comparaciones independientes en el ajuste de FDR es una simplificación; la interacción exacta entre §5.3 (significancia) y §7.4 (redundancia, detectada después de promover) es un candidato a refinarse cuando haya volumen real de detectores simultáneos.

---

## Riesgos

1. **Que la disciplina de "nunca redactar con lenguaje causal" (§7.3) dependa enteramente de AI Engine, sin que Knowledge Engine pueda forzarla estructuralmente más allá del `statement` tipado** — mismo tipo de riesgo de disciplina de implementación ya aceptado en otros componentes (p.ej. SPEC-003 Riesgo #2 sobre no leer el contenido de un Snapshot).
2. **El número de detectores simultáneos puede crecer sin gobernanza** (igual que la Rule Library, SPEC-004 §16 punto 2, y el registro de estrategias del Optimizer, SPEC-005 §14 punto 2) — mismo patrón de riesgo de curación de catálogo repetido por tercera vez en Fase 1, candidato a una solución de gobernanza común en vez de tres soluciones ad-hoc.
3. **`N` (reevaluaciones antes de descartar, §4.3) sin valor validado empíricamente** — un valor demasiado bajo reintroduce el riesgo de §12.1; uno demasiado alto retrasa el "olvido" pedido explícitamente por el fundador. Se deja como parámetro de configuración, no como constante fija, precisamente para poder ajustarlo con datos reales sin una migración.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Le da una casa propia, con esquema y garantías estadísticas reales, a un conocimiento que el producto ya necesitaba y que tres capítulos distintos (13, 27, 29) habían descrito parcialmente sin nunca asignarle persistencia ni un dueño único — evita que cada consumidor futuro reconstruya su propia versión del mismo conocimiento, exactamente el riesgo que el fundador nombró de forma explícita.

**¿Qué sobra?** Nada de 13/27/29 se descarta — se consolida.

**¿Qué falta?** Antes de este documento faltaba: el mecanismo de corrección de comparaciones múltiples (§5.3, el hallazgo central), la máquina de estados explícita de olvido (§4.3, más precisa que la prosa de 29 §4), y el tratamiento honesto de confusión/correlación falsa (§7.3) como limitación declarada en vez de ignorada.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §5.3 — ningún equipo cuantitativo profesional acepta una señal como "significativa" sin corregir por cuántas señales se probaron a la vez; es el error más común y más caro en investigación cuantitativa amateur, y este documento lo previene por diseño en vez de descubrirlo tras el primer falso positivo visible al trader.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — de gobernanza y de parámetros pendientes de validación empírica, no de ambigüedad de diseño.

**Nivel de madurez**: 94%. Modelo de dominio, pipeline, corrección estadística, máquina de estados de olvido y las seis salvaguardas contra sesgo (§7) están completos y son directamente implementables; lo pendiente es exclusivamente calibración de parámetros con datos reales y la limitación honestamente declarada de análisis causal (§13.1).

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Knowledge Engine tal como está especificado.

**Decisiones abiertas**:
1. Si la confusión/correlación falsa (§7.3, §13.1) se aborda en el futuro como línea de investigación de TradePilot Labs — recomendación: sí, cuando exista evidencia real de que los consumidores necesitan más que correlación marginal.
2. Gobernanza común para los tres catálogos de Fase 1 con el mismo riesgo de curación (Rule Library, registro de estrategias del Optimizer, catálogo de dimensiones de Knowledge Engine) — se recomienda tratarla como una única decisión de proceso, no tres.

**Recomendación profesional**: aprobar SPECIFICATION 006. Es la primera especificación de Fase 1 cuyo hallazgo principal no es una corrección de una contradicción puntual, sino el reconocimiento de un componente que el propio blueprint necesitaba desde el capítulo 13 sin haberlo nombrado nunca — y lo entrega con una garantía estadística real (control de falsos descubrimientos) que ninguna versión anterior del "aprendizaje continuo" tenía. Recomiendo que la próxima especificación (AI Engine, todavía sin construir) parta explícitamente de Knowledge Engine como su fuente de datos, nunca reconstruyendo ninguna de las piezas que este documento ya resuelve.
