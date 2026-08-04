import type { BETrigger, Money, Percent, RValue, RiskEngineError } from "@tradepilot/risk-engine";

export type TradeStatus = "open" | "closed" | "cancelled";

/**
 * Las cuatro ramas ya formalizadas de `R_cierre_resto` (02 §2), expuestas
 * como campo obligatorio del cierre (SPEC-002 §5.3) — no es un input nuevo
 * de Quant Engine, es el selector que `calcularRFinal` ya infería
 * implícitamente de `r_max`/`parciales_ejecutados`/`cierre_manual_rr`.
 */
export type ClosureReason = "STOP_LOSS" | "BREAK_EVEN" | "TAKE_PROFIT_FULL" | "MANUAL_CLOSE";

export interface Trade {
  readonly id: string;
  readonly account_id: string;
  readonly management_plan_id: string;
  readonly status: TradeStatus;
  readonly risk_amount: Money;
  readonly rr_objective: RValue;
  readonly be_trigger: BETrigger;
  readonly r_max: RValue | null;
  readonly r_final: RValue | null;
  readonly pnl_amount: Money | null;
  readonly closure_reason: ClosureReason | null;
  readonly cierre_manual_rr: RValue | null;
}

export interface TradePartialExecuted {
  readonly sequence: 1 | 2 | 3 | 4 | 5;
  readonly rr_level: RValue;
  readonly pct_close: Percent;
  readonly executed_at: string;
}

/**
 * Catálogo de errores tipados de Operations Engine (SPEC-002 §7,
 * `OperationsError`) — `RISK_ENGINE_ERROR` nunca oculta el error original,
 * lo envuelve tal cual (Trust Layer, SPEC-014), igual que Risk Engine hace
 * con los de Quant Engine.
 */
export type OperationsError =
  | { readonly code: "TRADE_NOT_FOUND"; readonly trade_id: string }
  | { readonly code: "INVALID_STATE_TRANSITION"; readonly from: TradeStatus; readonly to: TradeStatus }
  | { readonly code: "RISK_ENGINE_ERROR"; readonly error: RiskEngineError }
  | { readonly code: "GATEWAY_ERROR"; readonly detail: string };
