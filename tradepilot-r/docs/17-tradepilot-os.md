# 17 · TradePilot OS — visión de plataforma

*Voz: CEO/Fundador + Arquitecto de software*

## 1. Veredicto directo

La visión es correcta y la adopto — con una condición que no es negociable: **no se construye ni se anuncia ningún módulo nuevo antes de que TradePilot R esté funcionando y monetizando**. La razón no es falta de ambición, es la misma disciplina que ya se ha aplicado en todo este blueprint (11 §13, "ninguna etapa se construye antes de que su disparador ocurra"): una plataforma de 9 módulos anunciada antes de que el primero funcione es la forma más común en que una startup SaaS se queda sin foco y sin caja al mismo tiempo.

Dicho esto, hay una segunda parte del veredicto que cambia el proyecto de verdad, y es buena noticia: **al auditar los 9 módulos contra lo ya diseñado, 6 de los 9 ya existen** — no como planes, como documentos ya escritos en este blueprint. Lo que hace falta no es construir seis productos nuevos, es una arquitectura que ya estaba, casi por accidente de buen diseño, preparada para esto.

## 2. Por qué ya estaba preparado: los bounded contexts de 11 §3

Cuando 11 §3 trazó los límites de dominio (Identidad, Cartera, Trading, IA, Analítica) "aunque hoy vivan en el mismo proyecto Supabase", el motivo declarado era permitir extraer un servicio en el futuro sin rediseñar el sistema. Esos límites son, con otro nombre, los módulos de TradePilot OS:

| Módulo del OS | Bounded context ya definido | Estado real |
|---|---|---|
| **Journal** | Trading (`trades`, parciales) | **Ya existe** — es como se llama informalmente el registro de operaciones que ya diseñamos (02, 04, 10) |
| **Analytics** | Analítica (vistas materializadas, dashboards) | **Ya existe** — es el Dashboard de cuenta/global (03, 14) |
| **AI Coach** | IA (optimizador, recomendaciones) | **Ya existe** — es el optimizador + explicaciones (02 §5, 06, 12, 13) |
| **Portfolio** | Analítica, vista agregada | **Ya existe** — es el Dashboard global (03 §2), con margen de crecimiento futuro hacia correlación entre activos |
| **Funding Manager** | Cartera (`prop_firms`, `accounts`, `account_rules`) | **Ya existe** — es, literalmente, el corazón de TradePilot R (01 §1) reforzado por la reorientación a cuenta (§4 de este documento) |
| **TradeVault** | Ninguno nuevo — es el compromiso de exportabilidad y backup ya diseñado (11 §12, 16 §7) | **Ya existe como principio** — falta solo darle una pantalla propia con ese nombre (§3.4) |
| **Replay** | Ninguno — dominio nuevo | Nuevo, requiere redefinición (§3.1) |
| **Psychology** | Ninguno — dominio nuevo | Nuevo, requiere acotación de responsabilidad (§3.2) |
| **Tax Report** | Ninguno — dominio nuevo | Nuevo, requiere acotación legal fuerte (§3.3) |

**Conclusión de arquitecto**: TradePilot OS no es un pivote. Es el nombre correcto para lo que la arquitectura de 11 ya anticipaba sin decirlo explícitamente. Renombrar y reorganizar la narrativa cuesta un documento; construir sin esta claridad habría costado, dentro de unos años, una reescritura completa de los límites de servicio.

## 3. Los cuatro módulos que sí son nuevos — y cómo se acotan antes de aceptarlos

Aplicando el filtro de las 5 preguntas del contexto permanente del proyecto a cada uno:

### 3.1 Replay — riesgo de filosofía, no solo de esfuerzo

