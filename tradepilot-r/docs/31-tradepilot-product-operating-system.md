# 31 · TradePilot Product Operating System (TPOS)

*Voz: Cofundador / CTO / Product Architect — Challenge Mode obligatorio (19 §1.1). El documento con mayor autoridad sobre cualquier decisión futura de producto, junto con la Constitución Técnica (23).*

## 0. Qué sustituye este documento

Desde el inicio de este proyecto, cada decisión se sometió a un filtro informal de cinco preguntas (¿qué problema resuelve? ¿es necesaria? ¿puede simplificarse? ¿escala? ¿puede automatizarse?). Sirvió bien durante 30 capítulos, pero era un heurístico de conversación, no un sistema con puntuación ni con autoridad de bloqueo. **TPOS lo sustituye formalmente** — lo absorbe (las cinco preguntas siguen dentro de las doce de §2) y lo convierte en un proceso con veredicto objetivo, no una sensación de equipo.

## 1. Challenge Mode — qué se extrae de Notion, Linear, Stripe, Shopify y Figma (principios, no funciones)

Ninguna función de esos productos se copia. Cinco principios de *cómo evolucionan durante diez años*, cada uno ya presente en el blueprint sin haber sido nombrado como principio de gobierno hasta ahora:

| Principio observado | Qué significa | Dónde ya lo aplicamos sin saber que era esto |
|---|---|---|
| **Notion** — extensibilidad por composición de primitivas, nunca por acumulación de casos especiales | Un pequeño conjunto de bloques compone infinitas estructuras; una función nueva casi siempre es una composición, rara vez una primitiva nueva | Rule Engine (22): 15 reglas en 7 arquetipos, no 15 implementaciones distintas |
| **Linear** — el núcleo es sagrado; toda función nueva se mide por si degrada la velocidad del bucle central | Un producto famoso por decir que no, para proteger la rapidez del flujo de trabajo principal | El registro en <30s (10) ya es la métrica que ninguna función puede empeorar |
| **Stripe** — evolución aditiva y versionada, nunca disruptiva | Las integraciones antiguas nunca se rompen; el crecimiento se apila, no se reemplaza | `algorithm_version` (15 §3.5), APIs versionadas desde la primera función (11 §3) |
| **Shopify** — el núcleo nunca se bifurca por cliente; la variedad vive en la periferia extensible | Ninguna tienda obtiene un fork del checkout; toda personalización pasa por apps/extensiones sobre un core estable | Todo el diseño de módulos periféricos (22.5) sobre un CORE de 8 conceptos (21) |
| **Figma** — expansión mediante superficies nuevas y bien acotadas, nunca amontonando todo en la superficie principal | FigJam y Dev Mode nacieron como espacios propios, no como menús añadidos al canvas principal | TradePilot OS (17): Analytics, Reporting, TradeVault como módulos separados, no funciones apiladas en Cuentas/Home |

**Conclusión que condiciona todo lo demás**: los cinco principios ya estaban presentes en el blueprint antes de que este capítulo existiera — TPOS no inventa una filosofía nueva, la convierte en un sistema de admisión con autoridad de bloqueo sobre cualquier decisión futura, incluidas las que tome un equipo que no participó en ninguno de los 30 capítulos anteriores.

## 2. Las 12 preguntas obligatorias — checklist

Ninguna funcionalidad entra en producción sin responder las doce por escrito. Se agrupan por lo que informan:

