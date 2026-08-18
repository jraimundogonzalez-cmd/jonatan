# SPEC-012 · TradePilot Design System (TPDS)

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 03 §1-8 (principio rector, arquitectura de información, tokens de color/tipografía, StatTile/RChip/ExplainCard, mobile-first, accesibilidad, inspiraciones — todo reafirmado, no rediseñado), 10 (registro rápido, presupuesto de pulsaciones), 14 (inventario de pantallas y reglas de transformación móvil→tablet→desktop), 19 I16 (Zero Friction), I19 (Attention Is the Most Valuable Currency), 21.5 §3.1 (roles compartidos, "deliberadamente no existe hoy" — precedente para §6.2), SPEC-010 (AI Decision Center, jerarquía de 7 clases de prioridad — la manifestación visual de esa jerarquía se define aquí, §5)
**No re-abre ninguna decisión conceptual ya aprobada.** No redefine la paleta, la tipografía ni el mobile-first de 03 — los formaliza y extiende. Donde extiende algo que 03 dejó incompleto o donde encuentra una tensión real entre lo ya aprobado y lo pedido ahora, se marca explícitamente (§4.1, §5).

---

## 1. Objetivo del componente

### 1.1 Misión

TPDS define cómo se ve, se siente y se comporta cualquier pantalla de TradePilot durante los próximos diez años — no qué hace el producto (eso ya está resuelto en Fase 0 y en las once especificaciones de Fase 1 anteriores), sino cómo se percibe hacerlo. Es la garantía de que la pantalla 300 se sienta hecha por el mismo equipo que la pantalla 1.

### 1.2 Qué nunca debe hacer

1. **Nunca define una funcionalidad nueva.** Ningún componente de este catálogo introduce una capacidad de producto — solo la forma visual de capacidades ya especificadas en Fase 0/Fase 1.
2. **Nunca permite dos componentes para el mismo problema.** Es el requisito central del fundador, convertido en gate de gobernanza verificable (§11), no solo en intención.
3. **Nunca redefine un token ya fijado en 03 §5** sin una razón explícita y documentada (§4 aplica esta disciplina sobre sí misma).
4. **Nunca genera urgencia artificial.** Es I20 (§2), el hallazgo y el invariante central de este documento.
5. **Nunca añade un componente sin que supere las cinco preguntas del fundador** (§11) — el catálogo de §6 es el resultado de aplicarlas, no una lista aceptada por defecto.

### 1.3 Relación con el blueprint ya aprobado — consolidación, no reinvención

**03 (UX/UI y sistema de diseño) ya fijó, en Fase 0, buena parte de lo que esta especificación formaliza**: la paleta completa con sus valores hexadecimales (03 §5.2), la regla de que el acento de marca vive fuera del eje verde/rojo precisamente para no chocar con la semántica de P&L (03 §5.2, nota de diseño), la tipografía monoespaciada para datos numéricos (03 §5.3), tres componentes reutilizables ya nombrados (StatTile, RChip, ExplainCard, 03 §5.4), mobile-first (03 §6), contraste WCAG AA y la regla de nunca comunicar estado solo por color (03 §7), y una tabla de inspiraciones que ya cubre cuatro de las ocho referencias que el fundador pide ahora (Apple, Linear, Notion, Raycast — 03 §8). **Esta especificación no repite ese trabajo ni lo contradice — lo hereda sin cambios y lo extiende** donde 03 se quedó a nivel de blueprint conceptual (sin catálogo completo de componentes, sin reglas de animación, sin gobernanza de adición de componentes nuevos, sin las cuatro referencias que faltaban).

### 1.4 Estatus: infraestructura compartida, no un módulo de dominio

TPDS no es un módulo en el sentido de 22.5 (no tiene datos propios, no emite eventos, no tiene contrato de entrada/salida sobre una base de datos) — es infraestructura compartida consumida por toda superficie visual futura, la misma categoría que `quant-engine` o la utilidad de Snapshot ocupan como librerías compartidas (25 §2) en vez de servicios. No se añade al mapa de 18 módulos oficiales — se referencia desde cualquier especificación futura de pantalla como su fuente única de componentes.

---

## 2. I20 — Professional Calm (nuevo invariante permanente, operacionalizado)

**Se adopta**, con el mismo tratamiento que I16-I19: no como aspiración, sino como regla verificable.

