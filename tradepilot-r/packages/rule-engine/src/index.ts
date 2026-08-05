// API pública de @tradepilot/rule-engine (SPEC-004).
//
// Rule Engine es un motor de EVALUACIÓN, nunca de ejecución: produce
// veredictos con su evidencia y emite eventos. Ninguna función de esta API
// modifica una entidad de otro módulo.

export type {
  AccountFacts,
  Archetype,
  DomainEventRef,
  EstadoCuenta,
  EvaluationInputs,
  FrozenDefinition,
  FrozenInstance,
  InputRef,
  InstanceMode,
  OperationFacts,
  RiskMagnitudes,
  RuleEngineError,
  RuleEvaluation,
  RuleProfileSnapshot,
  Scope,
  Timestamp,
  Veredicto,
} from "./domain/types.js";

export type {
  AccountFactsProvider,
  EvaluationRepository,
  OperationFactsProvider,
  RiskMagnitudesProvider,
  SnapshotRepository,
} from "./ports/index.js";

export {
  EVALUADORES,
  composite,
  describirVeredicto,
  dynamicThreshold,
  progressToTarget,
  resolverInput,
  setMembership,
  staticThreshold,
  timeWindow,
  type Evaluador,
} from "./evaluators/index.js";

export {
  RuleEngineService,
  estaVigente,
  ordenarTopologicamente,
  type ResultadoEvaluacion,
} from "./services/RuleEngineService.js";
