/**
 * `bounded_random_search.v1` — estrategia de referencia (SPEC-005 §5).
 *
 * No es una implementación provisional: tiene una garantía matemática propia
 * (§2). Con `K` muestras uniformes independientes, la probabilidad de que
 * ninguna caiga en el mejor `q`-cuantil es `(1−q)^K`, **cota independiente
 * del tamaño del espacio** — por eso unos cientos de evaluaciones bastan
 * frente a las ≈2,3×10¹¹ combinaciones que la fuerza bruta exigiría
 * (SPEC-001 §8.4).
 */
import type { OptimizationProblem, Scenario } from "../domain/types.js";
import { crearRng, type Rng } from "../prng.js";
import { generarScenario } from "../scenario/generator.js";
import type { EvaluatedCandidate, SearchStrategy } from "./SearchStrategy.js";

export interface BoundedRandomSearchState {
  readonly problem: OptimizationProblem;
  readonly rng: Rng;
  readonly historial: readonly EvaluatedCandidate[];
  readonly propuestas: number;
}

export const BOUNDED_RANDOM_SEARCH_ID = "bounded_random_search";
export const BOUNDED_RANDOM_SEARCH_VERSION = "v1";

export const boundedRandomSearch: SearchStrategy<BoundedRandomSearchState> = {
  id: BOUNDED_RANDOM_SEARCH_ID,
  version: BOUNDED_RANDOM_SEARCH_VERSION,

  initState(problem: OptimizationProblem, seed: number): BoundedRandomSearchState {
    return { problem, rng: crearRng(seed), historial: [], propuestas: 0 };
  },

  /**
   * Propone las `K` candidatas de una vez: es la forma más simple de `ask`
   * (§3.2) — una búsqueda aleatoria no aprende de lo ya evaluado, así que no
   * necesita varias vueltas.
   */
  ask(state: BoundedRandomSearchState): readonly Scenario[] {
    const scenarios: Scenario[] = [];
    for (let i = 0; i < state.problem.evaluation_budget; i++) {
      scenarios.push(generarScenario(state.problem.base_scenario_space, state.rng));
    }
    return scenarios;
  },

  tell(state: BoundedRandomSearchState, evaluated: readonly EvaluatedCandidate[]): BoundedRandomSearchState {
    return {
      ...state,
      historial: [...state.historial, ...evaluated],
      propuestas: state.propuestas + evaluated.length,
    };
  },

  /** Presupuesto expresado en evaluaciones consumidas — nunca en milisegundos (§5.3). */
  isDone(state: BoundedRandomSearchState): boolean {
    return state.propuestas >= state.problem.evaluation_budget;
  },
};
