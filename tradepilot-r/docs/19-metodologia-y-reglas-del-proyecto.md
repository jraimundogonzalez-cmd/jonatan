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

## 8. Decisión abierta que esta metodología deja pendiente (no se resuelve unilateralmente)

¿Se retrofitan los 18 capítulos ya escritos (00-18) con el pie de capítulo de §5, o el formato nuevo aplica solo hacia adelante? Es un trabajo real (18 documentos), no una formalidad — se deja como decisión explícita del fundador, no se asume. Ver también 20-flujo-funcional-usuario.md, cuyo cierre de capítulo señala además una segunda decisión abierta más urgente (el impacto retroactivo del Rule Engine sobre 04/15/18).
