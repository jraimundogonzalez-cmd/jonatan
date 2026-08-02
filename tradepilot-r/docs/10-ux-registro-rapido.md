# 10 · UX de registro rápido — ≤3 pulsaciones, una mano, <30s

*Voz: UX/UI Designer Senior*

## 1. Corrección de partida: qué pantalla hace qué

Antes de diseñar el flujo, una auditoría honesta. En 03-ux-ui.md la pantalla "Hoy" mezclaba calculadora + lista de operaciones + tarjeta de IA en un mismo espacio. Bajo el principio *"cada pantalla debe tener un único objetivo"*, eso es un defecto de diseño, no un detalle: mezcla **repasar** (lista), **explorar** (simulación hipotética) e **interpretar** (insight). Ya corregido en 03 §2 y §4. Consecuencia directa para este documento: el flujo que se audita aquí es exclusivamente el de **registrar una operación real**, disparado desde el botón flotante, nunca desde la calculadora.

## 2. La regla de las 3 pulsaciones: qué cuenta y qué no

Aplicar literalmente "ninguna acción frecuente necesita más de 3 pulsaciones" a un formulario con datos que cambian en cada operación (símbolo, RR objetivo) es matemáticamente imposible — un input numérico de valor libre requiere, como mínimo, tantos toques como dígitos tenga. Diseñar contra una imposibilidad matemática produce un mal diseño (campos recortados, precisión perdida) para cumplir la letra de la regla en vez de su espíritu.

**Reformulación correcta, que sí se cumple sin excepción:**

> Ninguna acción de **navegación, confirmación o repetición de una elección ya hecha antes** puede costar más de 3 pulsaciones. Los **valores nuevos e irrepetibles** (RR objetivo de esta operación, símbolo si no está en recientes) están exentos del límite de pulsaciones, pero sujetos al presupuesto de tiempo total (§4).

Aplicación concreta — acciones que SÍ deben cumplir ≤3 pulsaciones, sin excepción:

| Acción frecuente | Pulsaciones |
|---|---|
| Abrir el registro rápido | 1 (FAB) |
| Cambiar de cuenta (si no es la última usada) | 1 (bottom sheet con cuentas recientes) |
| Elegir símbolo si está en "recientes" | 1 |
| Alternar Compra/Venta | 1 (control segmentado de 2 estados) |
| Ajustar Riesgo % desde el default | 1 (stepper, no teclado) |
| Aplicar una recomendación del optimizador | 1 |
| Marcar un parcial como ejecutado | 1 |
| Guardar la operación | 1 |

## 3. Zona de pulgar (una mano, iPhone)

Todo control primario vive en el tercio inferior de la pantalla (zona de alcance natural del pulgar sujetando el teléfono con una mano), siguiendo el modelo estándar de ergonomía móvil:

```
┌─────────────────────────┐
│  Zona fría (solo lectura) │  ← símbolo/cuenta ya seleccionados, se muestran, no se tocan
│                          │
├─────────────────────────┤
│  Zona templada           │  ← ajustes ocasionales (Riesgo%, RR objetivo)
│                          │
├─────────────────────────┤
│  Zona caliente (pulgar)  │  ← FAB, toggle Compra/Venta, teclado numérico, botón Guardar
└─────────────────────────┘
```

Reglas derivadas:
- El botón **Guardar** nunca está arriba (patrón iOS clásico de "listo" en la esquina superior derecha) — está fijo abajo, a un pulgar de distancia, siempre visible sin scroll.
- **Cerrar el modal de registro es un gesto de deslizar hacia abajo**, no un botón en la esquina superior izquierda — evita el único movimiento de esta pantalla que exigiría soltar el agarre natural del teléfono.
- El teclado numérico (Riesgo%, RR objetivo) es el teclado nativo del sistema, nunca un teclado custom — mismo aprendizaje motor que el usuario ya tiene automatizado en cualquier otra app.

## 4. Mapa de pulsaciones y presupuesto de tiempo del flujo estándar

> **Mejora tras la reorientación a cuenta (17-tradepilot-os.md §4)**: la tabla siguiente asumía el mejor caso con 0 pulsaciones de cuenta solo si la cuenta activa global ya coincidía con la deseada. Desde que el home es Cuentas y el FAB vive también dentro del Dashboard de cada cuenta (14 §3, pantalla 6), entrar a registrar **desde el contexto de una cuenta concreta** precarga esa cuenta con 0 pulsaciones siempre, no solo cuando coincide con la última usada — el caso común de abajo es ahora el caso típico, no el optimista.

Caso más común: misma cuenta y símbolo que la operación anterior (el patrón real de un trader que opera pocos activos de forma recurrente).

| Paso | Acción | Pulsaciones | Tiempo estimado |
|---|---|---|---|
| 1 | Tap en FAB "+" | 1 | ~1s |
| 2 | Cuenta (ya es la última usada, no se toca) | 0 | 0s |
| 3 | Símbolo desde "recientes" | 1 | ~1s |
| 4 | Compra/Venta (toggle) | 1 | ~1s |
| 5 | Riesgo % (default ya cargado, sin ajuste) | 0 | 0s |
| 6 | RR objetivo (teclado numérico, valor nuevo) | ~4 dígitos | ~3-4s |
| 7 | Guardar | 1 | ~1s |
| **Total** | | **4 pulsaciones de navegación + 4 dígitos** | **~7-8s** |

