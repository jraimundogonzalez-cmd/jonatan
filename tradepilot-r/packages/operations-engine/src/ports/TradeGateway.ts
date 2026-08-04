import type { Money, RValue, Result } from "@tradepilot/risk-engine";
import type { ClosureReason, OperationsError, Trade, TradePartialExecuted } from "../domain/types.js";

export interface AplicarCierreParams {
  readonly tradeId: string;
  readonly closedAt: string;
  readonly closureReason: ClosureReason;
  readonly cierreManualRr?: RValue;
  readonly rMax: RValue;
  readonly rFinal: RValue;
  readonly pnlAmount: Money;
}

/**
 * Cualquier campo ausente conserva su valor actual (semántica `Partial`,
 * SPEC-002 §7 `Partial<OperacionEditable>`) — `status` no aparece aquí a
 * propósito, `editarOperacion` nunca lo toca (FORBIDDEN_STATUS_EDIT).
 */
export interface AplicarEdicionParams {
  readonly tradeId: string;
  readonly riskAmount?: Money;
  readonly rrObjective?: RValue;
  readonly rMax?: RValue;
  readonly closureReason?: ClosureReason;
  readonly cierreManualRr?: RValue;
  readonly rFinal?: RValue;
  readonly pnlAmount?: Money;
  readonly notes?: string;
  readonly comments?: string;
}

/**
 * Puerto (Dependency Inversion, mismo patrón que `AccountRiskStateRepository`
 * de Risk Engine) — el servicio depende de esta abstracción, nunca de
 * Supabase directamente. Permite probar toda la orquestación con un
 * doble en memoria.
 */
export interface TradeGateway {
  obtenerOperacion(tradeId: string): Promise<Result<Trade, OperationsError>>;
  listarParcialesEjecutados(tradeId: string): Promise<Result<readonly TradePartialExecuted[], OperationsError>>;

  /**
   * Muestra vigente de R_final por Cuenta (excluye Canceladas) — la entrega
   * Operations Engine a Risk Engine para reconstruir su acumulador tras una
   * edición; Risk Engine nunca lee `trades` directamente (BUILD 003,
   * `packages/risk-engine/src/domain/events.ts`).
   */
  listarRFinalVigentePorCuenta(accountId: string): Promise<Result<readonly RValue[], OperationsError>>;

  aplicarCierre(params: AplicarCierreParams): Promise<Result<Trade, OperationsError>>;
  aplicarEdicion(params: AplicarEdicionParams): Promise<Result<Trade, OperationsError>>;
}
