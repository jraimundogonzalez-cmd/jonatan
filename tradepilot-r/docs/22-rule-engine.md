# 22 · Rule Engine (diseño conceptual)

*Voz: Cofundador / CTO / Product Architect — Challenge Mode obligatorio (19 §1.1). Sin tablas, sin código, sin APIs — diseño conceptual únicamente, por instrucción explícita del fundador.*

## 0. Encuadre

Este capítulo hereda tres requisitos ya fijados en capítulos anteriores, no se diseña desde cero: (1) cero código específico de empresa, solo reglas configurables (19 regla 4); (2) el patrón Snapshot es ya regla permanente (19 regla 13) — una Cuenta nunca referencia en vivo su Perfil de Reglas; (3) el evaluador de reglas es "core por dependencia, módulo por construcción" (21 §2.3) — Cuenta necesita que exista, pero no conoce su taxonomía interna.

## 1. La pregunta del arquitecto — respuesta directa

*¿Cómo diseñaría esto un arquitecto de Stripe, Shopify, Linear o Notion sabiendo que dentro de diez años existirán cientos de empresas con reglas que hoy no conocemos?*

Ninguna de esas cuatro empresas resuelve la variedad futura con flexibilidad ilimitada de configuración. La resuelven con **un conjunto pequeño y fijo de primitivas bien diseñadas, compuestas sin límite**:

- **Notion** no tiene un tipo de bloque por cada documento posible — tiene ~20 primitivas (texto, tabla, base de datos, embed...) y la variedad infinita emerge de cómo se combinan, no de cuántos tipos existen.
- **Linear** no tiene un motor de estados por equipo — tiene una gramática fija de categorías (`unstarted`/`started`/`completed`/`cancelled`) y cada equipo personaliza etiquetas y orden *dentro* de esa gramática, nunca fuera de ella.
- **Shopify** no modifica su core de checkout por comerciante — expone puntos de extensión (apps, scripts) y el core permanece idéntico para los cientos de miles de tiendas que lo usan.
- **Stripe** no añade una rama de código por cada nuevo caso de fraude — Radar evalúa reglas expresadas sobre un conjunto fijo y versionado de atributos del objeto `Charge`.

La lección común, y la que se adopta aquí: **la extensibilidad no viene de que el sistema pueda expresar cualquier cosa, viene de que un número pequeño de primitivas bien elegidas cubre casi todo, y el resto se añade como una primitiva nueva — no como una excepción**. Esto define directamente la arquitectura de §3.

## 2. Alternativa considerada y descartada: motor de expresiones genérico

Antes de aceptar "biblioteca de primitivas" como la respuesta, se evaluó en serio la alternativa más flexible posible: un **motor de expresiones** (al estilo JSON Logic, o las reglas de Stripe Radar) donde cada empresa define sus reglas como fórmulas libres sobre los datos de la cuenta, sin necesidad de que el equipo de TradePilot añada nunca una primitiva nueva.

