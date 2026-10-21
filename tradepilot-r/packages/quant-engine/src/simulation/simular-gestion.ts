/**
 * `simularGestion` — idéntica firma que `calcularRFinal` (SPEC-001 §3.8):
 * "simular" es "calcular sin persistir". Reutiliza el cálculo interno de
 * `core/r-final.ts` (`computeRFinal`), nunca una segunda copia de la
 * fórmula — solo cambia el `formula_id` del envelope público, para que
 * quien consuma el resultado (Optimizer) sepa que provino de una simulación.
 */
import { rvalueFromDecimal } from "../decimal/kernel.js";
import { computeRFinal, echoInput } from "../core/r-final.js";
import type { RFinalInput, RValue } from "../core/types.js";
import { ok, type QuantError, type Result } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

export function simularGestion(input: RFinalInput): Result<QuantResult<RValue>, QuantError> {
  const result = computeRFinal(input);
  if (!result.ok) return result;

  return ok(wrapExact(rvalueFromDecimal(result.value), "simularGestion", echoInput(input), null));
}
