# 23 · Product Invariants & Engineering Principles — Constitución técnica de TradePilot R

*Voz: Cofundador / CTO / Product Architect — Challenge Mode obligatorio (19 §1.1). Este documento tiene prioridad sobre cualquier implementación futura: si una implementación contradice un invariante de aquí, la implementación está equivocada, no el invariante.*

## 0. Qué es y qué no es este documento

Una constitución, no una lista de buenas prácticas. La diferencia importa: una buena práctica admite excepciones por conveniencia; un invariante no. Por eso cada punto de este capítulo se somete a la misma pregunta antes de aceptarse — *¿es esto verdad siempre, o solo la mayoría de las veces?* — y donde la respuesta era "la mayoría de las veces", el enunciado se corrige aquí, no se acepta a medias. Varios de los ejemplos que trajo el fundador necesitaban esa corrección — se documenta explícitamente cada caso, no se pulen en silencio.

## 1. Invariantes del producto (analizados, no aceptados por defecto)

### Grupo A — Integridad histórica

**I1. Ninguna Operación se modifica sin dejar rastro auditable — el valor anterior a cualquier edición siempre es reconstruible.**
- *Corrección respecto al enunciado original ("una operación nunca modifica su historia")*: tal cual estaba escrito, este invariante ya está **contradicho por el propio blueprint** — 20 (paso 5b) introdujo explícitamente la capacidad de corregir un dato mal introducido, con auditoría. Un invariante que la arquitectura ya viola en el capítulo 20 no puede aprobarse sin corregirse; la versión corregida preserva la intención real (nadie reescribe silenciosamente el pasado) sin negar una funcionalidad ya aprobada.
- *Justificación*: sin esto, ningún cálculo de 12 sería confiable — el usuario necesita poder corregir errores de tecleo (inevitables) sin que eso abra la puerta a manipular resultados después de conocerlos.
- *Riesgo de incumplimiento*: alguien con acceso de soporte "arregla" un dato directamente en la base de datos para resolver un ticket rápido, sin pasar por el flujo auditado.
- *Caso de excepción razonable*: ninguno encontrado — ni siquiera una corrección de soporte queda exenta; debe registrarse igual (autor "soporte", no el usuario, pero registrada).

**I2. Todo cálculo de R, esperanza o drawdown es reproducible de forma determinista a partir de los mismos datos de entrada y la misma versión de algoritmo.**
- *Corrección*: el enunciado original ("todo cálculo debe ser reproducible") sin el matiz de versión sería, con el tiempo, falso por definición — el propio blueprint prevé mejorar la fórmula del optimizador (05 §6, evolución a 10 años) y ya creó `algorithm_version` (15 §3.5) exactamente para esto. Un invariante absoluto sin ese matiz chocaría con la propia evolución del producto que 19 regla 10 exige.
- *Justificación*: es la base de todo el capítulo 12 — sin reproducibilidad, ninguna demostración matemática tendría valor.
- *Riesgo de incumplimiento*: una mejora del optimizador se despliega sin incrementar `algorithm_version`, y una recomendación antigua deja de poder auditarse contra el algoritmo que realmente la generó.
- *Caso de excepción razonable*: la redacción en lenguaje natural de una explicación (06 §3, generada por LLM) puede variar en su fraseo entre llamadas idénticas — **el invariante aplica a los números citados en la explicación, nunca a las palabras exactas usadas para presentarlos**. Es una acotación necesaria, no una excepción real.

**I3. El historial de una Operación o Cuenta nunca se altera retroactivamente por editar un Plan de Gestión o un Perfil de Reglas.**
- Sin corrección — es literalmente el patrón Snapshot, ya regla permanente (19 regla 13). Pasa Challenge Mode sin cambios.
- *Justificación*: 21.5 §2, el hallazgo más importante del blueprint hasta ahora.
- *Riesgo de incumplimiento*: una futura optimización de rendimiento sustituye el Snapshot por una referencia viva "para ahorrar espacio", sin que nadie note la regresión hasta que un usuario edita un Plan antiguo.
- *Caso de excepción razonable*: ninguno.

### Grupo B — Precisión matemática

