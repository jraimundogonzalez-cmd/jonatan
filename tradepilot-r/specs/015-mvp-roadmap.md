# SPEC-015 · MVP Implementation Roadmap (Fase 2, arranque)

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 2 — Construcción del MVP (primer documento de esta fase)
**Voz**: CTO — Challenge Mode aplicado a la implementación, no al blueprint. Cierra Fase 1 (14 especificaciones, 18 módulos de dominio, 2 piezas de infraestructura, 21 invariantes) y define el orden de construcción real.
**No re-abre ninguna decisión de Fase 1.** Este documento no rediseña ningún componente — decide en qué orden se construyen y, en varios casos, **cuánto de cada uno hace falta construir primero**, que es una pregunta que ninguna especificación anterior tenía que responder.

---

## 0. Hallazgo previo a cualquier roadmap: Fase 1 dejó módulos sin especificación de ingeniería

**Problema detectado antes de poder secuenciar nada**: el mapa de 22.5 §1 nombra 13 módulos originales; Fase 1 dio especificación de ingeniería completa a 11 de ellos (Quant Engine, Operations Engine, Funding Management, Rule Engine, Optimizer, Knowledge Engine, Analytics, Trade Capture Engine, AI Journal Engine, AI Decision Center, Simulation Engine). **Quedan sin SPEC-0XX propia**: Identity, Risk Engine, Management Plans, Notification Engine, Audit Engine, Snapshot Engine, Media Engine, Reporting Engine, y el ciclo completo de Improvement Prioritization Engine (30) más allá del Improvement Item ya congelado en 32 §3.7.

**No se corrige escribiendo cinco especificaciones más** — sería exactamente la sobreingeniería documental que el fundador acaba de pedir dejar atrás. Se resuelve aquí, en el propio roadmap (§1), clasificando cada uno por su complejidad real:

| Módulo sin SPEC propia | Complejidad real | Decisión |
|---|---|---|
| Identity | Delegado casi por completo a Supabase Auth (01 §3.6, 04 §1) | Se implementa directamente, sin especificación — es integración de una plataforma externa, no diseño de dominio |
| Risk Engine | Ya completamente descrito como secuencia de llamadas en SPEC-002 §4.1/26 §8 — es orquestación, no un motor propio | Se implementa como parte de la tarea de Operations Engine, sin documento propio |
| Snapshot Engine | Contrato genérico ya completo en 22.5 §2.11 (una función: congelar, nunca escribir) | Se implementa como utilidad compartida junto con Management Plans/Rule Engine, sin documento propio |
| Audit Engine | Esquema y comportamiento ya completos en 15 §3.4 (append-only, trigger) | Se implementa como trigger de base de datos, sin documento propio |
| Management Plans | Contrato de dominio completo desde 21.5 §3.4/32 §3.4 — CRUD simple + Snapshot | Se implementa junto con Operations Engine (comparten el mismo Sprint, §2) |
| Notification Engine | **Ver hallazgo de §1.3** | Diferido, posiblemente innecesario para MVP 1.0 |
| Media Engine | Ya explícitamente V3/no-MVP desde 06 §6 | Diferido, fuera de MVP 1.0 |
| Reporting Engine | Exportación/fiscal — valioso pero no parte del núcleo declarado (§6 del fundador) | Diferido, fuera de MVP 1.0 |
| Improvement Prioritization Engine (30) | **Ver hallazgo de §1.2** | Versión mínima dentro de MVP, completa después |

### 1.2 Hallazgo: Improvement Prioritization Engine completo es prematuro para el MVP

30 (Fase 0, conceptual) define un modelo de priorización con 8 factores, uno de los cuales (coste psicológico) el propio capítulo ya declaró como "la aproximación más débil del modelo" — sin datos reales de uso. Construir la máquina completa de Backlog/Prioridad/validación antes de tener un solo trader usando el producto sería calibrar una fórmula sin datos, exactamente lo que este proyecto ha rechazado repetidamente (11 §13). El objetivo del fundador para el MVP dice "detectar mejoras" — no "priorizar automáticamente entre docenas de mejoras candidatas", porque con el volumen de un piloto no habrá docenas, habrá una o ninguna.

### 1.3 Hallazgo: Notification Engine puede no ser necesario nunca

**Verificación exhaustiva de cada caso de uso que se le había asignado en Fase 0-1**: recordatorio pasivo de cuenta → resuelto como tarjeta de Clase 3 de AI Decision Center (SPEC-010 §5.4), nunca push. Coaching → cero notificaciones push por diseño (29 §5). Reglas incumplidas → tarjeta de Riesgo de Decision Center (SPEC-010 §5.1), nunca push. **No queda ningún caso de uso real que exija notificaciones push para el núcleo del producto.** Se elimina de la ruta crítica del MVP por completo — si en el futuro aparece un caso de uso genuino (p.ej. recuperación de contraseña, que en realidad resuelve Supabase Auth), se construye entonces, no antes.

