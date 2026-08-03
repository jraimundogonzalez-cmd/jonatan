/** Win Rate (SPEC-001 §3.5, §4.1): `nº(R_final > 0) / N`. R = 0 (breakeven) nunca cuenta como ganadora. */
import { isPositive, percentFromDecimal, Decimal } from "../decimal/kernel.js";
import type { Percent, RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

export function calcularWinRate(muestra: readonly RValue[]): Result<QuantResult<Percent>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularWinRate requiere al menos 1 elemento" });
  }

  const ganadoras = muestra.filter((r) => isPositive(r)).length;
  const winRate = new Decimal(ganadoras).div(muestra.length).times(100);

  return ok(wrapExact(percentFromDecimal(winRate), "calcularWinRate", { n: muestra.length, ganadoras }));
}