**Problema detectado antes de aceptarlo tal cual**: "Replay" en el vocabulario habitual de trading significa reproducir el gráfico de precio para revisar una operación — eso es **análisis de mercado**, y cruza exactamente la línea que todo este blueprint ha protegido desde el documento 01: *"TradingView analiza, TradePilot gestiona"* (09 §3). Construir un replay de precio convertiría a TradePilot en un competidor directo de TradingView en un terreno donde no tiene ventaja ni foso, diluyendo la única categoría que sí lidera (09 §6).

**Alternativa que sí se acepta, y por qué es mejor**: **Replay de gestión**, no de mercado. Reproduce, sobre el eje de R (no sobre el gráfico de precio), cómo evolucionó la propia decisión de gestión de una operación ya cerrada: en qué momento se movió el stop, en qué instante se ejecutó cada parcial, cuánto tardó en decidir tras alcanzar cada nivel. Usa datos que **ya existen** (`trade_partials_executed` con timestamps, 04 §3) — no requiere ingesta de datos de mercado de terceros, no analiza el precio, y enseña exactamente lo que TradePilot enseña en todo lo demás: el patrón de comportamiento del propio trader, nunca la calidad de su análisis técnico. Coste de construcción bajo (es una visualización sobre datos ya capturados); alineación con la filosofía, total.

### 3.2 Psychology — acotación de responsabilidad antes de aceptar el alcance

**Problema detectado**: "Psicología" como categoría de producto invita, sin quererlo, a que los usuarios esperen consejo terapéutico o diagnóstico de estado mental — TradePilot no es una herramienta clínica y no debe posicionarse como tal, por responsabilidad real hacia usuarios que podrían estar gestionando estrés genuino, no solo un hábito de trading.

**Alcance aceptado**: correlación de **comportamiento observable**, no de estado emocional declarado — exactamente la extensión ya prevista y acotada en 13 §5 ("¿Cierra parciales antes tras una racha perdedora?"), más una etiqueta ligera y opcional al registrar ("¿cómo llegaste a esta operación? tranquilo / con prisa / dudando") que se trata como un dato de comportamiento más, correlacionable con `R_final` por el mismo motor estadístico bayesiano de 13 — nunca como una función de bienestar mental. Cualquier extensión más allá de esto (journaling emocional profundo, recomendaciones de descanso) se evalúa como fase muy posterior y con asesoría legal/clínica explícita antes de construirse, no antes.

### 3.3 Tax Report — el módulo de mayor riesgo legal del roadmap, dicho sin rodeos

**Problema detectado**: calcular impuestos reales varía por país, por tipo de cuenta (fondeada vs. capital propio), por tipo de instrumento, y cambia con la legislación. Un cálculo de impuestos incorrecto no es un mal consejo de gestión que el usuario revisa y descarta (13 §6) — es un documento que un usuario podría presentar a una autoridad fiscal. El radio de daño de un error aquí es cualitativamente distinto a cualquier otra función del producto hasta ahora.

**Alcance aceptado, deliberadamente menor que el nombre sugiere**: TradePilot **exporta datos fiscal-ready** (resumen de resultados por año, por cuenta, por empresa, en un formato que un asesor fiscal humano pueda usar) — nunca **calcula ni presenta una cifra de impuesto a pagar**. Es la misma disciplina de alcance ya aplicada en 01 §5 ("no es un bróker, no ejecuta órdenes") aplicada ahora al terreno fiscal: TradePilot entrega el dato limpio, la responsabilidad del cálculo fiscal se queda, siempre, del lado humano (el usuario y su asesor). Este único ajuste de alcance reduce el riesgo legal del módulo en un orden de magnitud sin perder la mayor parte del valor percibido.

### 3.4 TradeVault — el módulo que ya está diseñado, solo le falta nombre y pantalla

No es dominio nuevo: es el compromiso de exportabilidad total y backups ya especificado en 11 §12 (PITR, backups diarios) y 16 §7 (exportación garantizada incluso tras cancelar, como mecanismo de retención basado en confianza, no en cautiverio). "TradeVault" es simplemente el nombre de producto correcto para ese compromiso, con una pantalla dedicada (accesible desde Ajustes, 14 §3 pantalla 9) donde el usuario ve y descarga su historial completo en cualquier momento. Coste de construcción: casi cero — es UI sobre una promesa que la arquitectura ya cumple.

