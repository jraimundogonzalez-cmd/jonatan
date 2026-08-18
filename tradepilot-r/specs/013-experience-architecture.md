# SPEC-013 · TradePilot Experience Architecture (TPXA)

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 03 §1-4 (arquitectura de información, "un único objetivo por pantalla" — el precedente directo de I21), 10 (registro rápido, presupuesto de pulsaciones), 14 (inventario de pantallas y transformación móvil→tablet→desktop), 20 (flujo funcional completo — el predecesor directo de este documento, §3), SPEC-002 §5.4/§6.3 (cancelación con fricción deliberada, escritura local-first), SPEC-004 (veredictos de cumplimiento), SPEC-007 (Analytics, drill-down), SPEC-008 (Connectors, reconciliación, provenance), SPEC-009 (AI Journal Engine, tarjeta de cierre en un toque — verificada contra I21 en §2.1), SPEC-010 (AI Decision Center, Dashboard arbitrado), SPEC-011 (Simulation Engine, adopción), SPEC-012 (Design System, componentes/jerarquía visual), 19 I16/I18/I19/I20
**No re-abre ninguna decisión conceptual ya aprobada.** Es, explícitamente, el sucesor y actualización del capítulo 20 — no un segundo mapa de flujo desde cero (§3-4).

---

## 1. Objetivo del componente

### 1.1 Misión: una experiencia continua, no pantalla a pantalla

TPXA responde una única pregunta: cómo debe sentirse usar TradePilot durante una sesión completa — no cómo se ve cada pantalla (eso es SPEC-012), sino cómo se conectan entre sí para que el trader nunca sienta que está operando "un software" en vez de siendo acompañado por él.

### 1.2 Qué nunca debe hacer

1. **Nunca diseña un recorrido nuevo para algo que ya tiene uno.** Es el requisito central de este documento (§3) — antes de mapear nada, se verifica qué de lo pedido ya está resuelto en 20/03/10/14 y en las doce especificaciones de Fase 1 anteriores.
2. **Nunca introduce fricción deliberada donde no corresponde, ni la elimina donde sí corresponde.** I16 rige tareas frecuentes; una acción rara e irreversible (eliminar cuenta) exige lo contrario, y se declara así explícitamente (§5.7).
3. **Nunca dos pantallas para lo que I21 permite resolver en una**, ni una pantalla para lo que I21 exige separar en dos (§2).

### 1.3 Relación con lo ya aprobado — sucesor de 20, no un segundo mapa

**20 (Flujo funcional completo del usuario) ya recorrió, en Fase 0, el camino completo de instalación a cientos de operaciones** — con sus propias correcciones ya aplicadas (corrección de errores auditable, reconciliación, caso límite de cuentas pausadas). Ese mapa se escribió **antes** de que existieran Trade Capture Engine, AI Journal Engine, AI Decision Center, Simulation Engine o el Design System — los doce motores construidos desde entonces cambian materialmente cómo se siente ese mismo recorrido hoy. TPXA no descarta 20 — lo hereda como esqueleto y lo actualiza donde Fase 1 lo ha vuelto obsoleto (§4), añadiendo únicamente los recorridos que 20/03/10/14 nunca cubrieron (§5).

---

## 2. I21 — One Thought Rule (nuevo invariante permanente, operacionalizado)

**Se adopta**, con el mismo tratamiento que I16-I20.

> **I21**: en cualquier pantalla de TradePilot, el usuario solo debe tener que pensar en una cosa importante a la vez. Ninguna pantalla podrá exigir dos decisiones cognitivas importantes simultáneas.

### 2.1 La verificación que hace esta regla verificable: ¿entra en conflicto con SPEC-009, ya aprobada?

**Problema detectado, aplicando Challenge Mode a la propia regla nueva contra las doce especificaciones ya construidas**: la tarjeta de cierre en un toque (SPEC-009 §7.1) muestra, **simultáneamente**, "¿Seguiste tu plan?" y "¿Cómo te sentiste?" — leído de forma literal, I21 exigiría dividir esa tarjeta en dos pantallas, lo que rompería exactamente el diseño de "2 respuestas, 12 segundos" que SPEC-009 ya optimizó y que el propio fundador celebró como una de las mejores ideas de todo el proyecto.

