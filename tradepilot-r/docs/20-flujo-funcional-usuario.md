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

Sobre el punto 2, dos caminos posibles — **decisión abierta, no resuelta unilateralmente aquí** (se traslada al checklist de cierre):

- **Camino A — plantilla compartida**: TradePilot mantiene un catálogo de perfiles de reglas ya configurados por la comunidad o por el propio equipo (datos, no código — coherente con la regla 4: "sin modificar el código"), el usuario elige la que corresponde a su firma y fase, y la personaliza si algo no coincide.
- **Camino B — configuración manual pura**: el usuario introduce sus propias reglas desde cero, sin ninguna plantilla, cada vez.

**Por qué esto no es un detalle menor**: Camino B es el más "puro" respecto al principio de no-hardcoding, pero introduce fricción severa (una prop firm real puede tener 10-15 reglas configurables, 04-b del prompt) justo en el momento de onboarding, donde 03 §6 y 10 exigen fricción mínima. Camino A resuelve la fricción pero reintroduce, por la puerta de atrás, una forma de "conocer" a FTMO — con la diferencia crítica de que sería **conocimiento en datos mantenidos por la comunidad/equipo, nunca en código**, lo cual sí respeta la letra y el espíritu de la regla 4 (el código nunca tiene un `if firm == 'FTMO'`; los datos, sí pueden incluir una fila llamada "FTMO Challenge Fase 1" sin que eso sea hardcoding). Se recomienda Camino A con esa salvedad, pero se deja como decisión abierta explícita porque cambia el alcance del catálogo de datos que hay que mantener desde el V1.

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

## 6. Fase 5 — Consulta asistida (paralela al paso 3 de la Fase 4, opcional)

El trader puede, en cualquier momento antes o durante la gestión de una posición real, abrir la Calculadora/Optimizador (03 §4) para simular configuraciones de parciales. Es una rama **opcional y sin efecto de persistencia** — no registra nada, solo informa la decisión que el trader tomará él mismo, fuera de TradePilot, en el paso 3.

## 7. Fase 6 — Aprendizaje invisible

Sin acción del usuario. Cada cierre de operación (Fase 4, paso 7) mueve la posterior bayesiana del bucket correspondiente (13 §3-4). El usuario no "entrena" nada explícitamente — el aprendizaje es un efecto secundario automático de usar el producto para lo que ya iba a usarlo (registrar).

## 8. Fase 7 — Revisión periódica

**Trigger**: el propio hábito del trader (diario al cerrar mercado, semanal, mensual) — no una notificación artificial (16 §7).
**Usuario**: abre Cuentas (home, 17 §4) → entra a una cuenta con alerta (semáforo 🟡/🔴) o al Dashboard Maestro (18 §6) si quiere panorama completo.
**Sistema**: sirve las vistas materializadas ya calculadas (04 §5) — sin cómputo pesado en el momento de la consulta.

## 9. Fase 8 — Eventos de ciclo de vida de cuenta (irregulares, no parte del bucle diario)

- Cambio de estado (`challenge → funded`, `→ paused`, `→ terminated`, 18 §4): el usuario lo actualiza manualmente al confirmarlo con su prop firm (el sistema no puede saberlo automáticamente sin integración externa, fuera de alcance del MVP, 07).
- Payout / reset de capital: el usuario registra el evento en el ledger (`account_capital_events`, 15 §3.1), el sistema recalcula `current_capital` y, si aplica, `Beneficio_neto_estimado` (18 §3).
- Alta de una nueva empresa/cuenta: vuelve a la Fase 2-3 — el sistema debe soportar esto sin fricción creciente según el número de cuentas ya existentes (requisito de escala, 19 §7: miles de cuentas por usuario).

## 10. Fase 9 — El momento en que el producto "ya lo conoce" (cientos de operaciones)

En algún punto entre la operación #20 y la #50 por bucket de RR (umbral variable, no fijo, 13 §2), las recomendaciones del optimizador pasan de "confianza baja" a "confianza alta". No es un evento discreto que el sistema anuncie con una notificación — es un cambio gradual que el usuario nota al leer el intervalo de credibilidad cada vez más estrecho (13 §2). Es, funcionalmente, el momento en que la promesa central del producto (01 §0, "el asesor de gestión más fiable que jamás ha tenido") se vuelve verificable por el propio usuario, no solo prometida.

## 11. Fase 10 — Consulta avanzada y salida de datos

TradeVault (17 §3.4, 14 §3 pantalla 8): exportación completa en cualquier momento. Exportación fiscal-ready (17 §3.3): resumen por año/cuenta/empresa para el asesor del usuario — nunca un cálculo de impuesto.

## 12. Fase 11 — Continuidad de la suscripción

Conversión Free→PRO (16 §2), previsiblemente disparada por volumen de operaciones registradas más que por tiempo transcurrido (16 §9, hipótesis a validar). Renovación transparente, cancelación sin fricción artificial (16 §7).

---

## Riesgos Detectados

1. **El Camino A/B de la Fase 2 no está resuelto** y bloquea el diseño de onboarding real hasta que se decida — es el riesgo más urgente de este capítulo.
2. **La Fase 8 (cambio de estado de cuenta) depende de que el usuario recuerde actualizarlo manualmente** — sin integración con la prop firm (fuera de alcance del MVP, 07), un usuario que no actualiza el estado tras pasar de Challenge a Funded generará estadísticas agregadas (18 §6) incorrectas hasta que lo corrija. No se resuelve en este documento; se deja anotado para el capítulo de IA/notificaciones (posible recordatorio pasivo, no bloqueante).
3. **El bucle de la Fase 4 asume que el trader siempre registra después de cerrar** — no modela el caso de una operación que se registra con retraso de días, lo cual podría sesgar el `opened_at` usado para el decaimiento temporal (13 §4) si no se distingue con cuidado entre "cuándo ocurrió la operación" y "cuándo se registró".

## Posibles mejoras futuras

- Recordatorio pasivo (no notificación de urgencia artificial, 16 §7) para revisar si el estado de una cuenta sigue siendo correcto, activado por inactividad prolongada de esa cuenta.
- Registro por lotes para usuarios que migran un histórico grande desde otro journal — no forma parte del bucle diario, pero afecta a la Fase 9 (llegar antes al umbral de confianza alta).

---

## Cierre de capítulo

**Nivel de madurez del capítulo**: 70%. El flujo está completo en su lógica y secuencia, pero depende de una decisión abierta (Fase 2) que condiciona el diseño real de un tramo entero del recorrido.

**Riesgos pendientes**: los 3 listados arriba, ninguno mitigado todavía — los tres requieren una decisión antes de poder darse por cerrados, no son riesgos residuales aceptados.

**Decisiones abiertas**:
1. Camino A (plantillas compartidas) vs. Camino B (configuración manual pura) para el perfil de reglas en el onboarding — recomendación: Camino A con edición libre, pero pendiente de aprobación explícita.
2. Si el capítulo 21 (Rule Engine) se diseña inmediatamente después de este, o si hay otro capítulo intermedio que el fundador prefiera revisar antes.
3. Si se retrofita el pie de capítulo (19 §5) a los documentos 00-18, según quedó anotado en 19 §8.

**Recomendación profesional**: aprobar el flujo en su estructura general, pero resolver la Decisión abierta #1 antes de avanzar a cualquier diseño de base de datos — es la única pieza de este documento que cambiaría el resto del flujo si se decide distinto.
