# 13 · IA de aprendizaje continuo — solo el historial del trader

*Voz: Investigador de IA*

Este documento profundiza 02 §6 y 06 §5 con la pregunta de un investigador, no de un ingeniero de producto: ¿cómo se construye un sistema que mejora con cada operación, sin usar jamás un solo dato ajeno al trader, sin inestabilidad estadística a bajo N, y sin que su confianza artificial sustituya el juicio del propio trader?

## 1. La restricción de investigación (no negociable)

El sistema de aprendizaje de TradePilot R tiene una restricción que ningún otro producto de IA en trading se impone: **cero datos de entrenamiento cruzados entre usuarios, en cualquier fase del pipeline.**

Esto descarta explícitamente, para siempre, cualquier técnica que dependa de datos agregados de otros usuarios:
- Ningún modelo pre-entrenado sobre "traders en general".
- Ningún prior bayesiano inicializado con estadísticas de la base de usuarios.
- Ningún embedding o clustering de usuarios "similares" para transferir conocimiento.
- Ninguna función de "benchmarking" que compare directamente el modelo de un usuario contra el de otro (el benchmarking agregado y anonimizado de 08 §5.2 es una función de producto distinta, opt-in, y **nunca** alimenta el modelo de recomendación de nadie).

La única fuente de verdad del modelo de un usuario son sus propias filas en `trades`, `trade_partials_planned/executed` y `user_stat_buckets` (04). Esto no es una limitación aceptada a regañadientes — es el foso de producto (01 §1): cuantas más operaciones registra un trader, mejor es *su* asesor, y ese valor no es transferible ni copiable a otro usuario ni a un competidor que solo tenga acceso a datos agregados.

## 2. Corrección de rigor: el "corte" a N<8 debe ser continuo, no un interruptor

02 §6.3 definía un umbral duro: por debajo de 8 operaciones en un bucket, el sistema "no personaliza". Revisado con rigor de investigador, esto es inconsistente con el propio modelo bayesiano de 02 §6.2, que **ya produce una estimación válida en cualquier N, incluido N=0** (con `Beta(1,1)`, una distribución uniforme — "no sé nada todavía" expresado matemáticamente, no un vacío). Un interruptor duro en N=8 crea un salto de experiencia injustificado: con 7 operaciones el sistema calla, con 8 aparece una recomendación con aparente autoridad — ninguna de las dos cosas refleja bien la incertidumbre real, que cambia de forma gradual, no discreta.

**Corrección**: se elimina el umbral duro. El sistema **siempre** muestra su mejor estimación junto con el intervalo de credibilidad (ya previsto en 02 §6.2), y el intervalo mismo comunica la confianza — ancho a N bajo, estrecho a N alto. La única adaptación de UI por nivel de confianza es una etiqueta cualitativa derivada del ancho del intervalo (`IC_95_ancho = límite_superior − límite_inferior`):

```
IC_ancho ≥ 40 puntos porcentuales  →  "Confianza baja"   (visualmente atenuado, nunca oculto)
20 ≤ IC_ancho < 40                 →  "Confianza media"
IC_ancho < 20                      →  "Confianza alta"
```

Esto es estrictamente más honesto que el corte anterior (una recomendación de baja confianza mostrada y etiquetada como tal enseña al usuario a leer incertidumbre; una recomendación oculta no enseña nada) y matemáticamente más simple (una sola fórmula continua, no una regla condicional aparte). 02 §6.3 queda sustituido por esta regla.

## 3. Aprendizaje continuo: pipeline de actualización incremental

"La IA debe aprender continuamente. Cada nueva operación mejora las recomendaciones" se implementa literalmente como **actualización online**, nunca como reentrenamiento por lotes:

```
Evento: se cierra una operación (o se resuelve su último parcial)
   ↓
1. quant-engine calcula R_final, r_max, etc. (05 §2) — síncrono, cliente
   ↓
2. Se persiste la operación (Postgres, RLS)
   ↓
3. Edge Function encolada (05 §3) actualiza SOLO el bucket afectado:
      α_bucket += peso(operación) · [hit]
      β_bucket += peso(operación) · [miss]
   ↓
4. user_stat_buckets se escribe con el nuevo (α, β) — operación O(1), no recorre
   el histórico completo en cada actualización
```

Esto es deliberado y es la razón por la que el sistema puede llamarse "aprendizaje continuo" con propiedad matemática, no solo de marketing: cada operación nueva mueve la posterior en una sola operación aritmética barata (sumar al contador ponderado), nunca dispara un recálculo global. Es también lo que mantiene el coste marginal por operación cercano a cero (11 §7) — coherente con la restricción de costes del CEO.

## 4. El problema no resuelto en 02: el comportamiento de un trader cambia con el tiempo