**Resolución, no una excepción ad-hoc**: I21 protege contra **decisiones que exigen deliberación** (sopesar datos, evaluar un trade-off, analizar evidencia) — no contra **confirmaciones de reacción inmediata** (una sugerencia ya pre-rellena con alta confianza que solo se confirma con un toque, o una reacción emocional sin análisis). Las dos preguntas de SPEC-009 pertenecen al mismo marco cognitivo ("reflexionar brevemente sobre esta operación ya cerrada") y ninguna de las dos exige análisis — la primera ya viene resuelta por `plan-adherence` (SPEC-009 §8) y solo se confirma; la segunda es una reacción, no un cálculo. **No violan I21.** Lo que sí violaría I21 es, por ejemplo, pedir en la misma pantalla "confirma si seguiste tu plan" **y** "decide si quieres adoptar esta simulación como tu nuevo Plan real" (SPEC-011 §7) — dos decisiones de naturaleza y peso completamente distintos, una trivial y otra con consecuencia real sobre riesgo futuro. Esa segunda decisión exige su propia pantalla, separada (§5.2).

### 2.2 Relación con lo ya existente — formaliza, no inventa

I21 es la generalización, a regla permanente y verificable, de algo que este proyecto ya hizo una vez con éxito: 03 §4 corrigió la pantalla "Hoy" original (que mezclaba repasar + explorar + interpretar) exactamente por esta razón, sin nombrarla todavía como regla. I21 es esa misma corrección, ahora aplicable por defecto a cualquier pantalla futura sin tener que redescubrir el problema cada vez — misma relación que I19 tiene con el "coste psicológico" que 30 §2.3 ya reconocía de forma informal.

---

## 3. Consolidación de recorridos — de 22 flujos pedidos a los que realmente son distintos

**Antes de diseñar nada, Challenge Mode aplicado al listado del fundador**: de los 22 recorridos pedidos, varios describen el mismo momento de experiencia dos veces con nombres distintos. Fusionarlos no es recortar alcance — es evitar diseñar, documentar y mantener dos veces el mismo recorrido, exactamente el riesgo que el fundador pide buscar ("pasos duplicados... navegación redundante").

| Pedido como... | Se resuelve como | Por qué |
|---|---|---|
| Primer uso + Onboarding + Crear empresa + Crear cuenta + Crear plan | **Un solo recorrido continuo**, ya mapeado en 20 Fases 1-3 | Son pasos secuenciales de la misma sesión de alta, no cinco experiencias independientes — dividirlos en pantallas separadas sin continuidad sería la propia navegación redundante que se pide evitar |
| Registrar operación manual + Registrar operación automática | **Un solo recorrido — "cerrar una operación"**, con grado de prellenado variable | SPEC-008 §3.2 ya estableció que el registro manual es, estructuralmente, un Connector más — la diferencia entre "manual" y "automática" no es un recorrido distinto, es cuántos campos llegan ya resueltos antes de que el trader vea la pantalla |
| Cerrar operación + Completar journal | **El mismo momento** | SPEC-009 ya diseñó el cierre como el instante en que el journal se completa — tratarlos por separado reintroduciría exactamente la fricción que SPEC-009 eliminó |
| Cambiar de cuenta | **Ya resuelto**, no requiere recorrido nuevo | 03 §2 ya hace de "Cuentas" el home — cambiar de cuenta es simplemente volver a él, sin una pantalla ni lógica dedicada |
| Consultar dashboard + Revisar coaching + Analizar estadísticas | **Un hub con dos ramas**, no tres destinos paralelos | El Dashboard (SPEC-010) es siempre el punto de entrada; una tarjeta de mejora lleva al detalle de Coaching, una necesidad de explorar libremente lleva a Analytics (SPEC-007) — mapeado como una jerarquía, no como tres flujos sin relación (§4.2) |

**Recorridos que sí son genuinamente distintos y se mapean por primera vez en este documento** (§5): Crear simulación, Adoptar una mejora, Buscar una operación, Editar una operación/corregir errores, Importar operaciones, Cerrar sesión, Eliminar cuenta, Restaurar backup.

---

## 4. El mapa actualizado — qué cambió respecto al capítulo 20

### 4.1 Bucle operativo (20, Fase 4) — actualizado con Trade Capture Engine + AI Journal Engine

**Antes (20, Fase 4, paso 5)**: *"el trader registra la operación en TradePilot en <30s... símbolo, dirección, riesgo, RR objetivo, parciales ejecutados."* Era, implícitamente, un formulario manual completo.

