# 19 · Metodología y reglas permanentes del proyecto

*Capítulo de proceso, no de producto — se referencia desde todos los capítulos posteriores.*

## 1. Rol asumido a partir de ahora

Cofundador, CTO, Product Architect y responsable de calidad de TradePilot R. No la misión de dar la razón — la misión de construir el mejor software de gestión de posiciones del mercado. Si una decisión (mía o del fundador) es mala, se dice explícitamente, con alternativa. Si una decisión limita la escalabilidad futura, se detiene el avance y se explica antes de continuar.

## 1.1 Challenge Mode (filosofía permanente, no un modo que se activa y desactiva)

Ante cualquier funcionalidad propuesta — por el fundador o por mí mismo en un capítulo anterior —, el proceso es siempre:

1. Detectar posibles problemas antes de aceptarla.
2. Buscar alternativas mejores, aunque no se hayan pedido.
3. Explicar pros y contras de cada una, sin editorializar de más.
4. **Elegir la solución profesional y proceder con ella**, aunque contradiga la idea inicial — no dejar la decisión indefinidamente abierta a modo de cortesía. Una decisión abierta se marca como tal solo cuando de verdad depende de una preferencia de negocio que no me corresponde decidir (ej. pricing, apetito de riesgo legal); cuando es una cuestión técnica con una respuesta profesional defendible, se decide y se documenta, y el fundador la revierte si no está de acuerdo.

Diferencia práctica con el punto §3 (formato de decisión): ese formato documenta *cómo* se explica una decisión ya tomada; Challenge Mode es la exigencia de que ninguna decisión se tome — ni se deje de tomar — solo por venir del fundador o por comodidad de avanzar rápido.

## 2. Regla 1 — precisión de dominio antes que simplicidad

Nunca se simplifica un problema de dominio si eso compromete la precisión del producto. Se prefiere una arquitectura más compleja pero correcta a una sencilla pero incorrecta. Ejemplo ya aplicado antes de que esta regla existiera formalmente: la distinción drawdown estático/trailing (18 §2) — la alternativa simple (un único número de drawdown) habría sido incorrecta para una parte real del mercado.

## 3. Formato obligatorio de toda decisión importante

A partir de ahora, cualquier decisión de diseño relevante en cualquier capítulo se documenta con esta estructura fija, sin excepción:

```
Problema detectado
Solución propuesta
Por qué es mejor que las alternativas
Impacto futuro sobre el producto
```

## 4. Rule Engine — principio anti-hardcoding (regla 3-4)

TradePilot R no puede conocer FTMO, Apex o Topstep por nombre en ninguna capa del sistema. Solo conoce **conjuntos de reglas configurables**. Esto es un principio de producto que se aplica a *toda* decisión futura que toque cuentas, reglas de riesgo o límites — no solo a la base de datos. El diseño técnico completo del Rule Engine es su propio capítulo (pendiente, ver §7) — pero el principio rige desde ya cualquier documento que se toque a partir de este punto.

## 5. Pie de capítulo obligatorio

Todo capítulo del blueprint, a partir de ahora, termina con dos bloques de contenido más un checklist de cierre:

**"Riesgos Detectados"** — problemas futuros posibles de la arquitectura de ese capítulo concreto, aunque hoy no bloqueen el avance.

**"Posibles mejoras futuras"** — mejoras identificadas pero deliberadamente no implementadas ahora.

**Checklist de cierre** (los 4 puntos de la regla 7 del fundador):
- Nivel de madurez del capítulo (0–100%)
- Riesgos pendientes (subconjunto de "Riesgos Detectados" que sigue sin mitigar al cerrar el capítulo — no es una lista nueva, es el resumen de qué de lo anterior queda abierto)
- Decisiones abiertas (preguntas que necesitan respuesta del fundador antes de considerar el capítulo cerrado)
- Recomendación profesional (una frase: seguir / revisar / bloquear el siguiente capítulo hasta resolver algo concreto)

**Relación entre "Riesgos Detectados" y "Riesgos pendientes"** (aclarada aquí para no dejar ambigüedad): la primera es la lista completa de riesgos identificados en el cuerpo del capítulo. La segunda, en el checklist final, es cuáles de esos riesgos siguen abiertos — normalmente todos, salvo que el propio capítulo ya incluya la mitigación.

## 5.1 Auditoría del capítulo (bloque obligatorio, se inserta justo antes del "Cierre de capítulo" de §5)

Además de los dos bloques de contenido de §5, todo capítulo pasa por esta auditoría fija antes de cerrarse:

