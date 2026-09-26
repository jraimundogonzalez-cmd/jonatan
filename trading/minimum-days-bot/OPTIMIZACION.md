# Minimum Days Bot: protocolo de optimización

## Objetivo (en este orden)

1. **Menos ciclos FAIL** (`% ciclos OK` lo más alto posible).
2. **Más ciclos OK con P&L > 0**: que el ciclo no termine en negativo.
3. **Días operados hasta 4 MIN DAYS**: mediana ≤ 5 y peor caso lo más bajo posible.

El profit factor, el winrate y el neto **no** son el objetivo. Solo sirven de diagnóstico.

## Por qué no basta la tabla del gráfico

La tabla solo ve las velas cargadas en el gráfico (~41 días operados en 5 min). Optimizar sobre 41 días es sobreajustar. Cada variante se mide sobre el **backtest profundo** (2019 → hoy): se exporta la lista de operaciones y se analiza con `analyze_trades.py`.

## Muestras

| Muestra | Rango | Uso |
|---|---|---|
| In-sample (IS) | 2019-05-01 → 2023-12-31 | Elegir parámetros |
| Out-of-sample (OOS) | 2024-01-01 → hoy | Validar. No se mira para decidir |

`python3 analyze_trades.py *.csv --split 2024-01-01` saca IS y OOS de cada export de una vez.

**Regla de aceptación:** un cambio se acepta solo si mejora el objetivo en IS **y** no empeora en OOS. Si solo mejora en una de las dos, se descarta.

## Paso 0: línea base (obligatorio)

1. Pegar `MinDaysBot_v0.2.pine` en el Pine Editor y añadirlo al gráfico MNQ1! de 5 min.
2. Comprobar que la tabla TOTAL sigue dando 7 OK / 2 FAIL / 4,57 / 8,43 / 11,29 y que el backtest profundo da ~1.110 trades.
   La v0.2 solo cambia la red GOAL (ya no bloquea el día sin P&L realizado). Puede variar como mucho algún día aislado.
3. Exportar la lista de operaciones → `v02_base.csv`.

## Rejilla (una palanca cada vez, desde la base)

| # | Input | Valores | Hipótesis |
|---|---|---|---|
| 1 | Máx. trades por día | 2 (base), 1 | Tras un SL el día ya no puede ser MIN DAY; el 2.º trade solo arriesga otro −802 $ |
| 2 | Riesgo neto máx. por trade ($) | 800 (base), 600, 450, 300 | Reducir el tamaño de los días D |
| 3 | Break-even: activar tras X ticks | 0 (base), 40, 55, 70 | El TP está a 83 ticks: proteger trades que casi llegan |
| 4 | Stop por tiempo (min) | 0 (base), 30, 60, 90 | Los cierres por hora pierden ~270 $ de media |
| 5 | Ventana de señales | 0930-1130 (base), 0930-1100, 0930-1030 | Las rupturas tardías tienen menos recorrido |
| 6 | Rango Asia máximo (pts) | 0 (base), 250, 150 | Evitar días de rango enorme |
| 7 | Rango Asia mínimo (pts) | 0 (base), 30, 60 | Evitar rupturas falsas de rango estrecho |
| 8 | TP tras un SL | Estándar (base), Recuperar hasta objetivo | ¿Convertir días −802 en MIN DAYS? (cuidado: TP enorme) |
| 9 | EMA dirección | 20 (base), 50 | Filtro de tendencia más lento |

Son ~22 exports. Después se combinan las 2–3 palancas ganadoras (4–8 exports más) y se valida la combinación final en OOS.

**No tocar:** objetivo diario (150), DD (2.000), días requeridos (4) ni comisión/slippage. Son la definición del problema, no parámetros.

## Nombres de archivo

`v02_<palanca>_<valor>.csv`. Ejemplos: `v02_trades_1.csv`, `v02_sl_450.csv`, `v02_be_55.csv`, `v02_hold_60.csv`.

## Prompt para Claude en Chrome (copiar y pegar)

```
Estoy en TradingView con la estrategia "Minimum Days Bot v0.2 - MNQ" en MNQ1! 5 min,
con backtesting PROFUNDO activado (rango desde 2019-05-01 hasta hoy).

Para cada fila de esta lista, en orden:
  1. Abre Configuración de la estrategia (icono de engranaje) -> pestaña Entradas.
  2. Pon TODOS los inputs en su valor base, y cambia SOLO el input de esa fila.
  3. Acepta y espera a que el Probador de estrategias termine de recalcular.
  4. Anota: PyG totales, Operaciones rentables (% y n/N), Factor de ganancias, Caída máx.
  5. Exporta la Lista de operaciones (icono de descarga del informe) y renombra el archivo
     con el nombre indicado.
No cambies Propiedades (capital, comisión 0.74, slippage 1, contratos 4, bar magnifier).
No cambies ningún otro input. Si algo no carga o el recálculo falla, dímelo y para.

Valores base: Máx. trades por día = 2 · Riesgo neto máx. = 800 · Break-even = 0 ·
Stop por tiempo = 0 · Ventana de señales = 0930-1130 · Rango Asia mín. = 0 · máx. = 0 ·
TP tras un SL = Estándar · EMA = 20 · Red GOAL = activada.

Lista:
  v02_base          (todo en base)
  v02_trades_1      Máx. trades por día = 1
  v02_sl_600        Riesgo neto máx. por trade = 600
  v02_sl_450        Riesgo neto máx. por trade = 450
  v02_sl_300        Riesgo neto máx. por trade = 300
  v02_be_40         Break-even tras X ticks = 40
  v02_be_55         Break-even tras X ticks = 55
  v02_be_70         Break-even tras X ticks = 70
  v02_hold_30       Stop por tiempo = 30
  v02_hold_60       Stop por tiempo = 60
  v02_hold_90       Stop por tiempo = 90
  v02_win_1100      Ventana de señales = 0930-1100
  v02_win_1030      Ventana de señales = 0930-1030
  v02_rmax_250      Rango Asia máximo = 250
  v02_rmax_150      Rango Asia máximo = 150
  v02_rmin_30       Rango Asia mínimo = 30
  v02_rmin_60       Rango Asia mínimo = 60
  v02_recup         TP tras un SL = Recuperar hasta objetivo
  v02_ema_50        EMA dirección = 50

Al terminar, dame una tabla con las 4 cifras anotadas de cada variante.
```

## Analizar los exports

```bash
python3 analyze_trades.py v02_*.csv --split 2024-01-01          # comparativa IS / OOS
python3 analyze_trades.py v02_base.csv --cycles --out base      # ciclos día a día + CSVs
```

Si las fechas del export no están en hora de Madrid, indica la zona del gráfico con `--tz`. Por ejemplo: `--tz UTC`.
