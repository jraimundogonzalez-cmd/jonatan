/**
 * Modelo formal del problema de optimización (SPEC-005 §4).
 *
 * Todos los imports de este archivo son **solo de tipo** — ningún módulo del
 * paquete salvo `src/evaluator/` importa `@tradepilot/quant-engine` como
 * valor (SPEC-005 §3.3: "evaluator-bridge es el único punto del componente
 * que importa el paquete quant-engine").
 */
import type { BETrigger, Money, Percent, RValue } from "@tradepilot/quant-engine";

/** ISO 8601. Alias local para no importar un tipo que Quant Engine no publica. */
export type Timestamp = string;

/**
 * Una Operación real ya cerrada del Trade Set de entrada (28 §2, SPEC-005
 * §4.2 tras la corrección documental de alineación). Optimizer nunca lee la
 * tabla `trades` — el llamador le entrega estos hechos ya resueltos.
 */
export interface HistoricalTrade {
  /** Recorrido máximo a favor realmente observado — contexto del contrafactual (02 §1). */
  readonly r_max: RValue;
  /** Resultado real ya calculado — es el baseline `trader_actual_behavior` de §10.2. */
  readonly r_final: RValue;
  /** Congelado en creación (SPEC-002 §2.5 invariante 3) — habilita las métricas en Money. */
  readonly risk_amount: Money;
  /** Orden cronológico real de la curva de equity — nunca un orden sintético. */
  readonly closed_at: Timestamp;
}

export interface PlannedPartial {
  readonly sequence: 1 | 2 | 3 | 4 | 5;
  readonly rr_level: RValue;
  readonly pct_close: Percent;
}

/**
 * Candidata generada por una estrategia (Scenario, 32 §3.9). Contiene solo la
 * configuración hipotética — el `r_max` de contexto lo aporta cada
 * `HistoricalTrade` en el momento de evaluar, nunca se inventa (32 §3.9:
 * "nunca referencia una Cuenta u Operación real por id").
 */
export interface Scenario {
  readonly rr_objetivo: RValue;
  readonly parciales_planificados: readonly PlannedPartial[];
  readonly be_trigger: BETrigger;
}

/** Métricas admitidas como objetivo o restricción (SPEC-005 §4.2/§4.3). */
export type ObjectiveMetric = "expectancy" | "consistency_ratio" | "drawdown" | "recovery_factor" | "score";

export interface Objective {
  readonly metric: ObjectiveMetric;
  readonly direction: "maximize" | "minimize";
}

export interface Constraint {
  readonly metric: ObjectiveMetric;
  readonly operator: "lte" | "gte";
  readonly threshold: RValue;
}

/**
 * Espacio de búsqueda (SPEC-005 §4.1, sin cambios respecto a 02 §5.1).
 * Los pasos de grid (0.1R y 5%) los fija 02 §5.1 y viven como constantes del
 * generador — no son configurables, para que dos ejecuciones del mismo
 * problema no puedan diferir por un parámetro invisible.
 */
export interface ScenarioSpaceParams {
  readonly rr_objetivo: RValue;
  /** 0..5 — el límite de 5 es de producto, no técnico (SPEC-002 §8.4.4). */
  readonly max_partials: number;
  /** Valores admitidos, aportados explícitamente por el llamador (02 §1.4). */
  readonly be_triggers: readonly BETrigger[];
}

export interface OptimizationProblem {
  readonly base_scenario_space: ScenarioSpaceParams;
  readonly objectives: readonly Objective[];
  readonly constraints: readonly Constraint[];
  /** Trade Set de Operaciones reales cerradas (28 §2). */
  readonly bootstrap_trade_set: readonly HistoricalTrade[];
  /**
   * `K` de SPEC-005 §5.2 — presupuesto en **número de evaluaciones**, nunca en
   * tiempo de reloj (§5.3). La spec lo exige explícito ("nunca un valor
   * oculto"): el llamador elige el punto de la tabla de §2 según el contexto.
   */
  readonly evaluation_budget: number;
  /** Obligatorio si algún objetivo/restricción es `score` — nunca un valor por defecto oculto (SPEC-001 §3.8). */
  readonly lambda?: RValue;
}

export type OptimizerError =
  | { readonly code: "STRATEGY_NOT_APPROVED"; readonly strategy_id: string }
  | { readonly code: "INVALID_SCENARIO_SPACE"; readonly detail: string }
  | { readonly code: "MISSING_LAMBDA_FOR_SCORE_OBJECTIVE" }
  | { readonly code: "EMPTY_BOOTSTRAP_SAMPLE" }
  | { readonly code: "NO_FEASIBLE_CANDIDATE"; readonly detail: string }
  /** Un error de Quant Engine nunca se disfraza de error propio (Trust Layer, SPEC-014). */
  | { readonly code: "QUANT_ENGINE_ERROR"; readonly detail: string };