```
¿Qué problemas reales del trader resuelve este capítulo?
¿Qué funcionalidades sobran?
¿Qué funcionalidades faltan?
¿Qué haría Apple para simplificar este capítulo?
¿Qué haría Linear para hacerlo más rápido?
¿Qué haría TradingView para hacerlo más intuitivo?
¿Qué haría un hedge fund profesional para hacerlo más robusto?
Puntuación del capítulo (0-100)
¿Qué tendría que ocurrir para convertir este capítulo en un 100/100?
```

**Puntuación (0-100) vs. Nivel de madurez (0-100%) — no son la misma medida, y confundirlas anularía el valor de tener las dos**: la madurez mide *si el capítulo está terminado* (¿quedan decisiones abiertas o riesgos sin resolver?). La puntuación mide *si el diseño resultante es excelente*, aplicando las cuatro lentes (Apple/Linear/TradingView/hedge fund) aunque el capítulo esté 100% completo. Un capítulo puede tener madurez alta y puntuación mediocre — eso es precisamente la señal de que "terminado" y "excelente" son cosas distintas, y de que la auditoría existe para no confundir una cosa con la otra.

Cuando la auditoría detecta huecos accionables (funcionalidad que falta, simplificación evidente), Challenge Mode (§1.1) exige aplicarlos en el propio capítulo antes de cerrarlo, no solo anotarlos — la puntuación final que se reporta es la de después de aplicar esas correcciones, no la de antes.

## 5.2 Principio rector del proyecto

> **"Cada clic debe generar valor. Cada dato introducido debe convertirse en una decisión mejor."**

Se une a "Every R Matters" (00) y a "TradingView analiza, TradePilot gestiona" (01 §3) como los tres principios que gobiernan cualquier decisión de producto de aquí en adelante. En la práctica es el criterio de corte para "¿qué funcionalidades sobran?" de la auditoría de §5.1: cualquier pantalla, campo o clic que no acorte el camino hacia una decisión de gestión mejor es, por definición, candidato a eliminarse.

## 6. Prioridades del producto (regla 8), en orden, para resolver empates de diseño

1. Precisión matemática
2. Rapidez de uso
3. Experiencia móvil
4. Escalabilidad
5. Automatización
6. Aprendizaje mediante IA

Cuando dos decisiones de diseño compitan sin un ganador obvio, se resuelve subiendo por esta lista — la precisión matemática nunca se sacrifica por velocidad de desarrollo, la velocidad de desarrollo nunca se sacrifica por adornos de IA.

## 7. Requisitos de escala no negociables (regla 9)

Miles de usuarios · millones de operaciones · cientos de empresas · miles de cuentas por usuario — sin rediseñar la arquitectura. Todo documento nuevo se audita contra esta lista antes de darse por cerrado.

## 8. Core First (reglas 10-12, adoptadas en 21-arquitectura-core-vs-modulos.md)

**Regla 10**: el producto debe poder crecer durante los próximos diez años sin rediseñar el núcleo.

**Regla 11**: toda funcionalidad nueva se implementa como módulo desacoplado siempre que sea posible.

**Regla 12**: el CORE permanece pequeño, estable y extremadamente robusto — un concepto entra al CORE solo si cumple las tres condiciones de 21 §2.1 a la vez (el producto pierde su propuesta de valor sin él, ningún módulo externo puede sustituirlo, cambia con muy baja frecuencia). Todo lo demás es módulo por defecto, no por descarte.

El CORE oficial (21 §2.2) y el mapa de módulos internos (21 §2.4) son la referencia vigente — cualquier concepto nuevo se admite al CORE solo pasando las tres condiciones de la regla 12, nunca por conveniencia de desarrollo.

## 8.0 Regla 14 — Calcular ≠ Juzgar, permanente (22.5-system-contracts.md §1, aprobada por el fundador)

Ningún módulo que calcule una magnitud (R_final, drawdown, esperanza — Risk Engine) puede a la vez decidir si esa magnitud es aceptable contra un límite configurado (Rule Engine). Son responsabilidades que nunca conviven en el mismo código, aunque el segundo consuma el resultado del primero. Se aplica por defecto a cualquier par cálculo/veredicto que aparezca en capítulos futuros (p.ej., si en el futuro se añade un "Position Sizing Engine" que calcule tamaños recomendados, el módulo que decida si un tamaño es aceptable debe ser distinto de nuevo).

## 8.1 Regla 13 — Patrón Snapshot, permanente (21.5-domain-model-ddd.md §2, aprobada por el fundador)

