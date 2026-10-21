/**
 * Orquestador (SPEC-005 §7). Domain Service **puro**: sin estado propio, sin
 * caché global, sin persistencia, sin efectos secundarios (21.5 §6).
 * `OptimizationResult` es un valor de retorno — Optimizer nunca escribe en
 * Management Plans ni en ningún otro módulo (I17 por construcción de tipos,
 * §13.4).
 */
import type { Result } from "@tradepilot/quant-engine";
import type { OptimizationProblem, OptimizerError } from "./domain/types.js";
import { metricasNecesarias, esViable, seleccionar } from "./comparator/index.js";
import {
  desviacionDeMuestra,
  evaluarMuestra,
  ordenarCronologicamente,
  simularCandidataSobreHistorial,
  type SampleEvaluation,
} from "./evaluator/evaluator-bridge.js";
import { construirExplicacion, type OptimizationExplanation } from "./explain/index.js";
import { buscarEstrategiaAprobada } from "./search/registry.js";
import type { EvaluatedCandidate } from "./search/SearchStrategy.js";

export interface OptimizationResult {
  readonly winners: readonly OptimizationExplanation[];
  readonly strategy_id: string;
  readonly strategy_version: string;
  readonly seed: number;
  readonly evaluations_consumed: number;
}

function validarProblema(problem: OptimizationProblem): OptimizerError | null {
  if (problem.bootstrap_trade_set.length === 0) return { code: "EMPTY_BOOTSTRAP_SAMPLE" };
  if (problem.objectives.length === 0) {
    return { code: "INVALID_SCENARIO_SPACE", detail: "se requiere al menos un objetivo" };
  }
  if (problem.evaluation_budget <= 0) {
    return { code: "INVALID_SCENARIO_SPACE", detail: "evaluation_budget debe ser > 0" };
  }
  const space = problem.base_scenario_space;
  if (space.max_partials < 0 || space.max_partials > 5) {
    return { code: "INVALID_SCENARIO_SPACE", detail: "max_partials debe estar entre 0 y 5" };
  }
  if (space.be_triggers.length === 0) {
    return { code: "INVALID_SCENARIO_SPACE", detail: "be_triggers no puede estar vacío" };
  }

  const usaScore =
    problem.objectives.some((o) => o.metric === "score") || problem.constraints.some((c) => c.metric === "score");
  if (usaScore && !problem.lambda) return { code: "MISSING_LAMBDA_FOR_SCORE_OBJECTIVE" };

  return null;
}

export function optimizar(
  problem: OptimizationProblem,
  strategy_id: string,
  seed: number,
): Result<OptimizationResult, OptimizerError> {
  const registro = buscarEstrategiaAprobada(strategy_id);
  if (!registro) return { ok: false, error: { code: "STRATEGY_NOT_APPROVED", strategy_id } };

  const errorProblema = validarProblema(problem);
  if (errorProblema) return { ok: false, error: errorProblema };

  const trades = ordenarCronologicamente(problem.bootstrap_trade_set);
  const metricas = metricasNecesarias(problem.objectives, problem.constraints);

  // Baseline = la gestión real observada. Si no puede evaluarse, la
  // optimización falla de forma honesta en vez de emitir una explicación sin
  // comparación — mostrar un subconjunto de métricas "elegido por
  // conveniencia" está prohibido por SPEC-014 §4.3.
  const baseline = evaluarMuestra(trades.map((t) => t.r_final), trades, metricas, problem.lambda);
  if (!baseline.ok) return { ok: false, error: baseline.error };

  const desviacionBaseline = desviacionDeMuestra(baseline.value.muestra);
  if (!desviacionBaseline.ok) return { ok: false, error: desviacionBaseline.error };

  const evaluaciones = new Map<number, SampleEvaluation>();
  /**
   * Registro propio del orquestador. La estrategia mantiene el suyo en su
   * `TState` para poder aprender, pero el orquestador nunca lo inspecciona —
   * hacerlo acoplaría el núcleo a la forma interna de cada estrategia y
   * rompería el Open/Closed que §3.2 protege.
   */
  const todasLasCandidatas: EvaluatedCandidate[] = [];
  const strategy = registro.strategy;
  let state: unknown = strategy.initState(problem, seed);
  let indice = 0;

  while (!strategy.isDone(state)) {
    const candidatas = strategy.ask(state);
    if (candidatas.length === 0) break;

    const evaluadas: EvaluatedCandidate[] = [];
    for (const scenario of candidatas) {
      const evaluationIndex = indice++;
      const simulada = simularCandidataSobreHistorial(scenario, trades);

      if (!simulada.ok) {
        // Candidata no evaluable: se excluye, nunca se puntúa con un valor
        // inventado ni se penaliza numéricamente (§4.3).
        evaluadas.push({ scenario, evaluation_index: evaluationIndex, objective_values: {}, feasible: false });
        continue;
      }

      const evaluada = evaluarMuestra(simulada.muestra, trades, metricas, problem.lambda);
      if (!evaluada.ok) {
        evaluadas.push({ scenario, evaluation_index: evaluationIndex, objective_values: {}, feasible: false });
        continue;
      }

      evaluaciones.set(evaluationIndex, evaluada.value);
      const candidata: EvaluatedCandidate = {
        scenario,
        evaluation_index: evaluationIndex,
        objective_values: evaluada.value.values,
        feasible: true,
      };
      evaluadas.push({ ...candidata, feasible: esViable(candidata, problem.constraints) });
    }

    todasLasCandidatas.push(...evaluadas);
    state = strategy.tell(state, evaluadas);
  }

  const viables = todasLasCandidatas.filter((c) => c.feasible);
  const ganadoras = seleccionar(viables, problem.objectives);
  if (ganadoras.length === 0) {
    return {
      ok: false,
      error: {
        code: "NO_FEASIBLE_CANDIDATE",
        detail: `ninguna de las ${indice} candidatas evaluadas satisface todas las restricciones`,
      },
    };
  }

  const winners: OptimizationExplanation[] = [];
  for (let i = 0; i < ganadoras.length; i++) {
    const ganadora = ganadoras[i]!;
    const evaluacion = evaluaciones.get(ganadora.evaluation_index)!;
    const desviacionCandidata = desviacionDeMuestra(evaluacion.muestra);
    if (!desviacionCandidata.ok) return { ok: false, error: desviacionCandidata.error };

    const siguiente = ganadoras[i + 1];
    const runnerUp = siguiente ? evaluaciones.get(siguiente.evaluation_index) ?? null : null;

    winners.push(
      construirExplicacion({
        scenario: ganadora.scenario,
        candidata: evaluacion,
        baseline: baseline.value,
        runnerUp,
        objetivos: problem.objectives,
        desviacionCandidata: desviacionCandidata.value,
        desviacionBaseline: desviacionBaseline.value,
        trades,
      }),
    );
  }

  return {
    ok: true,
    value: {
      winners,
      strategy_id: registro.id,
      strategy_version: registro.version,
      seed,
      evaluations_consumed: indice,
    },
  };
}
