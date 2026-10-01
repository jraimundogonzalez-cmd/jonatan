/**
 * Estado de drawdown (SPEC-001 §3.7, §4.1; fórmulas: 18 §2):
 *
 *   piso_estático  = initial_capital × (1 − max_total_drawdown_pct/100)
 *   piso_trailing  = peak_capital_basis × (1 − max_total_drawdown_pct/100)
 *   piso_vigente   = drawdown_type = "static" ? piso_estático : piso_trailing
 *
 *   Drawdown_restante_€ = current_capital − piso_vigente
 *   Drawdown_restante_% = Drawdown_restante_€ / current_capital × 100
 *
 * **Hallazgo de Challenge Mode**: "trailing" y "eod" comparten exactamente
 * la misma fórmula de `piso_vigente` — la única diferencia entre ambos es
 * qué valor de pico aporta el llamador (`peak_capital_basis`: continuo para
 * "trailing", anclado a cierre de día para "eod", 22 §151). Esta función
 * nunca decide cuál corresponde ni recalcula ningún pico — eso es Rule
 * Engine (19 regla 14, Calcular ≠ Juzgar, aplicado también a "qué dato usar",
 * no solo a "es aceptable el resultado").
 *
 * Nunca decide si `drawdown_restante` es aceptable (SPEC-001 §3.7) —
 * `formula_version: null`, es lectura/derivación aritmética de configuración.
 */
import { isZero, moneyFromDecimal, percentFromDecimal, toDecimal } from "../decimal/kernel.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import type { DrawdownState, DrawdownStateInput } from "./types.js";

const HUNDRED = 100;

export function calcularDrawdownState(input: DrawdownStateInput): Result<QuantResult<DrawdownState>, QuantError> {
  const pct = toDecimal(input.max_total_drawdown_pct);
  if (pct.isNegative() || pct.gt(HUNDRED)) {
    return err({
      code: "OUT_OF_RANGE",
      field: "max_total_drawdown_pct",
      detail: "max_total_drawdown_pct debe estar entre 0 y 100",
    });
  }

  if (input.drawdown_type !== "static" && !input.peak_capital_basis) {
    return err({
      code: "OUT_OF_RANGE",
      field: "peak_capital_basis",
      detail: `peak_capital_basis es obligatorio cuando drawdown_type = "${input.drawdown_type}"`,
    });
  }

  if (isZero(input.current_capital)) {
    return err({
      code: "UNDEFINED_RATIO",
      reason: "ZERO_CAPITAL",
      detail: "current_capital = 0 — drawdown_restante_pct no está definido",
    });
  }

  const factorRestante = toDecimal(input.max_total_drawdown_pct).neg().div(HUNDRED).plus(1); // (1 − pct/100)
  const base =
    input.drawdown_type === "static" ? toDecimal(input.initial_capital) : toDecimal(input.peak_capital_basis!);

  const pisoVigente = base.times(factorRestante);
  const drawdownRestanteEur = toDecimal(input.current_capital).minus(pisoVigente);
  const drawdownRestantePct = drawdownRestanteEur.div(toDecimal(input.current_capital)).times(HUNDRED);

  const resultado: DrawdownState = {
    piso_vigente: moneyFromDecimal(pisoVigente),
    drawdown_restante_eur: moneyFromDecimal(drawdownRestanteEur),
    drawdown_restante_pct: percentFromDecimal(drawdownRestantePct),
  };

  return ok(
    wrapExact(resultado, "calcularDrawdownState", {
      drawdown_type: input.drawdown_type,
      current_capital: input.current_capital.raw.toFixed(input.current_capital.scale),
      initial_capital: input.initial_capital.raw.toFixed(input.initial_capital.scale),
      peak_capital_basis: input.peak_capital_basis?.raw.toFixed(input.peak_capital_basis.scale) ?? null,
      max_total_drawdown_pct: input.max_total_drawdown_pct.raw.toFixed(input.max_total_drawdown_pct.scale),
    }),
  );
}