---

## 1. Grafo de dependencias real

```
CAPA 0 (día 1, sin dependencias, en paralelo)
├─ Quant Engine (SPEC-001) — funciones puras, cero dependencias
├─ Identity (Supabase Auth) — integración externa
└─ Design System — tokens + componentes base (Botón, Input, Card, KPI) — cero dependencia de backend

CAPA 1 (depende de Capa 0)
└─ Funding Management (SPEC-003) — necesita Identity (user_id); rule_profile_snapshot_id
   existe como columna nullable, sin uso hasta Capa 3

CAPA 2 (depende de Capa 0+1)
├─ Operations Engine (SPEC-002) — necesita Funding Management (account_id) + Quant Engine (vía Risk Engine)
├─ Management Plans + Snapshot Engine (utilidad) — construidos junto con Operations Engine
└─ Risk Engine (orquestador delgado) — construido junto con Operations Engine

CAPA 3 (depende de Capa 2, TRES RAMAS EN PARALELO — no secuenciales entre sí)
├─ Rama A: UI de registro manual (Design System + Operations Engine directo — SIN Trade Capture Engine todavía, §3.1)
├─ Rama B: Analytics Engine (SPEC-007) — Catálogo de KPIs mínimo
└─ Rama C: Rule Engine (SPEC-004) — código en paralelo con A/B, integración al final de esta capa

CAPA 4 (depende de Capa 3)
├─ AI Journal Engine (SPEC-009) — necesita Operations Engine cerrando operaciones + integración LLM
└─ Knowledge Engine (SPEC-006) — pipeline construido aquí, valor real solo con volumen (§3.2)

CAPA 5 (depende de Capa 4)
└─ AI Decision Center — VERSIÓN MÍNIMA (§3.3): solo fuentes Rule Engine + Knowledge Engine

CAPA 6 (post-MVP 1.0, fuera de este roadmap)
Trade Capture Engine (conectores automáticos reales), Optimizer, Simulation Engine,
Improvement Prioritization Engine completo, AI Decision Center completo (7 clases),
Media Engine, Reporting Engine, gobernanza de catálogos compartida (deuda ya señalada 8 veces en Fase 1)
```

**Paralelización explícita**: Design System corre en paralelo a **todo** el backend desde el primer día — nunca bloquea ni se bloquea, solo debe estar listo antes de que cada pantalla concreta lo necesite. Dentro de Capa 3, las tres ramas (UI manual, Analytics, Rule Engine) no dependen entre sí — solo comparten la Capa 2 como prerrequisito, así que un equipo de 3 personas podría construir las tres a la vez.

---

## 2. Simplificaciones deliberadas encontradas — sobreingeniería evitada antes de construir

### 2.1 Trade Capture Engine no se construye completo en el MVP — el registro manual llama a Operations Engine directamente

**Problema detectado**: SPEC-008 ya estableció que el registro manual es, estructuralmente, un Connector más — pero eso no significa que haya que construir `connectors/`, `reconciliation/`, `unit-normalization/` y `commission-slippage/` completos solo para soportar un formulario manual, que no tiene nada que reconciliar (una sola fuente), nada que normalizar (el trader ya introduce valores en unidades canónicas) y ninguna comisión que capturar automáticamente. **Decisión**: la UI de registro manual llama **directamente** a `registrarOperacion`/`cerrarOperacion` (SPEC-002 §7) en el MVP — no hay una segunda vía de escritura (Operations Engine sigue siendo el único contrato canónico, el principio de SPEC-008 §1.2 punto 4 no se viola), simplemente Trade Capture Engine **como módulo con su propia arquitectura de conectores** se construye cuando llega el primer conector automático real (Capa 6), momento en el que su abstracción empieza a pagar su propio coste.

### 2.2 AI Decision Center empieza con 2 clases de tarjeta, no 7

Construir la jerarquía completa de 7 clases (SPEC-010 §4.1) antes de que existan más de dos fuentes reales (Rule Engine, Knowledge Engine) sería diseñar para una variedad que todavía no existe. La arquitectura de clases (extensible por catálogo, nunca por código, SPEC-010 §3.2) permite añadir Experimentos/Cambios confirmados/Mejora/Logros/Recordatorios sin rediseño el día que Improvement Prioritization Engine y Simulation Engine existan de verdad.

