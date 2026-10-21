/**
 * Ratio de consistencia (SPEC-001 §3.5, §4.1): `E[R] / σ[R]` — compone
 * `calcularEsperanza`/`calcularDesviacionR`, nunca reimplementa ninguna de
 * las dos fórmulas (§8.3).
 *
 * **Hallazgo de Challenge Mode, más allá de lo que SPEC-001 §6.3 catalogaba**:
 * el catálogo solo previene la división por cero para `N = 1` (varianza no
 * definida). Pero con `N ≥ 2`, si **todos** los valores de la muestra son
 * idénticos, `σ[R] = 0` exactamente — una muestra real y posible (un trader
 * con un plan de gestión 100% mecánico podría producir el mismo R en varias
 * operaciones) que habría producido una división por cero real si solo se
 * comprobara `N = 1`. Se cubre aquí con el mismo `reason: "ZERO_VARIANCE"`
 * (la causa raíz es la misma — varianza cero — solo cambia el disparador).
 */
import { isZero, toDecimal, rvalueFromDecimal } from "../decimal/kernel.js";
import type { RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import { calcularDesviacionR } from "./welford.js";
import { calcularEsperanza } from "./welford.js";

export function calcularRatioConsistencia(muestra: readonly RValue[]): Result<QuantResult<RValue>, QuantError> {
  const esperanzaResult = calcularEsperanza(muestra);
  if (!esperanzaResult.ok) return esperanzaResult;

  const desviacionResult = calcularDesviacionR(muestra);
  if (!desviacionResult.ok) return desviacionResult;

  if (isZero(desviacionResult.value.value)) {
    return err({
      code: "UNDEFINED_RATIO",
      reason: "ZERO_VARIANCE",
      detail: "σ[R] = 0 — todos los valores de la muestra son idénticos, el ratio no está definido",
    });
  }

  const ratio = toDecimal(esperanzaResult.value.value).div(toDecimal(desviacionResult.value.value));
  return ok(wrapExact(rvalueFromDecimal(ratio), "calcularRatioConsistencia", { n: muestra.length }));
}
