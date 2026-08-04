import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { money, rvalue, toDisplayString } from "@tradepilot/risk-engine";
import { SupabaseTradeGateway } from "../../../src/adapters/SupabaseTradeGateway.js";

const rpcMock = vi.fn();
const client = { rpc: rpcMock } as unknown as SupabaseClient;

const TRADE_ROW = {
  id: "trade-1",
  account_id: "acc-1",
  management_plan_id: "plan-1",
  status: "closed",
  risk_amount: "100.0000",
  rr_objective: "3.0000",
  be_trigger: "NONE",
  r_max: "0.4000",
  r_final: "-1.0000",
  pnl_amount: "-100.0000",
  closure_reason: "STOP_LOSS",
  cierre_manual_rr: null,
};

describe("SupabaseTradeGateway.obtenerOperacion", () => {
  beforeEach(() => rpcMock.mockReset());

  it("traduce la fila a Trade con los tipos decimales correctos", async () => {
    rpcMock.mockResolvedValueOnce({ data: TRADE_ROW, error: null });
    const gateway = new SupabaseTradeGateway(client);
    const result = await gateway.obtenerOperacion("trade-1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.risk_amount)).toBe("100.0000");
    expect(toDisplayString(result.value.rr_objective)).toBe("3.0000");
    expect(toDisplayString(result.value.r_final!)).toBe("-1.0000");
    expect(result.value.cierre_manual_rr).toBeNull();
  });

  it("devuelve TRADE_NOT_FOUND cuando la RPC responde sin fila", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const gateway = new SupabaseTradeGateway(client);
    const result = await gateway.obtenerOperacion("ajena");
    expect(result).toEqual({ ok: false, error: { code: "TRADE_NOT_FOUND", trade_id: "ajena" } });
  });

  it("envuelve un error de Postgres como GATEWAY_ERROR", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "connection reset" } });
    const gateway = new SupabaseTradeGateway(client);
    const result = await gateway.obtenerOperacion("trade-1");
    expect(result).toEqual({ ok: false, error: { code: "GATEWAY_ERROR", detail: "connection reset" } });
  });
});

describe("SupabaseTradeGateway.aplicarCierre", () => {
  beforeEach(() => rpcMock.mockReset());

  it("envía los decimales como string con la escala correcta a aplicar_cierre_operacion", async () => {
    rpcMock.mockResolvedValueOnce({ data: TRADE_ROW, error: null });
    const gateway = new SupabaseTradeGateway(client);
    await gateway.aplicarCierre({
      tradeId: "trade-1",
      closedAt: "2026-01-01T00:00:00Z",
      closureReason: "STOP_LOSS",
      rMax: rvalue("0.4000"),
      rFinal: rvalue("-1.0000"),
      pnlAmount: money("-100.0000"),
    });
    expect(rpcMock).toHaveBeenCalledWith("aplicar_cierre_operacion", {
      p_trade_id: "trade-1",
      p_closed_at: "2026-01-01T00:00:00Z",
      p_closure_reason: "STOP_LOSS",
      p_cierre_manual_rr: null,
      p_r_max: "0.4000",
      p_r_final: "-1.0000",
      p_pnl_amount: "-100.0000",
    });
  });
});

describe("SupabaseTradeGateway.aplicarEdicion", () => {
  beforeEach(() => rpcMock.mockReset());

  it("envía risk_amount (nunca risk_pct) — el único input de Quant Engine que este paquete edita", async () => {
    rpcMock.mockResolvedValueOnce({ data: TRADE_ROW, error: null });
    const gateway = new SupabaseTradeGateway(client);
    await gateway.aplicarEdicion({ tradeId: "trade-1", riskAmount: money("150.0000") });
    expect(rpcMock).toHaveBeenCalledWith(
      "aplicar_edicion_operacion",
      expect.objectContaining({ p_trade_id: "trade-1", p_risk_amount: "150.0000" }),
    );
  });

  it("campos ausentes viajan como null (coalesce del lado de la RPC conserva el valor actual)", async () => {
    rpcMock.mockResolvedValueOnce({ data: TRADE_ROW, error: null });
    const gateway = new SupabaseTradeGateway(client);
    await gateway.aplicarEdicion({ tradeId: "trade-1", notes: "nota nueva" });
    expect(rpcMock).toHaveBeenCalledWith("aplicar_edicion_operacion", {
      p_trade_id: "trade-1",
      p_risk_amount: null,
      p_rr_objective: null,
      p_r_max: null,
      p_closure_reason: null,
      p_cierre_manual_rr: null,
      p_r_final: null,
      p_pnl_amount: null,
      p_notes: "nota nueva",
      p_comments: null,
    });
  });
});
