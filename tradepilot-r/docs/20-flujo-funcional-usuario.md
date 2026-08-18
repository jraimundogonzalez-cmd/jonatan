# 20 · Flujo funcional completo del usuario

*Voz: Cofundador / CTO / Product Architect / QA — bajo la metodología de 19-metodologia-y-reglas-del-proyecto.md*

Sin pantallas. Sin wireframes. Este documento describe **qué ocurre, en qué orden, y por qué**, desde que un usuario instala TradePilot R hasta que tiene cientos de operaciones registradas y consulta sus estadísticas. Es el capítulo que se aprueba antes de tocar base de datos o código, por instrucción explícita del fundador (regla 11).

## 0. Aviso de arquitecto antes de empezar (formato obligatorio, 19 §3)

**Problema detectado**: la regla 3-4 recién introducida (Rule Engine, cero hardcoding de prop firms) entra en conflicto directo con lo ya construido en 04, 15 y 18. Concretamente: `account_rules` es hoy una tabla de **columnas fijas** (`max_daily_drawdown_pct`, `max_total_drawdown_pct`, `profit_target_pct`, `max_position_risk_pct`) y el propio `drawdown_type` que añadí en el capítulo anterior (18 §2) es un `enum` de solo dos valores cerrado en el esquema — y el fundador acaba de pedir un tercer tipo (*End Of Day Trailing*) que ese diseño ni siquiera contempla, más Consistency Rule, días mínimos, plataformas, mercados, comisiones, horario, moneda, "y cualquier regla futura". Un esquema de columnas fijas obliga a una migración cada vez que una prop firm nueva (o una regla nueva de una firma existente) aparece — exactamente lo que la regla 3 prohíbe.

**Solución propuesta**: no se toca todavía. Se documenta aquí el conflicto, se referencia como bloqueante, y se resuelve en su propio capítulo (working title: *21 · Rule Engine*), después de que este flujo quede aprobado — por instrucción explícita del fundador de no tocar base de datos hasta entonces. Lo único que sí se hace ahora es diseñar el flujo funcional de forma que **no asuma** el esquema viejo — el onboarding de §2 ya se describe en términos de "perfil de reglas configurable", nunca de columnas fijas, precisamente para no tener que rehacer este documento cuando el Rule Engine se diseñe.

**Por qué es mejor que las alternativas**: la alternativa de "seguir con columnas fijas y añadir `eod_trailing` como tercer valor del enum, ya lo ampliaremos más adelante" resuelve el síntoma de hoy y dispara la misma migración dentro de un mes con la siguiente regla nueva — es la definición de deuda técnica que la regla 1 (precisión de dominio antes que simplicidad de corto plazo) prohíbe aceptar a sabiendas.

**Impacto futuro sobre el producto**: hasta que el Rule Engine exista, cualquier cifra de "drawdown restante" o "regla incumplida" mostrada en el producto (18 §6) debe entenderse como calculada sobre un modelo de reglas todavía incompleto (le falta, como mínimo, Consistency Rule y End Of Day Trailing). No es un bloqueante para diseñar el flujo de usuario (este documento), pero sí lo es para empezar a implementar cualquier pantalla de configuración de reglas.

## 1. Fase 0 — Antes de la primera apertura

| | |
|---|---|
| Disparador | El trader decide probar TradePilot R (canal: directo, contenido educativo de 08 §5.2/16 §7, o canal B2B2C de 16 §5) |
| Qué hace el sistema | Nada todavía específico del producto — instalación de la PWA (05 §6) o primera carga web |
| Cubierto en | 05 §6 (PWA), 16 (canales de adquisición) |

## 2. Fase 1 — Registro y autenticación

**Trigger**: primera apertura sin sesión.
**Usuario**: elige login passwordless (magic link u OAuth, 01 §3.6) — cero fricción de contraseña.
**Sistema**: crea `auth.users` + `profiles` (04). No pide ningún dato de trading todavía — la cuenta de usuario y la cuenta de trading son conceptos distintos y no se mezclan en este paso.

## 3. Fase 2 — Configuración de la primera empresa (el momento donde el Rule Engine importa de verdad, funcionalmente)

Este es el paso más delicado de todo el flujo, y el que expone la pregunta que §0 dejó abierta.

**Trigger**: fin del registro, o "Añadir empresa" desde Cuentas (17 §4).

