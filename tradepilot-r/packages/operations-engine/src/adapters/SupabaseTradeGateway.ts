/**
 * Adaptador Supabase de `TradeGateway` — habla exclusivamente en términos de
 * las RPC de `supabase/functions/sql/operations.sql`. Nunca ejecuta SQL
 * directo desde aquí (mismo principio que los adaptadores de Risk Engine y
 * `apps/web/lib/api/funding.ts`, mvp-0.1.md §6.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { err, money, ok, percent, rvalue, toDisplayString, type Result, type RValue } from "@tradepilot/risk-engine";
import type { ClosureReason, OperationsError, Trade, TradePartialExecuted, TradeStatus } from "../domain/types.js";
import type { AplicarCierreParams, AplicarEdicionParams, TradeGateway } from "../ports/TradeGateway.js";

interface TradeRow {
  readonly id: string;
  readonly account_id: string;
  readonly management_plan_id: string;
  readonly status: TradeStatus;
  readonly risk_amount: string;
  readonly rr_objective: string;
  readonly be_trigger: string;
  readonly r_max: string | null;
  readonly r_final: string | null;
  readonly pnl_amount: string | null;
  readonly closure_reason: ClosureReason | null;
  readonly cierre_manual_rr: string | null;
}

interface TradePartialExecutedRow {
  readonly sequence: 1 | 2 | 3 | 4 | 5;
  readonly rr_level: string;
  readonly pct_close: string;
  readonly executed_at: string;
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    account_id: row.account_id,
    management_plan_id: row.management_plan_id,
    // El check constraint de `trades.be_trigger` ya garantiza uno de los 3
    // valores del enum — frontera de entrada, mismo patrón que `rvalue(...)`.
    be_trigger: row.be_trigger as Trade["be_trigger"],
    status: row.status,
    risk_amount: money(row.risk_amount),
    rr_objective: rvalue(row.rr_objective),
    r_max: row.r_max !== null ? rvalue(row.r_max) : null,
    r_final: row.r_final !== null ? rvalue(row.r_final) : null,
    pnl_amount: row.pnl_amount !== null ? money(row.pnl_amount) : null,
    closure_reason: row.closure_reason,
    cierre_manual_rr: row.cierre_manual_rr !== null ? rvalue(row.cierre_manual_rr) : null,
  };
}

function gatewayError(detail: string): OperationsError {
  return { code: "GATEWAY_ERROR", detail };
}

export class SupabaseTradeGateway implements TradeGateway {
  constructor(private readonly client: SupabaseClient) {}

  async obtenerOperacion(tradeId: string): Promise<Result<Trade, OperationsError>> {
    const { data, error } = await this.client.rpc("obtener_operacion", { p_id: tradeId });
    if (error) return err(gatewayError(error.message));
    if (!data) return err({ code: "TRADE_NOT_FOUND", trade_id: tradeId });
    return ok(rowToTrade(data as TradeRow));
  }

  async listarParcialesEjecutados(tradeId: string): Promise<Result<readonly TradePartialExecuted[], OperationsError>> {
    const { data, error } = await this.client.rpc("listar_parciales_ejecutados", { p_trade_id: tradeId });
    if (error) return err(gatewayError(error.message));
    const rows = (data ?? []) as TradePartialExecutedRow[];
    return ok(
      rows.map((row) => ({
        sequence: row.sequence,
        rr_level: rvalue(row.rr_level),
        pct_close: percent(row.pct_close),
        executed_at: row.executed_at,
      })),
    );
  }

  async listarRFinalVigentePorCuenta(accountId: string): Promise<Result<readonly RValue[], OperationsError>> {
    const { data, error } = await this.client.rpc("listar_r_final_vigente_por_cuenta", { p_account_id: accountId });
    if (error) return err(gatewayError(error.message));
    const rows = (data ?? []) as ReadonlyArray<{ r_final: string }>;
    return ok(rows.map((row) => rvalue(row.r_final)));
  }

  async aplicarCierre(params: AplicarCierreParams): Promise<Result<Trade, OperationsError>> {
    const { data, error } = await this.client.rpc("aplicar_cierre_operacion", {
      p_trade_id: params.tradeId,
      p_closed_at: params.closedAt,
      p_closure_reason: params.closureReason,
      p_cierre_manual_rr: params.cierreManualRr ? toDisplayString(params.cierreManualRr) : null,
      p_r_max: toDisplayString(params.rMax),
      p_r_final: toDisplayString(params.rFinal),
      p_pnl_amount: toDisplayString(params.pnlAmount),
    });
    if (error) return err(gatewayError(error.message));
    return ok(rowToTrade(data as TradeRow));
  }

  async aplicarEdicion(params: AplicarEdicionParams): Promise<Result<Trade, OperationsError>> {
    const { data, error } = await this.client.rpc("aplicar_edicion_operacion", {
      p_trade_id: params.tradeId,
      p_risk_amount: params.riskAmount ? toDisplayString(params.riskAmount) : null,
      p_rr_objective: params.rrObjective ? toDisplayString(params.rrObjective) : null,
      p_r_max: params.rMax ? toDisplayString(params.rMax) : null,
      p_closure_reason: params.closureReason ?? null,
      p_cierre_manual_rr: params.cierreManualRr ? toDisplayString(params.cierreManualRr) : null,
      p_r_final: params.rFinal ? toDisplayString(params.rFinal) : null,
      p_pnl_amount: params.pnlAmount ? toDisplayString(params.pnlAmount) : null,
      p_notes: params.notes ?? null,
      p_comments: params.comments ?? null,
    });
    if (error) return err(gatewayError(error.message));
    return ok(rowToTrade(data as TradeRow));
  }
}
