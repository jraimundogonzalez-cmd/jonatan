# CRT Multi-Timeframe Power of Three (Pine Script v6)

Indicador para TradingView: `CRT_Multi_Timeframe_Power_of_Three.pine`

Detecta el modelo CRT (rango HTF -> manipulación -> alineación en TF
intermedio -> power of three en el TF de entrada) y marca señales LONG/SHORT
con SL y TP calculados. No ejecuta operaciones — solo señal visual.

## Activar la alarma sonora con precios (Entrada / SL / TP)

El indicador dispara internamente `alert(...)` con un mensaje dinámico tipo
`COMPRA EURUSD | Entrada 1.16895 | SL 1.16595 | TP 1.16700 | Calidad A+`
en la misma vela cerrada donde se confirma la señal. Para recibirlo con
sonido en TradingView:

1. Con el indicador ya cargado en el gráfico, pulsa el icono de **reloj de
   alarma** (o clic derecho en el gráfico → "Añadir alerta").
2. En **Condición**, elige el indicador `CRT Multi-TF Power of Three` y,
   dentro de él, selecciona **"Cualquier llamada de función alert()"**
   (en inglés: "Any alert() function call"). No elijas `CRT LONG` / `CRT
   SHORT` si quieres el mensaje con los precios — esas dos son alertas
   fijas de texto estático, sin precios.
3. En **Frecuencia**, deja "Solo una vez por barra al cierre" (así coincide
   con el diseño no-repaint del indicador).
4. En **Acciones al activarse la alerta**, marca "Reproducir sonido" y
   elige el sonido/volumen que quieras (y "Notificación en la app" /
   "push" si usas el móvil).
5. Guarda. A partir de ahí, cada señal LONG o SHORT sonará con un mensaje
   que ya trae el precio de entrada, SL, TP (y TP parcial si está
   activado) listos para leer, sin tener que interpretar la tabla ni las
   líneas del gráfico.

Como la alerta se crea una vez y queda "viva" escuchando al indicador, no
hace falta recrearla en cada señal — sonará automáticamente cada vez que
se confirme una nueva.

## Cómo probarlo

1. Copia el contenido del `.pine` en el Pine Editor de TradingView.
2. Abre el gráfico **en el timeframe de entrada** (5m por defecto). El
   indicador siempre corre sobre el TF del gráfico; el HTF y el TF
   intermedio se leen internamente vía `request.security()`.
3. Ajusta el HTF por símbolo (input "HTF (rango madre)"): `240` (4h) para
   EURUSD, `480` (8h) para XAUUSD si es lo que quieres replicar de tus
   ejemplos manuales.

## Decisiones de casos límite (ya fijadas, configurables donde aplica)

1. **Qué se barre en el HTF/intermedio**: la vela anterior del mismo TF
   (no un pivote estructural). Rango = high/low de esa vela; se valida con
   barrido + cierre de vuelta dentro, con penetración mínima en múltiplos
   de ATR (inputs `manipMinATR_HTF` / `manipMinATR_Mid`).
2. **Si el TF intermedio no llega a alinearse antes de que el HTF cierre
   una nueva vela**: el sesgo HTF se recalcula desde cero en cada cierre de
   vela HTF, y cualquier alineación intermedia pendiente se descarta. Nunca
   se opera sobre un sesgo HTF desactualizado.
3. **Swing gatillo en el TF de entrada cuando hay varios candidatos**: se
   usa el pivote (N velas a cada lado, input `swingLen`) que inició el
   impulso contrario inmediatamente anterior a la manipulación — el mismo
   swing que describes en tus ejemplos de EURUSD/XAUUSD.
4. **"Sin tomar el extremo contrario al sesgo"**: se implementa
   comprobando que el mínimo/máximo alcanzado durante el retroceso en el
   TF de entrada (`pullbackLow`/`pullbackHigh`) no traspasa el nivel que
   definió la manipulación HTF (`htfManipExtreme`). Si lo traspasa, esa
   ruptura de swing no cuenta como señal válida.
5. **Timeframe del gráfico**: el indicador asume que siempre se ejecuta en
   el TF de entrada; HTF y TF intermedio llegan vía `request.security(...,
   lookahead = barmerge.lookahead_off)`, leyendo siempre velas ya cerradas
   (`[1]`/`[2]`), por lo que no hay repintado ni look-ahead.

## Otras reglas objetivas implementadas

- **Cero repintado**: toda señal se evalúa únicamente con
  `barstate.isconfirmed`, y los valores HTF/intermedio usados son siempre
  de velas ya cerradas.
- **SL**: extremo del retroceso de manipulación en el TF de entrada, menos
  un buffer de ATR del TF de entrada (`slBufferMult`).
- **TP**: extremo opuesto del rango HTF. Si `usePartialTP` está activo, se
  marca además una línea punteada en el extremo opuesto del rango
  intermedio (30m) como TP parcial.
- **Calidad A+/B**: A+ si la penetración de la manipulación, tanto en HTF
  como en TF intermedio, supera `qualityMult` veces el mínimo exigido
  (por defecto 1.5x); si no, B. Solo se etiquetan señales ya alineadas en
  los tres timeframes (es precondición para que exista señal).
- **Registro histórico**: cada señal guarda barra, dirección, entrada, SL,
  TP y calidad; en cada vela cerrada se comprueba si el precio ya tocó el
  SL o el TP de las señales abiertas. Una tabla en la esquina superior
  derecha resume sesgo HTF/intermedio, alineación, señales totales,
  TP/SL/abiertas y win rate de las cerradas — para medir efectividad real
  en vez de estimarla a ojo.
- Cero valores de precio fijos: todo se deriva de ATR y estructura de
  precio (pivotes, rangos de vela), por lo que funciona igual en XAUUSD,
  EURUSD o cualquier otro símbolo.

## Limitaciones conocidas / próximos pasos sugeridos

- Después de una señal, el mismo sesgo HTF/intermedio puede volver a
  generar otra señal si se forma un nuevo swing gatillo válido (no es
  "una señal por rango"). Si prefieres una sola señal por alineación,
  dímelo y lo bloqueo con una bandera adicional.
- El manejo de objetos (`max_lines_count`/`max_labels_count = 300`) hace
  que TradingView descarte automáticamente las señales más antiguas del
  gráfico si acumulas muchas; el registro interno (arrays) no se ve
  afectado por ese límite, pero si quieres histórico ilimitado en tabla
  habría que exportarlo o paginarlo.
- Falta la fase de validación out-of-sample que ya tienes definida en el
  proyecto: este indicador deja todo lo necesario para registrar señales,
  pero la tasa de acierto real solo la da correr esto sobre muchos
  ejemplos históricos.
