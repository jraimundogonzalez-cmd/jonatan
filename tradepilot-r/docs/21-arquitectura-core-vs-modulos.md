# 21 · Revisión arquitectónica — Core vs. Módulos y el Plan de Gestión

*Voz: Cofundador / CTO / Product Architect — bajo Challenge Mode (19 §1.1). Capítulo de validación arquitectónica, no todavía el capítulo de Rule Engine (22, pendiente de esta aprobación).*

## 0. Encuadre

El fundador pide dos cosas antes de tocar el Rule Engine: (1) adoptar "Core First" y trazar oficialmente qué pertenece al núcleo y qué a módulos desacoplados, (2) introducir el Plan de Gestión como unidad central en lugar de la Operación. Ambas se analizan aquí bajo Challenge Mode — no se aceptan tal cual, se cuestionan, y donde la propuesta original tiene un matiz o un riesgo, se dice explícitamente antes de validar nada.

## 1. Challenge Mode aplicado

### 1.1 "Core First" en general — de acuerdo, con una precisión necesaria

El principio es correcto y, de hecho, ya lo veníamos aplicando sin nombrarlo: 11 §3 trazó bounded contexts, 17 §2 mapeó módulos de TradePilot OS a esos contextos. Lo que faltaba era la palabra "CORE" y una regla explícita de admisión. Se adopta sin objeción de fondo.

### 1.2 El Plan de Gestión — análisis completo, no aceptación automática

**Problema detectado en el diseño actual (02, 04, 15)**: `RR_obj` y la configuración de parciales viven directamente en `trades`/`trade_partials_planned`, sin posibilidad de reutilización. Un trader que gestiona sistemáticamente igual ("siempre parciales en 1R y 2.5R, resto a objetivo") tiene que reintroducir esa estructura en cada operación — exactamente el tipo de dato repetitivo que 10 (registro <30s) ya intenta minimizar con defaults, pero no elimina del todo porque no existe un concepto que lo capture como entidad reutilizable.

**Solución propuesta (la del fundador, validada tras análisis)**: extraer `RR_obj` + estructura de parciales + regla de Break Even a una entidad propia, **Plan de Gestión**, de la que una Operación es una ejecución. Se valida con una precisión importante: **todo Plan es reutilizable en potencia, pero no todo Plan se guarda con nombre** — una configuración improvisada para una sola operación sigue siendo, técnicamente, un Plan (uno anónimo, de un solo uso). Esto evita bifurcar el modelo en "operaciones con plan" y "operaciones sin plan" — hay un único camino: **toda operación ejecuta exactamente un Plan**, con o sin nombre.

**Por qué es mejor que la alternativa de no adoptarlo**:
- No añade complejidad neta — reubica datos que ya eran conceptualmente distintos (planificado vs. ejecutado, 04 §1.5) en una entidad con identidad propia, en vez de sumar una tabla nueva sin quitar nada.
- Mejora directamente la prioridad #2 del producto (rapidez de uso, 19 §6): aplicar un Plan guardado a una operación nueva es, potencialmente, más rápido que "duplicar última operación" (10 §6.1) porque no depende de que la última operación registrada sea la que se quiere repetir.
- Encaja con una pieza que ya existía sin nombre propio: el optimizador (02 §5.3) devuelve "configuraciones candidatas" — eso **es**, literalmente, un Plan sin guardar. Nombrar el concepto unifica algo que el blueprint ya trataba como tal sin decirlo.
- Prepara, sin construirlo, el escenario que el fundador pide dejar preparado: un Plan desacoplado de cualquier cuenta puede referenciarse desde operaciones en cuentas distintas sin cambio de esquema adicional.

**Por qué NO compromete el modelo matemático (12) ni la regla de oro de 02 §1**: `Riesgo€` (lo que define 1R) sigue calculándose por operación, a partir del capital y riesgo% de *esa* cuenta en *ese* momento — el Plan nunca aporta esa cifra, solo aporta la **forma** (RR objetivo, niveles de parcial, regla de BE). Es la separación correcta: la forma es reutilizable entre cuentas de distinto tamaño, la escala económica no lo es y nunca debe serlo. Esto es, además, precisamente lo que permite aplicar un mismo Plan a varias cuentas con capitales distintos sin que dé el mismo resultado en euros — daría el mismo resultado en R, que es lo correcto.

**Decisión final**: se adopta el Plan de Gestión como concepto CORE, con el matiz de "todo Plan es una entidad, con o sin nombre" ya incorporado.

### 1.3 Colisiones de nombres detectadas — se resuelven aquí, no se dejan para después