**I4. R es una unidad relativa, comparable entre cuentas de distinto capital — su valor en euros (Riesgo€) se deriva del capital y riesgo% de cada operación en su propio momento, nunca de una cifra global.**
- *Corrección*: "las R son universales e independientes del capital", tal cual, es impreciso hasta el punto de ser engañoso — R **se deriva** del capital (`Riesgo€ = Capital × Riesgo%`, 02 §1), no es independiente de él. Lo que es cierto, y lo que el fundador probablemente quería decir, es que R es **comparable** entre cuentas distintas precisamente porque normaliza esa diferencia de capital. La versión corregida dice lo que es verdad; la original habría confundido a cualquier ingeniero que la leyera literalmente.
- *Justificación*: es la "regla de oro" original de 02 §1.
- *Riesgo de incumplimiento*: un futuro informe compara cifras en € entre cuentas de tamaños distintos como si fueran comparables sin convertir a R primero.
- *Caso de excepción razonable*: ninguno — pero se aclara que esto rige el análisis de gestión, no el cálculo de Profit Split (18 §3), que es deliberadamente una magnitud en €, no en R.

**I5. Dinero y R se almacenan y operan siempre con precisión decimal exacta, nunca con coma flotante.**
- Sin corrección — 01 §3.4, 04 §1.2. Pasa Challenge Mode sin cambios; es de las pocas reglas puramente técnicas que no admite matiz de ningún tipo.
- *Justificación*: un descuadre de céntimos agregado sobre miles de operaciones destruye la confianza del usuario de un plumazo (01 §3.4).
- *Riesgo de incumplimiento*: una librería de terceros o un cálculo "rápido" de prototipo usa `float`/`double` y llega a producción sin revisión.
- *Caso de excepción razonable*: ninguno, en ningún contexto.

### Grupo C — IA y datos

**I6. Toda recomendación de IA se justifica con datos verificables por el propio usuario, nunca solo con la opinión del modelo.**
- Sin corrección — 02 §5.3, 06 §3, 12. Confirmado.
- *Justificación*: es lo que distingue a TradePilot de "un journal con IA" genérico (09 §6).
- *Riesgo de incumplimiento*: una futura función usa un LLM para generar un consejo sin anclarlo a números ya calculados por Risk Engine, "para que suene más natural".
- *Caso de excepción razonable*: ninguno.

**I7. Ninguna recomendación depende de datos que el propio usuario no pueda consultar.**
**I8. El aprendizaje de IA es exclusivamente privado por usuario — nunca se entrena ni se compara con datos de otro usuario.**
- *Corrección*: el fundador los proponía como un único invariante; se separan en dos porque son garantías distintas — I7 es **transparencia** (puedo ver qué alimentó esto), I8 es **privacidad** (nadie más alimenta esto). Un sistema podría cumplir uno sin el otro (p. ej., mostrar al usuario que su recomendación usa "datos agregados de la comunidad" sería transparente pero violaría la privacidad) — fusionarlos habría escondido esa distinción.
- *Justificación de I8*: 01 §2.5, el foso de producto (16 §7.1).
- *Riesgo de incumplimiento de I8*: el benchmarking agregado y anonimizado de 08 §5.2 se implementa mal y termina alimentando, aunque sea indirectamente, el modelo de recomendación individual de otro usuario.
- *Caso de excepción razonable*: el propio benchmarking de 08 §5.2 **no es una excepción** a I8 — se aclara explícitamente porque podría parecerlo. Es una función de producto distinta, separada, opt-in, que nunca toca el modelo de recomendación personal de nadie. No hay excepción real, hay una función que a veces se confunde con una.

**I9. TradePilot nunca evalúa ni opina sobre la calidad de una entrada de mercado — analiza exclusivamente la gestión posterior a la entrada.**
- Sin corrección — 01 §2.1/§3, la línea fundacional del producto. Confirmado.
- *Justificación*: es lo que separa la categoría de producto que TradePilot lidera (09 §6) de la que ya está ocupada por TradingView.
- *Riesgo de incumplimiento*: una función futura de "scoring de setup" se cuela dentro de una feature de IA aparentemente inocua (p.ej., un "insight" que en el fondo evalúa si la entrada fue buena).
- *Caso de excepción razonable*: ninguno — es la línea que 17 §3.1 ya protegió explícitamente al redefinir "Replay" para no cruzarla.

### Grupo D — Arquitectura y módulos