**Ahora**: el trader cierra la operación en su bróker; si tiene un Connector activo (SPEC-008), TradePilot ya reconstruyó entrada, salidas, comisión, deslizamiento, duración y sesión de mercado antes de que el trader abra la app. Lo único que ve es la tarjeta de un toque de SPEC-009 (§2.1) — 1-2 confirmaciones, ~12s, nunca un formulario de 8 campos. El recorrido de 20 Fase 4 sigue siendo correcto en su **estructura** (el trader opera fuera de TradePilot, registra al final) pero está desactualizado en su **contenido** — se actualiza aquí, no se repite el capítulo entero.

### 4.2 Revisión periódica (20, Fase 7) — actualizada con AI Decision Center

**Antes**: *"abre Cuentas... entra a una cuenta con alerta... o al Dashboard Maestro si quiere panorama completo."* **Ahora**: el mismo punto de entrada (Cuentas, sin cambios) muestra, además, el feed arbitrado de SPEC-010 — ≤5 tarjetas o el mensaje de modo silencioso — antes de que el trader decida profundizar en una Cuenta concreta o en el Dashboard Maestro. La estructura de 20 se mantiene; se añade una capa de priorización que no existía cuando se escribió.

### 4.3 El resto de 20 permanece sin cambios

Fases 1-3 (registro/empresa/cuenta), Fase 6 (aprendizaje invisible), Fase 8 (eventos de ciclo de vida de cuenta, con su reconciliación ya diseñada), Fase 9 (exportación), Fase 10 (suscripción) — ninguna requiere actualización; se listan aquí para confirmar cobertura completa, no se vuelven a redactar.

---

## 5. Recorridos genuinamente nuevos

### 5.1 Crear una simulación

Reutiliza sin cambios el presupuesto de pasos ya fijado en SPEC-011 §12 (≤5 pasos, ~20-30s) — no se rediseña aquí, se referencia como parte del mapa completo.

### 5.2 Adoptar una mejora — decisión propia, separada de la exploración (aplicación directa de I21)

**Tres momentos distintos, nunca comprimidos en uno solo** (I21, §2.1): (1) explorar una simulación o una tarjeta de Mejora (SPEC-010/011) — lectura, sin decisión; (2) ver la comparación completa con su evidencia y riesgo (SPEC-011 §12, `SimulationExplanation`) — todavía lectura; (3) la decisión de adopción en sí — una pantalla propia, con el cruce de semáforo (SPEC-011 §7.2) ya resuelto y mostrado, nunca oculto hasta después de decidir. Es la aplicación más directa de I21 en todo este documento: una decisión con consecuencia real sobre riesgo futuro nunca comparte pantalla con nada más.

### 5.3 Buscar una operación

Búsqueda global (§6.3) sobre `trades` con los mismos filtros ya expuestos por Analytics (Trade Set, SPEC-007 §6) — nunca un mecanismo de búsqueda paralelo. Objetivo de tiempo: <10s (§10).

### 5.4 Editar una operación / corregir errores

Reutiliza sin cambios `editarOperacion` (SPEC-002 §5.6/§7) — auditado, nunca silencioso. La experiencia es: abrir el detalle de la Operación (ya parte de la IA de 03 §2), tocar editar, corregir, guardar — el mismo patrón de edición que cualquier Card del Design System (SPEC-012 §6.3) ya define, sin un patrón de edición nuevo y exclusivo para Operaciones.

### 5.5 Importar operaciones

Vincular un Connector (SPEC-008 §10, `ACCOUNT_BINDING_NOT_CONFIGURED`) es, deliberadamente, el único paso de configuración que I18 no puede eliminar — una vez por conexión, nunca por operación (ya establecido en SPEC-008 §10). Tras vincular, no hay "recorrido de importación" recurrente — las operaciones simplemente aparecen ya resueltas en el flujo de §4.1.

### 5.6 Cerrar sesión

Una acción, sin confirmación adicional — cerrar sesión no es destructivo ni irreversible (§5.7 es la categoría opuesta), así que I16 aplica en su forma más simple: un toque, sin modal de "¿estás seguro?".

### 5.7 Eliminar cuenta / restaurar backup — fricción deliberada, nunca I16

