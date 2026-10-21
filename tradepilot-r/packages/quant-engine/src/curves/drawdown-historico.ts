/**
 * Drawdown histórico (SPEC-001 §3.6, §4.1): `Drawdown_t = Equity_t − max_{s≤t}(Equity_s)`.
 * Un solo paso de máximo corriente (running max), O(N). `max_drawdown = 0`
 * para una curva siempre creciente es un resultado válido, no un error — el
 * error `ZERO_DRAWDOWN` pertenece a `calcularRecoveryFactor`, que sí necesita
 * dividir por este valor; aquí es simplemente el resultado correcto.
 */
import { Decimal, toDecimal, wrap, type FixedDecimal } from "../decimal/kernel.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import type { EquityBrand, TimeSeries, TimeSeriesPoint } from "./types.js";

export interface DrawdownHistoricoResult<Brand extends EquityBrand> {
  readonly serie: TimeSeries<FixedDecimal<Brand>>;
  readonly max_drawdown: FixedDecimal<Brand>;
}

export function calcularDrawdownHistorico<Brand extends EquityBrand>(
  curvaEquity: TimeSeries<FixedDecimal<Brand>>,
): Result<QuantResult<DrawdownHistoricoResult<Brand>>, QuantError> {
  if (curvaEquity.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularDrawdownHistorico requiere al menos 1 punto" });
  }

  const brand = curvaEquity[0]!.value.brand;
  let runningMax = toDecimal(curvaEquity[0]!.value);
  let maxDrawdown = new Decimal(0);
  const serie: TimeSeriesPoint<FixedDecimal<Brand>>[] = [];

  for (const punto of curvaEquity) {
    const equity = toDecimal(punto.value);
    if (equity.gt(runningMax)) runningMax = equity;

    const drawdown = equity.minus(runningMax);
    if (drawdown.lt(maxDrawdown)) maxDrawdown = drawdown;

    serie.push({ timestamp: punto.timestamp, value: wrap(brand, drawdown) });
  }

  return ok(
    wrapExact(
      { serie, max_drawdown: wrap(brand, maxDrawdown) },
      "calcularDrawdownHistorico",
      { n: curvaEquity.length },
    ),
  );
}
