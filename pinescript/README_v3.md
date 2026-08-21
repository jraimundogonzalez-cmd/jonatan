# CRT Multi-TF Swing/Sniper v3

Tres archivos nuevos en `pinescript/`, todos partiendo de tu `v2` (que se
guarda tal cual como referencia en `CRT_MultiTF_Swing_Sniper_v2.pine`):

- `CRT_MultiTF_Swing_Sniper_v3.pine` — **indicador**, para verlo en vivo.
- `CRT_MultiTF_Swing_Sniper_v3_strategy.pine` — **estrategia**, misma
  lógica de entrada/salida, para el Strategy Tester nativo.

## Lo que audité de v2 (punto 2, regla dura)

v2 ya exigía correctamente `htfBias != 0` y `midBias == htfBias` antes de
disparar cualquier señal — esa parte ya estaba bien. El hueco real: **no
validaba que el TF intermedio fuera menor que el HTF y mayor que el TF de
entrada**. Si configurabas, por ejemplo, intermedio = 1D con HTF = 4h
(invertido), o intermedio igual al TF del gráfico, el script seguía
calculando sesgo y alineación igualmente sobre una jerarquía sin sentido.

v3 añade `validTFStack = HTF > intermedio > entrada` (comparando
timeframes en segundos) como candado único: si es falso, `aligned` nunca
puede ser `true`, así que no se arma ningún swing ni se dispara ninguna
señal — pase lo que pase con los otros inputs. Además aparece un aviso
grande en el gráfico: "⚠ CONFIG TF INVÁLIDA" mientras la configuración no
tenga sentido, y una fila roja/ámbar en el panel de estado.

También añadí el aviso "NEUTRO - NO OPERAR" en la fila de HTF cuando
`htfBias == 0`, y el filtro **`qualityOnly`** (activado por defecto): una
ruptura que no llega a A+ sigue "consumiendo" el swing (para no repetir el
mismo aviso vela tras vela) pero no genera señal, alerta ni entra en el
registro.

Subí también los valores por defecto de `manipMinATR_HTF`/`manipMinATR_Mid`
de 0.20 a 0.30 como punto de partida más exigente — **sin haberlo
backtesteado yo**, es una hipótesis de partida para que la compares contra
0.20/0.40 con el Strategy Tester del punto 1, no la des por buena a ciegas.

## Punto 1: la versión `strategy()`

Misma detección exacta que el indicador v3 (manipulación, alineación,
ruptura de pivote, filtro A+, validación dura de TFs). Gestión de posición:

- Una sola operación abierta a la vez — una señal nueva no hace nada si ya
  hay una posición en curso (sin pirámide).
- Salida en tres tramos 33% / 33% / 34% del tamaño **original** en
  TP1/TP2/TP3, con el mismo SL en los tres tramos vía `strategy.exit()`.
  Truco importante: `qty_percent` en Pine se calcula sobre la posición
  **restante** en cada momento, no sobre el tamaño original, así que si le
  pasas 33/33/34 literales el segundo y tercer tramo cierran de menos tras
  el primer TP. Los porcentajes reales que uso son 33 / 49.25 (=33÷67·100)
  / 100, que sí cierran exactamente 33/33/34 del tamaño original.
- Inputs de cuenta (capital inicial, comisión, slippage) en el propio
  diálogo de la estrategia, para que ajustes a tu bróker antes de mirar el
  Profit Factor.

### Cómo usarla

1. Pega `CRT_MultiTF_Swing_Sniper_v3_strategy.pine` en el Pine Editor,
   guárdala y añádela al gráfico (en el TF de entrada: 1h para SWING, 15m
   para SNIPER).
2. Configura HTF/intermedio igual que en el indicador (1D/240 para SWING,
   240/60 para SNIPER).
3. Abre la pestaña **"Strategy Tester"** (abajo, junto a Pine Editor).
   Ahí tienes Profit Factor, Sharpe, drawdown máximo, y la curva de
   capital — exactamente lo que pedías en el punto 1, con datos reales del
   motor de TradingView, no de mi tabla de conteo.
4. Para el punto 6 (optimizar parámetros por Profit Factor): en la propia
   pestaña de Strategy Tester, TradingView permite "Optimizar" barriendo
   rangos de los inputs (`manipMinATR_HTF`, `manipMinATR_Mid`,
   `qualityMult`, `slBufferMult`) — yo no puedo ejecutar eso desde aquí
   (no tengo acceso a tu TradingView), pero la estrategia ya está lista
   para que lo corras tú. Cuéntame los resultados (mejor combinación +
   señales/año) y seguimos desde ahí.

## Lo que NO he tocado todavía (puntos 3, 4, 5, 7)

Para no meter cambios sin poder verificarlos con cuidado en una sola
tanda, dejé pendientes:

- **Punto 3** (R:R real y Profit Factor por operación en la tabla del
  indicador) y **punto 4** (contar TP1 parcial como ganancia parcial, no
  pérdida total) — los añado en la próxima iteración sobre v3.
- **Punto 5** (filtro de sesión Londres/NY) — input + comparación de PF
  dentro/fuera de sesión, pendiente.
- **Punto 7** (exportar datos de OANDA/CME y portar a Python) — es un
  encargo grande aparte; dime cuándo quieres que lo empiece.

## Punto 8: diseño visual

Aplicado ya en el indicador v3, siguiendo el diseño que aprobamos: sin
cajas de rango translúcidas por defecto, triángulo de dirección
(▲ verde COMPRA / ▼ coral VENTA), raya corta + etiqueta numérica en cada
nivel (rojo = riesgo/SL, verde = objetivo/TP, siempre — no cambia con la
dirección), tarjeta compacta junto a la señal con los 5 precios en el
mismo orden que el eje de precio, y panel de estado con HTF/Intermedio/
Alineado en colores tipo "chip", incluido el aviso "NEUTRO - NO OPERAR".