## 4. La reorientación de TradePilot R: de operación a cuenta

Esta es la segunda mitad de este prompt y tiene consecuencias de diseño reales, no solo narrativas — desarrollada en detalle en los documentos editados (01 §1/§6, 03 §2, 14 §1-3). Resumen de la decisión:

**Qué NO cambia**: el modelo matemático (02) sigue siendo correcto sin tocar una fórmula — `R` siempre se define por operación (`Riesgo€` depende del capital y riesgo% *en el momento de esa operación concreta*, 02 §1) y eso es matemáticamente inevitable, no una elección de arquitectura de información. El árbol de propiedad de datos (11 §1, `Usuario → Empresa → Cuenta → Operación`) tampoco cambia — de hecho, ya estaba correctamente centrado en la cuenta como unidad de propiedad, la reorientación era pendiente solo en la capa de navegación/UX, no en el modelo de datos.

**Qué SÍ cambia**: la pantalla de entrada al producto. Hasta ahora, "Hoy" (un log plano de operaciones del día) era el home. A partir de esta revisión, **Cuentas es el home** — el usuario abre la app y ve el estado de salud de cada cuenta (capital, drawdown frente al límite de la prop firm, R de la semana, semáforo de estado) antes que cualquier operación individual. Es la continuación natural de una decisión que 01 §1 ya había apuntado sin llevar hasta el final: *"el onboarding y el dashboard global deben estar organizados por empresa de fondeo/cuenta como eje principal... porque P1 es el segmento de mayor valor."* Esta revisión completa esa idea en la navegación, no la contradice.

**Por qué es mejor, con los cinco criterios del filtro de producto**:
- *¿Qué problema resuelve?* Un trader fondeado (P1, mayor LTV) no piensa primero "¿cómo fue mi operación de EURUSD?" — piensa "¿está mi cuenta de FTMO en riesgo de romper su regla de drawdown?". La navegación debe reflejar el objeto que el usuario realmente gestiona.
- *¿Es realmente necesaria?* Sí — es el cambio que hace que "Funding Manager" (§2) deje de ser una función escondida dentro de Ajustes/Cuentas y se convierta en la columna vertebral real del producto, coherente con la visión de plataforma.
- *¿Puede hacerse más simple?* Sí, y de hecho simplifica: fusiona el resumen diario ("Hoy") dentro de la cabecera de la nueva pantalla Cuentas en vez de mantenerlo como una pantalla y una pestaña aparte — una tarjeta agregada, no una pantalla completa redundante.
- *¿Escala a 100.000 usuarios?* Mejor que antes — un usuario con 15 cuentas fondeadas (P1 intensivo) ya no tiene que bucear en un log plano de operaciones para saber qué cuenta necesita atención; lo ve en la primera pantalla, de un vistazo.
- *¿Puede automatizarse?* El semáforo de estado de cada cuenta (🟢/🟡/🔴) es un cálculo derivado de `account_rules` (04) — cero campo nuevo, cero tabla nueva, un umbral simple sobre datos que ya existen.

**Beneficio no buscado, detectado al rediseñar**: registrar una operación desde dentro del contexto de una cuenta (Dashboard de cuenta → FAB) precarga la cuenta con **0 pulsaciones**, mejorando incluso el mejor caso ya optimizado en 10 §4 (que asumía 0 pulsaciones solo si la cuenta activa global coincidía con la deseada). La reorientación a cuenta no es neutral para la velocidad de registro — la mejora.

Los cambios concretos de pantalla, wireframe y navegación están aplicados directamente en 03-ux-ui.md §2 y 14-pantallas-wireframes.md §1-3 (no se duplican aquí) y la nota de reconciliación de la métrica norte en 01-blueprint-producto.md §6.
