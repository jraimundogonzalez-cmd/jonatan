/**
 * Grupo B — resultado de una operación individual (SPEC-001 §3.4, §4.1).
 * Fórmula fuente: docs/02-modelo-matematico.md §2, corregida por el hallazgo
 * histórico de `R_cierre_resto` (12-demostracion-matematica.md §2).
 *
 * R_final = Σ_{i=1..k} p_i·RR_i + (100% − Σ_{i=1..k} p_i)·R_cierre_resto
 *
 * donde k = índice del último parcial realmente ejecutado (0 si ninguno), y
 * R_cierre_resto se deriva, en orden de prioridad:
 *   1. `cierre_manual_rr`, si el llamador lo aporta (dato observado, ver
 *      nota de corrección en core/types.ts) — tiene prioridad sobre 2 y 3.
 *   2. `rr_objetivo`, si `r_max ≥ rr_objetivo` (objetivo alcanzado).
 *   3. `0`, si `k ≥ 1` (breakeven tras el último parcial disparado).
 *   4. `-1`, si `k = 0` (stop original, pérdida total del riesgo asumido).
 */
import { Decimal, toDecimal, toDisplayString, isNegative, isZero, rvalueFromDecimal, moneyFromDecimal, percentFromDecimal } from "../decimal/kernel.js";
import type { Money, Percent, RValue, RFinalInput, ImpactoPorParcialItem } from "./types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

function echoInput(input: RFinalInput): Record<string, unknown> {
  return {
    riesgo_eur: toDisplayString(input.riesgo_eur),
    rr_objetivo: toDisplayString(input.rr_objetivo),
    parciales_ejecutados: input.parciales_ejecutados.map((p) => ({
      sequence: p.sequence,
      rr_level: toDisplayString(p.rr_level),
      pct_close: toDisplayString(p.pct_close),
      executed_at: p.executed_at,
    })),
    r_max: toDisplayString(input.r_max),
    be_trigger: input.be_trigger,
    cierre_manual_rr: input.cierre_manual_rr ? toDisplayString(input.cierre_manual_rr) : null,
  };
}

/** Valida la forma estructural del input — nunca calcula sobre datos inconsistentes en silencio (SPEC-001 §1.3). */
function validate(input: RFinalInput): QuantError | null {
  if (isNegative(input.riesgo_eur) || isZero(input.riesgo_eur)) {
    return { code: "OUT_OF_RANGE", field: "riesgo_eur", detail: "riesgo_eur debe ser > 0" };
  }

  let prevSequence = 0;
  let prevRrLevel = ZERO;
  let sumPct = ZERO;

  for (const p of input.parciales_ejecutados) {
    if (p.sequence !== prevSequence + 1) {
      return {
        code: "INVALID_PARTIAL_SEQUENCE",
        detail: `sequence debe ser consecutiva empezando en 1 (esperado ${prevSequence + 1}, recibido ${p.sequence})`,
      };
    }
    const rrLevel = toDecimal(p.rr_level);
    if (rrLevel.lte(prevRrLevel)) {
      return {
        code: "INVALID_PARTIAL_SEQUENCE",
        detail: `rr_level debe ser estrictamente creciente (parcial ${p.sequence})`,
      };
    }
    if (rrLevel.gt(toDecimal(input.r_max))) {
      return {
        code: "INCONSISTENT_TRIGGER_STATE",
        detail: `el parcial ${p.sequence} está marcado como ejecutado con rr_level=${toDisplayString(p.rr_level)} pero r_max=${toDisplayString(input.r_max)} nunca lo alcanzó`,
      };
    }
    const pct = toDecimal(p.pct_close);
    if (pct.lte(ZERO)) {
      return { code: "INVALID_PARTIAL_SEQUENCE", detail: `pct_close del parcial ${p.sequence} debe ser > 0` };
    }
    sumPct = sumPct.plus(pct);
    prevSequence = p.sequence;
    prevRrLevel = rrLevel;
  }

  if (sumPct.gt(HUNDRED)) {
    return { code: "PARTIALS_EXCEED_100_PCT", detail: `Σp_i = ${sumPct.toFixed(2)}% > 100%` };
  }

  if (input.cierre_manual_rr && toDecimal(input.cierre_manual_rr).gt(toDecimal(input.r_max))) {
    return {
      code: "INCONSISTENT_TRIGGER_STATE",
      detail: `cierre_manual_rr=${toDisplayString(input.cierre_manual_rr)} no puede superar r_max=${toDisplayString(input.r_max)}`,
    };
  }

  return null;
}

