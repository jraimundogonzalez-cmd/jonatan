# 32 · Public Domain Contracts (Contratos Públicos del Dominio)

*Voz: Cofundador / CTO / Product Architect — Challenge Mode obligatorio (19 §1.1). Cierra oficialmente la Fase 0 (Blueprint Conceptual) y abre la Fase 1 (Diseño Técnico). Sin tablas de base de datos, sin código, sin clases — el objetivo es que cualquier implementación interna pueda cambiar durante los próximos 10 años sin romper ningún otro módulo, siempre que respete el contrato aquí congelado.*

## 0. Challenge Mode — el hallazgo principal, antes de construir un solo contrato

El fundador pidió tratar **12 conceptos** — User, Company, Account, Management Plan, Operation, Snapshot, Rule Profile, Rule Evaluation, Coaching Card, Improvement Backlog, Scenario, Simulation — como si todos fueran **Aggregate Roots**, con el mismo contrato de 11 campos.

**Problema detectado**: no lo son. 21.5 §1 ya definió con precisión qué es un Aggregate Root (identidad propia, ciclo de vida, cambia de forma consistente como unidad), qué es un Value Object (sin identidad, definido por sus valores) y qué es un Domain Service (opera sobre varias entidades, sin estado propio). Forzar los 12 conceptos al mismo molde de "Aggregate Root" produciría contratos que mienten sobre su propia naturaleza — por ejemplo, preguntar "¿quién puede modificarlo?" de un Value Object inmutable como Snapshot no tiene una respuesta de tipo "un módulo lo edita", tiene una respuesta de tipo "nadie, nunca, por invariante". Rellenar esa fila igualmente produciría un contrato con apariencia de rigor pero contenido falso.

Aplicando la reclasificación que 21.5 y 28 ya dejaron trazada (no es una decisión nueva, es una consecuencia de aplicar lo ya aprobado):