Dos de los campos que el fundador lista dentro del Plan de Gestión reutilizan nombres ya ocupados por otros conceptos del blueprint. Ignorarlo produciría confusión real dentro de unos meses:

- **"Reglas"**: el Plan de Gestión tendría "reglas" propias (p.ej. "mover a BE tras el segundo parcial") en el mismo capítulo en el que se introduce el **Rule Engine**, cuyas reglas son las de la prop firm (externas, impuestas). Son conceptos distintos — uno es la lógica de gestión que el propio trader elige, el otro es una restricción que el trader no controla. **Se renombra** el campo del Plan de Gestión a **"Condiciones de ejecución"**, reservando "Reglas" en exclusiva para el Rule Engine (22). Confundir ambos en el vocabulario del producto sería el tipo de ambigüedad que un usuario nota inmediatamente y que un ingeniero nuevo en el equipo malinterpreta la primera semana.
- **"Perfil de gestión"**: el blueprint ya usa "perfil" para dos cosas — `profiles` (04, datos de cuenta de usuario) y el perfil bayesiano de comportamiento (13, `user_stat_buckets`). Un tercer "perfil" dentro del Plan sería el tercer significado distinto de la misma palabra en el sistema. **Se renombra** a **"Etiqueta de riesgo"** (ej. conservador/estándar/agresivo, o el valor de `λ` específico de ese Plan si el usuario quiere sobreescribir el general de 02 §5.2) — describe exactamente lo que hace sin colisionar con nada existente.

### 1.4 Mejora no pedida, detectada al formalizar Break Even como campo explícito

02 §2 (ya corregido una vez, ver esa sección) asume implícitamente una única regla de Break Even: el stop se mueve a BE automáticamente tras el **último parcial disparado**, siempre. Es una simplificación que nunca se cuestionó porque no había, hasta ahora, un sitio natural donde parametrizarla. Al convertir "Break Even" en un campo explícito del Plan, la simplificación queda expuesta: algunos traders no mueven el stop a BE hasta el segundo parcial, otros no lo mueven nunca (dejan el stop original hasta el cierre), otros lo gestionan manualmente sin regla fija.

