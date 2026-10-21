/**
 * Ciclo *ask/tell* (SPEC-005 §3.2) — la decisión de arquitectura central del
 * componente. Toda estrategia futura (heurística, evolutiva, bayesiana,
 * Monte Carlo) implementa estos cuatro miembros sin que el orquestador,
 * `comparator` ni `explain` cambien una línea (Open/Closed, §6.2).
 *
 * **Desacoplamiento del evaluador (invariante de este build)**: una estrategia
 * jamás ve un `QuantResult`, ni sabe que existe Quant Engine, ni cómo se
 * calcula R. Solo recibe `EvaluatedCandidate` — números opacos ya evaluados y
 * una bandera de viabilidad. La evidencia completa la guarda el orquestador,
 * fuera del alcance de la estrategia.
 */
import type { RValue } from "@tradepilot/quant-engine";
import type { ObjectiveMetric, OptimizationProblem, Scenario } from "../domain/types.js";

export interface EvaluatedCandidate {
  readonly scenario: Scenario;
  /** Orden canónico de evaluación — desempate determinista (§9.3). */
  readonly evaluation_index: number;
  readonly objective_values: Readonly<Partial<Record<ObjectiveMetric, RValue>>>;
  /** `false` si viola alguna Constraint (§4.3) o si su evaluación no fue posible. */
  readonly feasible: boolean;
}

export interface SearchStrategy<TState> {
  readonly id: string;
  readonly version: string;
  initState(problem: OptimizationProblem, seed: number): TState;
  /** Qué candidatas evaluar a continuación — ninguna candidata se genera fuera de este paso. */
  ask(state: TState): readonly Scenario[];
  /** La estrategia aprende del resultado. Devuelve el estado siguiente, nunca muta el recibido. */
  tell(state: TState, evaluated: readonly EvaluatedCandidate[]): TState;
  /** Presupuesto agotado o convergencia — **nunca** tiempo de reloj (§5.3). */
  isDone(state: TState): boolean;
}