> **I20**: TradePilot debe reducir el estrés del trader, nunca aumentarlo. Ninguna pantalla, gráfico, animación, sonido o interacción puede generar sensación de urgencia artificial.

### 2.1 La distinción que hace este invariante verificable, no solo inspirador

**Problema detectado antes de aplicar la regla**: un drawdown crítico real (SPEC-010, tarjeta de Clase 1 "Riesgo") **es** urgente — ocultar o suavizar esa urgencia sería negligente, no calmado. I20 no puede significar "nunca comunicar severidad real" sin contradecir directamente el propio SPEC-010 que este mismo proyecto acaba de aprobar. **La distinción exacta**: urgencia **artificial** es la que fabrica el propio diseño (animación en bucle, parpadeo, sonido de alarma, cuenta atrás, modal que bloquea hasta que se responda); severidad **real** se comunica con jerarquía visual estática y lenguaje preciso (color, posición, tipografía — nunca movimiento ni sonido). Es la diferencia entre un cirujano que dice con calma "esto es crítico, hay que actuar" y una alarma que suena — ambos comunican gravedad, solo uno genera pánico. Toda tarjeta de Clase 1 de SPEC-010 se renderiza, bajo esta regla, sin animación de entrada especial, sin badge pulsante, sin sonido — solo su posición fija en primer lugar y su color de máxima prioridad (§4.1).

### 2.2 Aplicación

Se revisa explícitamente en toda pantalla futura, con el mismo estándar que I16 ya exige para fricción — ninguna pantalla se aprueba sin una fila explícita de "¿genera esto urgencia artificial?" en su propia auditoría.

---

## 3. Principios extraídos de las referencias — nunca estética copiada

| Referencia | Principio extraído (no estética) | Dónde ya se aplica o se aplicará |
|---|---|---|
| Apple | Jerarquía tipográfica y espaciado generoso comunican prioridad sin necesitar color | 03 §8, ya vigente |
| Linear | Velocidad percibida (transiciones <150ms) y una sola acción primaria siempre accesible | 03 §8, ya vigente; FAB de registro (10) |
| Notion | Los campos opcionales no vacíos no deben sentirse vacíos ni sobrecargados | 03 §8, ya vigente |
| Raycast | Acción rápida centralizada (Cmd+K / FAB), teclado-first en desktop | 03 §8, ya vigente; §9 (teclado) |
| Stripe *(nueva)* | Claridad sobre inteligencia — un número con contexto mínimo vale más que un gráfico sofisticado sin él; documentación de producto tratada como parte del producto | Catálogo de componentes (§6): cada uno documentado con la misma disciplina que Stripe aplica a su propia documentación |
| Arc Browser *(nueva)* | La interfaz puede tener personalidad sin sacrificar velocidad — pero solo en superficies de baja frecuencia (onboarding, ajustes), nunca en el bucle operativo diario | Restringido explícitamente: el registro de operación (10) y el Dashboard (17 §4) nunca adoptan "personalidad" a costa de velocidad |
| Figma *(nueva)* | Un lenguaje de componentes versionado (igual que un archivo de librería de Figma) evita que dos equipos construyan el mismo patrón dos veces | §11 (gobernanza) — es, literalmente, el mecanismo que Figma usa para bibliotecas de componentes, aplicado aquí como proceso, no como herramienta |
| Bloomberg Terminal *(nueva, con advertencia explícita)* | Densidad de información precisa, alineación numérica que comunica confianza — **y nada más** | Ver §3.1 — el resto de la estética de Bloomberg se rechaza explícitamente |

### 3.1 Bloomberg Terminal — la referencia que hay que citar con más cuidado

**Problema detectado, aplicando Challenge Mode a la propia lista de referencias del fundador**: Bloomberg Terminal es, precisamente, el ejemplo de producto profesional **menos calmado** que existe — ventanas múltiples, alta densidad simultánea, colores de alto contraste optimizados para escaneo rápido bajo presión, cultura de alertas sonoras. Extraer su estética literal contradeciría I20 (§2) en la primera pantalla que la aplicara. **Se extrae exactamente un principio y se rechaza el resto explícitamente**: la alineación numérica monoespaciada que comunica precisión (ya adoptada en 03 §5.3) es la única lección de Bloomberg que TPDS conserva — la densidad multi-ventana, el contraste agresivo y la cultura de alerta sonora quedan fuera por diseño, no por omisión.

