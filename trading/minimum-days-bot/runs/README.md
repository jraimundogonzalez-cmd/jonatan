# runs/

Deja aquí los exports de la **Lista de operaciones** del backtest profundo de TradingView (CSV o XLSX). Un archivo por variante:

- `v02_base.csv`: todos los inputs en su valor base (obligatorio).
- `v02_<palanca>_<valor>.csv`: una sola palanca cambiada. Ejemplos: `v02_sl_450.csv`, `v02_be_55.csv`.

Después, en Claude Code:

> Usa el agente strategy-tester para analizar los exports de runs/

El agente escribe `RANKING.md` y `INFORME_<fecha>.md` en esta carpeta.