### 2.3 Rule Engine empieza con 4 de 15 tipos de regla

Static Drawdown, Trailing Drawdown, Daily Loss Limit, Maximum Loss — los cuatro tipos que cubren la inmensa mayoría de reglas reales de una prop firm típica (18 §2). Los 11 restantes (Consistency Rule, News Restriction, etc.) se añaden como filas de catálogo (SPEC-004 §11), nunca como código nuevo, en cuanto un usuario piloto real los necesite.

### 2.4 Analytics empieza con 6 KPIs, no con el catálogo completo

Expectancy, Profit Factor, Win Rate, Drawdown histórico, Curva de Equity, Recovery Factor — los seis que un trader necesita para responder "¿cómo voy?" el primer día. El resto del catálogo de SPEC-007 §3.2 se añade por fila, nunca por código nuevo, según demanda real de uso.

---

## 3. Entregables — MVP 0.1 a 1.0

### MVP 0.1 — El núcleo matemático y el modelo de datos

| Campo | Contenido |
|---|---|
| Objetivo | Demostrar que la matemática es exacta y que existe un modelo de datos real, antes de construir ninguna interfaz de verdad |
| Componentes | Quant Engine completo (SPEC-001, con golden dataset), Identity (Supabase Auth), Funding Management (SPEC-003, CRUD de Empresa/Cuenta), esquema completo con RLS |
| Qué puede hacer el usuario | Crear su cuenta de usuario, crear una Empresa, crear una Cuenta con capital inicial |
| Qué NO puede hacer todavía | Registrar una operación, ver cualquier dashboard o estadística |
| Riesgos | Un bug sutil en el kernel decimal (`BigInt`) sería el error más caro posible de todo el proyecto si pasara desapercibido |
| Dependencias | Ninguna — es la Capa 0-1 completa |
| Pruebas de cierre | El golden dataset completo de SPEC-001 §6.5 pasa sin ninguna divergencia; verificación de RLS (un usuario no puede leer ni un byte de otro usuario) |

### MVP 0.2 — Registrar y cerrar una operación real

| Campo | Contenido |
|---|---|
| Objetivo | El núcleo declarado del producto: registrar con precisión matemática, en menos de 30s |
| Componentes | + Operations Engine, Management Plans, Risk Engine, UI de registro manual (§2.1) |
| Qué puede hacer | Registrar una operación completa (entrada, parciales, cierre), ver su `R_final` correcto, editar/corregir con auditoría |
| Qué NO puede hacer | Ver Analytics agregado, ver ninguna sugerencia, importar nada automáticamente |
| Riesgos | El riesgo más importante de todo el roadmap: si el registro real no es <30s en la práctica, el producto falla en su promesa central desde el primer día |
| Dependencias | MVP 0.1 completo |
| Pruebas de cierre | 50+ operaciones sintéticas cubriendo las tres ramas de `R_cierre_resto` verificadas contra el golden dataset; tiempo real de registro medido con al menos un usuario piloto, no solo estimado |

### MVP 0.3 — Ver cómo voy

| Campo | Contenido |
|---|---|
| Objetivo | Cerrar el bucle de valor mínimo: registrar y después **ver** el resultado agregado |
| Componentes | + Analytics Engine (6 KPIs, §2.4), Rule Engine (4 tipos, §2.3), Dashboard de Cuenta |
| Qué puede hacer | Ver estadísticas reales de una Cuenta, ver su drawdown restante frente a un límite real |
| Qué NO puede hacer | Dashboard Maestro multi-cuenta (diferible si el piloto usa 1 sola cuenta), cualquier tarjeta de IA |
| Riesgos | Si la prop firm real del piloto usa un tipo de regla fuera de los 4 iniciales, hay que priorizar añadirlo antes que seguir el roadmap en orden |
| Dependencias | MVP 0.2 completo |
| Pruebas de cierre | Cada KPI del dashboard coincide exactamente con un cálculo de referencia manual; el semáforo cambia de color en el umbral exacto, ni un punto porcentual antes ni después |

### MVP 0.4 — El journal se completa solo

| Campo | Contenido |
|---|---|
| Objetivo | Primera demostración real de Automation Before Interaction |
| Componentes | + AI Journal Engine (tarjeta de 1-2 toques, título/resumen, campo `tags` — resuelve el hueco de SPEC-007 §12.1) |
| Qué puede hacer | Cerrar una operación y confirmar en ~10-12s con `plan_followed` pre-rellenado, mood, título/resumen generados |
| Qué NO puede hacer | Importación automática desde un bróker real — sigue siendo entrada manual + journal automático |
| Riesgos | Dependencia de proveedor externo de IA (coste/latencia variable) — mitigación ya especificada en 06 §7 |
| Dependencias | MVP 0.3 completo |
| Pruebas de cierre | Ninguna tarjeta se genera sin datos reales que la respalden (Trust Layer §5.1, verificación manual de una muestra); tiempo real de cierre medido, no estimado |

