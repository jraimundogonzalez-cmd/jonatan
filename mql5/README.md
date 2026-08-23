# CRT Multi-TF Swing/Sniper — Expert Advisor para MT5 (solo backtesting)

`CRT_MultiTF_Swing_Sniper_v3.mq5` — puerto a MQL5 del indicador/estrategia
Pine v3, para correr en el **Strategy Tester de MetaTrader 5** y comparar
sus métricas contra las de TradingView.

**Importante:** no he podido compilarlo aquí (no tengo MetaEditor en este
entorno). Ábrelo en MetaEditor, compílalo (F7) y revisa la pestaña
"Errores" antes de nada — si sale algún aviso de sintaxis, tráemelo y lo
corrijo.

## Decisiones que ya tomamos

- **Solo backtesting**, sin operativa automática real — coincide con la
  regla del proyecto de "nada de ejecución automática, decides tú".
- **Cuenta netting asumida** (una sola posición neta por símbolo, lo más
  común en cuentas de fondeo sobre MT5): los TP1/TP2/TP3 se simulan con
  **cierres parciales** de esa única posición
  (`PositionClosePartial`), monitoreados en cada tick — no son 3 órdenes
  independientes como en la versión de TradingView. Si tu bróker resulta
  ser de cuenta **hedging** (varias posiciones simultáneas permitidas en
  el mismo símbolo), dímelo y lo cambio a 3 órdenes independientes de
  33/33/34%, que es más parecido a como quedó en Pine.
  - Para comprobarlo: en tu terminal MT5, Herramientas → Opciones →
    pestaña de la cuenta, o pregúntaselo directamente a tu prop firm/bróker.

## Corrección: TP1/TP2/TP3 rediseñados (bug real encontrado en tu propio test)

Tu primer test en MT5 (8 meses) dio 8 operaciones que se autocerraban en
1-3 segundos. Causa: TP1/TP2/TP3 salían de tres timeframes sueltos
(H4/H6/H8) sin relación garantizada entre ellos — como la entrada dispara
justo tras una ruptura fuerte, el precio ya solía haber superado esos
máximos recientes, así que el "objetivo" quedaba detrás del precio en vez
de delante. Con el segundo test (varios años) el fallo se hizo aún más
visible: 0 operaciones en todo el histórico, porque el candado que añadí
para bloquear TPs inválidos casi nunca se cumplía con ese diseño.

Ahora TP1/TP2/TP3 son **fracciones de la distancia entre la entrada y
`htfTargetExtreme`** (extremo opuesto del rango HTF): TP1 = entrada + 33%
de esa distancia, TP2 = 66%, TP3 = el extremo completo. Por construcción
quedan ordenados y siempre por delante del precio. Los inputs
`InpTP1TF`/`InpTP2TF`/`InpTP3TF` desaparecen; ahora son
`InpTP1Split`/`InpTP2Split` (0.33/0.66 por defecto). Tienes que
**recompilar** (F7) con el archivo actualizado antes de volver a testear.

## Diferencia importante de tamaño de posición

La versión de TradingView usaba 100% del equity por operación (una
simplificación del backtest de Pine, no una recomendación real). Para MT5
usé un sizing **por riesgo real**: `InpRiskPercent` (1% por defecto) del
equity, calculado a partir de la distancia al SL de cada señal. Esto hace
que las curvas de equity de TradingView y MT5 **no sean directamente
comparables en euros/dólares** — sí lo son en Profit Factor, win rate y
R:R, que es lo que de verdad quieres para "sacar conclusiones".

## Cómo probarlo

1. Copia `CRT_MultiTF_Swing_Sniper_v3.mq5` a tu carpeta
   `MQL5/Experts/` (Archivo → Abrir carpeta de datos, desde MetaEditor o
   el propio MT5) y ábrelo en MetaEditor.
2. Compila (F7). Corrige cualquier error de sintaxis que salga — avísame
   si hay alguno raro.
3. En MT5, abre el **Strategy Tester** (Ctrl+R), elige este EA, el
   símbolo (EURUSD, XAUUSD...) y el **TF de entrada** (H1 para SWING, M15
   para SNIPER) — el EA se ejecuta en ese TF, igual que en TradingView.
4. Configura los inputs igual que en Pine: `InpHTF`/`InpMidTF` = D1/H4
   para SWING, H4/H1 para SNIPER.
5. Modelo de ejecución: elige **"Cada tick basado en ticks reales"** si tu
   histórico lo permite — es el más preciso para detectar exactamente
   cuándo se toca cada TP/SL intravela, que es justo lo que este EA vigila
   en cada tick.
6. **Historial multi-timeframe:** antes de lanzar el test, abre una vez en
   tu terminal (en vivo, no en el tester) los gráficos del HTF y del TF
   intermedio del símbolo que vayas a testear (por ejemplo XAUUSD D1 y
   XAUUSD H4) para forzar la descarga de ese histórico — el Strategy
   Tester lee de la caché local del terminal, no descarga sobre la marcha
   timeframes que nunca has abierto.
7. Lanza el test. En la pestaña "Resultados" tienes Profit Factor,
   drawdown, Sharpe (si tu build de MT5 lo muestra) y el listado de
   operaciones — compáralo con lo que te dé el Strategy Tester de
   TradingView con la misma configuración (mismo símbolo, mismos
   parámetros de manipulación/calidad).

## Qué comparar entre TradingView y MT5

- Profit Factor y win rate deberían salir **parecidos** (misma lógica de
  señal) — si salen muy distintos, probablemente sea por diferencias de
  datos entre proveedores (spread, huecos de fin de semana, horario del
  bróker) más que por un fallo de traducción. Tráeme ambos resultados y
  los comparamos.
- El histórico de MT5 suele ser más largo que el tope de 20.000 barras de
  TradingView — es la ventaja real de este camino frente al de
  TradingView para el punto 7 (más años de datos para validar fuera de
  muestra).
