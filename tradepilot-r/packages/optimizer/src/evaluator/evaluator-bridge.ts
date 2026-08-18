/**
 * `evaluator-bridge` (SPEC-005 §3.1/§3.3) — traduce y delega, nunca calcula.
 * Cada número que sale de aquí proviene literalmente de una llamada a
 * `@tradepilot/quant-engine`; este archivo no contiene ni una sola fórmula del
 * catálogo de SPEC-001 (verificación de §13.1 a nivel de código).
 *
 * Consumo directo de Quant Engine, sin pasar por Risk Engine — confirmado en
 * SPEC-005 §3.3: las evaluaciones son siempre hipotéticas y efímeras, nunca
 * datos reales que requieran la capa de persistencia de Risk Engine.
 */
import {
  calcularBeneficioReal,
  calcularCurvaEquity,
  calcularDesviacionR,
  calcularDrawdownHistorico,
  calcularEsperanza,
  calcularRatioConsistencia,
  calcularRecoveryFactor,
  calcularScore,
  simularGestion,
} from "@tradepilot/quant-engine";
import type { Money, ParcialEjecutado, QuantResult, RFinalInput, RValue } from "@tradepilot/quant-engine";
import type { HistoricalTrade, ObjectiveMetric, OptimizerError, Scenario } from "../domain/types.js";
import { esMayor } from "./kernel.js";

/**
 * Evidencia de una métrica: el valor comparable más el envelope original que
 * Quant Engine produjo, sin alterar. §10.2 tipaba `QuantResult<RValue>[]`
 * asumiendo que toda métrica es un escalar `RValue`; `drawdown` no lo es (su
 * envelope envuelve `DrawdownHistoricoResult`), así que se conserva el
 * envelope real en vez de fabricar uno nuevo — nunca se reconstruye un
 * `QuantResult` fuera de Quant Engine.
 */
export interface MetricEvidence {
  readonly metric: ObjectiveMetric;
  readonly value: RValue;
  readonly quant_result: QuantResult<unknown>;
}

export interface SampleEvaluation {
  readonly values: Readonly<Partial<Record<ObjectiveMetric, RValue>>>;
  readonly evidence: readonly MetricEvidence[];
  /** Muestra de `R_final` sobre la que se calcularon las métricas. */
  readonly muestra: readonly RValue[];
}

function quantError(detail: string): OptimizerError {
  return { code: "QUANT_ENGINE_ERROR", detail };
}

/**
 * Ordena el Trade Set por `closed_at` real ascendente — requisito de
 * `calcularCurvaEquity`, que exige timestamps estrictamente crecientes. El
 * orden proviene del dato real de cada Operación, nunca de un índice
 * sintético.
 */
export function ordenarCronologicamente(trades: readonly HistoricalTrade[]): readonly HistoricalTrade[] {
  return [...trades].sort((a, b) => (a.closed_at < b.closed_at ? -1 : a.closed_at > b.closed_at ? 1 : 0));
}

/**
 * Aplica un Scenario hipotético sobre el `r_max` real de cada Operación
 * (SPEC-011 §5.1, mismo procedimiento; 12 §6 lo demuestra numéricamente).
 *
 * Qué parciales se consideran ejecutados: exactamente los planificados cuyo
 * `rr_level ≤ r_max`. No es una regla nueva — es el mismo predicado que
 * `calcularRFinal` ya usa para rechazar un estado imposible
 * (`INCONSISTENT_TRIGGER_STATE`, SPEC-001 §3.3) y el que 12 §6 aplica en su
 * demostración (`triggered(0.8≥2)=0`). Como los planificados vienen
 * ordenados y con `rr_level` estrictamente creciente, el filtro conserva
 * siempre un prefijo, así que las `sequence` siguen siendo consecutivas
 * desde 1 tal como exige la validación de Quant Engine.
 */
export function simularCandidataSobreHistorial(
  scenario: Scenario,
  trades: readonly HistoricalTrade[],
): { readonly ok: true; readonly muestra: readonly RValue[] } | { readonly ok: false; readonly error: OptimizerError } {
  const muestra: RValue[] = [];

  for (const trade of trades) {
    const ejecutados: ParcialEjecutado[] = scenario.parciales_planificados
      .filter((p) => !esMayor(p.rr_level, trade.r_max))
      .map((p) => ({
        sequence: p.sequence,
        rr_level: p.rr_level,
        pct_close: p.pct_close,
        // Dato real de la Operación — nunca un timestamp inventado. No
        // participa en la aritmética de R_final, solo en `inputs_echo`.
        executed_at: trade.closed_at,
      }));

    const input: RFinalInput = {
      riesgo_eur: trade.risk_amount,
      rr_objetivo: scenario.rr_objetivo,
      parciales_ejecutados: ejecutados,
      r_max: trade.r_max,
      be_trigger: scenario.be_trigger,
    };

    const resultado = simularGestion(input);
    if (!resultado.ok) return { ok: false, error: quantError(`simularGestion: ${resultado.error.code}`) };
    muestra.push(resultado.value.value);
  }

  return { ok: true, muestra };
}