### MVP 0.5 — TradePilot empieza a conocerte

| Campo | Contenido |
|---|---|
| Objetivo | Primera pieza de inteligencia real: descubrimiento de patrones con evidencia |
| Componentes | + Knowledge Engine completo (4 arquetipos, corrección FDR) |
| Qué puede hacer | Ver un hallazgo de comportamiento real, con su evidencia y confianza, si el volumen de datos ya lo permite |
| Qué NO puede hacer | Todavía no hay un feed inteligente de home — el hallazgo vive en una vista dedicada simple |
| Riesgos | Con poco volumen de piloto, es probable y **correcto** que no haya ningún hallazgo — comunicarlo así desde el principio, no como si el producto "no funcionara" |
| Dependencias | MVP 0.4 completo, más volumen real de operaciones acumulado |
| Pruebas de cierre | Sobre un dataset sintético de ruido puro (sin ningún patrón real insertado), verificar que no se promueve ningún hallazgo falso |

### MVP 0.6 — Un solo lugar donde mirar

| Campo | Contenido |
|---|---|
| Objetivo | Consolidar Riesgo + Conocimiento en un único punto de entrada, versión mínima de AI Decision Center (§2.2) |
| Componentes | + AI Decision Center simplificado (2 clases: Riesgo, Conocimiento) |
| Qué puede hacer | Abrir la app y ver, como máximo, 5 tarjetas relevantes, o el mensaje de modo silencioso |
| Qué NO puede hacer | Recibir mejoras priorizadas, simulaciones, logros — dependen de módulos todavía no construidos |
| Riesgos | Construir la arbitración completa de 7 clases ahora sería sobreingeniería — se construye deliberadamente solo lo necesario hoy |
| Dependencias | MVP 0.3 y 0.5 completos |
| Pruebas de cierre | El modo silencioso muestra exactamente el mensaje ya especificado (SPEC-010 §7); una tarjeta de Riesgo nunca queda fuera de las 5 posiciones por una de Conocimiento |

### MVP 1.0 — El núcleo declarado, completo

| Campo | Contenido |
|---|---|
| Objetivo | Cumplir literalmente los 6 puntos que el fundador definió como objetivo del MVP |
| Componentes | Todo lo anterior + Trust Layer aplicado de forma transversal (taxonomía de origen visible, disciplina de `algorithm_version` ya en uso desde 0.1) + Experience Architecture auditada sobre cada pantalla real construida |
| Qué puede hacer | Registrar <30s, matemática correcta, Analytics, Journal automático, detectar mejoras — los 6 puntos exactos |
| Qué NO puede hacer, declarado explícitamente | Optimizer, Simulation Engine, conectores de bróker reales, Improvement Prioritization Engine completo, Media Engine, Reporting Engine, Notification Engine, Design System al 100% de su catálogo |
| Riesgos | Que 1.0 se sienta "incompleto" frente a la ambición total del blueprint — es, precisamente, la razón de ser de este roadmap: demostrar el núcleo primero |
| Dependencias | Las seis entregas anteriores |
| Pruebas de cierre | Uso real, con operaciones reales, durante 2-4 semanas, por al menos un trader piloto — sin errores de matemática, sin fricción no anticipada que rompa el flujo de <30s |

---

## 4. Software funcionando antes que software perfecto — dónde se traza el límite

Cada simplificación de §2 es exactamente esta priorización aplicada, no una excepción a los 21 invariantes: ninguna reduce precisión matemática (I1-I15 intactos en cada entrega — Quant Engine nunca se recorta), ninguna introduce fricción nueva (I16/I18 se cumplen desde 0.2), ninguna oculta incertidumbre (I20/Trust Layer se aplican desde el primer dashboard). Lo que se recorta es siempre **superficie de catálogo** (menos tipos de regla, menos KPIs, menos fuentes de tarjeta) — nunca **rigor** dentro de lo que sí se construye.

---

## 5. Auditoría del propio roadmap

### 5.1 Dependencias ocultas encontradas

