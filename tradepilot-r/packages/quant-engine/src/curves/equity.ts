/**
 * Curva de equity (SPEC-001 §3.6, §4.1): `Equity_t = Σ_{j≤t} valor_j`.
 * Genérica sobre `EquityBrand` — ver la nota de corrección en `types.ts`
 * sobre por qué ya no recibe un parámetro `unidad` separado.
 *
 * Requiere `muestra_ordenada` estrictamente creciente en el tiempo (SPEC-001
 * §3.6/§4.3 punto 5) — nunca reordena en silencio; un orden no creciente es
 * un dato de entrada inconsistente, no una decisión de negocio de este
 * componente.
 */
import { Decimal, toDecimal, wrap, type FixedDecimal } from "../decimal/kernel.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import type { EquityBrand, TimeSeries, TimeSeriesPoint } from "./types.js";

export function calcularCurvaEquity<Brand extends EquityBrand>(
  muestraOrdenada: TimeSeries<FixedDecimal<Brand>>,
): Result<QuantResult<TimeSeries<FixedDecimal<Brand>>>, QuantError> {
  if (muestraOrdenada.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularCurvaEquity requiere al menos 1 punto" });
  }

  let prevTimestampMs: number | null = null;
  let acumulado = new Decimal(0);
  const serie: TimeSeriesPoint<FixedDecimal<Brand>>[] = [];

  for (const punto of muestraOrdenada) {
    const timestampMs = new Date(punto.timestamp).getTime();
    if (prevTimestampMs !== null && timestampMs <= prevTimestampMs) {
      return err({
        code: "INCONSISTENT_TRIGGER_STATE",
        detail: `timestamps no estrictamente crecientes en "${punto.timestamp}"`,
      });
    }

    acumulado = acumulado.plus(toDecimal(punto.value));
    serie.push({ timestamp: punto.timestamp, value: wrap(punto.value.brand, acumulado) });
    prevTimestampMs = timestampMs;
  }

  return ok(wrapExact(serie, "calcularCurvaEquity", { n: muestraOrdenada.length }));
}