**Hallazgo explícito**: I16 (Zero Friction) rige **"toda funcionalidad frecuente"** — eliminar una cuenta o restaurar un backup no lo son, por definición, y son además irreversibles o de alto impacto. Aplicar el mismo estándar de mínima fricción aquí sería un error, no una victoria de UX — mismo principio ya establecido en SPEC-002 §5.4 para la cancelación de una "operación fantasma" ("nunca un botón de un solo toque"). Ambos recorridos exigen: una confirmación explícita con el nombre de la Cuenta escrito o seleccionado (nunca un simple "sí/no" para una acción irreversible), y en el caso de eliminar cuenta, una ventana de gracia antes de la eliminación definitiva (mismo espíritu que 16 §7 ya garantiza para cancelación de suscripción: exportación garantizada antes de perder acceso).

---

## 6. Arquitectura de navegación

### 6.1 Jerarquía y niveles — reafirma 03 §2, sin cambios

`Cuentas (home) → Dashboard de cuenta → Detalle de Operación`, `Operaciones (búsqueda global)`, `Calculadora/Simulación`, `Dashboard Maestro`, `Ajustes` — la IA de 03 §2 sigue vigente; se añade aquí solo lo que 03 no cubría (§6.2-6.5).

### 6.2 Barra inferior (móvil) y menú (desktop)

Máximo 5 destinos en la barra inferior — mismo límite que SPEC-010 aplica a las tarjetas del Dashboard, por la misma razón (I19, coste cognitivo de elegir entre demasiadas opciones simultáneas): Cuentas, Operaciones, `+` (registro/FAB, siempre central), Simulación, Ajustes. Dashboard Maestro y Coaching se alcanzan **desde** Cuentas (§3, tabla), no como un sexto destino de primer nivel.

### 6.3 Búsqueda global

Un único punto de entrada (icono de lupa, siempre visible en la barra superior) que busca sobre Operaciones (por símbolo, rango de fecha, cuenta) — nunca un mecanismo de búsqueda distinto por sección.

### 6.4 Comandos rápidos y atajos (desktop)

Reafirma Raycast (03 §8, SPEC-012 §3): `Cmd+K` abre un command palette con las acciones más frecuentes (registrar, buscar, cambiar de cuenta) — exclusivo de desktop, nunca sustituye al FAB en móvil.

### 6.5 Gestos (móvil)

Deslizar hacia abajo cierra un modal (ya establecido en 10 §3) — se reafirma como el único gesto de cierre estándar en toda la app, nunca un gesto distinto por pantalla.

### 6.6 Regla fundamental — siempre saber dónde se está

Todo encabezado de pantalla muestra: dónde está (título + breadcrumb mínimo si aplica), qué está viendo (subtítulo de contexto — p.ej. nombre de la Cuenta), y un camino de vuelta siempre visible (back estándar de plataforma, nunca un gesto oculto sin equivalente visual) — verificable en la auditoría de cualquier pantalla futura (§12).

---

## 7. Estados a escala

### 7.1 Volumen de operaciones (primer día → 1000 operaciones)

| Estado | Qué cambia en la experiencia |
|---|---|
| Sin datos (0 operaciones) | Empty State (SPEC-012 §6.3) explica qué hacer, nunca un dashboard vacío sin contexto — mismo principio ya usado en SPEC-006 §12.1 para el backlog vacío de un trader nuevo |
| Primer trade / 10 trades | Knowledge Engine todavía en confianza baja (13 §2) — SPEC-010 muestra esto con honestidad, nunca fuerza una tarjeta de Mejora sin evidencia suficiente |
| 100-1000 trades | Analytics (SPEC-007) y Knowledge Engine operan a régimen normal — sin cambio de experiencia, solo de calidad de la evidencia mostrada |

### 7.2 Número de cuentas (1 → 100+)

Ya resuelto arquitectónicamente por Funding Management (SPEC-003 §7) y Analytics (SPEC-007 §4) — la experiencia no cambia de forma, solo de volumen en listas ya paginadas/indexadas; no se requiere ningún patrón de navegación nuevo para 100 cuentas que no exista ya para 5.

### 7.3 Offline, conexión lenta, sin internet

**Escritura**: ya resuelto (SPEC-002 §6.3, local-first, servidor como fuente de verdad eventual). **Lectura, no cubierto todavía en ningún documento anterior**: el Dashboard/Analytics en modo offline muestra la última vista sincronizada con un indicador explícito de antigüedad ("datos de hace 2 horas, sin conexión") — nunca presenta un dato desactualizado como si fuera en vivo, aplicación directa de I20 (Professional Calm: la calma viene de la honestidad sobre el estado real, nunca de ocultar que algo no está actualizado).