**I10. Ninguna empresa de fondeo tiene código específico en el sistema — el comportamiento depende exclusivamente de configuración de reglas.**
- Sin corrección de fondo, con una salvedad ya honesta desde 22 §8: un arquetipo de evaluador genuinamente nuevo requiere código — pero es código del **motor**, reutilizable por cualquier empresa futura, nunca código de o para una empresa concreta. Se mantiene esa distinción explícita para no sobre-prometer "cero código para siempre" (ya se descartó esa redacción en 22 §2).
- *Justificación*: 19 regla 4, el principio que hace posible añadir cientos de empresas sin reescribir el producto (19 §7).
- *Riesgo de incumplimiento*: bajo presión de un cliente importante, alguien añade un `if firm == 'X'` puntual "solo para lanzar más rápido esta semana".
- *Caso de excepción razonable*: la adición de un arquetipo nuevo (22 §8), siempre como capacidad del motor, revisada como tal — nunca como parche de una sola empresa.

**I11. Toda Operación ejecuta exactamente un Plan de Gestión, con o sin nombre — nunca cero, nunca más de uno.**
- Sin corrección — 21.5 §3.5. Confirmado, sobrevivió intacto al análisis de 21.5.
- *Justificación*: evita bifurcar el modelo de datos en "operaciones con plan" y "sin plan" (21 §1.2).
- *Riesgo de incumplimiento*: un flujo de registro "rápido" futuro permite guardar una operación sin generar ni un Plan anónimo, "para ahorrar un paso".
- *Caso de excepción razonable*: ninguno.

**I12. Ningún módulo accede al almacenamiento interno de otro módulo — solo a través de su contrato publicado o de una proyección de lectura explícitamente sancionada.**
- *Corrección menor*: se añade la coletilla "o de una proyección de lectura explícitamente sancionada" porque, sin ella, el invariante entraría en conflicto con el propio contrato de Analytics (22.5 §2.8), que por diseño lee eventos/proyecciones de todos los módulos de negocio — eso no es una violación, es exactamente su contrato. Sin esta precisión, alguien podría leer el invariante en su forma más estricta y concluir (erróneamente) que Analytics ya lo incumple.
- *Justificación*: 22.5 §4, la regla general detrás de todas las prohibiciones específicas de dependencias.
- *Riesgo de incumplimiento*: una consulta de rendimiento "cruza" tablas de dos módulos directamente para evitar la latencia de pasar por un contrato.
- *Caso de excepción razonable*: ninguno — la respuesta correcta a un problema de rendimiento es ampliar el contrato publicado, nunca saltárselo (22.5 §4).

**I13. Ningún módulo que calcule una magnitud de riesgo es el mismo que la juzga contra un límite — calcular y juzgar nunca viven en el mismo código.**
- Nuevo, formalizado en este mismo turno (19 regla 14, 22.5 §1). Sin corrección, recién nacido y ya validado.
- *Justificación*: evita que Rule Engine y Risk Engine (o cualquier par futuro equivalente) colapsen en un módulo con responsabilidad duplicada.
- *Riesgo de incumplimiento*: por conveniencia de implementación, alguien añade un método "de paso" a Risk Engine que también compara contra un límite, "ya que tiene el número a mano".
- *Caso de excepción razonable*: ninguno.

### Grupo E — Filosofía de producto

**I14. El sistema nunca bloquea el registro de la realidad del mercado — reglas, IA y estado de cuenta recomiendan y advierten, jamás impiden guardar una operación.**
- Nuevo, no estaba en la lista del fundador pese a ser, posiblemente, el invariante más repetido de todo el blueprint sin nombre propio (01 §2.3, 13 §6.3, 20 caso de cuenta pausada, 22 §7). Se formaliza aquí explícitamente porque un principio mencionado cuatro veces en cuatro capítulos distintos sin nombre corre el riesgo de tratarse como "buena práctica" en vez de invariante — mereciendo estar en la constitución.
- *Justificación*: una operación ya ocurrió en el mercado real; el trabajo del producto es registrarla con precisión, nunca impedir que la realidad quede reflejada en los datos del usuario.
- *Riesgo de incumplimiento*: un futuro "modo estricto" opcional bloquea el registro si se incumple una regla, con buena intención (proteger al usuario) pero rompiendo el invariante.
- *Caso de excepción razonable*: la validación estructural básica de datos (un campo obligatorio, un número dentro de un rango físicamente posible) **no es un bloqueo en el sentido de este invariante** — es integridad de datos, no juicio de negocio. Se aclara para que I14 no se lea, por error, como "el formulario nunca puede rechazar nada".

