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

export function echoInput(input: RFinalInput): Record<string, unknown> {
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

interface RFinalDecomposition {
  readonly parciales: ReadonlyArray<{ readonly sequence: 1 | 2 | 3 | 4 | 5; readonly contribution: Decimal }>;
  readonly resto: Decimal;
}

/**
 * Descompone `R_final` en sus contribuciones aditivas (un término por
 * parcial ejecutado + el término del resto) — **hallazgo de Challenge Mode**:
 * antes de esta refactorización, `computeRFinal` y `calcularImpactoPorParcial`
 * recorrían `parciales_ejecutados` por separado calculando la misma expresión
 * (`pct_close/100 × rr_level`) cada una por su cuenta — la misma clase de
 * "formula drift" que SPEC-001 §Riesgos #1 previene en general, aquí
 * encontrada en la práctica entre dos funciones del propio catálogo. Ambas
 * funciones pliegan/reexponen ahora esta única descomposición.
 */
function decomposeRFinal(input: RFinalInput): RFinalDecomposition {
  const k = input.parciales_ejecutados.length;
  const rCierreResto = calcularRCierreResto(input, k);

  let sumPct = ZERO;
  const parciales = input.parciales_ejecutados.map((p) => {
    const contribution = toDecimal(p.pct_close).div(HUNDRED).times(toDecimal(p.rr_level));
    sumPct = sumPct.plus(toDecimal(p.pct_close));
    return { sequence: p.sequence, contribution };
  });

  const resto = HUNDRED.minus(sumPct).div(HUNDRED).times(rCierreResto);
  return { parciales, resto };
}

/**
 * Cálculo puro de `R_final`, sin el envelope `QuantResult` — punto único
 * reutilizado por `calcularRFinal` y por `simularGestion` (Grupo F,
 * simulation/simular-gestion.ts). "Simular" es "calcular sin persistir"
 * (SPEC-001 §3.8) — nunca una segunda implementación de la fórmula, solo un
 * `formula_id` distinto en el envelope público.
 */
export function computeRFinal(input: RFinalInput): Result<Decimal, QuantError> {
  const validationError = validate(input);
  if (validationError) return err(validationError);

  const { parciales, resto } = decomposeRFinal(input);
  const rFinal = parciales.reduce((acc, p) => acc.plus(p.contribution), ZERO).plus(resto);

  return ok(rFinal);
}

export function calcularRFinal(input: RFinalInput): Result<QuantResult<RValue>, QuantError> {
  const result = computeRFinal(input);
  if (!result.ok) return result;

  return ok(wrapExact(rvalueFromDecimal(result.value), "calcularRFinal", echoInput(input), null));
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

  const { parciales, resto } = decomposeRFinal(input);

  const items: ImpactoPorParcialItem[] = parciales.map((p) => ({
    kind: "parcial",
    sequence: p.sequence,
    contribution: rvalueFromDecimal(p.contribution),
  }));
  items.push({ kind: "resto", contribution: rvalueFromDecimal(resto) });

  return ok(
    wrapExact(items, "calcularImpactoPorParcial", {
      r_final: toDisplayString(rFinal),
      parciales_ejecutados: input.parciales_ejecutados.length,
    }),
  );
}