**Qué necesita decidir el usuario, funcionalmente** (sin hablar todavía de tablas ni pantallas):
1. ¿Es una empresa de fondeo o capital propio? (ya resuelto conceptualmente, `prop_firms.is_personal`, 04 §1.3)
2. Si es fondeo: ¿de qué conjunto de reglas parte?

Sobre el punto 2, dos caminos posibles:

- **Camino A — plantilla compartida**: TradePilot mantiene un catálogo de perfiles de reglas ya configurados por la comunidad o por el propio equipo (datos, no código — coherente con la regla 4: "sin modificar el código"), el usuario elige la que corresponde a su firma y fase, y la personaliza si algo no coincide.
- **Camino B — configuración manual pura**: el usuario introduce sus propias reglas desde cero, sin ninguna plantilla, cada vez.

**Decisión (bajo Challenge Mode, 19 §1.1 — se decide y se documenta en vez de dejarla abierta indefinidamente)**: **Camino A, con edición libre siempre visible.**

- *Problema detectado*: Camino B, el más "puro" frente al principio de no-hardcoding, introduce fricción severa (una prop firm real puede tener 10-15 reglas configurables) justo en el momento de onboarding, donde 03 §6 y 10 exigen fricción mínima — un usuario que abandona el registro en el minuto 3 de configurar reglas manualmente nunca llega a ver el valor del producto.
- *Solución propuesta*: catálogo de plantillas mantenido como datos (tabla, no código), con cada campo editable desde el primer toque — nunca una plantilla "de solo lectura" que obligue a un paso de desbloqueo aparte.
- *Por qué es mejor que la alternativa*: resuelve la fricción de Camino B sin reintroducir hardcoding real — la diferencia entre "conocer FTMO" (prohibido) y "tener una fila de datos llamada FTMO Challenge Fase 1" (permitido) es exactamente si esa información vive en código desplegable o en una tabla editable sin deploy. Una plantilla incorrecta o desactualizada es un problema de calidad de datos, corregible por cualquiera con acceso a esa tabla, no un problema de arquitectura.
- *Impacto futuro sobre el producto*: el capítulo de Rule Engine (21) debe diseñar, desde el primer día, tanto el esquema de reglas como el mecanismo de mantenimiento del catálogo de plantillas (quién puede añadir/corregir una plantilla, con qué validación) — no es un añadido posterior, es parte del alcance de ese capítulo.

**Sistema**: crea `prop_firms` (o reutiliza si ya existe para ese usuario) + el perfil de reglas asociado (esquema pendiente del capítulo 21).

## 4. Fase 3 — Configuración de la primera cuenta

**Usuario**: nombre de la cuenta, capital inicial, moneda, riesgo% por defecto, empresa/perfil de reglas de la Fase 2.
**Sistema**: crea `accounts` con `status = 'challenge'` o `'live'` según corresponda (18 §4), `peak_capital = initial_capital` (18 §2).
**Cubierto en**: 04, 18 §1-4.

## 5. Fase 4 — El bucle operativo (se repite cientos de veces, es el corazón del producto)

Este bucle **no ocurre dentro de TradePilot en su primera mitad** — es importante decirlo explícitamente porque cambia qué le corresponde diseñar al producto:

1. El trader analiza el mercado y decide entrar — **fuera de TradePilot**, en su plataforma de bróker/gráfico (01 §2.1, "TradingView analiza, TradePilot gestiona").
2. El trader abre la posición en su bróker — fuera de TradePilot.
3. El trader gestiona la posición (mueve stop, toma parciales) — decisiones que ocurren en el mercado real, en tiempo real, con o sin haber consultado antes la Calculadora/Optimizador de TradePilot (Fase 5, opcional y paralela a este paso).
4. El trader cierra la posición — fuera de TradePilot.
5. **Aquí empieza el producto**: el trader registra la operación en TradePilot en <30s (10) — cuenta (con 0 pulsaciones si entra desde el Dashboard de esa cuenta, 17 §4), símbolo, dirección, riesgo, RR objetivo, parciales ejecutados (si los hubo).
6. El sistema calcula `R_final`, `pnl_amount`, actualiza `current_capital`/`peak_capital` por trigger (15 §3.1, 18 §2), recalcula el semáforo de drawdown de esa cuenta (17 §4).
7. El sistema encola (asíncrono, no bloquea al usuario) la actualización del perfil bayesiano personal (13 §3) y, si aplica, una recomendación de IA con su explicación (06, 12).