| # | Pregunta | Alimenta a |
|---|---|---|
| 1 | ¿Qué problema real resuelve? | Puntuación: Valor para el trader |
| 2 | ¿A qué tipo de trader ayuda? | Puntuación: Valor para el trader |
| 3 | ¿Cuántos segundos ahorra? | Puntuación: Simplicidad (10, prioridad #2 del producto, 19 §6) |
| 4 | ¿Cuántas R puede ayudar a recuperar? | Puntuación: Impacto económico |
| 5 | ¿Ayuda al Trader Evolution Loop (29 §2)? | Puntuación: Capacidad para mejorar traders |
| 6 | ¿Añade complejidad? | Puntuación: Simplicidad, Mantenimiento |
| 7 | ¿Puede resolverse reutilizando algo existente? | Puntuación: Reutilización |
| 8 | **¿Rompe algún invariante (23)?** | **Gate binario — ver §3, no puntúa, descalifica** |
| 9 | ¿Genera deuda técnica? | Puntuación: Mantenimiento |
| 10 | ¿Cómo afecta al aprendizaje del trader (13)? | Puntuación: Capacidad para mejorar traders |
| 11 | ¿Podría automatizarse en el futuro? | Puntuación: Escalabilidad |
| 12 | ¿Qué coste de mantenimiento tendrá en 5 años? | Puntuación: Mantenimiento, Impacto económico |

## 3. El gate binario (antes de cualquier puntuación)

**Decisión de diseño, reutilizando un patrón ya validado dos veces en este blueprint** (30 §2.2, Riesgo de sobrecorrección; y antes, cualquier violación de un invariante en 23): romper un invariante no resta puntos — **descalifica directamente, sin importar cuánto puntúen las otras nueve dimensiones**. Una función que ahorra 20 segundos y tiene un impacto económico enorme pero rompe I9 (23, nunca predecir mercado) no se aprueba "porque el resto compensa" — no llega a puntuarse. Es la misma lógica que ya usamos para no dejar que un beneficio alto compre la exclusión de un riesgo de sobrecorrección: algunos "no" no tienen precio de compensación.

## 4. Sistema de puntuación (0-100, diez dimensiones con pesos no arbitrarios)

| Dimensión | Peso | Por qué ese peso (nunca un número inventado) |
|---|---|---|
| Precisión | 15 | Prioridad #1 absoluta del producto (19 §6) — el peso más alto posible |
| Valor para el trader | 15 | Es la razón de existir del producto (00) |
| Capacidad para mejorar traders | 15 | 29/30 ya establecieron esto como la misión principal, con las palabras del propio fundador |
| Simplicidad | 10 | Prioridad #2 (rapidez de uso, 19 §6) |
| Escalabilidad | 8 | Prioridad #4 (19 §6) |
| Mantenimiento (coste a 5 años) | 8 | Principio de ingeniería "coste consciente" (23) |
| Reutilización | 8 | Open/Closed ya demostrado (22.5 §5) — reutilizar es preferible a crear |
| Coherencia con el Blueprint | 8 | Mide grado de alineamiento con patrones existentes — el gate de §3 ya cubre la violación dura, esto puntúa el resto del espectro |
| Impacto económico | 8 | Sostiene el modelo de negocio (16) sin ser la prioridad #1 |
| Diferenciación frente a la competencia | 5 | **Peso deliberadamente bajo** — 24 ya demostró que el foso de TradePilot no es de features (son fácilmente copiables), es de tiempo de uso acumulado; una función poco diferenciada pero que sirve al bucle central no debe penalizarse como si el producto compitiera por novedad |

**Bandas de decisión**:

```
90-100  →  Aprobación directa
75-89   →  Aprobable con ajustes menores señalados explícitamente
60-74   →  Revisión sustancial antes de reconsiderar — no se aprueba tal como está
< 60    →  Rechazada
```

Cualquier puntuación, del rango que sea, queda anulada si la pregunta 8 (§3) es afirmativa.

## 5. Sistema para retirar funcionalidades

**TradePilot mejora también eliminando, no solo añadiendo** — el mandato explícito del fundador. Criterio, no una sola señal:

```
Retirar si:  (Uso sostenido bajo) AND (Coste de mantenimiento alto) AND (Sin valor estructural/de confianza)
    O:  Queda redundante tras una capacidad más general construida después
    O:  Una re-auditoría retroactiva (§6) descubre que viola un invariante vigente
Nunca retirar solo por:  antigüedad, o por no ser "novedosa"
```

**Por qué "uso bajo" nunca es, por sí solo, motivo de retirada**: 22.5 ya clasificó Reporting Engine como criticidad "LOW-MEDIUM" por uso poco frecuente, pero explícitamente **no** lo marcó como candidato a eliminar — su disponibilidad es un compromiso de confianza (TradeVault, 16 §7), no una función que compite por atención. El sistema de retirada exige las tres condiciones a la vez precisamente para no confundir "poco usado" con "poco valioso".

**Ejemplo concreto de redundancia real ya presente en el blueprint**: "Duplicar última operación" (10 §6.1) y "Aplicar Plan guardado" (21 §1.2) resuelven un problema muy similar (reducir tecleo al repetir una configuración). No se retira ninguna todavía — "Aplicar Plan guardado" es más potente (cualquier Plan, no solo el último usado) pero "Duplicar última operación" es más rápida quando el último Plan es justo el que se quiere repetir. Es el tipo de caso que este sistema debe resolver con datos de uso real, no en este capítulo — se documenta aquí como el ejemplo de referencia para la primera revisión de retirada.

## 6. Re-auditoría retroactiva — TPOS no es solo un filtro hacia adelante

**Hallazgo de Challenge Mode sobre el propio alcance del capítulo**: limitar TPOS a evaluar funciones *nuevas* dejaría sin cubrir exactamente lo que ya ocurrió una vez en este proyecto — el Rule Engine (22) invalidó retroactivamente el diseño de columnas fijas de `account_rules` que 04/18 habían aprobado antes de que la regla anti-hardcoding existiera. TPOS debe aplicarse también, de forma periódica, a lo ya construido: **una función aprobada bajo una Constitución anterior puede dejar de cumplir la vigente** cuando la Constitución misma evoluciona (23, 19 regla 13/14 se añadieron después de varios capítulos que ya estaban aprobados). Se recomienda una re-auditoría periódica (orientativo: cada vez que se añade un invariante o principio nuevo a 19/23, no en un calendario fijo) sobre las funciones ya construidas, no solo sobre las propuestas nuevas.

## Riesgos

1. **Los pesos de §4 son un punto de partida razonado, no una verdad matemática** — se calibran con datos reales de qué funciones terminan generando valor sostenido frente a las que puntuaron alto y no lo hicieron, coherente con cómo se trataron los umbrales de 29/30.
2. **El gate binario de invariantes podría usarse para bloquear por exceso de celo** una función que en realidad no viola nada, solo se parece superficialmente a algo prohibido — mitigación: la pregunta 8 exige justificar *qué* invariante concreto se rompe, con cita explícita a 23, no una sospecha genérica.
3. **La re-auditoría retroactiva (§6) es trabajo real recurrente**, no un evento único — si no se calendariza con disciplina, el sistema degenera en un filtro solo hacia adelante, perdiendo exactamente la protección que este capítulo añadió sobre TPOS mismo.

## Casos límite

1. Una función con puntuación alta en las 10 dimensiones pero que un miembro del equipo, sin poder citar un invariante concreto, "siente" que no encaja — no se rechaza por intuición (mandato explícito del fundador); se documenta como desacuerdo y se revisa, pero el sistema no cede a un veto sin justificación citable.
2. Una función ya aprobada hace tiempo con puntuación alta bajo los pesos antiguos, si los pesos de §4 se recalibran más adelante — no se re-evalúa automáticamente solo por el cambio de pesos; entra en el ciclo de re-auditoría (§6) igual que cualquier otra, no se le da trato retroactivo automático.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno de forma directa — protege que, dentro de diez años, con un equipo que no escribió ni leyó estos 31 capítulos, TradePilot siga tomando las mismas decisiones que un fundador que sí los conoce tomaría.

**¿Qué funcionalidades sobran?** El filtro informal de 5 preguntas usado hasta ahora — formalmente sustituido (§0), no descartado sin más: sus 5 preguntas siguen vivas dentro de las 12.

**¿Qué funcionalidades faltan?** Un sistema de retirada de funcionalidades no existía en ningún capítulo anterior — añadido en §5, con la re-auditoría retroactiva de §6 como la pieza que ni el propio fundador pidió explícitamente pero que la historia real de este proyecto (el caso Rule Engine/`account_rules`) justifica por sí sola.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que ningún trader vea jamás "puntuación 87/100" en ninguna parte del producto — este documento gobierna qué se construye, nunca se expone como mecánica de cara al usuario.

**¿Qué haría Linear para hacerlo más rápido?** Confirmaría que el gate binario de §3 (rechazo inmediato sin puntuar) es más rápido de aplicar que puntuar las 10 dimensiones de algo que de todas formas se va a rechazar — el orden importa: primero el gate, después la puntuación, nunca al revés.

**¿Qué haría TradingView para hacerlo más intuitivo?** No aplica a un documento de gobierno interno sin usuario final — la pregunta con sentido es si un ingeniero nuevo puede aplicar el checklist sin ayuda, y la tabla de §2 (pregunta → qué alimenta) está pensada exactamente para eso.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Confirmaría §6 sin dudarlo — ningún marco de control de riesgo profesional se audita solo contra decisiones nuevas; se re-audita periódicamente lo ya aprobado contra las reglas vigentes, precisamente porque las reglas evolucionan y lo aprobado bajo una versión anterior puede dejar de cumplir la actual.

**Puntuación del capítulo**: **96/100**. Los principios extraídos de Notion/Linear/Stripe/Shopify/Figma no son decorativos — cada uno se ató a algo que el blueprint ya hizo, lo cual valida que 30 capítulos de decisiones independientes convergieron, sin planearlo así desde el principio, en los mismos patrones que sostienen productos de referencia a diez años. Los 4 puntos restantes son los pesos de §4 (razonados pero no definitivos) y la disciplina de calendario que §6 exige y que ningún documento puede garantizar por sí solo.

**Nivel de madurez del capítulo**: 94%. El sistema está completo, coherente con toda la Constitución (23) y con el propio historial real del proyecto; falta la calibración empírica de pesos y umbrales con datos de uso, y la práctica sostenida de re-auditoría — ninguna de las dos es alcanzable en un documento conceptual.

---

## Cierre de capítulo

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea aprobar el sistema; los 3 son disciplina de aplicación continua, no defectos de diseño.

**Decisiones abiertas**:
1. Calendario exacto de re-auditoría retroactiva (§6) — orientativo aquí, se fija como práctica de equipo, no como regla técnica.
2. Si "Duplicar última operación" vs. "Aplicar Plan guardado" (§5, ejemplo de referencia) se resuelve en la primera revisión de retirada real, con datos de uso — no se decide en este capítulo.

**Recomendación profesional**: aprobar TPOS. Con la Constitución Técnica (23) definiendo qué nunca se puede romper, y TPOS definiendo cómo se admite y se retira todo lo demás, TradePilot tiene ya las dos piezas de gobierno que sostienen el desarrollo de un producto de referencia durante diez años sin que "crecer" signifique "acumular". Con esto aprobado, y por instrucción del fundador, comienza definitivamente el diseño técnico del TradePilot Quant Engine — no queda ningún documento de gobierno ni conceptual pendiente en la fase de Blueprint.
