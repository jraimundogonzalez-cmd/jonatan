import { err, ok, type Result, type RValue } from "@tradepilot/risk-engine";
import type { OperationsError, Trade, TradePartialExecuted } from "../../src/domain/types.js";
import type { AplicarCierreParams, AplicarEdicionParams, TradeGateway } from "../../src/ports/TradeGateway.js";

/**
 * Doble en memoria de `TradeGateway` — suficiente para probar la
 * orquestación de `OperationsEngineService` (decisión de recalcular o no,
 * ensamblaje de RFinalInput, propagación de errores) sin Postgres. No
 * replica el motor de reversión de capital ni la máquina de estados
 * completa de la migración — eso se valida contra Postgres real en
 * `supabase/tests/` (mismo reparto de responsabilidades que Risk Engine).
 */
export class InMemoryTradeGateway implements TradeGateway {
  private readonly trades = new Map<string, Trade>();
  private readonly executedPartials = new Map<string, TradePartialExecuted[]>();
  private readonly vigenteSampleByAccount = new Map<string, RValue[]>();

  /**
   * BUILD 018 — los parámetros con los que se invocó el último cierre.
   *
   * Existe para una sola aserción, y es una que no se puede hacer de otro
   * modo: que `OperationsEngineService` **siempre** envíe el testigo de
   * evidencia (`expectedPartials`). En SQL el parámetro tiene `default null`
   * por compatibilidad con las llamadas históricas, así que omitirlo no
   * produce ningún error — la Operación se cerraría igual, sin protección
   * frente a un parcial insertado en la ventana entre el cálculo y el cierre.
   * Un olvido en la ruta de producción sería invisible salvo aquí.
   */
  lastCierreParams: AplicarCierreParams | null = null;

  /** Cuántas veces se intentó escribir el cierre. `previsualizarCierre` debe dejarlo en 0. */
  cierreCallCount = 0;

  /** BUILD 019 — para observar que el borrado explícito llega al puerto. */
  lastEdicionParams: AplicarEdicionParams | null = null;

  /** BUILD 022 — `previsualizarCorreccion` debe dejarlo en 0: no escribe nada. */
  edicionCallCount = 0;

  seedTrade(trade: Trade): void {
    this.trades.set(trade.id, trade);
  }

  seedExecutedPartials(tradeId: string, partials: readonly TradePartialExecuted[]): void {
    this.executedPartials.set(tradeId, [...partials]);
  }

  seedVigenteSample(accountId: string, sample: readonly RValue[]): void {
    this.vigenteSampleByAccount.set(accountId, [...sample]);
  }

  async obtenerOperacion(tradeId: string): Promise<Result<Trade, OperationsError>> {
    const trade = this.trades.get(tradeId);
    if (!trade) return err({ code: "TRADE_NOT_FOUND", trade_id: tradeId });
    return ok(trade);
  }

  async listarParcialesEjecutados(tradeId: string): Promise<Result<readonly TradePartialExecuted[], OperationsError>> {
    return ok(this.executedPartials.get(tradeId) ?? []);
  }

  async listarRFinalVigentePorCuenta(accountId: string): Promise<Result<readonly RValue[], OperationsError>> {
    return ok(this.vigenteSampleByAccount.get(accountId) ?? []);
  }

  /** BUILD 022 — sólo para contar estados; la muestra vigente sigue aparte. */
  async listarOperacionesPorCuenta(accountId: string): Promise<Result<readonly Trade[], OperationsError>> {
    return ok([...this.trades.values()].filter((t) => t.account_id === accountId));
  }

  async aplicarCierre(params: AplicarCierreParams): Promise<Result<Trade, OperationsError>> {
    this.lastCierreParams = params;
    this.cierreCallCount += 1;
    const trade = this.trades.get(params.tradeId);
    if (!trade) return err({ code: "TRADE_NOT_FOUND", trade_id: params.tradeId });
    const updated: Trade = {
      ...trade,
      status: "closed",
      r_max: params.rMax,
      r_final: params.rFinal,
      pnl_amount: params.pnlAmount,
      closure_reason: params.closureReason,
      cierre_manual_rr: params.cierreManualRr ?? trade.cierre_manual_rr,
    };
    this.trades.set(params.tradeId, updated);
    return ok(updated);
  }

  async aplicarEdicion(params: AplicarEdicionParams): Promise<Result<Trade, OperationsError>> {
    this.lastEdicionParams = params;
    this.edicionCallCount += 1;
    const trade = this.trades.get(params.tradeId);
    if (!trade) return err({ code: "TRADE_NOT_FOUND", trade_id: params.tradeId });
    // BUILD 016B/018: `risk_amount` y `rr_objective` son identidad y ya no
    // viajan en `AplicarEdicionParams` — el doble no puede escribirlos porque
    // el puerto real tampoco los recibe.
    const updated: Trade = {
      ...trade,
      r_max: params.rMax ?? trade.r_max,
      closure_reason: params.closureReason ?? trade.closure_reason,
      // BUILD 019: la bandera vacía el campo; sin ella, `undefined` conserva.
      cierre_manual_rr: params.borrarCierreManualRr ? null : (params.cierreManualRr ?? trade.cierre_manual_rr),
      r_final: params.rFinal ?? trade.r_final,
      pnl_amount: params.pnlAmount ?? trade.pnl_amount,
    };
    this.trades.set(params.tradeId, updated);
    return ok(updated);
  }
}