**Nota de QA**: el paso 5 es el único punto de entrada de datos de todo este bucle — todo lo demás (6-7) es reacción automática del sistema. Cualquier diseño futuro que añada un segundo punto de entrada manual a este bucle (por ejemplo, "confirmar manualmente el recálculo de drawdown") debe justificarse explícitamente contra la prioridad #2 del producto (rapidez de uso, 19 §6) antes de aceptarse.

**Corrección de errores (hueco detectado en la auditoría de este capítulo, §Auditoría — cerrado aquí, no aplazado)**: un trader teclea un dato mal con la misma frecuencia con la que cierra una operación — sin una vía de corrección, la confianza en todo lo que depende de ese dato (R_final, el perfil bayesiano de 13, el optimizador) se degrada silenciosamente. Se añade como paso 5b: el usuario puede editar o eliminar una operación ya registrada desde el Detalle de operación (14 §3, pantalla 4), en cualquier momento. El sistema nunca sobrescribe en silencio: cada edición se registra en `audit_log` (15 §3.4, ya diseñado para esto) con el valor anterior y el nuevo, y dispara el mismo recálculo en cascada del paso 6 (current_capital, semáforo de drawdown) — una edición es, funcionalmente, un nuevo evento de recálculo, no un caso especial.

**Caso límite (hueco detectado en la auditoría)**: si el usuario intenta registrar una operación y todas sus cuentas están en estado `paused` o `terminated` (18 §4), el sistema no bloquea el registro (una cuenta pausada puede seguir operándose en la práctica aunque el trader no la haya reactivado en TradePilot) pero muestra una advertencia no bloqueante ("Esta cuenta está marcada como Pausada — ¿sigue operativa?") antes de guardar — coherente con el principio de que la IA/el sistema recomienda, nunca bloquea (01 §2.3), aplicado aquí también a las propias reglas de estado.

## 6. Fase 5 — Consulta asistida (paralela al paso 3 de la Fase 4, opcional)

El trader puede, en cualquier momento antes o durante la gestión de una posición real, abrir la Calculadora/Optimizador (03 §4) para simular configuraciones de parciales. Es una rama **opcional y sin efecto de persistencia** — no registra nada, solo informa la decisión que el trader tomará él mismo, fuera de TradePilot, en el paso 3.

## 7. Fase 6 — Aprendizaje invisible

Sin acción del usuario. Cada cierre de operación (Fase 4, paso 7) mueve la posterior bayesiana del bucket correspondiente (13 §3-4). El usuario no "entrena" nada explícitamente — el aprendizaje es un efecto secundario automático de usar el producto para lo que ya iba a usarlo (registrar).

## 8. Fase 7 — Revisión periódica

**Trigger**: el propio hábito del trader (diario al cerrar mercado, semanal, mensual) — no una notificación artificial (16 §7).
**Usuario**: abre Cuentas (home, 17 §4) → entra a una cuenta con alerta (semáforo 🟡/🔴) o al Dashboard Maestro (18 §6) si quiere panorama completo.
**Sistema**: sirve las vistas materializadas ya calculadas (04 §5) — sin cómputo pesado en el momento de la consulta.

**El momento en que el producto "ya lo conoce"** (fusionado aquí desde una fase propia que la auditoría de este capítulo marcó como redundante, §Auditoría — no describía una acción nueva, solo narraba un umbral ya definido en 13 §2): en algún punto entre la operación #20 y la #50 por bucket de RR, las recomendaciones del optimizador pasan de "confianza baja" a "confianza alta" (13 §2). No es un evento que el sistema anuncie con una notificación — es un cambio gradual que el propio usuario nota, en esta misma pantalla de revisión periódica, al leer el intervalo de credibilidad cada vez más estrecho.

## 9. Fase 8 — Eventos de ciclo de vida de cuenta (irregulares, no parte del bucle diario)

