/**
 * `calcularScore` (SPEC-001 §3.8, §4.1): `Score = E[R_final|c] − λ·σ[R_final|c]`.
 * Compone `calcularEsperanza`/`calcularDesviacionR` (Grupo C), nunca
 * reimplementa ninguna de las dos (§8.3). Única función versionada del
 * catálogo (`formula_version: "score.v1"`) — es una decisión de diseño
 * ajustable, no aritmética fija (SPEC-001 §4.5).
 *
 * Evalúa **una** configuración candidata — la búsqueda entre miles de
 * candidatas es responsabilidad del Optimizer, nunca de esta función
 * (SPEC-001 §3.8, hallazgo §8.4: fuerza bruta exhaustiva no es viable).
 */
import { toDecimal, rvalueFromDecimal } from "../decimal/kernel.js";
import { calcularDesviacionR, calcularEsperanza } from "../stats/welford.js";
import type { RValue } from "../core/types.js";
import { ok, type QuantError, type Result } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import type { ScoreInput } from "./types.js";

const SCORE_FORMULA_VERSION = "score.v1";

export function calcularScore(input: ScoreInput): Result<QuantResult<RValue>, QuantError> {
  const esperanzaResult = calcularEsperanza(input.muestra_r_final_candidata);
  if (!esperanzaResult.ok) return esperanzaResult;

  const desviacionResult = calcularDesviacionR(input.muestra_r_final_candidata);
  if (!desviacionResult.ok) return desviacionResult;

  const score = toDecimal(esperanzaResult.value.value).minus(
    toDecimal(input.lambda).times(toDecimal(desviacionResult.value.value)),
  );

  return ok(
    wrapExact(
      rvalueFromDecimal(score),
      "calcularScore",
      { n: input.muestra_r_final_candidata.length, lambda: input.lambda.raw.toFixed(input.lambda.scale) },
      SCORE_FORMULA_VERSION,
    ),
  );
}