function calcularRCierreResto(input: RFinalInput, k: number): Decimal {
  if (input.cierre_manual_rr) {
    return toDecimal(input.cierre_manual_rr);
  }
  if (toDecimal(input.r_max).gte(toDecimal(input.rr_objetivo))) {
    return toDecimal(input.rr_objetivo);
  }
  if (k >= 1) {
    return ZERO;
  }
  return new Decimal(-1);
}

export function calcularRFinal(input: RFinalInput): Result<QuantResult<RValue>, QuantError> {
  const validationError = validate(input);
  if (validationError) return err(validationError);

  const k = input.parciales_ejecutados.length;
  const rCierreResto = calcularRCierreResto(input, k);

  let sumPartials = ZERO;
  let sumPct = ZERO;
  for (const p of input.parciales_ejecutados) {
    const pctFraction = toDecimal(p.pct_close).div(HUNDRED);
    sumPartials = sumPartials.plus(pctFraction.times(toDecimal(p.rr_level)));
    sumPct = sumPct.plus(toDecimal(p.pct_close));
  }

  const pRemanenteFraction = HUNDRED.minus(sumPct).div(HUNDRED);
  const rFinal = sumPartials.plus(pRemanenteFraction.times(rCierreResto));

  return ok(wrapExact(rvalueFromDecimal(rFinal), "calcularRFinal", echoInput(input), null));
}

export function calcularBeneficioReal(riesgoEur: Money, rFinal: RValue): QuantResult<Money> {
  const beneficio = toDecimal(riesgoEur).times(toDecimal(rFinal));
  return wrapExact(moneyFromDecimal(beneficio), "calcularBeneficioReal", {
    riesgo_eur: toDisplayString(riesgoEur),
    r_final: toDisplayString(rFinal),
  });
}

export function calcularBeneficioMaximo(riesgoEur: Money, rrObjetivo: RValue): QuantResult<Money> {
  const beneficio = toDecimal(riesgoEur).times(toDecimal(rrObjetivo));
  return wrapExact(moneyFromDecimal(beneficio), "calcularBeneficioMaximo", {
    riesgo_eur: toDisplayString(riesgoEur),
    rr_objetivo: toDisplayString(rrObjetivo),
  });
}

export function calcularBeneficioSacrificado(beneficioMaximo: Money, beneficioReal: Money): QuantResult<Money> {
  const sacrificado = toDecimal(beneficioMaximo).minus(toDecimal(beneficioReal));
  return wrapExact(moneyFromDecimal(sacrificado), "calcularBeneficioSacrificado", {
    beneficio_maximo: toDisplayString(beneficioMaximo),
    beneficio_real: toDisplayString(beneficioReal),
  });
}

export function calcularPorcentajeConservado(
  rFinal: RValue,
  rMax: RValue,
): Result<QuantResult<Percent>, QuantError> {
  if (isZero(rMax)) {
    return err({ code: "UNDEFINED_RATIO", reason: "ZERO_R_MAX", detail: "r_max = 0, %_beneficio_conservado no está definido" });
  }
  const ratio = toDecimal(rFinal).div(toDecimal(rMax)).times(HUNDRED);
  return ok(wrapExact(percentFromDecimal(ratio), "calcularPorcentajeConservado", {
    r_final: toDisplayString(rFinal),
    r_max: toDisplayString(rMax),
  }));
}

/**
 * Descomposición aditiva de `R_final` (SPEC-001 §4.1) — invariante de
 * property-test §6.2.4: la suma de todas las contribuciones debe ser
 * exactamente igual a `R_final`, sin pérdida ni sobra por redondeo.
 */
export function calcularImpactoPorParcial(
  input: RFinalInput,
  rFinal: RValue,
): Result<QuantResult<ImpactoPorParcialItem[]>, QuantError> {
  const validationError = validate(input);
  if (validationError) return err(validationError);

  const k = input.parciales_ejecutados.length;
  const rCierreResto = calcularRCierreResto(input, k);

  const items: ImpactoPorParcialItem[] = [];
  let sumPct = ZERO;
  for (const p of input.parciales_ejecutados) {
    const contribution = toDecimal(p.pct_close).div(HUNDRED).times(toDecimal(p.rr_level));
    items.push({ kind: "parcial", sequence: p.sequence, contribution: rvalueFromDecimal(contribution) });
    sumPct = sumPct.plus(toDecimal(p.pct_close));
  }
  const restoContribution = HUNDRED.minus(sumPct).div(HUNDRED).times(rCierreResto);
  items.push({ kind: "resto", contribution: rvalueFromDecimal(restoContribution) });

  return ok(
    wrapExact(items, "calcularImpactoPorParcial", {
      r_final: toDisplayString(rFinal),
      parciales_ejecutados: input.parciales_ejecutados.length,
    }),
  );
}