- Cambio de estado (`challenge → funded`, `→ paused`, `→ terminated`, 18 §4): el usuario lo actualiza manualmente al confirmarlo con su prop firm (el sistema no puede saberlo automáticamente sin integración externa, fuera de alcance del MVP, 07).
- Payout / reset de capital: el usuario registra el evento en el ledger (`account_capital_events`, 15 §3.1), el sistema recalcula `current_capital` y, si aplica, `Beneficio_neto_estimado` (18 §3).
- Alta de una nueva empresa/cuenta: vuelve a la Fase 2-3 — el sistema debe soportar esto sin fricción creciente según el número de cuentas ya existentes (requisito de escala, 19 §7: miles de cuentas por usuario).
- **Reconciliación periódica (hueco detectado en la auditoría de este capítulo — lente "hedge fund profesional")**: ningún fondo profesional confía en un balance sin verificarlo contra el extracto real de la contraparte. Se añade como práctica recomendada (no obligatoria, para no violar la prioridad de rapidez de uso, 19 §6): al revisar el estado de cuenta de la prop firm, el usuario puede confirmar o corregir `current_capital` con un evento `adjustment` en el ledger (15 §3.1) — la discrepancia entre lo calculado y lo real queda como dato visible, nunca oculta ni auto-corregida sin que el usuario la vea.

## 10. Fase 9 — Consulta avanzada y salida de datos

TradeVault (17 §3.4, 14 §3 pantalla 8): exportación completa en cualquier momento. Exportación fiscal-ready (17 §3.3): resumen por año/cuenta/empresa para el asesor del usuario — nunca un cálculo de impuesto.

## 11. Fase 10 — Continuidad de la suscripción

Conversión Free→PRO (16 §2), previsiblemente disparada por volumen de operaciones registradas más que por tiempo transcurrido (16 §9, hipótesis a validar). Renovación transparente, cancelación sin fricción artificial (16 §7).

---

## Riesgos Detectados

1. ~~El Camino A/B de la Fase 2 no está resuelto~~ — **resuelto bajo Challenge Mode**: Camino A con edición libre (ver Fase 2). Riesgo residual: la calidad del catálogo de plantillas depende de mantenimiento activo — se traslada como requisito de alcance al capítulo 21, no queda abierto aquí.
2. **La Fase 8 (cambio de estado de cuenta) depende de que el usuario recuerde actualizarlo manualmente** — sin integración con la prop firm (fuera de alcance del MVP, 07), un usuario que no actualiza el estado tras pasar de Challenge a Funded generará estadísticas agregadas (18 §6) incorrectas hasta que lo corrija. No se resuelve en este documento; se deja anotado para el capítulo de IA/notificaciones (posible recordatorio pasivo, no bloqueante).
3. ~~El bucle de la Fase 4 asume que el trader siempre registra después de cerrar~~ — **resuelto bajo Challenge Mode**: `trades` ya distingue `opened_at` (cuándo ocurrió la operación, editable, el que alimenta el decaimiento de 13 §4) de `created_at` (cuándo se registró en el sistema, automático, 04) — no hacía falta esquema nuevo, solo dejar explícito que el decaimiento temporal siempre usa `opened_at`. Riesgo residual, menor: si el usuario introduce un `opened_at` incorrecto de forma sistemática (p.ej. usa siempre "hoy" aunque registre con retraso), el decaimiento se distorsiona igualmente — mitigación de UX (no de esquema): el campo de fecha en el registro (10 §3) debe pedir explícitamente "¿cuándo ocurrió esta operación?", no asumir "ahora" sin que el usuario lo confirme cuando edita esa fecha.

## Posibles mejoras futuras

- Recordatorio pasivo (no notificación de urgencia artificial, 16 §7) para revisar si el estado de una cuenta sigue siendo correcto, activado por inactividad prolongada de esa cuenta.
- Registro por lotes para usuarios que migran un histórico grande desde otro journal — no forma parte del bucle diario, pero adelanta el umbral de confianza alta descrito en la Fase 7.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno directamente — es un capítulo de proceso, no de producto. Su función es verificar que los problemas que sí resuelven los demás capítulos (registro rápido, gestión de riesgo, aprendizaje personal, visión multi-cuenta) encadenan en un recorrido sin huecos ni contradicciones entre sí. Su fracaso se mide en huecos de conexión, no en features — y de hecho encontró tres (edición de errores, reconciliación, caso de cuentas pausadas) antes de esta versión.