**Se adopta como parte del alcance de este capítulo** (Challenge Mode, decidir y proceder): el Plan de Gestión incluye un campo `be_trigger` con tres modos — `after_partial_N` (N configurable), `never`, `manual` (el usuario registra manualmente cuándo se movió, como ya permite `trade_partials_executed`). La fórmula de `R_cierre_resto` (02 §2) pasa de asumir siempre "tras el último parcial disparado" a leer este campo del Plan. Es una corrección de precisión matemática (prioridad #1 del producto, 19 §6) que estaba pendiente sin que nadie la hubiera detectado todavía.

## 2. Arquitectura oficial: CORE vs. Módulos

### 2.1 Definición operativa de "Core" (para no reabatir esta discusión en cada capítulo futuro)

Un concepto pertenece al **CORE** si y solo si cumple las tres condiciones a la vez:

1. El producto pierde su propuesta de valor central (01, "Every R Matters" + "cada clic debe generar valor") si este concepto no existe.
2. Otro módulo no puede sustituirlo por una integración externa sin reescribir el producto.
3. Cambia con muy baja frecuencia — su estabilidad es la que permite que todo lo demás se construya encima sin miedo a romperse.

Si falla cualquiera de las tres, es **módulo**: se construye desacoplado, con una interfaz estrecha hacia el core, y puede evolucionar (o incluso no construirse nunca) sin poner en riesgo el resto del producto.

### 2.2 El CORE — lista validada (corrige el ejemplo del fundador en tres puntos, justificados)

| Concepto | ¿Core? | Nota |
|---|---|---|
| Usuarios | Sí | Sin objeción |
| Empresas | Sí | Sin objeción |
| Cuentas | Sí | Sin objeción — sigue siendo el centro de gravedad de la navegación (17 §4) |
| Rule Engine | Sí, con matiz | Ver §2.3 — core por dependencia, arquitectura interna de módulo |
| Operaciones | Sí | Sin objeción |
| **Plan de Gestión** | Sí | Nuevo, validado en §1.2 |
| ~~Parciales~~ | **No, corregido** | Deja de ser un ítem independiente: los parciales planificados viven dentro del Plan de Gestión, los ejecutados dentro de la Operación (04 §1.5) — listarlo aparte en el CORE es redundante ahora que el Plan existe |
| Resultados | Sí, como concepto — no como tabla | Ya resuelto en 15 §1: `R_final`, `pnl_amount` son columnas derivadas de Operación, nunca una tabla propia. Es core como *responsabilidad* (que el cálculo sea correcto), no como *entidad* separada |
| ~~Dashboard~~ | **No, corregido → módulo (Analytics)** | Es una capa de lectura agregada sobre el core (11 §1, ya lo decía: "nunca escribe, solo proyecta") — coincide exactamente con el módulo "Analytics"/"Portfolio" de 17 §2. Que sea imprescindible para el negocio no lo hace core bajo la definición de §2.1: sí puede sustituirse o reconstruirse sin tocar Usuarios/Cuentas/Operaciones |
| ~~Estadísticas~~ | **Parcialmente, corregido** | Se separa en dos: (a) la actualización incremental del perfil bayesiano al cerrar cada operación (13 §3) SÍ es core — está tan acoplada al ciclo de vida de una Operación que sacarla rompería el propio bucle de aprendizaje continuo que es la promesa central del producto; (b) la *presentación* de estadísticas (heatmaps, calendario, comparativas) es módulo (Analytics), igual que Dashboard |
| **IA / Optimizador** | **Módulo (omitido en la lista original)** | Ausente en el ejemplo del fundador — se señala explícitamente como hueco. 11 §3 ya lo trazaba como bounded context separado; 17 §2 ya lo llamaba "AI Coach". El core solo necesita saber que existen Planes y Operaciones — no necesita saber cómo se genera una recomendación. El optimizador consume datos del core y produce Recomendaciones (`ai_recommendations`, 04 §3), nunca al revés |

**CORE final (8 conceptos, no 10)**: Usuarios · Empresas · Cuentas · Rule Engine · Operaciones · Plan de Gestión · Resultados (como responsabilidad de cálculo, no tabla) · el bucle de actualización del perfil de aprendizaje (no su presentación).

### 2.3 Rule Engine — por qué es "core con arquitectura de módulo" y no simplemente "core"

Cuestión que el propio principio 3 del fundador (núcleo pequeño y estable) obliga a hacerse: si el Rule Engine va a crecer indefinidamente (nuevos tipos de regla, nuevas prop firms, "cualquier regla futura"), ¿cómo puede ser core sin violar "el núcleo debe permanecer pequeño y estable"?

Respuesta: Cuentas **depende** de que exista algún conjunto de reglas para tener sentido de producto (condición 1 de §2.1) — eso lo hace core por dependencia. Pero el Rule Engine se construye (capítulo 22) con una interfaz estrecha hacia Cuentas: Cuentas solo conoce "esta cuenta tiene un perfil de reglas con este id" y consume un resultado ya evaluado (`drawdown_restante`, `reglas_incumplidas`) — nunca conoce el catálogo interno de tipos de regla, evaluadores o plantillas. Todo el crecimiento futuro (Consistency Rule, End Of Day Trailing, la próxima regla que invente una prop firm en 2030) ocurre **dentro** del Rule Engine sin tocar el esquema de `accounts`. Es la combinación exacta que el fundador pide: core por necesidad, módulo por construcción interna.

### 2.4 Los módulos — mapeo reconciliado con 17-tradepilot-os.md

Aclaración de zoom, para que no lea como contradicción con 17: aquel capítulo mapeaba módulos de **TradePilot OS** (la plataforma completa, donde "TradePilot R" es un producto/módulo entre varios). Este capítulo divide el **interior de TradePilot R** en Core + módulos internos. "Funding Manager" en 17 §2 se refería a la capacidad, no a una pieza desacoplada — y aquí queda aclarado sin ambigüedad: Funding Manager **es** el CORE de R (Empresas + Cuentas + Rule Engine), no un módulo periférico. Los módulos internos de R son:

| Módulo interno de R | Qué contiene | Relación con 17 |
|---|---|---|
| Analytics | Dashboard de cuenta, Dashboard Maestro, heatmaps, calendario, presentación de estadísticas | = "Analytics"/"Portfolio" de 17 §2 |
| AI Coach | Optimizador determinista, explicaciones, aprendizaje bayesiano (presentación y generación de recomendaciones — la actualización incremental queda en el core, §2.2) | = "AI Coach" de 17 §2 |
| TradeVault | Exportación, backups visibles al usuario | = 17 §3.4 |
| Replay de gestión | 17 §3.1 | Sin cambios |
| Psychology | 17 §3.2 | Sin cambios |
| Tax Report | 17 §3.3 | Sin cambios |

## 3. Plan de Gestión — definición oficial (conceptual, sin DDL todavía)

```
Plan de Gestión
  ├─ Nombre (null si es anónimo/de un solo uso)
  ├─ RR objetivo
  ├─ Parciales planificados (n, RR_i, p_i) — reemplaza a trade_partials_planned (04 §1.5)
  ├─ Break Even (be_trigger: after_partial_N | never | manual) — §1.4
  ├─ Condiciones de ejecución (antes "Reglas" — §1.3)
  ├─ Etiqueta de riesgo (antes "Perfil de gestión" — §1.3, incluye λ opcional propio del Plan)
  └─ Propietario (user_id — un Plan es siempre privado del usuario, coherente con 01 §2.5)

Operación
  └─ plan_id (siempre presente, nunca null — toda Operación ejecuta exactamente un Plan)
```

> **Corrección posterior (21.5-domain-model-ddd.md §2)**: `Operación → plan_id` tal como se dibuja aquí es una referencia viva a un Plan editable — análisis de dominio (DDD) posterior encontró que eso corrompe silenciosamente el histórico si el Plan se edita después. La relación correcta es una **instantánea inmutable (`PlanSnapshot`)** capturada al crear la Operación, no una referencia directa. Mismo ajuste aplica a Cuenta ↔ Perfil de Reglas. Ver 21.5 §2 para el análisis completo — el capítulo 22 diseña el esquema ya con esta corrección incorporada.

No se diseña el DDL completo en este capítulo — corresponde al capítulo 22 (Rule Engine), que de todas formas va a tocar `accounts`/`account_rules`, junto con una revisión específica de 04/15 para migrar `trades.rr_objective` + `trade_partials_planned` hacia esta entidad. Se deja la lista exacta de qué hay que revisar en §5, para que no se pierda entre capítulos.

## 4. Los tres principios — adoptados formalmente en 19-metodologia-y-reglas-del-proyecto.md

Añadidos como regla 10 (crecimiento a 10 años sin rediseñar el core), regla 11 (módulo desacoplado por defecto, "siempre que sea posible") y regla 12 (core pequeño y estable, con la definición operativa de §2.1 como criterio de admisión) — ver ese documento para el texto exacto.

## 5. Qué habrá que revisar en capítulos ya escritos cuando esto se apruebe (lista, no ejecutado todavía)

- **02** §2: la fórmula de `R_cierre_resto` debe leer `be_trigger` del Plan en vez de asumir "siempre tras el último parcial disparado".
- **04/15**: `trades.rr_objective` y `trade_partials_planned` se sustituyen por `gestion_plans` + `gestion_plan_partials` y una FK `trades.plan_id`; `trade_partials_executed` no cambia.
- **10**: el flujo de registro gana una variante más rápida todavía — "aplicar un Plan guardado" — que se documenta junto a "Duplicar última operación" (10 §6.1).
- **12**: los ejemplos numéricos siguen siendo válidos sin cambios (la matemática no cambia, §1.2) — solo cambiaría, opcionalmente, el encuadre narrativo ("Config A" pasa a poder llamarse "Plan A").
- **13**: confirmar si el aprendizaje bayesiano se sigue segmentando por bucket de `RR_obj` (como hoy) o si en el futuro también podría segmentarse por `plan_id` — no se decide aquí, se anota como pregunta abierta para 13 cuando se revise.

Ninguno de estos cambios se ejecuta en este capítulo — es la lista de trabajo pendiente una vez el fundador apruebe esta arquitectura, tal como se hizo con el Rule Engine al cierre del capítulo 20.

---

## Riesgos Detectados

1. **Migrar `trade_partials_planned` a `gestion_plan_partials` es un cambio de esquema real**, no cosmético — si hubiera datos de producción ya escritos sobre el esquema de 04 (no los hay todavía, el proyecto sigue en fase de blueprint), sería una migración con downtime a planificar. Se anota para cuando exista implementación real.
2. **La pregunta abierta de 13 (bucket por `RR_obj` vs. por `plan_id`)** no está resuelta — tiene implicaciones de fondo: agrupar por Plan podría dar recomendaciones más precisas (mismo Plan, mismo patrón de comportamiento) pero fragmenta más la muestra a igualdad de operaciones registradas, con el mismo problema de bajo N que 13 §2 ya resolvió para buckets de RR. No se decide aquí a propósito — depende de datos que no existen todavía (uso real).
3. **El Rule Engine (capítulo 22) hereda ahora más alcance del que tenía al cierre del capítulo 20**: además de la extensibilidad de reglas y el catálogo de plantillas, debe dejar espacio para que un Plan de Gestión referencie condiciones de ejecución sin colisionar con las reglas de la prop firm — dos sistemas de "condiciones" en el mismo producto que deben quedar claramente separados también a nivel de esquema, no solo de nombre.

## Posibles mejoras futuras

- Comparativa de Planes en el dashboard Analytics ("tu Plan 'Agresivo 5R' tiene esperanza +1.6R, tu Plan 'Conservador 2R' tiene +0.9R") — valor directo del principio rector (19 §5.2), no implementado en este capítulo por no invadir el alcance de Analytics.
- Aplicación sincronizada de un Plan a varias cuentas a la vez (lo que el fundador pide dejar preparado, no construido) — la arquitectura de este capítulo ya lo permite sin cambios adicionales cuando llegue el momento.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Dos: (1) deja de obligar a reintroducir la misma estructura de gestión operación tras operación — ataca la fricción de registro igual que 10, pero desde el lado de la reutilización en vez de los defaults; (2) permite, por primera vez, comparar la calidad de distintos *estilos* de gestión propios, no solo el resultado agregado — un trader podrá saber no solo "cuánto gano" sino "qué forma de gestionar me da más esperanza".

**¿Qué funcionalidades sobran?** "Parciales" como concepto independiente en la lista de CORE del fundador — absorbido por el Plan de Gestión (§2.2).

**¿Qué funcionalidades faltan?** El módulo de IA/Optimizador, ausente de la lista original — añadido en §2.2. También faltaba un campo explícito de Break Even, detectado al formalizar el Plan (§1.4).

**¿Qué haría Apple para simplificar este capítulo?** Cuestionaría si el usuario necesita entender la diferencia entre "Plan anónimo" y "Plan guardado" — la respuesta de diseño (no desarrollada aquí, pendiente de 14/03 cuando se revisen pantallas) debería ser que guardar un Plan sea un simple "ponle nombre a lo que ya hiciste", nunca una decisión que haya que tomar por adelantado.

**¿Qué haría Linear para hacerlo más rápido?** Aplicar un Plan guardado debería ser, igual que "Duplicar última operación" (10 §6.1), una acción de 1 toque desde el registro — se anota como requisito para cuando se actualice 10.

**¿Qué haría TradingView para hacerlo más intuitivo?** Visualizar un Plan como una plantilla de niveles sobre el eje de R (coherente con el "Replay de gestión" de 17 §3.1, que también visualiza sobre el eje de R, nunca sobre precio) — mismo lenguaje visual reutilizado en dos módulos distintos, consistencia gratis.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exigiría que un Plan, una vez usado en al menos una operación cerrada, no se pueda editar retroactivamente sin dejar rastro — mismo patrón de auditoría ya establecido para ediciones de operación (20, paso 5b) aplicado ahora también al Plan. Se incorpora como requisito para el capítulo 22, no se implementa aquí.

**Puntuación del capítulo**: **88/100**. No es más alto porque dos piezas quedan explícitamente como preguntas abiertas no triviales (bucket por Plan en 13, editabilidad retroactiva del Plan) que un hedge fund exigiría resueltas antes de un 100 — se dejan abiertas a propósito porque decidirlas ahora, sin datos de uso real, sería adivinar en vez de decidir con criterio.

**¿Qué tendría que ocurrir para un 100/100?** Resolver las dos preguntas abiertas del párrafo anterior (con datos reales de uso, no antes) y ejecutar la lista de revisión de §5 sobre 02/04/10/12/13.

---

## Cierre de capítulo

**Nivel de madurez del capítulo**: 85%. La decisión arquitectónica está tomada y justificada; lo que falta es ejecutarla sobre los capítulos existentes (§5) y resolver las dos preguntas abiertas de la auditoría.

**Riesgos pendientes**: los 3 de "Riesgos Detectados" — ninguno bloquea aprobar la arquitectura, todos condicionan el capítulo 22.

**Decisiones abiertas**:
1. Bucket del aprendizaje bayesiano por `RR_obj` (como hoy) vs. por `plan_id` (13) — pendiente de datos de uso real, no se fuerza una respuesta ahora.
2. Si la lista de revisión de §5 se ejecuta como parte del capítulo 22 (Rule Engine, ya que este de todas formas va a tocar `accounts`/`trades`) o como un capítulo propio intercalado.

**Recomendación profesional**: aprobar la arquitectura (CORE de 8 conceptos, Plan de Gestión, Rule Engine como "core por dependencia, módulo por construcción") y ejecutar el capítulo 22 incorporando también la migración de §5 — separar ambos en dos capítulos distintos solo duplicaría trabajo de contexto sin beneficio, dado que ambos tocan `accounts` y `trades` a la vez.