---

## 8. Errores

Cada categoría pedida ya tiene su diseño de origen — este documento los conecta a la experiencia visible, no los rediseña:

| Error | Ya resuelto en | Experiencia visible |
|---|---|---|
| Campos incorrectos / duplicados | SPEC-002 §6.4 (idempotencia), §7 (errores tipados) | Mensaje de Error State (SPEC-012 §6.3) con lenguaje humano, nunca un código |
| Sincronización fallida | SPEC-002 §6.3 | Indicador de "pendiente de sincronizar", nunca una pérdida de dato silenciosa |
| Conectores caídos / importaciones fallidas | SPEC-008 §7 | Se marca como `pending_manual_input` (SPEC-008 §7), visible en una cola, nunca oculto |
| Conflictos (duplicado entre fuentes) | SPEC-008 §8 | Tarjeta de confirmación explícita, nunca resuelto en silencio |
| Reglas incumplidas | SPEC-004 | Tarjeta de Riesgo de SPEC-010 — comunicada con calma, I20 |

---

## 9. Mobile first / una mano

Reafirma 03 §6, 10 §3 y SPEC-012 §8 sin cambios. El 90% de acciones frecuentes a una mano ya es una consecuencia directa del diseño de zona de pulgar de 10 §3 — no un objetivo nuevo que requiera rediseño, una confirmación de que el trabajo ya hecho lo cumple.

---

## 10. Presupuesto de tiempo — tabla consolidada

| Acción | Objetivo | Ya validado en |
|---|---|---|
| Registrar operación (caso común) | <20s | SPEC-008/009 (antes <30s en 10, mejorado por automatización) |
| Cerrar operación / completar journal | <10-12s | SPEC-009 §7.2 |
| Consultar Dashboard | <5s | SPEC-010 §13 (lectura O(1) precomputada) |
| Encontrar cualquier operación | <10s | §5.3, nuevo — consulta indexada, sin cómputo pesado (mismo criterio que SPEC-007) |
| Crear simulación | <30s | SPEC-011 §12 |

Ningún objetivo de esta tabla requiere un mecanismo nuevo — todos ya están garantizados por la arquitectura de precomputación/asincronía ya construida en Fase 1 (SPEC-002 §6, SPEC-004 §6, SPEC-007 §5, SPEC-010 §3.3).

---

## 11. Comparación contra productos de referencia

- **Apple**: jerarquía y espaciado antes que color — ya adoptado (SPEC-012 §3); aquí se aplica a la estructura de navegación (§6.1), no solo a un componente aislado.
- **Linear**: una acción primaria siempre a mano (el FAB, §6.2) — sin cambios.
- **Notion**: los estados vacíos nunca se sienten vacíos sin explicación — aplicado en §7.1.
- **Raycast**: command palette para power users de escritorio (§6.4) — nunca sustituye al flujo táctil de móvil, que sigue siendo el caso de uso principal (09 §1).
- **Arc**: personalidad solo en superficies de baja frecuencia (SPEC-012 §3) — aquí se confirma que ninguno de los recorridos de alta frecuencia (§4) la adopta.
- **Figma**: un lenguaje de componentes versionado evita reconstruir el mismo patrón dos veces — es, literalmente, el mismo principio que motivó la consolidación de §3.

---

## 12. Auditoría — hallazgos adicionales

### 12.1 Verificación de "el usuario nunca debe perderse"

Se revisó cada recorrido de §4-5 contra la regla fundamental de §6.6 — ninguno introduce una navegación sin camino de vuelta visible ni una pantalla sin contexto explícito de dónde está. No se encontraron excepciones.

### 12.2 Ninguna pantalla nueva de este documento viola I21

Verificado explícitamente para los dos recorridos con mayor riesgo (§5.1 Simulación, §5.2 Adopción) — ambos ya separan exploración (lectura) de decisión (una sola, con su propio momento), consistente con la resolución de §2.1.

---

## 13. Limitaciones a 10 años