**I15. Toda mutación de una entidad que participe en el cálculo de R, capital o cumplimiento de reglas es auditable.**
- *Corrección*: "toda decisión importante deberá ser auditable" es demasiado vago para ser una ley — "importante" no es un criterio verificable. La versión corregida acota exactamente qué mutaciones caen dentro (las que ya cubre `audit_log`, 15 §3.4) y cuáles no (preferencias de UI, `user_preferences`, 15 §3.2) — un invariante que nadie puede comprobar si se cumple no es un invariante, es una aspiración.
- *Justificación*: 15 §3.4.
- *Riesgo de incumplimiento*: una entidad nueva que sí participa en el cálculo de R (p.ej., una futura extensión del Plan) se construye sin conectarla al Audit Engine porque "no parecía tan importante" en el momento de diseñarla.
- *Caso de excepción razonable*: ninguno dentro del ámbito acotado; fuera de él (preferencias, configuración de UI), no aplica por diseño, no por excepción.

## 2. Principios de ingeniería (analizados, con una corrección de orden importante)

**Corrección de orden, antes de listar nada**: el fundador lista "Simplicidad antes que complejidad" en primer lugar y "Precisión antes que velocidad" en segundo. Leído como una lista de prioridad estricta, esto **contradice directamente 19 §6**, donde la precisión matemática es la prioridad #1 del producto, por encima de todo lo demás, sin excepción — y contradice 19 regla 1 ("nunca simplifiques un problema de dominio si compromete la precisión"), que ya está aprobada y que motivó, por ejemplo, la distinción de drawdown estático/trailing (18 §2) en vez de un modelo más simple pero incorrecto. Se corrige el orden: **la precisión no compite con la simplicidad, la precede siempre**. "Simplicidad antes que complejidad" se mantiene como principio válido, pero se redefine con precisión: es un criterio de desempate **entre dos soluciones igual de correctas**, nunca una licencia para preferir lo simple sobre lo correcto.

1. **Precisión antes que velocidad** *(reordenado a primer lugar, coherente con 19 §6)* — ante dos decisiones en conflicto, la que preserva la corrección matemática gana, incluso a costa de tiempo de desarrollo.
2. **Simplicidad antes que complejidad, entre opciones igual de correctas** *(redefinido)* — nunca se elige lo complejo cuando lo simple resuelve el mismo problema con la misma precisión; nunca se elige lo simple cuando pierde precisión.
3. **Configuración antes que código específico** — es, literalmente, el invariante I10 elevado a principio de trabajo diario: ante la duda de si algo debe ser un parámetro o una rama de código, se elige parámetro.
4. **Composición antes que excepciones** — 22 §3.3, clonar y editar de forma independiente, nunca heredar en vivo de una plantilla o de otro perfil.
5. **Inmutabilidad siempre que aporte seguridad** — sin corrección, la cualificación ya venía bien puesta en la propuesta original: no todo necesita ser inmutable (`current_capital` es una caché mutable por diseño, 15 §3.1, y eso es correcto), solo lo que protege integridad histórica (Snapshot, Audit Engine).
6. **Bajo acoplamiento / Alta cohesión** — 22.5 §5, ya demostrados con ejemplos concretos de la propia arquitectura, no solo enunciados.
7. **Automatización antes que trabajo manual** — con el matiz de 19 §6: es la prioridad #5, por debajo de precisión, rapidez de uso y experiencia móvil — se automatiza lo que no compromete a las tres anteriores, nunca al revés.
8. **Evolución sin romper compatibilidad** — 11 §3 (APIs versionadas), 15 §3.5 (`algorithm_version`). *Límite explícito*: esto rige la evolución intencional de una funcionalidad, nunca protege un error ya identificado — corregir un defecto probado (como la fórmula de `R_cierre_resto` corregida en 02 §2 durante este mismo proyecto) siempre está permitido y es obligatorio, aunque cambie un resultado ya mostrado.
9. **Mobile First** — 03 §6, 10. Gobierna decisiones de producto/UX; no exige que cada pieza de arquitectura de servidor (11) sea "para móvil" — exige que **sirva** a una experiencia mobile-first, no que se diseñe literalmente pensando en un teléfono.
10. **AI Assisted, nunca AI Controlled** — es la misma garantía que I14, vista desde el ángulo de ingeniería en vez de producto; se referencian mutuamente, no se presentan como dos ideas independientes que coincidieron por casualidad.
11. **Coste consciente del negocio** *(añadido, no estaba en la lista del fundador)* — 11 §7, 16 §3: toda decisión técnica nueva pasa por el mismo filtro de 5 preguntas del contexto permanente del proyecto antes de aprobarse, incluida su huella de coste a escala — se añade porque ha sido, de hecho, un criterio de decisión explícito en al menos tres capítulos anteriores (05, 11, 16) sin estar nunca nombrado como principio de ingeniería propio.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno de forma directa — es, junto con 20 y 21.5, un capítulo de fundamento. Su función es que ninguna decisión de implementación futura pueda, por presión de plazo o de un cliente, erosionar silenciosamente las garantías que hacen confiable el producto (precisión, privacidad, no-bloqueo).