1. **Trust Layer's `algorithm_version`/disclosure discipline debe empezar en MVP 0.1**, no cuando Trust Layer "se construya" en 1.0 — retrofitarlo después de tener usuarios reales sería mucho más caro que empezar con la disciplina desde el primer commit de Quant Engine.
2. **El token `--success` distinto de `--positive` (SPEC-012 §4.1.1) debe resolverse en MVP 0.2**, no más tarde — la primera confirmación de guardado ya convive en pantalla con una cifra de R real.
3. **El campo `tags` (SPEC-007 §12.1) solo se resuelve en MVP 0.4**, no antes — Analytics (0.3) debe declarar explícitamente que `group_by: tag` no está disponible hasta entonces, coherente con SPEC-007 §12.1.

### 5.2 Pasos innecesarios eliminados

Ya cubiertos en §2 — Trade Capture Engine completo, AI Decision Center de 7 clases, Rule Engine de 15 tipos, catálogo completo de Analytics: los cuatro se posponen sin perder la arquitectura que los hace extensibles sin rediseño.

### 5.3 Funcionalidades adelantadas detectadas y corregidas

Improvement Prioritization Engine completo (§1.2) y Notification Engine (§1.3) — ambas se habrían construido "porque estaban en el blueprint", no porque el MVP las necesite.

---

## 6. Limitaciones a 10 años

1. **La versión mínima de AI Decision Center (§2.2) exige disciplina para no convertirse en la versión definitiva por inercia** — el riesgo real no es técnico, es de producto: que funcione "suficientemente bien" con 2 clases y nadie priorice construir las 5 restantes.
2. **Los 4 tipos de regla iniciales (§2.3) dependen de que la prop firm del primer piloto real no necesite algo distinto** — es una apuesta razonable, no una garantía.

---

## Riesgos

1. **Que MVP 0.2 no cumpla realmente <30s en producción** — es el riesgo más importante de todo el roadmap, ya señalado en la propia tabla de esa entrega.
2. **Que la simplificación de §2 se congele por comodidad** en vez de expandirse cuando el MVP 1.0 lo justifique — mismo riesgo que §6.1.
3. **Gobernanza de catálogos** — sigue sin resolverse (novena mención acumulada); en Fase 2, con código real desplegándose, el coste de no resolverla ya no es teórico.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería, aplicada a un roadmap)

**¿Qué problema real resuelve este documento?** Evita construir en el orden equivocado, y evita construir más de lo que el objetivo declarado del MVP (§6 del fundador) realmente necesita — encontrando que ese propio objetivo, tal como se enunció, ya omitía Rule Engine y Funding Management sin nombrarlos, pese a ser indispensables para que exista una Cuenta.

**¿Qué sobra?** Cinco módulos que Fase 1 nunca especificó a propósito porque son integración externa u orquestación delgada (§1.1) — no se escriben cinco especificaciones más para justificarlos.

**¿Qué falta?** Antes de este documento faltaba: el grafo de dependencias real (§1), la decisión explícita de cuánto construir de cada módulo para el MVP (§2), y la verificación de que ningún objetivo de fricción/precisión declarado se rompe por el camino más corto (§4).

**¿Qué haría un CTO real para hacerlo más robusto?** Exactamente §2.1: nunca construir la abstracción completa antes de tener el segundo caso de uso real que la necesite — una abstracción construida para un solo caso de uso no es arquitectura, es especulación con sintaxis de arquitectura.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — el más importante (que <30s se cumpla de verdad) no lo puede validar ningún documento, solo el propio MVP 0.2 en producción.

**Nivel de madurez**: 95%. El grafo de dependencias, las siete entregas y las cuatro simplificaciones deliberadas están completos y son directamente accionables; lo pendiente es exclusivamente la validación empírica que solo la construcción real puede dar — que es, precisamente, el punto de pasar a Fase 2.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea empezar MVP 0.1 hoy mismo.

**Decisiones abiertas**:
1. Quién es el usuario piloto real y qué prop firm(s)/tipos de regla usa — determina si los 4 tipos de regla de §2.3 son suficientes desde el día 1 o si hay que reordenar.
2. Gobernanza de catálogos (§5, novena mención) — se recomienda, sin más demora, como la primera decisión de proceso a tomar en paralelo con MVP 0.1, no después.

**Recomendación profesional**: aprobar SPECIFICATION 015 y comenzar MVP 0.1 de inmediato. Es el documento que convierte catorce especificaciones de arquitectura en un plan de construcción real, y su hallazgo más importante no es una simplificación técnica — es la confirmación de que el propio objetivo del MVP, tal como se enunció, ya daba por sentados dos módulos (Rule Engine, Funding Management) sin nombrarlos, precisamente porque son tan centrales a lo que es TradePilot que resulta fácil olvidar que también hay que construirlos. A partir de aquí, el trabajo de este proyecto dejará de medirse en especificaciones aprobadas y empezará a medirse en software real ejecutándose — exactamente el cambio que corresponde ahora.