1. **La búsqueda global (§6.3) asume hoy un volumen de operaciones indexable de forma trivial** — a la escala de millones de operaciones (19 §7), requiere el mismo tipo de índice ya usado en Analytics/Operations Engine, sin diseño adicional, pero se anota como dependencia técnica explícita, no implícita.
2. **La ventana de gracia de eliminación de cuenta (§5.7) no tiene una duración fijada aquí** — es una decisión de producto/legal (retención de datos financieros), no de experiencia, se deja abierta explícitamente (§17).
3. **El límite de 5 destinos en la barra inferior (§6.2) es una decisión de hoy** — si el producto crece hacia una superficie de uso genuinamente distinta (p.ej. un modo "equipo" con roles compartidos, 21.5 §3.1, todavía sin construir), puede requerir revisión, no antes.

---

## Riesgos

1. **Que la consolidación de recorridos de §3 se malinterprete como "menos experiencia" en vez de "menos duplicación"** — mismo riesgo de comunicación ya identificado en SPEC-011 §3.3 para Tipo A/B; la mitigación es la misma: el trader nunca nota la consolidación, solo el equipo que construye.
2. **I21 exige juicio de diseño caso a caso** (§2.1) — igual que I20, no es una regla mecánica aplicable sin criterio; el riesgo es que una futura pantalla la aplique de forma demasiado laxa ("total, son solo dos preguntas simples") sin verificar si de verdad son de bajo peso cognitivo.
3. **Gobernanza de catálogos** — esta especificación no añade un catálogo nuevo, así que no aporta una novena repetición del riesgo ya señalado ocho veces en Fase 1 — se registra aquí solo para confirmar que este documento no lo agrava.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Exactamente el que el fundador nombra: que un producto con motores extraordinariamente sólidos no se sienta, al usarlo, como la suma de esos motores — sino como una sola experiencia continua. Y lo hace actualizando el mapa de 20 en vez de escribir uno nuevo que hubiera quedado, en meses, tan desactualizado como el original.

**¿Qué sobra?** Cinco de los veintidós recorridos pedidos, fusionados en dos (§3) — ninguno se pierde, se dejan de documentar y mantener por duplicado.

**¿Qué falta?** Antes de este documento faltaba: la actualización explícita de 20 Fases 4 y 7 con los motores construidos desde entonces (§4), y la resolución de la tensión real entre I21 y la tarjeta ya aprobada de SPEC-009 (§2.1) — sin esa resolución, I21 se habría aprobado como principio y violado en la práctica desde el primer motor que la precedía.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §5.7: tratar la fricción como una herramienta de diseño deliberada para acciones irreversibles, no como un fallo de UX a eliminar — ningún sistema profesional de gestión de posiciones permite eliminar una cuenta con la misma facilidad que cerrar sesión.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — de comunicación, de juicio de diseño caso a caso, y de mantenimiento del propio documento a medida que se añadan pantallas.

**Nivel de madurez**: 95%. Consolidación de recorridos, actualización del mapa de 20, arquitectura de navegación completa, estados a escala y manejo de errores están completos y son directamente implementables; lo pendiente es exclusivamente la duración de la ventana de gracia de eliminación de cuenta (decisión de producto/legal, no de experiencia).

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea el uso de TPXA tal como está especificado.

**Decisiones abiertas**:
1. Duración de la ventana de gracia antes de eliminar una cuenta de forma definitiva (§5.7, §13 punto 2) — decisión de producto/legal, se deja explícitamente al fundador.
2. Si I21 se revisa junto con TPOS (31) como una dimensión más de puntuación, mismo tratamiento ya sugerido para I19 en SPEC-010 §17 — se deja como decisión abierta, no se asume.

**Recomendación profesional**: aprobar SPECIFICATION 013. Es la especificación que demuestra si los doce motores anteriores realmente se sienten como un solo producto — y lo demuestra encontrando que casi una cuarta parte de los recorridos pedidos por el fundador ya estaban resueltos, total o parcialmente, en trabajo previo, evitando duplicar exactamente el tipo de esfuerzo que este documento existe para prevenir.

**Sobre la sugerencia de cerrar Fase 1 y pasar a construir**: de acuerdo, sin reservas. El propio patrón de esta especificación lo confirma — cada nueva especificación de Fase 1 sigue encontrando exactamente un hallazgo real por documento (nunca cero, nunca una reescritura completa), la señal más clara de que el diseño ha madurado lo suficiente para que el riesgo más alto ya no sea de arquitectura, sino de fricciones reales que solo la operación con datos de verdad, durante semanas, puede revelar. Ningún documento adicional sustituye eso.