---

## 4. Tokens visuales

### 4.1 Color — reafirmado, con una corrección de colisión semántica

Se hereda la paleta completa de 03 §5.2 sin cambios (`--bg-base`, `--bg-surface`, `--accent`, `--positive`, `--negative`, `--warning`) y se añade la capa semántica funcional pedida ahora (Riesgo/Precaución/Información/Confirmación/Neutro):

| Rol funcional | Token | Valor | Nunca se usa para |
|---|---|---|---|
| Riesgo | `--risk` | = `--negative` (03 §5.2, `#F5484B`) | Decoración; nunca sin texto/icono que lo acompañe (03 §7) |
| Precaución | `--caution` | = `--warning` (03 §5.2, `#F5A623`) | — |
| Información | `--info` | = `--accent` (03 §5.2, `#5B8DEF`) | Nunca como color de fondo de una acción destructiva |
| Confirmación | `--success` | **Nuevo, deliberadamente distinto de `--positive`** (§4.1.1) | Nunca para representar un valor de R o € positivo |
| Neutro | `--neutral` | = `--text-secondary` (03 §5.2, `#8B8F98`) | — |

**4.1.1 Hallazgo: "Confirmación" no puede reutilizar el verde de "Beneficio" sin romper la razón por la que ese verde existe.** 03 §5.2 ya justificó, explícitamente, por qué `--accent` (el color de marca/CTA) vive fuera del eje verde/rojo: para que verde/rojo signifiquen **solo** P&L en toda la app, sin excepciones. El mapeo nuevo del fundador ("Verde = Confirmación") reintroduce exactamente la ambigüedad que 03 ya había eliminado — un checkmark de "guardado con éxito" en el mismo verde que "+2.3R" generaría, en una app financiera, la misma confusión momentánea que 03 §5.2 se esforzó en prevenir. **Solución aplicada**: `--success` es un verde deliberadamente **desaturado y distinto** de `--positive`, y **siempre** se empareja con un icono de check — nunca aparece solo, nunca en una superficie donde también haya una cifra de R/€ visible en el mismo campo visual. Es una corrección menor de token, no una reapertura de 03 §5.2 — su razón fundacional se preserva, se extiende con más precisión.

### 4.2 Tipografía

Reafirma 03 §5.3 sin cambios: monoespaciada para todo dato numérico, sans-serif geométrica para texto de interfaz, nunca mezcladas dentro del mismo dato. Se añade la restricción de tono pedida ahora: ningún peso de fuente, tamaño o tratamiento puede evocar interfaz de videojuego (fuentes gruesas con efectos), de bróker retail (condensadas, muy densas sin jerarquía) o de plataforma cripto (tipografía "tech"/futurista) — la referencia de tono sigue siendo Apple/Linear (§3), nunca esas tres categorías.

### 4.3 Espaciado y elevación (nuevo, 03 no lo cubría)

Escala de espaciado en múltiplos de 4px (4/8/12/16/24/32/48/64) — estándar de la industria, sin justificación adicional necesaria. Tres niveles de elevación (`--bg-base` → `--bg-surface` → `--bg-surface-2`, ya definidos en 03 §5.2) son el único mecanismo de profundidad — nunca sombras decorativas adicionales fuera de esos tres niveles, para no introducir una cuarta variable visual que compita con la jerarquía de §5.

---

## 5. Jerarquía visual — la forma pixel de la jerarquía de SPEC-010

`Riesgo > Decisión > Acción > Información > Decoración` no es una regla nueva e independiente — es la manifestación visual exacta de la jerarquía de 7 clases ya aprobada en SPEC-010 §4.1 (Riesgo/Advertencias por encima de Mejora/Logros). Una tarjeta de Clase 1 de SPEC-010 se dibuja siempre con mayor peso visual (posición, tamaño, `--risk`) que cualquier tarjeta de clase inferior — no por una regla de diseño separada, sino porque ambas jerarquías son, deliberadamente, la misma jerarquía descrita dos veces: una en la capa de decisión (qué se muestra), otra en la capa visual (cómo se dibuja lo que se muestra). "Decoración" en el nivel 5 no significa prohibida — significa que nunca puede ganarle peso visual a nada de los cuatro niveles superiores, en ninguna pantalla.

