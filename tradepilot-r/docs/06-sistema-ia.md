# 06 · Sistema de IA

*Voz: Especialista en IA aplicada al trading*

## 1. Principio rector: dos tipos de IA muy distintos, nunca confundidos

TradePilot R usa IA para **dos problemas separados**, con dos tecnologías distintas y explícitamente **no intercambiables**:

| Problema | Es un problema de... | Tecnología | Nunca usar |
|---|---|---|---|
| Optimizar parciales / calcular esperanza | Optimización combinatoria sobre datos determinista | Grid search + estadística bayesiana (02 §5-6) | Red neuronal / LLM |
| Explicar una recomendación en lenguaje natural | Generación de lenguaje | LLM (OpenAI) | — |
| Leer entrada/stop/TP de una captura | Visión por computador | Modelo de visión (OpenAI) | Cálculo de RR final (eso lo hace `quant-engine`, no el modelo de visión) |

**Por qué esto es una decisión de arquitectura y no solo de implementación**: un LLM optimizando parciales sería más lento, más caro por operación, no determinista (dos ejecuciones podrían dar resultados distintos ante el mismo input) y no auditable — inaceptable para una herramienta que informa decisiones de riesgo real. El optimizador debe ser reproducible bit a bit: mismos datos de entrada → misma recomendación, siempre. Solo un algoritmo determinista lo garantiza.

## 2. Motor optimizador (resumen operativo, matemática completa en 02 §5-6)

```
Input:  historial de operaciones del usuario (bucketizado por RR_obj, ver 02 §6.1)
        + configuración actual en la calculadora
Proceso: grid search sobre (n, RR_i, p_i) → Score(c) = E[R_final|c] − λ·σ[R_final|c]
Output: top-3 configuraciones + explicación estructurada
```

Corre como Edge Function (no en el navegador, porque necesita leer el historial completo del usuario desde Postgres), pero es **puramente determinista y sin llamada a ningún modelo de lenguaje** — es el mismo módulo `quant-engine/optimizer.ts` compartido con el cliente (05 §2), solo que ejecutado con el dataset completo en servidor por motivos de payload (no se descarga todo el historial al cliente para esto).

## 3. Generación de explicaciones en lenguaje natural

Una vez el optimizador determinista calcula la recomendación (número, no texto), se genera la explicación con un LLM **con contexto estrictamente acotado**:

```
Prompt (estructura, no texto libre):
  - Configuración recomendada: {n, RR_i, p_i}
  - Configuración actual del usuario: {...}
  - Delta de E[R], E[€], σ
  - Estadística personal relevante: "P(R_max≥3R)=72% [IC 58-83%], N=34"
  → Genera: 2-3 frases explicando el POR QUÉ, tono directo, sin jerga innecesaria
```

El LLM **nunca inventa números** — todos los valores numéricos de la explicación se inyectan ya calculados en el prompt; el modelo solo redacta. Esto elimina el riesgo de alucinación numérica en un dominio donde un número incorrecto (aunque sea solo en el texto explicativo) rompe la confianza del usuario en todo el producto.

## 4. Lectura de capturas de TradingView (V2, ver 01 §3.3)

Pipeline propuesto:

1. Usuario sube captura al registrar/completar una operación.
2. Edge Function envía la imagen a un modelo de visión (OpenAI) con un prompt acotado: *"Detecta si hay líneas de entrada, stop loss y take profit dibujadas. Devuelve sus valores de precio si son legibles, y la dirección (long/short) según la posición relativa de las líneas."*
3. Salida estructurada (JSON): `{entry, stop, tp, direction, confidence}`.
4. **Nunca se aplica automáticamente**: se muestra como sugerencia precargada en el formulario ("¿Detectamos esto — confirmas?"), el usuario confirma o corrige con un tap. Coherente con el principio de 01 §2.3 (la IA recomienda, nunca ejecuta ni asume).
5. Si `confidence` es bajo, ni se sugiere — se pide entrada manual directamente para no entrenar al usuario a desconfiar de sugerencias erróneas frecuentes.

Este pipeline se pospone a V2 (no MVP) porque requiere volumen real de capturas variadas (distintos temas de gráfico, anotaciones, plataformas) para calibrar el prompt y medir tasa de acierto antes de exponerlo como feature fiable — lanzarlo prematuramente con baja precisión dañaría la confianza en toda la IA del producto, no solo en esta función.

## 5. Aprendizaje personalizado: qué significa exactamente "la IA aprende del usuario"

Para ser precisos y evitar expectativas infladas de "machine learning" donde en realidad hay estadística bayesiana (decisión justificada en 01 §3.2 y 02 §6):

- **Lo que se actualiza por usuario**: los parámetros `(α, β)` de las distribuciones Beta por bucket de RR (`user_stat_buckets`, 04 §3), recalculados de forma incremental cada vez que se cierra una operación.
- **Lo que nunca ocurre**: no hay un modelo de ML con pesos entrenados por usuario, no hay fine-tuning por usuario, no hay transferencia de patrones entre usuarios. Cada usuario es un modelo estadístico completamente independiente y aislado (refuerza 01 §2.5 — foso de producto basado en datos privados, no en un modelo compartido que diluiría el valor diferencial de "tu propio historial").
- **Por qué esto es mejor que un modelo de ML clásico para este caso de uso concreto**: con 20-50 muestras por usuario y por bucket, cualquier red neuronal sobreajustaría o necesitaría regularización tan fuerte que terminaría comportándose, en la práctica, como... un modelo bayesiano con prior fuerte. Se elige directamente la herramienta correcta para el tamaño de dato real, no la más de moda.

## 6. Roadmap de IA (fases, alineado con 07)

| Fase | Capacidad |
|---|---|
| MVP | Calculadora + optimizador determinista + explicaciones LLM básicas (sin personalización, N insuficiente) |
| V2 | Estadísticas bayesianas personalizadas por bucket + explicaciones enriquecidas con esas estadísticas |
| V3 | Lectura de capturas por visión (§4) |
| V4 (exploratorio) | Detección de patrones de comportamiento no solicitados explícitamente (ej. "sueles cerrar manualmente antes de tu 2º parcial en operaciones de más de 45 min — ¿es una regla que quieres formalizar?") — siempre como sugerencia opt-in, nunca automatizado |

## 7. Coste y latencia (consideración de negocio, no solo técnica)

Las llamadas a OpenAI (explicación + visión) son la única partida de coste variable por usuario activo distinta de la infraestructura base. Se diseñan para:

- Cachear explicaciones cuando el input no cambió (evitar recalcular texto idéntico).
- Usar el modelo más pequeño que cumpla la tarea para generación de texto corto estructurado (no se necesita el modelo más grande disponible para redactar 2-3 frases con números ya calculados).
- Reservar el modelo de visión (más caro) exclusivamente para el flujo explícito de captura, nunca en el camino crítico de guardado de una operación.

Esto mantiene el coste marginal de IA por usuario predecible y bajo, condición necesaria para que la economía de la suscripción (08) funcione a escala.
