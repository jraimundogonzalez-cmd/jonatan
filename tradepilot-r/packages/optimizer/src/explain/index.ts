/**
 * `explain` (SPEC-005 §10) — construye el "¿Por qué?" de cada ganadora.
 *
 * **Ninguna palabra ni número de esta estructura se genera sin un dato real
 * detrás** (§10.2): cada valor procede de un `QuantResult` de Quant Engine o
 * de una resta/cociente exacto entre dos de ellos. El redactado en lenguaje
 * natural es responsabilidad de AI Engine, que consume esta estructura —
 * nunca la sustituye por una narrativa sin respaldo numérico.
 *
 * Se explica el **resultado**, no el proceso de búsqueda (§10.1): por qué
 * esta configuración es mejor que la que ya usa el trader, con las mismas
 * métricas objetivas para cualquier estrategia presente o futura.
 */
import type { Percent, RValue } from "@tradepilot/quant-engine";
import type { HistoricalTrade, Objective, ObjectiveMetric, Scenario } from "../domain/types.js";
import type { MetricEvidence, SampleEvaluation } from "../evaluator/evaluator-bridge.js";
import { compararR, porcentajeDeConteo, restarR } from "../evaluator/kernel.js";

export interface ComparacionPorObjetivo {
  readonly delta_per_objective: Readonly<Partial<Record<ObjectiveMetric, RValue>>>;
}

export interface OptimizationExplanation {
  readonly candidate: Scenario;
  /** Evidencia cruda de Quant Engine, sin reconstruir ningún envelope. */
  readonly metrics: readonly MetricEvidence[];
  readonly comparison_vs_baseline: {
    readonly baseline: "trader_actual_behavior";
    readonly delta_per_objective: Readonly<Partial<Record<ObjectiveMetric, RValue>>>;
  };
  readonly comparison_vs_runner_up?: ComparacionPorObjetivo;
  /** % de Operaciones del historial cuyo `R_final` habría mejorado (02 §5.3). */
  readonly pct_of_historical_trades_that_would_improve: Percent;
  /** Varianza adicional (o menos) que introduce la candidata (02 §5.3). */
  readonly variance_delta: RValue;
  /**
   * Tamaño real de la muestra que respalda la recomendación. Nunca se
   * traduce aquí a una etiqueta cualitativa ("Alta/Media/Baja"): calificar la
   * suficiencia estadística es competencia de Knowledge Engine (SPEC-006),
   * no de Optimizer. Exponer `n` crudo cumple "nunca ocultar incertidumbre"
   * sin invadir otro motor ni inventar un criterio propio.
   */
  readonly evidence_sample_size: number;
}

function deltas(
  candidata: SampleEvaluation,
  referencia: SampleEvaluation,
  objetivos: readonly Objective[],
): Readonly<Partial<Record<ObjectiveMetric, RValue>>> {
  const out: Partial<Record<ObjectiveMetric, RValue>> = {};
  for (const objetivo of objetivos) {
    const a = candidata.values[objetivo.metric];
    const b = referencia.values[objetivo.metric];
    if (a && b) out[objetivo.metric] = restarR(a, b);
  }
  return out;
}

/** Cuenta las Operaciones en las que el `R_final` hipotético supera al real. */
function contarMejoras(hipotetica: readonly RValue[], real: readonly RValue[]): number {
  let mejoras = 0;
  for (let i = 0; i < hipotetica.length; i++) {
    if (compararR(hipotetica[i]!, real[i]!) > 0) mejoras += 1;
  }
  return mejoras;
}

export function construirExplicacion(params: {
  readonly scenario: Scenario;
  readonly candidata: SampleEvaluation;
  readonly baseline: SampleEvaluation;
  readonly runnerUp: SampleEvaluation | null;
  readonly objetivos: readonly Objective[];
  readonly desviacionCandidata: RValue;
  readonly desviacionBaseline: RValue;
  readonly trades: readonly HistoricalTrade[];
}): OptimizationExplanation {
  const mejoras = contarMejoras(params.candidata.muestra, params.baseline.muestra);

  return {
    candidate: params.scenario,
    metrics: params.candidata.evidence,
    comparison_vs_baseline: {
      baseline: "trader_actual_behavior",
      delta_per_objective: deltas(params.candidata, params.baseline, params.objetivos),
    },
    ...(params.runnerUp
      ? { comparison_vs_runner_up: { delta_per_objective: deltas(params.candidata, params.runnerUp, params.objetivos) } }
      : {}),
    pct_of_historical_trades_that_would_improve: porcentajeDeConteo(mejoras, params.trades.length),
    variance_delta: restarR(params.desviacionCandidata, params.desviacionBaseline),
    evidence_sample_size: params.trades.length,
  };
}