/**
 * Calcula únicamente las métricas solicitadas sobre una muestra de `R_final`
 * — real (baseline) o hipotética (candidata). Quant Engine no distingue entre
 * ambas, por diseño (26 §1), así que es exactamente la misma función.
 */
export function evaluarMuestra(
  muestra: readonly RValue[],
  trades: readonly HistoricalTrade[],
  metricas: ReadonlySet<ObjectiveMetric>,
  lambda: RValue | undefined,
): { readonly ok: true; readonly value: SampleEvaluation } | { readonly ok: false; readonly error: OptimizerError } {
  const values: Partial<Record<ObjectiveMetric, RValue>> = {};
  const evidence: MetricEvidence[] = [];

  const push = (metric: ObjectiveMetric, value: RValue, quant_result: QuantResult<unknown>): void => {
    values[metric] = value;
    evidence.push({ metric, value, quant_result });
  };

  if (metricas.has("expectancy")) {
    const r = calcularEsperanza(muestra);
    if (!r.ok) return { ok: false, error: quantError(`calcularEsperanza: ${r.error.code}`) };
    push("expectancy", r.value.value, r.value);
  }

  if (metricas.has("consistency_ratio")) {
    const r = calcularRatioConsistencia(muestra);
    if (!r.ok) return { ok: false, error: quantError(`calcularRatioConsistencia: ${r.error.code}`) };
    push("consistency_ratio", r.value.value, r.value);
  }

  if (metricas.has("score")) {
    if (!lambda) return { ok: false, error: { code: "MISSING_LAMBDA_FOR_SCORE_OBJECTIVE" } };
    const r = calcularScore({ muestra_r_final_candidata: muestra, lambda });
    if (!r.ok) return { ok: false, error: quantError(`calcularScore: ${r.error.code}`) };
    push("score", r.value.value, r.value);
  }

  if (metricas.has("drawdown")) {
    const curva = calcularCurvaEquity(muestra.map((value, i) => ({ timestamp: trades[i]!.closed_at, value })));
    if (!curva.ok) return { ok: false, error: quantError(`calcularCurvaEquity: ${curva.error.code}`) };
    const dd = calcularDrawdownHistorico(curva.value.value);
    if (!dd.ok) return { ok: false, error: quantError(`calcularDrawdownHistorico: ${dd.error.code}`) };
    push("drawdown", dd.value.value.max_drawdown, dd.value);
  }

  if (metricas.has("recovery_factor")) {
    // Beneficio en Money por Operación: riesgo real congelado × R_final.
    const serieMoney = muestra.map((rFinal, i) => ({
      timestamp: trades[i]!.closed_at,
      value: calcularBeneficioReal(trades[i]!.risk_amount, rFinal).value as Money,
    }));
    const curvaMoney = calcularCurvaEquity(serieMoney);
    if (!curvaMoney.ok) return { ok: false, error: quantError(`calcularCurvaEquity(Money): ${curvaMoney.error.code}`) };
    const puntos = curvaMoney.value.value;
    const beneficioNeto = puntos[puntos.length - 1]!.value;
    const ddMoney = calcularDrawdownHistorico(puntos);
    if (!ddMoney.ok) return { ok: false, error: quantError(`calcularDrawdownHistorico(Money): ${ddMoney.error.code}`) };
    const rf = calcularRecoveryFactor(beneficioNeto, ddMoney.value.value.max_drawdown);
    if (!rf.ok) return { ok: false, error: quantError(`calcularRecoveryFactor: ${rf.error.code}`) };
    push("recovery_factor", rf.value.value, rf.value);
  }

  return { ok: true, value: { values, evidence, muestra } };
}

/** Desviación de una muestra — usada solo para `variance_delta` (§10.2). */
export function desviacionDeMuestra(
  muestra: readonly RValue[],
): { readonly ok: true; readonly value: RValue } | { readonly ok: false; readonly error: OptimizerError } {
  const r = calcularDesviacionR(muestra);
  if (!r.ok) return { ok: false, error: quantError(`calcularDesviacionR: ${r.error.code}`) };
  return { ok: true, value: r.value.value };
}
