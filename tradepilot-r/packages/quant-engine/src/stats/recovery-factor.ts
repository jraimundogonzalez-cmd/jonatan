/** Recovery Factor (SPEC-001 §3.5, §4.1): `Beneficio_neto / |Max_Drawdown|`. */
import { toDecimal, rvalueFromDecimal, isZero } from "../decimal/kernel.js";
import type { Money, RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

export function calcularRecoveryFactor(
  beneficioNeto: Money,
  maxDrawdown: Money,
): Result<QuantResult<RValue>, QuantError> {
  if (isZero(maxDrawdown)) {
    return err({
      code: "UNDEFINED_RATIO",
      reason: "ZERO_DRAWDOWN",
      detail: "max_drawdown = 0 — el Recovery Factor no está definido (nunca Infinity)",
    });
  }

  const recoveryFactor = toDecimal(beneficioNeto).div(toDecimal(maxDrawdown).abs());
  return ok(
    wrapExact(rvalueFromDecimal(recoveryFactor), "calcularRecoveryFactor", {
      beneficio_neto: beneficioNeto.raw.toFixed(beneficioNeto.scale),
      max_drawdown: maxDrawdown.raw.toFixed(maxDrawdown.scale),
    }),
  );
}