Ninguna Entity que registre un hecho histórico (Operación, y cualquier futura entidad equivalente) puede referenciar en vivo a otra Entity editable (Plan de Gestión, Perfil de Reglas, o cualquier configuración reutilizable futura). Debe capturar una **instantánea inmutable** de esa configuración en el momento en que el hecho ocurre. Editar la plantilla original nunca reescribe, ni parcial ni totalmente, un hecho ya registrado. Se aplica por defecto a cualquier relación nueva de este tipo que aparezca en capítulos futuros, sin necesidad de repetir el análisis cada vez.

## 8.2 I16 — Zero Friction, permanente (aprobada por el fundador en SPEC-003, specs/003-funding-management.md)

TradePilot debe minimizar permanentemente la fricción del usuario. Toda funcionalidad frecuente deberá poder ejecutarse en el menor número posible de interacciones. Si una tarea habitual requiere más de 30 segundos o más de 10-12 acciones, deberá justificarse mediante una auditoría de valor o rediseñarse. Es la generalización, elevada a invariante permanente, de lo que 10 §2/§4 ya exigía solo para el registro de una Operación (<30s, ≤3 pulsaciones para lo recurrente) — a partir de esta regla, el mismo estándar rige cualquier tarea frecuente de cualquier módulo, no solo el registro.

**Aplicación**: este principio se revisa explícitamente en toda especificación técnica futura (Fase 1 en adelante), con una sección propia que confirme que ninguna interfaz nueva introduce una tarea frecuente por encima del umbral, o que documente por qué una tarea concreta queda exenta (p.ej. una tarea infrecuente de configuración de equipo, no del bucle diario del trader — ver specs/004-rule-engine.md §15 para el primer precedente de esta distinción).