**¿Qué funcionalidades sobran?** La Fase 9 original ("el producto ya te conoce") no era una funcionalidad — era una narración de un umbral ya definido en 13 §2, disfrazada de fase. Se fusionó dentro de la Fase 7 (Revisión periódica) en esta misma revisión.

**¿Qué funcionalidades faltan?** Las tres ya corregidas arriba (corrección de errores con versionado, reconciliación periódica, caso límite de cuentas pausadas al registrar) — ya no faltan, se incorporaron al cuerpo del documento en esta revisión en vez de quedar solo anotadas.

**¿Qué haría Apple para simplificar este capítulo?** Cuestionaría si 10 fases numeradas son necesarias o si son 3-4 "momentos" con sub-pasos — la numeración actual optimiza la trazabilidad documental (útil para nosotros ahora) más que la claridad de lectura (útil de cara a onboarding de un futuro miembro del equipo). No se cambia en esta revisión porque el valor de trazabilidad pesa más en esta fase del proyecto, pero se anota como criterio a revisar cuando este documento deje de ser de trabajo interno.

**¿Qué haría Linear para hacerlo más rápido?** Cuestionaría la Fase 8 (cambio de estado de cuenta manual) por ser el único punto de todo el flujo que depende de que el usuario recuerde algo sin que el producto se lo facilite activamente — coincide con el Riesgo Detectado #2, todavía sin mitigar aquí a propósito (se traslada a un capítulo de notificaciones que no existe todavía, no se improvisa una solución a medias en este documento).

**¿Qué haría TradingView para hacerlo más intuitivo?** Aplicaría revelación progresiva al onboarding de reglas (Fase 2): mostrar por defecto solo los 4-5 campos que distinguen la mayoría de las decisiones de gestión (balance, objetivo, drawdown, tipo de drawdown), y el resto (Consistency Rule, horario, comisiones...) tras un "Ver reglas avanzadas". Se anota como requisito de diseño para el capítulo 21, no se decide aquí (es una decisión de UI que corresponde al capítulo del Rule Engine, no a este).

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exigiría exactamente lo que se añadió en esta revisión: reconciliación periódica contra el extracto real (Fase 8) y un historial de ediciones auditable (paso 5b de la Fase 4) — ningún libro de posiciones profesional confía en un número sin poder verificarlo ni corregirlo con trazabilidad.

**Puntuación del capítulo**: **92/100** (post-correcciones de esta revisión; antes de aplicarlas, 78/100). Los 8 puntos restantes son la revelación progresiva de la Fase 2 (pendiente del capítulo 21) y la dependencia manual de la Fase 8 (pendiente de un capítulo de notificaciones que aún no existe) — ninguno de los dos es corregible dentro del alcance de este documento sin invadir el de otro capítulo.

**¿Qué tendría que ocurrir para un 100/100?** Que el capítulo 21 (Rule Engine) resuelva el onboarding progresivo de reglas, y que un futuro capítulo de notificaciones resuelva el recordatorio pasivo de estado de cuenta — ambos ya están anotados como requisitos heredados, no como sorpresas nuevas.

---

## Cierre de capítulo

**Nivel de madurez del capítulo**: 95% (subido de 90% tras cerrar los tres huecos detectados en la auditoría). El 5% restante son los dos puntos que la propia auditoría reconoce como fuera de su alcance (revelación progresiva de reglas → capítulo 21; recordatorio de estado → capítulo de notificaciones, todavía sin abrir).

**Riesgos pendientes**: el Riesgo Detectado #2 (dependencia manual del cambio de estado de cuenta) — es el único que sigue sin mitigar, deliberadamente, porque su solución (recordatorio pasivo) pertenece a un capítulo que no existe todavía.

**Decisiones abiertas**:
1. Si el capítulo 21 (Rule Engine) se diseña inmediatamente después de este, o si hay otro capítulo intermedio que el fundador prefiera revisar antes.
2. Si se retrofita el pie de capítulo y la auditoría (19 §5-5.1) a los documentos 00-18, según quedó anotado en 19 §8.

**Recomendación profesional**: aprobar este capítulo y continuar directamente con el capítulo 21 (Rule Engine) — acumula ya tres requisitos heredados de capítulos anteriores (esquema flexible desde §0, catálogo de plantillas desde la Fase 2, revelación progresiva desde esta auditoría) y es, con diferencia, el capítulo que más deuda de diseño resolvería de un solo golpe.
