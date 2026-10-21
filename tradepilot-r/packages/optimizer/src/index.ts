// API pública de @tradepilot/optimizer (SPEC-005 §11). Domain Service puro:
// recibe un problema, devuelve un resultado explicado. Nunca persiste, nunca
// aplica una recomendación, nunca escribe en otro módulo (I17).

export type {
  Constraint,
  HistoricalTrade,
  Objective,
  ObjectiveMetric,
  OptimizationProblem,
  OptimizerError,
  PlannedPartial,
  Scenario,
  ScenarioSpaceParams,
  Timestamp,
} from "./domain/types.js";

export type { EvaluatedCandidate, SearchStrategy } from "./search/SearchStrategy.js";
export type { SearchStrategyRegistration } from "./search/registry.js";
export { listarEstrategiasAprobadas } from "./search/registry.js";
export {
  BOUNDED_RANDOM_SEARCH_ID,
  BOUNDED_RANDOM_SEARCH_VERSION,
  boundedRandomSearch,
} from "./search/bounded-random-search.js";

export type { MetricEvidence } from "./evaluator/evaluator-bridge.js";
export type { OptimizationExplanation } from "./explain/index.js";

export { optimizar, type OptimizationResult } from "./optimizar.js";
export { MAX_WINNERS } from "./comparator/index.js";