| # pedido | Concepto | Categoría real | Fuente que ya lo estableció |
|---|---|---|---|
| 1 | User | **Aggregate Root** | 21.5 §3.1, §5 |
| 2 | Company | **Aggregate Root** | 21.5 §3.2, §5 |
| 3 | Account | **Aggregate Root** | 21.5 §3.3, §5 |
| 4 | Management Plan | **Aggregate Root** | 21.5 §3.4, §5 |
| 5 | Operation | **Aggregate Root** | 21.5 §3.5, §5 |
| 6 | Snapshot | **Value Object** (con matiz de identidad técnica — ver §1) | 21.5 §4; 22.5 §2.11 |
| 7 | Rule Profile | **Aggregate Root** (agregado propio, catálogo de la Empresa) | 21.5 §3.6; 22 |
| 8 | Rule Evaluation | **Registro inmutable** (hecho calculado, no una entidad con ciclo de vida) | 22 §5; 21.5 §6 |
| 9 | Coaching Card | *(se unifica con #10 — ver §2)* | 29 §3 |
| 10 | Improvement Backlog | *(se unifica con #9 — ver §2)* | 30 §3 |
| 11 | Scenario | **Value Object** | 28 §2, fila 5 |
| 12 | Simulation | **Domain Service / proceso** | 28 §2, fila 6; 21.5 §6 |

Resultado: **12 nombres → 11 contratos reales**, cada uno tratado con el rigor que le corresponde a su categoría, no con una plantilla forzada. Se detalla la unificación (#9/#10) y la aclaración de Snapshot (#6) antes de construir el catálogo, porque ambas son hallazgos de Challenge Mode que cambian cómo se lee el resto del capítulo.

## 1. Aclaración: Snapshot como Value Object con identidad técnica (no de dominio)

**Problema detectado**: existe una contradicción real, no cosmética, entre dos capítulos ya aprobados. 21.5 §4 clasifica `PlanSnapshot` y `RuleProfileSnapshot` como **Value Objects** — por definición, sin identidad propia. Pero 22.5 §2.11 (contrato de Snapshot Engine) dice textualmente que devuelve "un Snapshot **con identidad propia**, timestamp y garantía de inmutabilidad". Ambas frases no pueden ser ciertas del mismo concepto a la vez bajo el vocabulario DDD fijado en 21.5 §1.

**Solución propuesta**: separar identidad de dominio de identidad de almacenamiento. Un Snapshot **no tiene identidad de dominio** — dos snapshots con los mismos valores congelados son, conceptualmente, intercambiables, y ninguna lógica de negocio los compara por "cuál es cuál", solo por su contenido. Pero **sí necesita un id técnico** por la misma razón que cualquier VO que se persiste en su propia fila de tabla lo necesita: sirve como clave foránea desde la Operación o la Cuenta que lo posee, y como referencia de recuperación. Es idéntico al caso ya resuelto en `Resultado` (21.5 §4): un VO derivado que igual se guarda con una fila propia por razones de persistencia, sin que eso lo convierta en Entity.

**Por qué es mejor que las alternativas**: la alternativa de "promover Snapshot a Entity" (aceptar la redacción de 22.5 tal cual) rompería la garantía central del patrón — un Snapshot editable-por-identidad es exactamente el defecto que la regla 13 (19 §8.1) existe para prohibir. La alternativa de "quitarle cualquier id" es inviable en la práctica: sin id técnico no hay forma de referenciarlo desde una fila de Operación o Cuenta sin embeberlo completo cada vez, lo cual sí sería viable pero es una decisión de esquema (fuera de alcance de este capítulo, se anota en §7).

**Impacto futuro**: se corrige la redacción de 22.5 §2.11 mediante nota en este capítulo (no se reescribe el archivo original, seguimos la misma disciplina de 26 §8 de anotar la actualización en el capítulo nuevo). El contrato de Snapshot en §3 de este documento usa esta distinción explícitamente.

## 2. Unificación: Coaching Card + Improvement Backlog Item → Improvement Item

**Problema detectado**: 29 §3 define una Coaching Card de 6 campos (Qué ocurrió / Por qué / Cuánto costó / Qué alternativa / Qué evidencia / Qué probabilidad). 30 §3 define un elemento del Improvement Backlog con otros 6 campos (Qué mejorar / Por qué / Cuánto cuesta no cambiarlo / Qué ganancia potencial / Qué evidencia / Cuándo consolidada). Comparados campo a campo, no son dos conceptos — son **la misma información, en dos momentos y con dos audiencias distintas**: el Backlog Item es la representación interna (con Prioridad numérica, estado Detectado/En cola/Activo/Consolidado/Descartado, uso del sistema de priorización); la Coaching Card es la representación narrativa que se le muestra al trader **solo cuando ese mismo item está en estado Activo y ha superado el filtro de admisión de 29 §5**. Tratarlos como dos Aggregate Roots distintos obligaría a mantener sincronizados dos objetos que en realidad son una sola fuente de verdad vista desde dos ángulos — el mismo riesgo de duplicación que 22.5 §1 ya evitó al fusionar Empresa+Cuenta y al separar (no fusionar, el caso opuesto) Risk Engine de Rule Engine.

**Solución propuesta**: un único Aggregate Root, **Improvement Item**, con una máquina de estados (Detectado → En cola → Activo → Validando → Consolidado | Descartado, refinando el ciclo de 29 §2 con el detalle de estados que 30 §3 ya usaba) y dos proyecciones de lectura sobre el mismo dato: la vista **Backlog** (uso interno del motor de priorización, nunca visible al trader completo — 30 §3) y la vista **Coaching Card** (narrativa, visible al trader únicamente mientras el item está Activo — 29 §3).

**Por qué es mejor que la alternativa**: mantenerlos separados (la lectura literal del pedido del fundador) exigiría un evento de sincronización constante entre "Backlog Item cambia de prioridad" y "Coaching Card se actualiza" — exactamente el tipo de acoplamiento oculto que 22.5 §Riesgos ya identificó como riesgo #1 para Rule Engine. Unificarlos elimina la sincronización por construcción: no hay dos fuentes, hay una fuente y dos formas de leerla.

**Impacto futuro**: reduce el catálogo de 5 a 4 Aggregate Roots "nuevos" de Fase 1 relacionados con mejora del trader, y obliga a nombrar explícitamente 4 eventos que ninguno de los capítulos 29/30 había nombrado todavía (`MejoraCandidataDetectada`, `MejoraActivada`, `MejoraConsolidada`, `MejoraDescartada`) — se cubre en el contrato de §3.7.

## 3. Catálogo completo de contratos

### 3.1 User (Usuario) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Raíz de propiedad e identidad de todo el sistema (21.5 §3.1) |
| Estado mínimo | `user_id`, credenciales delegadas, estado de ciclo de vida (Registrado→Activo→Inactivo→Cancelado→Eliminado) |
| Qué publica | `user_id` verificado, datos de perfil no críticos |
| Qué nunca publica | Credenciales en claro (delegadas a Supabase Auth, 22.5 §2.1); ningún dato de otro Usuario (01 §2.5) |
| Quién puede consumirlo | Todos los módulos — referencian `user_id`, nunca cargan el agregado completo (21.5 §5) |
| Quién puede modificarlo | Solo el propio Usuario (autoservicio) o Identity en su nombre (recuperación de cuenta) |
| Eventos que emite | `UsuarioRegistrado`, `UsuarioCancelado`, `UsuarioEliminado` (21.5 §7) |
| Eventos que escucha | Ninguno — raíz del grafo de dependencias (22.5 §2.1) |
| Invariantes | `user_id` único e inmutable; aislamiento total de datos entre Usuarios (01 §2.5, I1 en 23) |
| Dependencias permitidas | Ninguna — no depende de ningún otro Aggregate Root |
| Dependencias prohibidas | Cualquier lectura directa de Cuenta, Operación, Plan o Perfil de Reglas — Identity es la base, no un consumidor (22.5 §2.1) |

### 3.2 Company (Empresa de Fondeo) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Agrupar Cuentas y ofrecer el catálogo de Perfiles de Reglas disponibles para ellas (21.5 §3.2) |
| Estado mínimo | Nombre, `is_personal`, estado (Creada→Activa→Archivada), referencia a `user_id` propietario |
| Qué publica | Catálogo de Perfiles de Reglas ofrecidos; metadatos no sensibles (nombre) |
| Qué nunca publica | Qué Cuentas de otros Usuarios usan un Perfil suyo si es plantilla comunitaria (20, Fase 2) — el catálogo se publica, no sus adoptantes |
| Quién puede consumirlo | Account (al crear una Cuenta bajo ella), Rule Engine (lee sus Perfiles), Analytics |
| Quién puede modificarlo | Solo el Usuario propietario |
| Eventos que emite | `EmpresaCreada`, `EmpresaArchivada` (21.5 §7) |
| Eventos que escucha | Ninguno |
| Invariantes | `is_personal = true` no ofrece Perfiles tipo "challenge" (04 §1.3); no se elimina si tiene Cuentas con Operaciones registradas (21.5 §3.2) |
| Dependencias permitidas | User (propietario) |
| Dependencias prohibidas | Nunca conoce las magnitudes de riesgo (`DrawdownState`) de una Cuenta concreta — eso vive en Risk Engine, no en Company |

### 3.3 Account (Cuenta) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Mantener la verdad de cuánto capital hay, cuánto margen de drawdown queda, y en qué fase de vida está la Cuenta (21.5 §3.3) |
| Estado mínimo | `current_capital`, `peak_capital` (derivados de eventos, nunca editables a mano), estado (18 §4), `RuleProfileSnapshot` adoptado |
| Qué publica | Estado agregado (capital, fase, semáforo de riesgo — derivado, no calculado por Account misma) |
| Qué nunca publica | Cómo se calcula `R_final`/esperanza (eso es Quant Engine vía Risk Engine, 26 §8); la taxonomía interna de tipos de regla (Rule Engine) |
| Quién puede consumirlo | Operation (pertenece a ella), Risk Engine (lee eventos), Rule Engine (lee `RuleProfileSnapshot` y magnitudes), Analytics, Improvement Item (lectura del semáforo, 30 §4) |
| Quién puede modificarlo | Solo mediante eventos de capital/estado propios — nunca edición directa de `current_capital`/`peak_capital` (15 §3.1) |
| Eventos que emite | `CuentaCreada`, `CuentaEstadoCambiado`, `CapitalRecalculado` (21.5 §7) |
| Eventos que escucha | `OperacionCerrada`, `ReglaIncumplida`, `CapitalEventoRegistrado` (21.5 §7; 22.5 §2.2) |
| Invariantes | `current_capital`/`peak_capital` solo derivan de eventos (15 §3.1); una Cuenta `Terminada` no admite nuevas Operaciones salvo el aviso no bloqueante de 20 |
| Dependencias permitidas | Company (dueña), Snapshot (adopta `RuleProfileSnapshot`), Risk Engine (lectura de magnitudes) |
| Dependencias prohibidas | Nunca calcula sus propias magnitudes de riesgo — las solicita, nunca las reimplementa (misma regla 14 aplicada a nivel de agregado) |

### 3.4 Management Plan (Plan de Gestión) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Capturar y permitir reutilizar un estilo de gestión — RR objetivo, parciales, Break Even, condiciones (21.5 §3.4) |
| Estado mínimo | Parciales planificados (`ParcialPlanificado[]`), Break Even, condiciones de ejecución, etiqueta de riesgo, nombre (opcional) |
| Qué publica | Su forma completa vigente, para quien vaya a generar un `PlanSnapshot` a partir de él |
| Qué nunca publica | Qué Operaciones lo usan — un Plan no conoce sus consumidores, por diseño (21.5 §2, garantía que hace segura su edición) |
| Quién puede consumirlo | Operation (vía Snapshot, nunca en vivo), Simulation (como base de un Escenario), Analytics |
| Quién puede modificarlo | Solo el Usuario propietario — nunca una Cuenta ni una Empresa (es transversal, 21 §1.2) |
| Eventos que emite | `PlanCreado`, `PlanEditado`, `PlanArchivado` (21.5 §7) |
| Eventos que escucha | Ninguno — independiente por diseño (21.5 §3.4) |
| Invariantes | Editar un Plan nunca modifica un `PlanSnapshot` ya emitido (19 regla 13); suma de % de parciales ≤ 100 |
| Dependencias permitidas | User (propietario) |
| Dependencias prohibidas | Nunca referencia ni consulta Operaciones, Cuentas ni Empresas — cero acoplamiento hacia abajo |

### 3.5 Operation (Operación) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Registrar la ejecución real de un Plan en una Cuenta y su resultado (21.5 §3.5) |
| Estado mínimo | `PlanSnapshot` capturado, `ParcialEjecutado[]`, estado (Abierta→Cerrada→Editable con auditoría) |
| Qué publica | Su `PlanSnapshot`, sus parciales ejecutados, su `Resultado` derivado |
| Qué nunca publica | La lógica interna de cálculo (la pide a Risk Engine, nunca la reimplementa, 22.5 §2.6) |
| Quién puede consumirlo | Account (dueña), Risk Engine (calcula su Resultado), Rule Engine (lee atributos puntuales), Analytics, Improvement Item (Diagnóstico, 27 §2.8) |
| Quién puede modificarlo | Solo el Usuario propietario, con auditoría obligatoria en cada edición (20, paso 5b) |
| Eventos que emite | `OperacionRegistrada`, `ParcialEjecutado`, `OperacionCerrada`, `OperacionEditada` (21.5 §7) |
| Eventos que escucha | Ninguno de otros Aggregate Roots — productor neto de eventos, igual que Account (22.5 §2.6) |
| Invariantes | Pertenece a exactamente 1 Cuenta y captura exactamente 1 `PlanSnapshot` (21.5 §3.5); `R_final`/`pnl_amount` siempre recalculables de forma determinista, nunca introducidos a mano |
| Dependencias permitidas | Account (dueña), Management Plan (vía Snapshot), Risk Engine (solicita cálculo) |
| Dependencias prohibidas | Nunca escribe directamente en `current_capital` de la Cuenta — solo emite el evento, Account decide cómo reaccionar |

### 3.6 Rule Profile (Perfil de Reglas) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Mantener un conjunto nombrado de reglas configurables (Library→Definition→Instance, 22) que una Empresa ofrece y una Cuenta puede adoptar |
| Estado mínimo | Nombre, lista de Rule Instances (Definition + parámetros configurados), estado (Creado→Editado) |
| Qué publica | Su forma completa (para que Account tome el Snapshot al adoptar) y su forma resumida (catálogo, 20 Fase 2) |
| Qué nunca publica | Qué Cuentas lo han adoptado — mismo principio que Management Plan (§3.4), evita acoplamiento inverso |
| Quién puede consumirlo | Account (adopta vía Snapshot), Rule Engine (puebla la Library, 22 §2), Analytics |
| Quién puede modificarlo | La Empresa dueña, o el equipo/comunidad si es plantilla pública (20, Fase 2) — nunca una Cuenta que ya lo adoptó |
| Eventos que emite | `PerfilDeReglasCreado`, `PerfilDeReglasEditado` *(nuevos, identificados en este capítulo — 21.5 solo nombraba el Snapshot resultante, no el ciclo de vida del propio Perfil)* |
| Eventos que escucha | Ninguno |
| Invariantes | Editar un Perfil nunca modifica un `RuleProfileSnapshot` ya emitido (19 regla 13); toda regla se valida como grafo acíclico antes de aceptarse (22 §5) |
| Dependencias permitidas | Company (dueña), Rule Engine (biblioteca de arquetipos, 22 §3) |
| Dependencias prohibidas | Nunca conoce el estado de una Cuenta concreta ni sus magnitudes de riesgo — esa dirección es Risk Engine → Rule Engine, no Rule Profile → Account |

### 3.7 Improvement Item (unifica Coaching Card + Improvement Backlog Item) — Aggregate Root

| Campo | Contenido |
|---|---|
| Responsabilidad | Representar, con una única identidad, un candidato de mejora desde que se detecta hasta que se consolida o descarta; internamente prioriza (vista Backlog, 30 §3) y, en estado Activo tras superar el gate de admisión (29 §5), se renderiza como Coaching Card (29 §3) |
| Estado mínimo | Patrón detectado, los 6 campos fusionados (qué/por qué/coste/alternativa/evidencia/umbral de validación), Prioridad (Beneficio/Coste, 30 §2), estado (Detectado→En cola→Activo→Validando→Consolidado\|Descartado) |
| Qué publica | En Activo: la vista Coaching Card completa (narrativa, 6 campos) — solo al Usuario dueño, solo dentro de su propia revisión (20, Fase 7) |
| Qué nunca publica | Su Prioridad numérica cruda al trader (sería juzgarlo con una cifra fría, contrario al tono exigido en 29 §1); el resto del backlog "En cola" — nadie ve la lista completa (30 §3) |
| Quién puede consumirlo | El Usuario dueño (solo su vista Activa), Analytics (agregados anónimos de eficacia), Audit Engine |
| Quién puede modificarlo | Solo el Improvement Prioritization Engine (política de decisión de AI Engine, 29 §0/30 §0) — el trader puede descartar explícitamente (transición de estado válida), nunca editar el contenido |
| Eventos que emite | `MejoraCandidataDetectada`, `MejoraActivada`, `MejoraConsolidada`, `MejoraDescartada` *(nuevos, identificados en este capítulo por la unificación de §2)* |
| Eventos que escucha | `OperacionCerrada` (recalcula Diagnóstico/confianza, 13 §3), `ReglaIncumplida` (cruce con semáforo antes de activar, 30 §4) |
| Invariantes | Máximo 1-2 Activos por Usuario, límite global no por Cuenta (30 §3); un Activo nunca se desplaza por uno de mayor prioridad (30 §3); nunca se activa si aumenta varianza y el semáforo de la Cuenta relevante está en 🔴 (30 §4) |
| Dependencias permitidas | Simulation/Diagnóstico (Quant Capabilities vía AI Engine, 27 §2.2/§2.8), Risk Engine/Rule Engine (lectura del semáforo) |
| Dependencias prohibidas | **Notification Engine — nunca, en ningún estado** (decisión explícita de canal, 29 §5); nunca escribe en Operation, Account ni Management Plan directamente — solo puede proponer un Plan nuevo que el trader adopta manualmente |

### 3.8 Snapshot — Value Object (identidad técnica, no de dominio — ver §1)

| Campo | Contenido |
|---|---|
| Responsabilidad | Producir y conservar una instantánea inmutable de cualquier entidad `Snapshotable` (Plan, Perfil de Reglas) en el instante en que se congela |
| Estado mínimo | Los valores copiados de la entidad origen en ese instante; timestamp; id técnico de almacenamiento (§1) |
| Qué publica | Sus valores congelados, de solo lectura, a quien lo posea (Operation o Account) |
| Qué nunca publica | Ninguna referencia editable hacia la entidad que congeló — leer un Snapshot nunca navega de vuelta a la forma actual del Plan/Perfil |
| Quién puede consumirlo | Operation, Account (dueños), Risk Engine, Rule Engine, Analytics, Audit Engine |
| Quién puede modificarlo | **Nadie, nunca** — es inmutable por invariante, no por convención (19 regla 13) |
| Eventos que emite | Ninguno propio — el evento de negocio (`PlanCreado`, `PerfilDeReglasCreado`) lo emite el módulo dueño de la entidad original |
| Eventos que escucha | Ninguno — se invoca síncronamente por el módulo que necesita congelar algo (22.5 §2.11) |
| Invariantes | Cero escrituras tras la creación, sin excepción |
| Dependencias permitidas | Ninguna — no depende de ningún Aggregate Root, es invocado por ellos |
| Dependencias prohibidas | Nunca depende del estado *actual* de la entidad que congeló — su único vínculo con ella es el instante de creación, ya pasado |

### 3.9 Scenario (Escenario) — Value Object

| Campo | Contenido |
|---|---|
| Responsabilidad | Representar una configuración hipotética de entrada — Plan (real o hipotético) + contexto (`R_max` real o supuesto) — para una Simulación (28 §2, fila 5) |
| Estado mínimo | La configuración de Plan usada y el `R_max` de contexto |
| Qué publica | Su configuración completa a quien lo invoque |
| Qué nunca publica | N/A — es un input puro, no tiene consumidores restringidos más allá de quien lo construye |
| Quién puede consumirlo | Simulation (lo consume como único input), AI Engine, Improvement Item, Reporting/Analytics (comparación) |
| Quién puede modificarlo | Nadie — no se edita, se descarta y se crea uno nuevo |
| Eventos que emite | Ninguno — es efímero, no necesariamente persistido salvo trazabilidad de una recomendación |
| Eventos que escucha | Ninguno |
| Invariantes | No puede alterar ninguna Operación, Cuenta o Plan real — es puramente hipotético (26 §2.7) |
| Dependencias permitidas | Management Plan (como base opcional) |
| Dependencias prohibidas | Nunca referencia una Cuenta u Operación real por id — solo toma de ellas los valores necesarios, nunca una referencia viva |

### 3.10 Simulation (Simulación) — Domain Service / proceso

| Campo | Contenido |
|---|---|
| Responsabilidad | Ejecutar la fórmula de R Final (Quant Engine, 26) sobre un Escenario, produciendo un `R_final` hipotético |
| Estado mínimo | N/A — no tiene estado propio, es una función pura invocada bajo demanda (21.5 §6) |
| Qué publica | Un `Resultado` hipotético (VO) a quien la invocó |
| Qué nunca publica | Nunca escribe en una Operación o Cuenta real — la salida es siempre hipotética hasta que el trader decida adoptarla como un Plan nuevo (mismo principio que "AI Engine nunca aplica sola una recomendación", 13 §6.3) |
| Quién puede invocarlo | AI Engine, Improvement Item (pipeline de priorización), Reporting/Analytics (comparación), futura UI de "qué habría pasado si" |
| Quién puede modificarlo | Nadie — es lógica pura de Quant Engine (26), sin estado que mutar |
| Eventos que emite | Ninguno de negocio propio — si el resultado se persiste para trazabilidad de un Improvement Item, lo emite el módulo dueño del item, no Simulation |
| Eventos que escucha | Ninguno — se invoca síncronamente |
| Invariantes | Todo resultado es reproducible de forma determinista a partir del mismo Escenario (02, 12) |
| Dependencias permitidas | Scenario (único input), Quant Engine (fórmulas puras) |
| Dependencias prohibidas | Nunca lee ni escribe el estado de una Cuenta u Operación real directamente |

### 3.11 Rule Evaluation (Evaluación de Regla) — Registro inmutable

| Campo | Contenido |
|---|---|
| Responsabilidad | Dejar constancia del veredicto de una evaluación de cumplimiento de un `RuleProfileSnapshot` contra las magnitudes de Risk Engine, en un instante dado (22 §5) |
| Estado mínimo | Referencia al `RuleProfileSnapshot` evaluado, magnitudes de entrada, veredicto por regla (compliant/violated + margen), timestamp |
| Qué publica | El veredicto agregado y su margen — a Account (semáforo) y a quien lo consulte para auditoría |
| Qué nunca publica | La lógica interna del evaluador (qué arquetipo se usó, 22 §3) — solo el resultado |
| Quién puede consumirlo | Account (actualiza semáforo), Improvement Item (Diagnóstico, cruce de 30 §4), Audit Engine, Analytics |
| Quién puede modificarlo | **Nadie — append-only**, mismo principio que Audit Engine (15 §3.4); nunca se re-evalúa retroactivamente con reglas nuevas |
| Eventos que emite | `ReglaIncumplida` — **solo si el veredicto es no conforme**; si es conforme, no emite nada (silencio por defecto, mismo principio de 29 §5 aplicado aquí a nivel de Rule Engine, no solo de coaching) |
| Eventos que escucha | Ninguno — se genera de forma síncrona tras cada evaluación disparada por Rule Engine |
| Invariantes | Nunca bloquea el registro de una Operación (01 §2.3, 22 §7); nunca se recalcula con una versión distinta del `RuleProfileSnapshot` al que se ató |
| Dependencias permitidas | Rule Profile (vía Snapshot), Risk Engine (magnitudes, solo lectura) |
| Dependencias prohibidas | Nunca accede a la Operación completa — solo a las magnitudes que Risk Engine le entrega ya calculadas (regla 14, Calcular ≠ Juzgar) |

## 4. Mapa de comunicación

| Origen | Destino | Qué cruza | Dirección | Qué NUNCA cruza |
|---|---|---|---|---|
| Account | Operation | Referencia de pertenencia (`account_id`) | Account → Operation (contención) | Nunca al revés: Operation no decide el estado de Account, solo emite eventos que Account interpreta |
| Management Plan | Operation | `PlanSnapshot` (copia congelada, vía Snapshot) | Unidireccional, en el instante de creación | La forma *actual* del Plan — Operation nunca relee el Plan en vivo |
| Rule Profile | Account | `RuleProfileSnapshot` (copia congelada, vía Snapshot) | Unidireccional, en el instante de adopción | La forma *actual* del Perfil — Account nunca relee el Perfil en vivo |
| Operation | Risk Engine | Historial + `PlanSnapshot` | Operation → Risk Engine (solicita cálculo) | Risk Engine nunca escribe en Operation directamente — devuelve el `Resultado`, Operation lo persiste |
| Risk Engine | Rule Engine (Rule Evaluation) | `DrawdownState`, magnitudes ya calculadas | Risk Engine → Rule Engine, solo lectura | Nunca al revés: Rule Engine no le dice a Risk Engine qué límite existe (regla 14) |
| Rule Evaluation | Account | Veredicto agregado (semáforo) | Rule Evaluation → Account | Nunca el detalle de qué arquetipo evaluó cada regla |
| Rule Evaluation | Improvement Item | `ReglaIncumplida` (si aplica) | Rule Evaluation → Improvement Item | Nunca una evaluación individual sin agregar — Improvement Item consume el patrón, no el evento aislado |
| Management Plan | Scenario | Configuración base (opcional) | Management Plan → Scenario | Scenario nunca escribe de vuelta en Management Plan |
| Scenario | Simulation | Input único | Scenario → Simulation | Simulation nunca persiste un Scenario como si fuera real |
| Simulation | Improvement Item | `Resultado` hipotético (para el campo "qué alternativa habría sido mejor", 29 §3) | Simulation → Improvement Item | Nunca se aplica automáticamente a una Operación o Cuenta real |
| Operation | Improvement Item | Datos para Diagnóstico (27 §2.8) | Operation → Improvement Item, solo lectura | Improvement Item nunca edita una Operación pasada |
| Improvement Item | Usuario (trader) | Vista Coaching Card, solo si Activo | Improvement Item → Usuario | Prioridad numérica cruda; el resto del backlog en cola (§3.7) |
| Improvement Item | Notification Engine | — | **Prohibido en ambos sentidos** | Ningún dato cruza — decisión de canal permanente (29 §5) |
| Todos los Aggregate Roots | Analytics | Eventos/proyecciones de solo lectura | Unidireccional, hacia Analytics | Analytics nunca escribe de vuelta en ningún Aggregate Root (22.5 §2.8) |
| Todos los Aggregate Roots | Audit Engine | Eventos de mutación sensible | Unidireccional, hacia Audit Engine | Audit Engine nunca interpreta el significado de negocio del cambio (22.5 §2.10) |

## 5. Eventos públicos

Extiende el catálogo canónico de 21.5 §7 con lo identificado en este capítulo:

| Evento | Ya existía | Emitido por |
|---|---|---|
| `UsuarioRegistrado` / `UsuarioCancelado` / `UsuarioEliminado` | Sí (21.5 §7) | User |
| `EmpresaCreada` / `EmpresaArchivada` | Sí | Company |
| `CuentaCreada` / `CuentaEstadoCambiado` / `CapitalRecalculado` | Sí | Account |
| `PlanCreado` / `PlanEditado` / `PlanArchivado` | Sí | Management Plan |
| `OperacionRegistrada` / `ParcialEjecutado` / `OperacionCerrada` / `OperacionEditada` | Sí | Operation |
| `ReglaIncumplida` | Sí (identificado en 21.5) | Rule Evaluation |
| `PerfilDeReglasCreado` / `PerfilDeReglasEditado` | **No — nuevo en este capítulo** | Rule Profile |
| `MejoraCandidataDetectada` / `MejoraActivada` / `MejoraConsolidada` / `MejoraDescartada` | **No — nuevo en este capítulo, consecuencia directa de la unificación de §2** | Improvement Item |
| `RecomendacionGenerada` | Sí (22.5 §2.7) | AI Engine (Optimizador — sigue siendo un evento distinto del Improvement Item; ver Riesgos §6.3) |

## 6. Dependencias (resumen consolidado)

Confirma, a nivel de Aggregate Root, lo que 22.5 §3-4 ya trazó a nivel de módulo — sin contradecirlo, añadiendo la granularidad que faltaba:

- **Cero dependencias circulares**: ningún Aggregate Root de §3 depende, directa o indirectamente, de sí mismo a través de otro.
- **User es la única raíz sin dependencias entrantes de negocio** — todos los demás referencian `user_id`, nunca al revés.
- **Snapshot y Scenario son las únicas dos categorías sin dependencias propias** — se invocan, no dependen.
- **Simulation es el único proceso sin estado de todo el catálogo** — coherente con que Quant Engine (26) es, por diseño, una capa de funciones puras.
- **Improvement Item es el Aggregate Root con más dependencias entrantes de lectura** (Operation, Rule Evaluation, Simulation) y ninguna de escritura hacia otros — es intencional: orquesta información de todo el sistema para enseñar, pero nunca actúa sobre él directamente salvo proponer.

## Riesgos

1. **La unificación de §2 (Improvement Item) es una decisión de este capítulo, no una validada con datos reales** — el riesgo es que, al implementarse, la vista Backlog y la vista Coaching Card resulten tener necesidades de consulta tan distintas (una para el motor de priorización en batch, otra para una sola tarjeta en tiempo real) que en la práctica se acabe materializando en dos tablas de todos modos. Mitigación: aceptable incluso si ocurre — dos tablas con una sola identidad de dominio compartida sigue siendo mejor que dos Aggregate Roots sin relación formal, que era el problema original.
2. **`Rule Evaluation` como registro append-only podría crecer sin límite** (una evaluación por cada operación y cada regla activa, potencialmente miles de cuentas × miles de operaciones, 19 §7) — no es un problema de contrato de dominio, es una decisión de retención de datos que corresponde al diseño técnico (¿se conserva cada evaluación individual o solo los cambios de veredicto?). Se deja como decisión abierta en el cierre de este capítulo.
3. **`RecomendacionGenerada` (AI Engine, Optimizador) e `Improvement Item` (coaching) son conceptualmente distintos pero comparten casi el mismo origen de datos** (Quant Engine, historial de Operaciones) — riesgo de que, en implementación futura, alguien intente fusionarlos igual que se fusionó Coaching Card con Improvement Backlog. Se anota explícitamente que **no deben fusionarse**: el Optimizador responde "¿cuál es la mejor configuración posible?" (pregunta abierta, iniciada por el sistema o el usuario), el Improvement Item responde "¿qué patrón concreto del pasado te costó R?" (pregunta cerrada, anclada a un hecho ya ocurrido) — son 27 §2.4 y 27 §2.8 respectivamente, categorías distintas de Quant Capabilities desde el principio.
4. **La corrección de 22.5 §2.11 (Snapshot, §1 de este capítulo) vive como nota en un capítulo distinto al original** — mismo patrón ya usado en 26 §8 para Risk Engine, consistente pero disperso; el capítulo de diseño técnico que traduzca esto a esquema debe leer ambos documentos, no solo uno.

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno de forma visible — es, como 21.5 y 22.5, un capítulo de fundamento puro. Su éxito se mide en que el equipo técnico pueda implementar y modificar cualquiera de los 11 contratos sin que un cambio interno de uno obligue a tocar otro.

**¿Qué funcionalidades sobran?** Ninguna de las 12 pedidas se descarta — las 12 quedan cubiertas, 2 de ellas (#9 y #10) unificadas en un solo contrato con justificación explícita.

**¿Qué funcionalidades faltan?** Dos pares de eventos que ningún capítulo anterior había nombrado con ese nivel de detalle: el ciclo de vida propio de Rule Profile (`PerfilDeReglasCreado`/`Editado`) y el ciclo de vida completo de Improvement Item (`MejoraCandidataDetectada`/`Activada`/`Consolidada`/`Descartada`) — ambos añadidos en §5.

**¿Qué haría Apple para simplificar este capítulo?** Confirmaría que la unificación de §2 es la decisión correcta bajo su propio principio de "menos conceptos, mejor definidos" — dos objetos que representan el mismo hecho en dos audiencias son, para Apple, un solo objeto con dos vistas, nunca dos objetos.

**¿Qué haría Linear para hacerlo más rápido?** Preguntaría si 11 contratos completos, con 11 campos cada uno, ralentizan la primera implementación técnica — la respuesta, igual que en 22.5, es la contraria: cada contrato es una pregunta de diseño que un ingeniero no tiene que resolver por su cuenta ni descubrir a medio camino.

**¿Qué haría TradingView para hacerlo más intuitivo?** No aplica de forma literal a un capítulo de contratos internos sin usuarios finales — la pregunta análoga con sentido es si un ingeniero nuevo en el equipo puede leer un solo contrato de §3 y entender, sin abrir ningún otro documento, qué puede y no puede hacer ese módulo. Cada contrato de §3 cumple esa prueba de forma autocontenida.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente lo que motivó §1: nunca dejar que un documento de contrato afirme una propiedad (identidad de dominio) que contradice la definición ya fijada de esa categoría — es la misma disciplina de segregación de responsabilidades que ya se aplicó en 22.5 §1 (Risk Engine ≠ Rule Engine), ahora aplicada a la propia consistencia interna de la documentación.

**Puntuación del capítulo**: **95/100**. Los 5 puntos que faltan corresponden a los 4 Riesgos de §6, ninguno de los cuales es una falla de diseño — son decisiones de retención de datos, de materialización física, y de disciplina de mantenimiento documental, todas correctamente identificadas pero pendientes del capítulo de diseño técnico.

**¿Qué se necesitaría para 100/100?** Que la decisión de retención de `Rule Evaluation` (Riesgo #2) se resuelva con una política concreta, y que la unificación de Improvement Item (Riesgo #1) se valide con el primer ciclo de implementación real antes de asumir que la vista Backlog y la vista Coaching Card conviven sin fricción en una sola tabla.

**Nivel de madurez del capítulo**: 93%. Los 11 contratos están completos con sus 11 campos (adaptados por categoría, no forzados), el mapa de comunicación cubre las 12 relaciones más relevantes del sistema, y los eventos nuevos quedan nombrados — lo pendiente es exclusivamente de implementación (los 4 riesgos), no de decisión de dominio.

---

## Cierre de capítulo

**Riesgos pendientes**: los 4 de §6 — ninguno bloquea aprobar los contratos; los 4 son disciplina de implementación o decisiones de retención/esquema que corresponden al diseño técnico.

**Decisiones abiertas**:
1. Política de retención de `Rule Evaluation` (¿se guarda cada evaluación o solo los cambios de veredicto?) — se decide en el capítulo de esquema de Rule Engine, no aquí.
2. Si la vista Backlog y la vista Coaching Card de Improvement Item se materializan en una sola tabla o en dos con una identidad compartida — recomendación: empezar con una sola tabla y separar solo si el primer ciclo de implementación demuestra fricción real (coherente con 11 §13).
3. Si `RecomendacionGenerada` (Optimizador) e `Improvement Item` (coaching) deben compartir infraestructura de persistencia aunque sean conceptos distintos — recomendación: infraestructura compartida, identidad y contrato de dominio separados (Riesgo #3).

**Recomendación profesional**: aprobar los 11 contratos. Con esto, los 12 conceptos que el fundador pidió congelar quedan protegidos frente a cambios internos durante los próximos 10 años (19 §7) — cualquier módulo puede reescribir su implementación interna (cambiar de librería, de estructura de datos, de proveedor) sin que ningún otro módulo lo note, siempre que respete el contrato aquí fijado. Es el documento que formalmente cierra la Fase 0 y habilita, sin más bloqueos conceptuales pendientes, comenzar el diseño técnico del TradePilot Quant Engine (esquema de datos, empezando por Operation + Account + Risk Engine, que son los tres Aggregate Roots con más dependientes directos de todo el catálogo de §3).
