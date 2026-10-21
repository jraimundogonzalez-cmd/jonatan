import type { DrawdownType, Money, Percent, QuantError, RValue, WelfordAccumulator } from "@tradepilot/quant-engine";

/**
 * Estado agregado que Risk Engine persiste por Cuenta (SPEC-001 §5.3: "el
 * WelfordAccumulator es el objeto que Risk Engine persiste por Cuenta...
 * y actualiza con O(1) por operación cerrada"). `version` es el campo de
 * concurrencia optimista — nunca se expone como "el número de operaciones
 * menos uno" ni nada por el estilo, es puramente técnico.
 */
export interface AccountRiskState {
  readonly account_id: string;
  readonly accumulator: WelfordAccumulator;
  readonly version: number;
  readonly updated_at: string;
}

/**
 * Los hechos de capital que Risk Engine necesita de Funding Management para
 * ensamblar un `DrawdownStateInput` — Risk Engine nunca importa el esquema
 * de `accounts`, solo consume estos tres campos ya resueltos (SPEC-003 §8.2:
 * "Funding Management... es un proveedor pasivo de datos, no un invocador").
 */
export interface CapitalFacts {
  readonly current_capital: Money;
  readonly initial_capital: Money;
}

/**
 * Configuración de drawdown — hoy aportada explícitamente por quien llama a
 * `obtenerEstadoDrawdown` (SPEC-001 §8.6: "el llamador es responsable de
 * aportar el pico correcto según el tipo"). Cuando exista RuleProfileSnapshot
 * (Rule Engine), este mismo contrato se rellenará leyendo el Snapshot en
 * lugar de recibirlo por parámetro — la firma pública no cambia.
 */
export interface DrawdownConfig {
  readonly drawdown_type: DrawdownType;
  readonly max_total_drawdown_pct: Percent;
  readonly peak_capital_basis?: Money | undefined;
}

/**
 * Catálogo de errores tipados de Risk Engine — nunca lanza una excepción no
 * tipada (mismo principio que SPEC-001 §1.2 punto 7 aplicado a este
 * consumidor). `QUANT_ENGINE_ERROR` nunca oculta el error original: lo
 * envuelve tal cual, Trust Layer (SPEC-014) prohíbe disfrazar un error ajeno
 * como propio o viceversa.
 */
export type RiskEngineError =
  | { readonly code: "ACCOUNT_NOT_FOUND"; readonly account_id: string }
  | { readonly code: "CAPITAL_FACTS_UNAVAILABLE"; readonly account_id: string; readonly detail: string }
  | { readonly code: "QUANT_ENGINE_ERROR"; readonly error: QuantError }
  | { readonly code: "VERSION_CONFLICT_EXCEEDED"; readonly account_id: string; readonly attempts: number }
  | { readonly code: "INVALID_EVENT"; readonly detail: string }
  | { readonly code: "REPOSITORY_ERROR"; readonly detail: string };

export type { RValue, WelfordAccumulator };
