/**
 * Registro de estrategias aprobadas (SPEC-005 §6). Optimizer **rechaza
 * invocar** cualquier estrategia cuyos tres criterios no estén en `true`
 * (`STRATEGY_NOT_APPROVED`) — es el mecanismo concreto, no solo declarativo,
 * de "Optimizer únicamente consume algoritmos ya aprobados" (§1.2 punto 5).
 *
 * Añadir una estrategia nueva (TradePilot Labs, §6.2) es añadir una entrada
 * aquí: ni el orquestador, ni `comparator`, ni `explain`, ni ninguna
 * estrategia existente cambian una sola línea (Open/Closed).
 */
import type { SearchStrategy } from "./SearchStrategy.js";
import { boundedRandomSearch } from "./bounded-random-search.js";

export interface SearchStrategyRegistration {
  readonly id: string;
  readonly version: string;
  readonly origin: "reference" | "tradepilot_labs";
  readonly approved_at: string;
  readonly criteria: {
    /** Misma semilla + mismo problema ⇒ mismo resultado, siempre. */
    readonly deterministic_given_seed: boolean;
    /** Presupuesto en nº de evaluaciones, nunca en tiempo (§5.3). */
    readonly evaluation_bounded: boolean;
    /** Validada contra problemas de referencia con óptimo conocido. */
    readonly validated_against_benchmarks: boolean;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly strategy: SearchStrategy<any>;
}

/**
 * `validated_against_benchmarks` en `true` para la estrategia de referencia:
 * su garantía no es empírica sino la cota cerrada de §2, verificada además
 * por el test de cobertura del propio paquete. El conjunto de problemas de
 * referencia para estrategias *futuras* sigue siendo responsabilidad de
 * TradePilot Labs (§6.1, Riesgo #2), no de este build.
 */
const REGISTRO: readonly SearchStrategyRegistration[] = [
  {
    id: boundedRandomSearch.id,
    version: boundedRandomSearch.version,
    origin: "reference",
    approved_at: "2026-08-04T00:00:00Z",
    criteria: {
      deterministic_given_seed: true,
      evaluation_bounded: true,
      validated_against_benchmarks: true,
    },
    strategy: boundedRandomSearch,
  },
];

export function buscarEstrategiaAprobada(strategyId: string): SearchStrategyRegistration | null {
  const registro = REGISTRO.find((r) => r.id === strategyId);
  if (!registro) return null;
  const { deterministic_given_seed, evaluation_bounded, validated_against_benchmarks } = registro.criteria;
  if (!deterministic_given_seed || !evaluation_bounded || !validated_against_benchmarks) return null;
  return registro;
}

export function listarEstrategiasAprobadas(): readonly SearchStrategyRegistration[] {
  return REGISTRO;
}