**Por qué se descarta, aplicando las prioridades del producto (19 §6, en orden)**:
- *Precisión matemática (prioridad #1)*: una expresión libre, escrita por un usuario o por la comunidad, no tiene las garantías de corrección que sí tiene un evaluador cerrado, escrito y testeado una sola vez por el equipo. El coste de un error aquí no es una mala recomendación (13 §6.3) — es un drawdown mal calculado, que es exactamente el tipo de fallo que este producto existe para prevenir.
- *Rapidez de uso / experiencia móvil (prioridades #2-3)*: nadie configura una regla de drawdown escribiendo una expresión lógica desde el móvil en 30 segundos (10). Un catálogo de primitivas con parámetros (elegir "Trailing Drawdown", introducir "5%") sí es compatible con esa experiencia; un lenguaje de expresiones no lo es.
- *Seguridad y superficie de ataque*: un motor de expresiones abierto a configuración de terceros (aunque sea "solo datos") es una superficie de inyección lógica y de cómputo descontrolado que un catálogo cerrado de evaluadores no tiene.

**Se adopta la biblioteca de primitivas compuestas — no por ser la única opción técnicamente viable, sino por ser la que gana bajo las prioridades ya fijadas del producto.** Es la respuesta honesta a "busca una alternativa mejor": existe, se consideró, y pierde frente a la propuesta del fundador una vez aplicados los criterios que el propio proyecto ya se había dado.

## 3. Arquitectura conceptual — jerarquía de reglas

```
Rule Library (catálogo global — una entrada por comportamiento distinto, nunca por empresa)
  └─ Rule Definition (metadata + esquema de parámetros + referencia a un Evaluador)
       └─ Rule Instance (una Definition + valores concretos de parámetros, dentro del
                          conjunto compuesto por una Empresa)
            └─ Rule Evaluation (resultado de evaluar esa instancia contra el estado de
                                 una Cuenta/Operación, en un momento dado — vía el
                                 RuleProfileSnapshot de 21.5 §2)
```

### 3.1 Qué pertenece al núcleo del motor

Solo tres cosas, y deben ser las que casi nunca cambian:

1. El contrato genérico `Evaluador(parámetros, estado) → Resultado` — una interfaz, no una implementación por regla.
2. Un conjunto pequeño y fijo de **arquetipos de evaluador** (§4) — no uno por regla humana, uno por *forma* de cálculo. Se identifican 7 arquetipos que cubren la biblioteca completa de §6; añadir un arquetipo nuevo debe ser un evento raro, no rutinario.
3. El orquestador de evaluación (§5) — sabe recorrer un conjunto de Rule Instances, resolver dependencias entre ellas, y agregar resultados. No sabe qué significa "drawdown".

El núcleo **nunca** contiene el nombre de una empresa, ni una lista de reglas por empresa, ni un `if`/`switch` sobre un tipo de regla concreto más allá de invocar su arquetipo genérico.

### 3.2 Qué pertenece a la definición de una regla (Rule Definition, en la Library)

Metadata (nombre, descripción, categoría), esquema de parámetros (qué necesita configurarse y con qué validación — p.ej. un porcentaje entre 0 y 100), el arquetipo de evaluador que usa (§4), el **scope** (§3.4: `account_state` u `operation_event`), y si es una **regla de cumplimiento** (produce compliant/violated) o una **regla de cálculo** (alimenta una fórmula sin verdicto propio — es el caso de Profit Split, ver §6). Añadir una Rule Definition que reutiliza un arquetipo existente es **pura configuración de datos, sin código** — es el caso común. Solo cuando ninguna forma de cálculo existente sirve hace falta un arquetipo nuevo (§8, límite reconocido explícitamente, no escondido).

### 3.3 Qué pertenece a la configuración de una empresa (Rule Profile)

Una Empresa compone su propio conjunto de Rule Instances eligiendo de la Library y fijando parámetros — **nunca hereda en vivo de otra Empresa**. Cuando el catálogo de plantillas compartidas (20, Fase 2) ofrece "empezar desde FTMO Challenge Fase 1", lo que ocurre es una **copia** de las Rule Instances de esa plantilla al nuevo perfil — desde ese momento son independientes, editar una no afecta a la otra. Es exactamente el mismo principio que el patrón Snapshot (19 regla 13) aplicado ahora también a la composición, no solo a la adopción por una Cuenta — **clonar, nunca heredar en vivo**, es una única regla aplicada dos veces.

### 3.4 Qué pertenece a la ejecución de una operación

Aquí aparece una distinción que ninguna de las 15 reglas listadas por el fundador comparte de la misma forma, y que el motor debe modelar explícitamente: no todas las reglas se evalúan en el mismo momento ni sobre los mismos datos.

- **Reglas de estado de cuenta** (`scope: account_state`) — Trailing/Static/EOD Drawdown, Daily Loss Limit, Maximum Loss, Profit Target, Minimum Trading Days, Consistency Rule. Se evalúan sobre el estado agregado de la Cuenta (capital, histórico), se recalculan cuando ese estado cambia (21.5 §7, eventos `OperacionCerrada`/`CapitalEventoRegistrado`) — no dependen de una Operación concreta.
- **Reglas de evento de operación** (`scope: operation_event`) — Instrument Restriction, Position Size Restriction, Time Restriction, News Restriction, Overnight Restriction, Weekend Restriction. Se evalúan sobre los atributos de **una** Operación en el momento de registrarla (símbolo, tamaño, hora de apertura) — no producen un estado continuo, producen un veredicto puntual por operación.

Este `scope` es el que responde con precisión "qué pertenece a la ejecución de una operación": todo lo que necesita los atributos de esa operación concreta para evaluarse, nada más.

## 4. Tipos de reglas — los arquetipos de evaluador (núcleo del motor)

| Arquetipo | Qué compara | Reglas de la Library que lo usan |
|---|---|---|
| Umbral estático | Un valor actual contra un límite fijo | Static Drawdown, Maximum Loss, Daily Loss Limit (variante importe fijo) |
| Umbral dinámico (trailing) | Un valor actual contra un límite que se mueve con un máximo histórico — con variante de anclaje (continuo vs. fin de día, ver Casos límite) | Trailing Drawdown, End Of Day Trailing |
| Progreso hacia objetivo | Avance acumulado contra una meta | Profit Target, Minimum Trading Days |
| Pertenencia a conjunto | Un valor debe estar (o no) en una lista permitida | Instrument Restriction, Position Size Restriction (como límite superior, también podría tratarse como Umbral) |
| Ventana temporal | El momento/duración de una operación cae dentro o fuera de un rango permitido | Time Restriction, Weekend Restriction, Overnight Restriction |
| Ventana temporal + fuente externa | Igual que el anterior, pero depende de un calendario económico de terceros | News Restriction (único con dependencia de datos externos, ver §7 y Riesgos) |
| Compuesto (depende de otras reglas) | Combina el resultado de otras Rule Instances ya evaluadas | Consistency Rule (único de este tipo en la biblioteca actual) |

**Reglas de cálculo, sin arquetipo de veredicto** (categoría aparte, §3.2): Profit Split no compara nada contra un límite — es un parámetro que alimenta `Beneficio_neto_estimado` (18 §3). Se cataloga en la Library por completitud y porque una Empresa la compone igual que las demás, pero el orquestador (§5) no le pide un veredicto de cumplimiento.

7 arquetipos de veredicto + 1 categoría de cálculo cubren las 15 reglas nombradas por el fundador — confirma, con datos reales del propio catálogo pedido, la afirmación de 21 §2.3 ("~8-10 tipos de evaluador genéricos").

## 5. Flujo completo de evaluación

```
Evento de dominio (21.5 §7): OperacionRegistrada / OperacionCerrada / CapitalEventoRegistrado
   │
   ▼
1. El orquestador carga el RuleProfileSnapshot vigente de la Cuenta (21.5 §2 — instantánea, nunca en vivo)
   │
   ▼
2. Separa las Rule Instances del snapshot en dos grupos por scope (§3.4):
      - operation_event → solo si el evento es de una Operación concreta
      - account_state    → siempre que el estado de la Cuenta haya cambiado
   │
   ▼
3. Ordena las Rule Instances de scope account_state por dependencia (orden topológico):
      primero las "hoja" (Drawdown, Daily Loss, Maximum Loss, Profit Target, Minimum Days),
      después las "compuestas" que las consumen (Consistency Rule)
   │
   ▼
4. Evalúa cada Rule Instance con su arquetipo (§4) → Resultado (compliant | violated, margen restante)
   │
   ▼
5. Agrega todos los Resultados en el Estado de cumplimiento de la Cuenta (alimenta el
   semáforo de 17 §4 y el Dashboard Maestro, 18 §6)
   │
   ▼
6. Por cada Resultado = violated, emite el evento ReglaIncumplida (21.5 §7) — informativo,
   nunca bloqueante (ver §7)
```

**Resolución de dependencias, en detalle**: Consistency Rule es, en la biblioteca pedida, la única regla verdaderamente compuesta — su definición típica ("ningún día puede aportar más del X% del beneficio total hacia el objetivo") necesita el resultado de Profit Target (progreso actual) como entrada. El orquestador valida, en el momento en que una Empresa compone su Rule Profile, que el grafo de dependencias entre sus Rule Instances sea acíclico — una composición que dependiera circularmente de sí misma se rechaza al guardarse, no se descubre en producción.

## 6. La Rule Library oficial (composición inicial)

| Regla | Arquetipo | Scope | Cumplimiento / Cálculo |
|---|---|---|---|
| Static Drawdown | Umbral estático | account_state | Cumplimiento |
| Trailing Drawdown | Umbral dinámico | account_state | Cumplimiento |
| End Of Day Trailing | Umbral dinámico (anclado a cierre de día, parámetro de zona horaria — Casos límite) | account_state | Cumplimiento |
| Daily Loss Limit | Umbral estático | account_state | Cumplimiento |
| Maximum Loss | Umbral estático | account_state | Cumplimiento |
| Consistency Rule | Compuesto | account_state | Cumplimiento |
| Minimum Trading Days | Progreso hacia objetivo | account_state | Cumplimiento |
| Profit Target | Progreso hacia objetivo | account_state | Cumplimiento |
| Profit Split | — (sin veredicto) | account_state | Cálculo |
| News Restriction | Ventana temporal + fuente externa | operation_event | Cumplimiento — **diferido, ver §9** |
| Time Restriction | Ventana temporal | operation_event | Cumplimiento |
| Instrument Restriction | Pertenencia a conjunto | operation_event | Cumplimiento |
| Position Size Restriction | Umbral estático (aplicado a un atributo de la operación) | operation_event | Cumplimiento |
| Overnight Restriction | Ventana temporal | operation_event | Cumplimiento |
| Weekend Restriction | Ventana temporal | operation_event | Cumplimiento |

**Nota honesta sobre "Daily Loss Limit" como ejemplo del límite de §8**: si una empresa lo expresa en % de capital y otra en importe fijo, son dos Rule Definitions distintas que comparten el mismo arquetipo (Umbral estático) — no una Definition con un parámetro "opcional" que cambia de forma según el caso. Preferir varias Definitions precisas sobre una flexible y ambigua es una decisión de diseño explícita (evita el antipatrón de un campo de configuración polimórfico que termina necesitando lógica condicional dentro del propio evaluador, exactamente lo que el núcleo no debe tener).

## 7. Principio no negociable: la Library restringe el cumplimiento, nunca la aplicación

El propio nombre "Restriction" en varias reglas invita a un modelo mental equivocado — que el motor **bloquee** el registro de una operación que las incumple. Se rechaza explícitamente, por consistencia con principios ya establecidos y no por ser una decisión nueva: 01 §2.3 ("la IA recomienda, nunca ejecuta ni bloquea"), 13 §6.3 (los guardarraíles de que la IA no sustituye al trader) y el precedente de 20 (una Cuenta pausada no bloquea el registro, solo avisa). Una operación ya ocurrió en el mercado real — el trabajo del producto es registrarla con precisión y avisar del riesgo de regla incumplida, nunca impedir que la realidad quede reflejada en los datos del usuario.

---

## Riesgos arquitectónicos

1. **Validación del grafo de dependencias (§5)**: si el orquestador no rechaza correctamente una composición cíclica al guardarse, el fallo se movería a tiempo de evaluación real — mitigación ya incorporada al flujo (validación en el momento de componer, no de evaluar), pero exige disciplina de implementación en el capítulo técnico.
2. **Corrección de zona horaria en reglas "fin de día"** (End Of Day Trailing, y en menor medida Daily Loss Limit si se resetea diariamente): "fin de día" no es universal — depende del servidor/convención de sesión de cada prop firm. Si se asume UTC de forma global, cualquier firma que cierre su día de trading en otra zona horaria calculará mal el drawdown restante. Se resuelve haciendo la zona horaria/hora de corte un **parámetro obligatorio** de la Rule Definition, nunca una asunción del motor — anotado aquí para que no se pierda al implementar.
3. **Curación de la Library**: sin un proceso de revisión, el catálogo puede acumular Rule Definitions casi duplicadas (dos "Daily Loss Limit" con diferencias triviales de nombre) — es un riesgo de gobernanza, no resoluble solo con arquitectura; se anota como requisito de proceso para cuando exista un catálogo mantenido por comunidad (20, Fase 2).
4. **Rendimiento a escala** (19 §7, millones de operaciones): recalcular reglas de `account_state` para cuentas con histórico muy grande en cada evento debe ser incremental, no recorrer todo el histórico cada vez — mismo principio ya aplicado en 15 §3.1 (capital cacheado por trigger) y 13 §3 (actualización bayesiana O(1)); el evaluador de reglas debe seguir el mismo patrón, no uno nuevo.

## Casos límite

1. Una Cuenta de capital propio (`is_personal = true`, 04 §1.3) no tiene Rule Profile de tipo challenge — el motor debe degradar con naturalidad (sin reglas de cumplimiento evaluadas, el semáforo de 17 §4 simplemente no aplica, no se fuerza un estado "sin datos" confuso).
2. Una regla configurada con parámetros inválidos (p.ej. un porcentaje >100%) debe rechazarse en el momento de componer el Rule Profile, con el esquema de parámetros de la propia Rule Definition (§3.2) — nunca descubrirse al evaluar.
3. Una Empresa nueva necesita una regla que no encaja en ningún arquetipo existente de §4 — límite honesto reconocido en §2 y §8: requiere añadir un arquetipo nuevo al núcleo (código, aislado, una sola vez), no una excepción por empresa.
4. Dos Rule Instances en el mismo perfil son lógicamente contradictorias (p.ej. un Daily Loss Limit más estricto de lo que Maximum Loss permitiría alcanzar en un solo día) — el motor no detecta esto automáticamente en esta versión; se anota como ampliación futura, no como bloqueante.

## Posibles ampliaciones futuras

- Integración de un calendario económico externo para activar News Restriction (§6, diferido) — requiere una fuente de datos de terceros que no forma parte del alcance actual.
- Detección automática de contradicciones lógicas entre Rule Instances de un mismo perfil (Caso límite #4).
- Gobernanza formal de la Rule Library con revisión comunitaria (Riesgo #3), coherente con el catálogo de plantillas de 20 Fase 2.
- Nuevos arquetipos de evaluador conforme aparezcan prop firms con mecánicas genuinamente nuevas — se espera que ocurra, y el diseño de §3-4 está preparado para absorberlo sin tocar el núcleo salvo por la adición aislada del arquetipo.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Que TradePilot pueda representar con precisión las reglas de *cualquier* prop firm, actual o futura, sin esperar a que el equipo "añada soporte" para ella — y que el drawdown restante (18 §2) y el semáforo (17 §4) sean correctos incluso para una firma que hoy no existe.

**¿Qué funcionalidades sobran?** Ninguna de las 15 reglas pedidas — las 15 encajan en 7 arquetipos + 1 categoría de cálculo, sin necesidad de descartar ninguna.

**¿Qué funcionalidades faltan?** La distinción `account_state` vs. `operation_event` (§3.4) no estaba pedida explícitamente pero es necesaria para que "qué pertenece a la ejecución de una operación" tenga una respuesta precisa — añadida aquí. También faltaba resolver qué ocurre cuando una regla depende de otra (Consistency Rule) — resuelto con el grafo de dependencias de §5.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que el usuario nunca vea la palabra "arquetipo de evaluador" — compone su perfil eligiendo reglas por nombre humano ("Trailing Drawdown") y rellenando 2-3 campos; toda esta arquitectura es invisible. Se anota como restricción de copy para el capítulo de UX de composición de reglas.

**¿Qué haría Linear para hacerlo más rápido?** Clonar una plantilla existente (§3.3) como punto de partida, en vez de componer 15 reglas desde cero — ya incorporado en el diseño, coherente con la decisión de Camino A de 20 (Fase 2).

**¿Qué haría TradingView para hacerlo más intuitivo?** Visualizar el Estado de cumplimiento (§5, paso 5) como una franja de "semáforos" por regla, no solo un único semáforo agregado por cuenta (17 §4) — permite ver de un vistazo cuál de las 8-10 reglas activas está más cerca de incumplirse, no solo que "algo" está en amarillo. Se anota como requisito para el Dashboard Maestro (18 §6) cuando se revise su UI.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente lo que exigió el capítulo 21.5 y aquí se reafirma: nunca evaluar reglas contra una plantilla en vivo (§3.3, composición por copia) y validar el grafo de dependencias antes de aceptar una composición (§5, Riesgo #1) — ambos ya incorporados, no pendientes.

**Puntuación del capítulo**: **93/100**. Los 7 puntos que faltan son el límite honesto de §8/Caso límite #3 (una regla puede no encajar en ningún arquetipo existente) y la ausencia de detección automática de contradicciones lógicas (Caso límite #4) — ninguno de los dos tiene una solución arquitectónica limpia sin datos reales de uso, así que no se fuerza una aquí.

**¿Qué tendría que ocurrir para un 100/100?** Validar contra datos reales de reglas de al menos 5-10 prop firms distintas que los 7 arquetipos realmente cubren el caso general y no solo los 15 ejemplos dados — es una validación empírica, no de diseño, y no puede completarse en este capítulo.

---

## Cierre de capítulo

**Nivel de madurez del capítulo**: 90%. El diseño conceptual está completo y ha superado el intento explícito de "destruirlo" (§2) sin caer — lo que falta es validación empírica contra reglas reales de múltiples firmas, que corresponde a la fase de implementación, no a este capítulo.

**Riesgos pendientes**: los 4 de "Riesgos arquitectónicos", ninguno bloquea aprobar el diseño — los 4 son requisitos de implementación cuidadosa, no defectos de la arquitectura misma.

**Decisiones abiertas**:
1. Si el capítulo técnico de implementación (esquema de datos del Rule Engine) se aborda inmediatamente o si el fundador quiere revisar antes algún otro capítulo pendiente (retrofit de pies de capítulo a 00-18, 19 §9).
2. Gobernanza de la Rule Library (Riesgo #3) — quién puede añadir/corregir entradas del catálogo, no decidido en este capítulo por ser una cuestión de proceso de equipo, no de arquitectura.

**Recomendación profesional**: aprobar el diseño conceptual. Es, junto con 21.5, el capítulo con puntuación más alta del blueprint — encontró y resolvió un problema real no anticipado (dependencias entre reglas, distinción de scope) sin necesitar una arquitectura distinta a la propuesta por el fundador, y consideró explícitamente una alternativa más flexible (motor de expresiones) rechazándola con criterio, no por defecto. Recomiendo continuar con el diseño técnico (esquema de datos) del Rule Engine como siguiente paso, incorporando ya el patrón Snapshot (19 regla 13) y las migraciones pendientes que 21 §5 dejó listadas para 02/04/10/12/13.