**Relación con las reglas ya existentes**: no sustituye ni contradice la regla 8 (§6, prioridades del producto) — Rapidez de uso (prioridad #2) ya apuntaba en esta dirección; I16 la convierte en un umbral verificable y obligatorio en vez de un criterio cualitativo de desempate.

## 8.3 I17 — Evaluate ≠ Execute, permanente (aprobada por el fundador en specs/004-rule-engine.md §14.4)

TradePilot nunca modificará automáticamente el estado crítico de un usuario únicamente porque una regla lo indique. Rule Engine produce evaluaciones, nunca ejecuta acciones — toda acción pertenece siempre a otro componente responsable, o al propio usuario de forma explícita. Es la extensión de la regla 14 (Calcular ≠ Juzgar, §8.0) un nivel más allá: donde la regla 14 separa quién calcula de quién juzga, I17 separa quién juzga de quién actúa. Nace del intento explícito de "romper el modelo" de Rule Engine con una regla hipotética de tipo *scaling* (una cuenta que crece automáticamente al cumplir un criterio, specs/004-rule-engine.md §14.4) — ninguna regla, sin importar lo claro que parezca su criterio de cumplimiento, dispara una acción por sí sola.

**Aplicación**: se extiende explícitamente a cualquier componente que produzca un veredicto o una recomendación, no solo a Rule Engine — TradePilot Optimizer (specs/005-tradepilot-optimizer.md) es el primer precedente aplicado: ninguna recomendación de una configuración mejor se aplica sola, el trader la adopta de forma explícita (mismo principio que 13 §6.3 ya exigía para el optimizador, ahora generalizado y elevado a invariante permanente del producto).

## 8.4 I18 — Automation Before Interaction, permanente (aprobada por el fundador en specs/007-analytics-engine.md, aplicada por primera vez en specs/008-trade-capture-engine.md)

TradePilot siempre intentará capturar, interpretar y completar automáticamente toda la información posible antes de solicitar cualquier dato al usuario. Orden obligatorio, sin excepción:

1. Captura automática.
2. Inferencia segura (derivación determinista a partir de datos ya capturados — nunca una suposición estadística de un valor no observado).
3. Interacción manual únicamente cuando sea imprescindible.

**Distinción central que gobierna la regla**: "inferencia segura" nunca significa "predicción" — es derivación aritmética/determinista de un hecho a partir de otros hechos ya conocidos (p.ej. calcular `risk_pct` a partir del precio de entrada, el stop y el tamaño de posición), nunca una conjetura sobre un dato que jamás se observó (p.ej. adivinar qué RR objetivo tenía en mente un trader que nunca fijó un take-profit). Cuando la inferencia segura no es posible, la regla exige caer directamente al paso 3 — nunca rellenar con una aproximación no marcada como tal (specs/008-trade-capture-engine.md §5.3).

**Aplicación**: se revisa explícitamente en toda especificación futura que involucre entrada de datos del usuario, con el mismo estándar que I16 ya exige para la fricción — un campo que podría capturarse o inferirse automáticamente y no lo hace debe justificarse explícitamente, no asumirse.

## 8.5 I19 — Attention Is the Most Valuable Currency, permanente (aprobada por el fundador en specs/010-ai-decision-center.md §2)

Ninguna funcionalidad podrá competir por la atención del trader sin demostrar un beneficio esperado superior al coste cognitivo que introduce. No es un eslogan — se operacionaliza reutilizando el `Beneficio` ya definido en 30 §2.2 (impacto × confianza × frecuencia) frente a un coste cognitivo calibrado sobre el mismo eje que I16 (número de elementos mostrados × tiempo de lectura estimado). Es la escalada de "coste psicológico", el factor que 30 §2.3 ya reconocía como el más débil de su propio modelo, a un gate arquitectónico de primera clase que rige a **cualquier** módulo futuro que aspire a reclamar espacio de atención del trader, no solo al sistema de mejora conductual de 30.

**Aplicación**: se revisa explícitamente en toda especificación futura que introduzca cualquier superficie de atención (tarjetas, notificaciones, insights, alertas) — ninguna se admite sin declarar su beneficio esperado y su coste cognitivo estimado. Primera aplicación completa en specs/010-ai-decision-center.md, que además añade la salvaguarda de que el arbitraje de atención nunca puede calibrarse contra señales de engagement (cuántas veces se tocó algo) — sería el mecanismo exacto que convertiría esta regla en papel mojado.

## 8.6 I20 — Professional Calm, permanente (aprobada por el fundador en specs/012-tradepilot-design-system.md §2)

TradePilot debe reducir el estrés del trader, nunca aumentarlo. Ninguna pantalla, gráfico, animación, sonido o interacción puede generar sensación de urgencia artificial. La interfaz debe transmitir la misma calma que tendría un gestor de un hedge fund revisando posiciones, nunca la de una plataforma diseñada para provocar más operaciones.

**Distinción que hace esta regla verificable, no solo aspiracional**: urgencia artificial es la que fabrica el propio diseño (animación en bucle, parpadeo, sonido de alarma, cuenta atrás, modal bloqueante); severidad real (un riesgo de cuenta genuino, SPEC-010 Clase 1) se comunica con jerarquía visual estática y lenguaje preciso — nunca con movimiento ni sonido. I20 nunca significa ocultar o suavizar un riesgo real; significa comunicarlo con calma, una sola vez, con precisión.

**Aplicación**: se revisa explícitamente en toda pantalla futura, mismo estándar que I16 ya exige para fricción. Primera aplicación completa en specs/012-tradepilot-design-system.md, que además identifica el caso de mayor riesgo de violarla (la tarjeta de "Logro" de SPEC-010, por su cercanía natural a mecánicas de celebración tipo videojuego) y lo resuelve explícitamente.

## 8.7 I21 — One Thought Rule, permanente (aprobada por el fundador en specs/013-experience-architecture.md §2)

En cualquier pantalla de TradePilot, el usuario solo debe tener que pensar en una cosa importante a la vez. Ninguna pantalla podrá exigir dos decisiones cognitivas importantes simultáneas — si una pantalla obliga a pensar en más de una cosa, debe dividirse.

**Distinción que hace esta regla verificable, no solo aspiracional**: protege contra decisiones que exigen deliberación (sopesar datos, evaluar un trade-off, analizar evidencia) — no contra confirmaciones de reacción inmediata (una sugerencia ya pre-rellenada que solo se confirma con un toque, una reacción emocional sin análisis). Verificada explícitamente contra la tarjeta de cierre en un toque de SPEC-009 (dos preguntas en la misma pantalla) para confirmar que no la viola — ambas preguntas pertenecen al mismo marco cognitivo de baja deliberación. Formaliza, como regla permanente, lo que 03 §4 ya hizo una vez de forma ad-hoc al separar la pantalla "Hoy" en tres pantallas de un único objetivo cada una.

**Aplicación**: se revisa explícitamente en toda pantalla futura. Primera aplicación completa en specs/013-experience-architecture.md, que además la usa para exigir que "adoptar una simulación como Plan real" (SPEC-011) tenga siempre su propio momento dedicado, nunca compartido con otra decisión.

## 9. Decisión abierta que esta metodología deja pendiente (no se resuelve unilateralmente)

¿Se retrofitan los 18 capítulos ya escritos (00-18) con el pie de capítulo de §5, o el formato nuevo aplica solo hacia adelante? Es un trabajo real (18 documentos), no una formalidad — se deja como decisión explícita del fundador, no se asume. Ver también 20-flujo-funcional-usuario.md, cuyo cierre de capítulo señala además una segunda decisión abierta más urgente (el impacto retroactivo del Rule Engine sobre 04/15/18).
