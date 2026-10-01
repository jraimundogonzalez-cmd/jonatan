/**
 * Modelo de dominio de Rule Engine (SPEC-004 §2, §3).
 *
 * Rule Engine **evalúa**, nunca calcula ni ejecuta. Ningún tipo de este
 * archivo describe una acción sobre el sistema: el resultado de todo el
 * motor es un veredicto y su evidencia.
 */
import type { Money, Percent, RValue } from "@tradepilot/risk-engine";

export type Timestamp = string;

export type Archetype =
  | "static_threshold"
  | "dynamic_threshold"
  | "progress_to_target"
  | "set_membership"
  | "time_window"
  | "composite";

export type Scope = "account_state" | "operation_event";
export type InstanceMode = "enforced" | "shadow";
export type EstadoCuenta = "challenge" | "funded" | "live" | "paused" | "terminated" | "merged";

/**
 * Hechos ya resueltos por sus módulos propietarios. Rule Engine nunca los
 * calcula ni los almacena — los recibe y los compara (SPEC-004 §1.2).
 */
export interface AccountFacts {
  readonly current_capital: Money;
  readonly peak_capital: Money;
  readonly initial_capital: Money;
  readonly status: EstadoCuenta;
}

/** Magnitudes de Risk Engine — nunca de Quant Engine directamente (SPEC-004 §14.1). */
export interface RiskMagnitudes {
  readonly piso_vigente: Money;
  readonly drawdown_restante_eur: Money;
  readonly drawdown_restante_pct: Percent;
}

export interface OperationFacts {
  readonly trade_id: string;
  readonly symbol: string;
  readonly side: string;
  readonly opened_at: Timestamp;
  readonly risk_pct: Percent;
}

export interface EvaluationInputs {
  readonly account_facts: AccountFacts;
  readonly risk_magnitudes?: RiskMagnitudes;
  readonly operation_facts?: OperationFacts;
  /** Solo para `composite` — veredictos de las reglas de las que depende (SPEC-004 §5). */
  readonly sibling_verdicts?: Readonly<Record<string, Veredicto>>;
}

/**
 * `unavailable` nunca se infiere como `compliant` ni como `violated`
 * (SPEC-004 §7): en un sistema de cumplimiento, inventar un veredicto sin
 * datos es peor que no dar ninguno.
 */
export type Veredicto =
  | { readonly verdict: "compliant"; readonly margin: RValue }
  | { readonly verdict: "violated"; readonly margin: RValue }
  | { readonly verdict: "unavailable"; readonly reason: string };

/** Nombres de magnitud que un evaluador puede leer. Cerrado a propósito: impide que un parámetro arbitrario abra la puerta a un cálculo. */
export type InputRef =
  | "drawdown_restante_pct"
  | "drawdown_restante_eur"
  | "piso_vigente"
  | "current_capital"
  | "peak_capital"
  | "initial_capital"
  | "risk_pct";

export interface FrozenDefinition {
  readonly key: string;
  readonly version: number;
  readonly archetype: Archetype;
  readonly archetype_version: string;
  readonly scope: Scope;
  readonly depends_on_definition_key?: string;
}

/** Una Rule Instance congelada dentro de un Snapshot, con su Definition ya resuelta. */
export interface FrozenInstance {
  readonly definition: FrozenDefinition;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly mode: InstanceMode;
  readonly effective_from?: Timestamp;
  readonly effective_until?: Timestamp;
  readonly active_only_in_status?: readonly EstadoCuenta[];
}

export interface RuleProfileSnapshot {
  readonly id: string;
  readonly frozen_instances: readonly FrozenInstance[];
}

/** Referencia al evento del Event Backbone que dispara la pasada (BUILD 006A). */
export interface DomainEventRef {
  readonly event_id: string;
  readonly event_sequence: number;
  readonly event_type: string;
  readonly account_id: string;
  readonly trade_id?: string;
  readonly occurred_at: Timestamp;
}

/** Resultado de evaluar una Instance: veredicto + toda su evidencia. Explicable sin IA. */
export interface RuleEvaluation {
  readonly rule_definition_key: string;
  readonly rule_definition_version: number;
  readonly archetype_version: string;
  readonly mode: InstanceMode;
  readonly trade_id?: string;
  readonly verdict: Veredicto["verdict"];
  readonly margin: RValue | null;
  readonly triggering_event_sequence: number;
  /** Qué regla, qué evidencia, por qué — con datos, nunca con texto generado (SPEC-004 §9). */
  readonly evaluation_context: Readonly<Record<string, unknown>>;
}

export type RuleEngineError =
  | { readonly code: "SNAPSHOT_NOT_FOUND"; readonly account_id: string }
  | { readonly code: "MISSING_DEPENDENCY_INSTANCE"; readonly requires_definition_key: string }
  | { readonly code: "CYCLIC_DEPENDENCY_IN_LIBRARY"; readonly path: readonly string[] }
  | { readonly code: "INVALID_PARAMETER_SCHEMA"; readonly field: string; readonly detail: string }
  | { readonly code: "REPOSITORY_ERROR"; readonly detail: string };