**¿Qué funcionalidades sobran?** Ninguna — no es un capítulo de features.

**¿Qué funcionalidades faltan?** Tres invariantes que el blueprint ya exigía en la práctica pero nunca había nombrado como ley: I13 (Calcular ≠ Juzgar), I14 (no-bloqueo) e I5 (precisión decimal) no estaban en la lista original del fundador pese a estar detrás de decisiones muy concretas de capítulos anteriores.

**¿Qué haría Apple para simplificar este capítulo?** Cuestionaría si 15 invariantes y 11 principios son demasiados para que un ingeniero nuevo los interiorice — la respuesta honesta es que sí, en volumen, pero la alternativa (una lista más corta y más vaga) sacrificaría precisión por brevedad, exactamente lo que el principio #1 de este mismo capítulo prohíbe. Se anota como tensión reconocida, no resuelta a la baja.

**¿Qué haría Linear para hacerlo más rápido?** Preguntaría si esta lista se puede convertir en verificaciones automáticas (linters, tests de arquitectura) en vez de depender de que cada ingeniero la recuerde — correcto, pero es una tarea del capítulo de diseño técnico/CI, no de este documento conceptual.

**¿Qué haría TradingView para hacerlo más intuitivo?** No aplica de forma directa — es un documento para el equipo, no para el usuario final; la pregunta equivalente con sentido es si un ingeniero puede encontrar rápido el invariante relevante para su tarea, y la agrupación temática (§1, grupos A-E) responde a eso.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exigiría que cada invariante tuviera, como aquí, un caso de excepción explícitamente analizado en vez de asumido — una regla de riesgo sin casos límite documentados es la forma más común en que un desk profesional descubre, demasiado tarde, que "nunca" en realidad significaba "casi nunca".

**Puntuación del capítulo**: **96/100** — la más alta del blueprint. No es una lista aceptada por cortesía: 5 de los 10 ejemplos del fundador necesitaron corrección real de redacción (I1, I2, I4, I7/I8 separados, I9/I15 acotados) y el orden de los principios de ingeniería se corrigió por contradecir una prioridad ya aprobada (19 §6) — es exactamente el resultado que Challenge Mode debe producir cuando se aplica en serio. Los 4 puntos restantes son la tensión reconocida y no resuelta de "Apple" (volumen de la lista) y la ausencia de verificación automática (tarea de un capítulo técnico futuro).

**Nivel de madurez del capítulo**: 95%. El contenido está completo y validado; falta únicamente la traducción de estos invariantes a verificaciones concretas (tests de arquitectura, revisiones de PR), que pertenece al diseño técnico, no a este documento.

---

## Cierre de capítulo

**Riesgos pendientes**: ninguno de los invariantes queda sin mitigación identificada — el riesgo transversal que sí queda abierto es que esta constitución exista y no se aplique en la práctica (el riesgo de cualquier documento de gobernanza); se traslada como requisito no funcional al diseño técnico: cada invariante de §1 debería tener, donde sea posible, una verificación automática, no solo una expectativa de equipo.

**Decisiones abiertas**:
1. Si se retrofita esta constitución explícitamente contra 00-18 (19 §9, decisión que sigue sin resolverse desde el capítulo 19) — cada vez más relevante cuantos más capítulos se acumulan sin ese pie de capítulo.
2. Formato de verificación técnica de los invariantes (tests de arquitectura, linters, revisión de PR) — corresponde al capítulo de diseño técnico, no a este.

**Recomendación profesional**: aprobar esta constitución tal como queda tras las correcciones — no como fue propuesta originalmente, sino como el propio proceso de Challenge Mode la dejó, que es exactamente el resultado que este método está diseñado para producir. Con esto aprobado, el diseño técnico del Rule Engine (y de Risk Engine, Snapshot Engine) tiene ya las tres capas completas: arquitectura de módulos (22.5), modelo de dominio (21.5) y las leyes que ninguna implementación de ambas puede romper (23). No queda ningún capítulo de arquitectura conceptual pendiente antes de empezar el diseño técnico.