Un modelo que simplemente acumula todas las operaciones históricas con el mismo peso tiene un defecto de investigador que 02 no abordaba: **asume que el trader de hace dos años es el mismo trader que el de hoy.** No lo es — un trader mejora (o empeora) su disciplina de gestión con la experiencia, y un modelo que pesa igual una operación de hace 3 años que una de ayer aprende más lento de lo que debería y puede recomendar en base a un hábito ya superado.

**Solución: ponderación temporal por decaimiento exponencial.** El "peso" de cada operación en la actualización de §3 no es 1, es:

```
peso(operación_j) = exp( −Δt_j / τ )
```

donde `Δt_j` es el tiempo transcurrido desde esa operación hasta hoy, y `τ` es la vida media de relevancia (valor por defecto propuesto: 6 meses, ajustable). Una operación de hace 6 meses pesa la mitad que una de hoy; una de hace 12 meses, un cuarto.

**Por qué esto no rompe la privacidad ni la simplicidad del modelo (autocrítica aplicada)**: sigue siendo Beta-Binomial, sigue siendo 100% personal, sigue siendo una suma incremental (§3) — el decaimiento se aplica al peso de cada término de la suma, no cambia la naturaleza del cálculo ni su coste. Es la diferencia entre un modelo que "acumula memoria" y uno que "envejece con el trader", y es la implementación correcta de la palabra "continuo" del enunciado: sin decaimiento, un histórico grande se vuelve cada vez más lento de mover (la posterior se "congela"); con decaimiento, el modelo sigue siendo sensible a cambios de comportamiento recientes indefinidamente — condición necesaria para que el aprendizaje sea *continuo* de verdad y no solo *acumulativo*.

## 5. Comportamiento, no solo resultado: qué campos observa el modelo

El enunciado pide explícitamente que la IA aprenda de "su comportamiento", no solo del resultado en R. El esquema (04) ya captura las señales necesarias sin añadir una sola tabla nueva:

| Señal de comportamiento | Campo ya existente | Pregunta que permite responder (con datos propios) |
|---|---|---|
| Tiempo en mercado | `trades.time_in_market_sec` | ¿Cierra antes de tiempo en operaciones largas? |
| Momento del día/semana | `trades.opened_at` | ¿Su patrón de cierre cambia según sesión (Londres/NY) o día? |
| Racha previa | Derivable ordenando `trades` por `opened_at` | ¿Cierra parciales antes tras 2+ pérdidas consecutivas ("revenge trading" defensivo)? |
| Desviación plan vs. ejecución | `trade_partials_planned` vs. `trade_partials_executed` | ¿Con qué frecuencia ejecuta distinto de lo que planificó, y en qué dirección (más conservador o más agresivo)? |

Estas correlaciones se calculan con el mismo aparato estadístico de §2 (Beta-Binomial personal, ponderado por recencia) — no requieren ninguna técnica nueva, solo condicionar sobre una variable adicional. **Decisión de alcance (aplicando el filtro de las 5 preguntas)**: estas correlaciones de comportamiento se mantienen en la fase exploratoria V4 ya prevista en 06 §6, no se adelantan al MVP — la pregunta *"¿es realmente necesaria ahora?"* tiene respuesta no: primero hay que validar que el modelo de un solo eje (bucket de RR) genera confianza y uso real antes de multiplicar los ejes de personalización, que además fragmentan la muestra por celda y empeoran la estabilidad estadística a la misma cantidad de operaciones registradas.

## 6. Guardarraíles: por qué la IA no puede sustituir al trader, por construcción

No es una promesa de producto, es una propiedad del sistema, verificable en tres capas:

1. **No existe ningún camino de código que ejecute una orden.** TradePilot no tiene integración de ejecución con ningún bróker (01 §5); no hay, arquitectónicamente, ninguna función capaz de actuar sobre una posición real. La afirmación "la IA nunca sustituye al trader" no depende de una política de uso, depende de que la capacidad de sustituirlo no existe en el sistema.
2. **Toda salida del modelo es una recomendación con explicación obligatoria** (02 §5.3, 06 §3) — nunca un valor aislado. Un número sin explicación invita a obedecer; un número con su "por qué" invita a decidir.
3. **"Aplicar" una recomendación nunca guarda nada por sí solo** — precarga la calculadora (03 §4) con la configuración recomendada, y el usuario todavía tiene que registrar o cerrar la operación con una acción explícita propia (10). No existe un botón "aplicar y guardar" de un solo toque para una recomendación de IA — esa fricción adicional de un toque es intencional, no un descuido de UX: separa "ver qué recomienda el sistema" de "decidir que es mi operación", incluso al coste de un toque extra que en cualquier otro flujo del producto habríamos eliminado (10 §2).
