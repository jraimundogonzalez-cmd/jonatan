/** Profit Factor (SPEC-001 §3.5, §4.1): `Σ ganancias / |Σ pérdidas|`. */
import { Decimal, toDecimal, rvalueFromDecimal } from "../decimal/kernel.js";
import type { Money, RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

export function calcularProfitFactor(muestra: readonly Money[]): Result<QuantResult<RValue>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularProfitFactor requiere al menos 1 elemento" });
  }

  let ganancias = new Decimal(0);
  let perdidas = new Decimal(0);
  for (const beneficio of muestra) {
    const valor = toDecimal(beneficio);
    if (valor.isPositive() && !valor.isZero()) {
      ganancias = ganancias.plus(valor);
    } else if (valor.isNegative()) {
      perdidas = perdidas.plus(valor);
    }
  }

  if (perdidas.isZero()) {
    return err({
      code: "UNDEFINED_RATIO",
      reason: "ZERO_LOSSES",
      detail: "no hay pérdidas en la muestra — el Profit Factor no está definido (nunca Infinity)",
    });
  }

  const profitFactor = ganancias.div(perdidas.abs());
  return ok(wrapExact(rvalueFromDecimal(profitFactor), "calcularProfitFactor", { n: muestra.length }));
}