Caso menos frecuente (cuenta distinta, símbolo nuevo, ajuste manual de riesgo, 2 parciales):

| Paso | Acción | Pulsaciones | Tiempo estimado |
|---|---|---|---|
| 1 | Tap en FAB | 1 | ~1s |
| 2 | Cambiar cuenta (bottom sheet) | 1 | ~1-2s |
| 3 | Escribir símbolo nuevo | ~5 caracteres | ~3-4s |
| 4 | Compra/Venta | 1 | ~1s |
| 5 | Ajustar Riesgo % (stepper) | 1-2 | ~2s |
| 6 | RR objetivo | ~4 dígitos | ~3-4s |
| 7 | Añadir parcial 1 (RR + %) | 2 campos | ~4s |
| 8 | Añadir parcial 2 (RR + %) | 2 campos | ~4s |
| 9 | Guardar | 1 | ~1s |
| **Total** | | | **~20-23s** |

Incluso en el caso menos favorable, con parciales incluidos, el flujo queda por debajo del objetivo de 30s. El margen (7-10s) es intencional: cubre variabilidad real de usuario (dedos más lentos, dudas) sin poner en riesgo el compromiso de producto.

## 5. Auditoría de cada botón (por qué existe)

| Elemento | Motivo de existir | Alternativa descartada |
|---|---|---|
| FAB "+" | Única entrada al flujo más frecuente del producto — debe ser inconfundible y constante | Menú de navegación con "Nueva operación" — un nivel extra de indirección para la acción más usada del producto, injustificable |
| Toggle Compra/Venta | Dato obligatorio, binario | Dropdown — un dropdown para 2 opciones es siempre peor que un control segmentado de 1 toque |
| Stepper de Riesgo % | Ajuste ocasional sobre un default ya correcto la mayoría de las veces | Teclado libre — obliga a borrar y reescribir un valor que casi siempre ya es correcto; el stepper permite mantenerlo con 0 toques |
| Chips de "símbolos recientes" | Cubren el caso dominante (mismo activo que operaciones recientes) en 1 toque | Autocompletar-solo — exige escribir siempre, incluso cuando el valor se repite |
| "+ parcial" | Los parciales son opcionales y de cardinalidad variable (0-N) — debe poder no aparecer nunca en el flujo si el usuario no los usa | Mostrar 5 filas vacías siempre — sobrecarga visual permanente por una función que muchas operaciones no usan al momento de abrir la posición |
| Guardar | Confirmación explícita de una acción que persiste datos financieros — el único botón de esta pantalla que no se puede sustituir por un gesto, porque un dato financiero no debe poder guardarse por accidente | Autoguardado silencioso — descartado deliberadamente: el usuario debe tener la certeza consciente de que la operación quedó registrada |

Cualquier botón que no pase esta tabla no se construye. Esta auditoría se repite para cada pantalla nueva del producto, no solo para el registro.

## 6. Vías más rápidas todavía (propuestas activas, no en el brief original)

Cumpliendo el mandato de proponer algo más rápido si existe:

1. **Duplicar última operación.** Botón contextual sobre la última operación de la lista en "Hoy": 1 toque precarga cuenta, símbolo, dirección y riesgo % de esa operación; el usuario solo ajusta el RR objetivo (dato que sí cambia siempre) y guarda. Reduce el caso común de §4 (~7-8s) a ~4-5s. Es la optimización de mayor impacto de todo este documento porque ataca directamente el patrón real de un trader que opera pocos activos de forma repetida.
2. **Siri Shortcut / iOS App Intent "Registrar en TradePilot".** Invocable desde el Action Button (iPhone 15 Pro+), desde Spotlight, o como shortcut en la pantalla de bloqueo — abre el flujo de registro sin pasar por desbloquear y navegar a la app. Elimina 2-3 segundos de "encontrar la app" que ningún rediseño interno puede eliminar.
3. **Complicación de Apple Watch.** Captura mínima desde la muñeca (símbolo + dirección + riesgo, sin RR) en el instante exacto de cerrar la operación en el móvil o el ordenador — el RR objetivo y los parciales se completan después desde el móvil. Se propone como exploración de V4 (07 §3), no como compromiso de MVP: valida primero que el ahorro de fricción justifica el coste de mantener un target adicional de Apple Watch.
4. **Stepper con aceleración por mantener pulsado.** Para Riesgo % y RR objetivo cuando sí requieren ajuste manual: mantener pulsado el stepper acelera el incremento (patrón nativo iOS de "long-press para repetir rápido"), evitando decenas de toques individuales para llegar a un valor alejado del default.

Ninguna de estas cuatro propuestas es necesaria para cumplir el objetivo de <30s (ya se cumple sin ellas, §4) — se documentan porque el mandato del proyecto es proponer la vía más rápida posible, no solo la vía suficiente. Se priorizan en el roadmap según el filtro de las 5 preguntas: la propuesta 1 (duplicar operación) entra en el MVP por su ratio esfuerzo/impacto; las propuestas 2-4 se evalúan en fases posteriores.