---

## 6. Catálogo de componentes

### 6.1 Reglas globales heredadas — una sola vez, no repetidas por componente

Para no repetir el mismo bloque de texto veinte veces (y arriesgar que diverjan con el tiempo, la misma clase de "formula drift" que SPEC-001 §Riesgos #1 ya advirtió, aplicada aquí a documentación de componentes en vez de a fórmulas), estas reglas aplican a **todo** el catálogo de §6.3 salvo excepción explícita:

- **Estados mínimos obligatorios**: default, hover/focus (desktop), pressed, disabled, loading, error — un componente sin uno de estos estados definido no se considera completo.
- **Accesibilidad mínima obligatoria**: contraste AA (03 §7), nunca solo color para comunicar estado (03 §7), objetivo táctil mínimo 44×44px (estándar iOS/Android), navegable por teclado con foco visible, etiquetado para lector de pantalla.
- **Animación**: máximo 150ms para micro-interacciones (03 §8, ya vigente para Linear), curva de easing estándar, y siempre sujeta a la regla de §7 (comunica, nunca decora).
- **Modo claro/oscuro**: todo componente se define sobre tokens (§4), nunca sobre un valor de color fijo — el cambio de modo es automático por construcción, no un segundo diseño paralelo.

### 6.2 Reducción del catálogo pedido — Challenge Mode aplicado antes de construir

| Elemento pedido | Resolución |
|---|---|
| Indicador | **No es un componente propio** — es la categoría que Semáforo, Badge, RChip y Progress ya instancian. Mantenerlo como entrada de catálogo duplicaría cualquiera de los otros cuatro. Se elimina del catálogo como componente, se conserva como taxonomía en esta nota. |
| Widget | **Rechazado.** Ningún patrón nombrado "widget" tiene un problema propio que no resuelva ya Card, KPI o Gráfico — permitirlo crearía la vía de escape exacta que rompe "nunca dos componentes para el mismo problema": cualquier caso incómodo de clasificar terminaría llamándose "widget" en vez de forzarse a encajar en el catálogo real. |
| Avatar | **Diferido, no rechazado.** No existe hoy ningún contexto de producto multi-persona (21.5 §3.1 ya declaró explícitamente que los roles compartidos mentor/alumno "deliberadamente no existen hoy"). Construir un componente de avatar sin un caso de uso real sería exactamente el tipo de anticipación sin demanda validada que este proyecto ha rechazado repetidas veces (11 §13). Se añade al catálogo el día que 21.5 §3.1 se apruebe como ampliación real. |

### 6.3 Catálogo final (17 componentes, cada uno con objetivo/casos prohibidos/variantes — estados/accesibilidad/animación por §6.1)

| Componente | Objetivo | Casos prohibidos | Variantes |
|---|---|---|---|
| Botón | Disparar una acción, nunca navegar (eso es un link) | Nunca más de una acción primaria visible a la vez en la misma vista (03 §8, Linear) | Primario, secundario, destructivo, texto |
| Input | Capturar un valor libre | Nunca para una elección de conjunto cerrado (eso es Selector) | Texto, numérico (siempre monoespaciado, §4.2), fecha |
| Selector | Elegir entre opciones ya conocidas | Nunca más de 7 opciones sin buscador (umbral estándar de usabilidad) | Segmentado (2-3 opciones, 10 §5), desplegable, chip múltiple (parciales, 10 §5) |
| Card | Agrupar información relacionada con un límite visual claro | Nunca anidar una Card dentro de otra Card | Cuenta (18 §6), Operación, Decisión (SPEC-010) |
| KPI (`StatTile`) | Mostrar un número con su contexto mínimo (03 §5.4, ya vigente) | Nunca sin unidad visible; nunca más de un delta simultáneo | Con delta, sin delta |
| Gráfico | Visualizar una serie o distribución ya calculada por Analytics (SPEC-007 §7) | Nunca decorativo (SPEC-007 §8.3, ya rechazado explícitamente) | Curva, heatmap, ranking — mismos tres arquetipos ya fijados en SPEC-007 §7, sin un cuarto nuevo aquí |
| Tabla | Comparar muchos registros con los mismos campos | Nunca más de 7 columnas visibles sin scroll horizontal en desktop; en móvil, nunca tabla — siempre lista de Cards | — |
| Filtro | Acotar un Trade Set (28 §2, SPEC-007 §6) | Nunca inventa una dimensión de filtro que Analytics no exponga | — |
| Timeline | Mostrar una secuencia temporal de eventos de una misma entidad (parciales de una Operación, historial de capital, historial de cumplimiento) | Nunca para más de una entidad a la vez (eso es un Gráfico de serie temporal, SPEC-007 §7) | — |
| Modal | Interrumpir el flujo para una decisión que exige atención inmediata | Nunca para una confirmación de éxito (03 §3, paso 6: "toast, no modal") — nunca para contenido informativo que podría ser una Card | — |
| Empty State | Explicar por qué una vista está vacía y qué hacer al respecto | Nunca un espacio en blanco sin explicación (SPEC-006 §12.1, mismo principio ya aplicado al backlog vacío de un trader nuevo) | — |
| Loading State | Comunicar que algo está en curso | Nunca más de 400ms sin feedback visual; nunca un spinner genérico si ya se conoce la forma del contenido (usar Skeleton) | Spinner (esperas cortas/inciertas), Skeleton (esperas de forma conocida) |
| Error State | Comunicar un fallo y su siguiente paso posible | Nunca solo un código de error sin lenguaje humano | — |
| Badge | Etiqueta corta de estado o categoría (nunca un valor numérico — eso es KPI/RChip) | Nunca como único portador de información crítica (03 §7) | Estado, categoría (tags de SPEC-009) |
| Semáforo | Comunicar el estado agregado de cumplimiento de una Cuenta (17 §4, 18 §6, ya vigente) | Nunca para nada que no sea el estado de cumplimiento — no se reutiliza como indicador genérico de "bueno/malo" | 🟢🟡🔴, siempre con texto/valor numérico acompañante (03 §7) |
| Progress | Comunicar avance hacia un objetivo cuantificable (Profit Target, muestra de un experimento) | Nunca para tiempo transcurrido sin un objetivo claro | Lineal, circular (uso escaso, solo en espacios muy reducidos) |
| Banner | Comunicar un mensaje a nivel de página, no de un solo dato | Nunca para contenido que ya tiene su propia Card o Modal — nunca de marketing (SPEC-010 §4.3, ya rechazado) | Informativo, de advertencia |

---

## 7. Animación — comunica, nunca decora

Regla ya introducida en §6.1, ampliada aquí con el caso límite explícito que Challenge Mode encontró: **la tarjeta de "Logro" de SPEC-010 es el punto de mayor riesgo de violar esta regla** — un logro es, por naturaleza, un momento que invita a celebrar visualmente (confeti, rebote, sonido), exactamente el repertorio de una mecánica de videojuego que §4.2 y SPEC-010 §9.1 ya rechazan explícitamente. **Resolución**: un Logro se comunica con una transición de entrada estándar (misma curva de 150ms que cualquier otro componente) y, como máximo, un cambio de color puntual a `--success` (§4.1.1) — nunca una animación exclusiva, nunca sonido, nunca confeti. Es la aplicación directa de I20 (§2) al caso que con más probabilidad la habría violado sin esta nota explícita.

---

## 8. Mobile first

Reafirma 03 §6 y 14 sin cambios — diseñado primero para viewport móvil, expandido a desktop, nunca al revés. Ya era la decisión vigente antes de este documento; se cita aquí como confirmación, no como hallazgo nuevo.

---

## 9. Accesibilidad

Reafirma 03 §7 (contraste AA, nunca solo color) y añade lo que 03 no cubría explícitamente:
- **Fuentes grandes**: todo tamaño de fuente se define en unidades relativas (`rem`), nunca en píxeles fijos, para respetar la configuración de accesibilidad del sistema operativo sin trabajo adicional por pantalla.
- **Navegación por teclado**: todo componente interactivo (§6.3) tiene un estado de foco visible (§6.1) y es alcanzable en orden lógico de tabulación — prioridad alta en desktop (Raycast, §3), donde el uso teclado-first es más frecuente.
- **Lectores de pantalla**: todo dato semánticamente significativo (un valor de R, un estado de semáforo) lleva una etiqueta accesible equivalente al contenido visual — nunca solo un color o un icono sin texto alternativo.
- **Modo claro**: se ofrece como preferencia de accesibilidad genuina — el modo oscuro sigue siendo la identidad de marca por defecto (03 §7, sin cambios), el modo claro no la sustituye, la complementa.

---

## 10. Zero Friction medido más allá de clics

Reafirma I16 y lo extiende con las cinco dimensiones que el fundador pide medir explícitamente, cada una con su instrumento ya existente en el blueprint — ninguna requiere un mecanismo nuevo:

| Dimensión | Cómo se mide | Instrumento ya existente |
|---|---|---|
| Tiempo | Duración de la interacción, ya el estándar de medición en 10 §4/SPEC-002 §6/SPEC-008 §12/SPEC-009 §7.2 | Presupuestos ya fijados por flujo |
| Carga cognitiva | Número de decisiones simultáneas visibles (nunca más de lo que I19 permite por pantalla) | I19 (SPEC-010 §2) |
| Errores | Tasa de corrección tras guardar (SPEC-002 §5.6, ediciones auditadas) | `audit_log` ya cuenta esto por diseño |
| Decisiones | Número de opciones presentadas a la vez (Selector, §6.3: máx. 7 sin buscador) | Límite ya fijado en el catálogo de componentes |
| Cambios de contexto | Número de pantallas distintas necesarias para completar una tarea frecuente | Mismo criterio que 03 §4 ya aplicó para separar Calculadora de "Hoy" |

---

## 11. Gobernanza — ningún componente nuevo sin las cinco preguntas del fundador

Mismo patrón que TPOS (31) aplica a funcionalidades de producto, aplicado aquí a componentes visuales: antes de añadir cualquier componente al catálogo de §6.3, debe responder, por escrito, las cinco preguntas que el propio fundador exige en este documento — ¿por qué existe? ¿qué problema resuelve? ¿cuándo NO debe usarse? ¿cuánto espacio mental consume? ¿qué prioridad visual tiene (§5)? — es el mismo gate binario de TPOS trasladado a este dominio, y resuelve directamente el riesgo de gobernanza de catálogo que Fase 1 ha señalado repetidamente desde SPEC-004 (ahora su octava aparición, la primera aplicada a un catálogo que no es de backend).

---

## 12. Auditoría — hallazgos adicionales

### 12.1 Consistencia verificada contra las cuatro especificaciones más recientes

SPEC-009 (AI Journal Engine) y SPEC-010 (AI Decision Center) ya usaban lenguaje de diseño ("tarjeta", "toque") sin un catálogo formal detrás — se verificó que ninguno de los patrones que describen (tarjeta de cierre de un toque, tarjeta de decisión) requiere un componente nuevo fuera del catálogo de §6.3 (ambas son variantes de Card + Botón + Selector) — ninguna corrección retroactiva necesaria a esas especificaciones, solo confirmación de compatibilidad.

### 12.2 Colisión evitada entre "Semáforo" y "Badge de estado"

Ambos podrían, sin la restricción explícita de §6.3, usarse indistintamente para "mostrar un estado" — se resuelve reservando Semáforo exclusivamente para cumplimiento de cuenta (17 §4/18 §6, un significado ya fijado en el producto) y Badge para cualquier otro estado o categoría — evita que un futuro desarrollador use un semáforo 🟢🟡🔴 para algo que no sea drawdown/cumplimiento, lo que diluiría el significado que ese símbolo ya tiene en todo el producto.

---

## 13. Limitaciones a 10 años

1. **El catálogo de 17 componentes es el punto de partida, no un techo** — la gobernanza de §11 es lo que debe sostenerlo, no un número fijo; si en cinco años el catálogo real tiene 25 componentes porque 25 pasaron las cinco preguntas, es un éxito de la gobernanza, no una desviación del diseño original.
2. **Arc Browser como referencia de "personalidad en superficies de baja frecuencia" (§3) es la línea más subjetiva de este documento** — sin datos reales de qué superficies son genuinamente de baja frecuencia, existe el riesgo de que se aplique personalidad visual a algo que en la práctica se usa a diario; se revisa con datos de uso real, no se decide especulativamente más allá de lo ya acotado aquí.
3. **`--success` (§4.1.1) es un token nuevo sin validación visual real todavía** — su distinción de `--positive` es correcta en principio, pero su implementación final (cuánto debe desaturarse para ser inequívocamente distinto sin generar una cuarta familia de verdes) requiere revisión de diseño visual real, no solo de arquitectura de tokens.

---

## Riesgos

1. **Que un futuro equipo de diseño, bajo presión de plazo, añada un componente "solo esta vez" sin pasar las cinco preguntas de §11** — mismo tipo de riesgo de disciplina ya aceptado repetidamente en este blueprint para catálogos de backend, aquí trasladado a un catálogo visual con la misma exposición directa al usuario final que ya hizo crítico el hallazgo de SPEC-007 (Catálogo de KPIs).
2. **Que I20 (§2) se interprete de forma demasiado laxa en la implementación real** — la distinción entre urgencia real y artificial (§2.1) es conceptualmente clara pero exige juicio de diseño en cada caso concreto, no una regla mecánica aplicable sin criterio.
3. **Gobernanza compartida de catálogos** — esta es la octava vez en Fase 1 que este riesgo aparece (Rule Library, estrategias del Optimizer, dimensiones de Knowledge Engine, KPIs de Analytics, especificaciones de instrumento, `milestone_definitions`, `simulation_methods`, y ahora el catálogo de componentes) — a estas alturas, ya no es una nota recurrente, es la señal más clara de todo Fase 1 de que hace falta un proceso de gobernanza único, no ocho procesos separados idénticos en espíritu.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** El que el fundador nombra directamente: que 200-300 pantallas construidas por equipos y momentos distintos se sientan como un solo producto — y lo hace verificando primero que buena parte del trabajo ya existía en 03, evitando reconstruirlo con valores ligeramente distintos (el error más caro posible en un sistema de diseño: dos definiciones del mismo azul).

**¿Qué sobra?** Indicador (redundante con Semáforo/Badge/RChip/Progress) y Widget (categoría sin problema propio) — ambos eliminados del catálogo antes de construirse; Avatar, diferido por falta de caso de uso real.

**¿Qué falta?** Antes de este documento faltaba: la resolución de la colisión semántica entre "Verde = Confirmación" (pedido ahora) y "Verde = Beneficio" (ya fijado en 03 §5.2) — un error real que, sin corregirse, habría introducido ambigüedad de color en un producto financiero cuya promesa central es precisión ("Every R Matters"); y la distinción operacional entre urgencia real y artificial que hace de I20 una regla verificable en vez de un buen deseo.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §2.1: comunicar severidad real con calma, nunca con teatralidad — es el mismo estándar de comunicación de riesgo de cualquier mesa profesional, donde una alerta crítica se dice una vez, con precisión, sin necesidad de repetirla con parpadeos para que se tome en serio.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — el más importante (gobernanza compartida de catálogos, ya en su octava aparición) no es un defecto de este documento, es la conclusión acumulada de toda la Fase 1.

**Nivel de madurez**: 94%. Tokens, jerarquía visual, catálogo de componentes con su reducción justificada, gobernanza y las cinco dimensiones de fricción medibles están completos y son directamente implementables; lo pendiente es exclusivamente calibración visual real (`--success`, §13 punto 3) y la gobernanza de catálogos ya señalada de forma acumulada.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea el uso de TPDS tal como está especificado.

**Decisiones abiertas**:
1. Calibración visual final de `--success` frente a `--positive` — trabajo de diseño visual real, no de arquitectura, se completa en la fase de implementación.
2. **La gobernanza común de catálogos (Riesgo #3), ya señalada ocho veces**, se recomienda formalmente como la primera decisión de proceso a resolver antes de avanzar a más especificaciones — no como una novena repetición de la misma nota, sino como una recomendación explícita de que esta es, con diferencia, la deuda de proceso más consistente de todo el proyecto hasta ahora.

**Recomendación profesional**: aprobar SPECIFICATION 012. Es la decisión estratégica correcta en el momento correcto — el propio fundador identificó, sin que Challenge Mode tuviera que argumentarlo, la razón por la que un sistema de diseño debe preceder a las pantallas, no seguirlas. El hallazgo más valioso de esta especificación no es una funcionalidad nueva, es haber encontrado una colisión de significado (verde = confirmación vs. verde = beneficio) antes de que doscientas pantallas la hicieran costosa de corregir.
