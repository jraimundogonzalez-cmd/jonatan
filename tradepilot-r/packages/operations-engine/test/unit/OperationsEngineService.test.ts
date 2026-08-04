import { beforeEach, describe, expect, it } from "vitest";
import { BETrigger, RiskEngineService, money, rvalue, toDisplayString } from "@tradepilot/risk-engine";
import { OperationsEngineService } from "../../src/services/OperationsEngineService.js";
import type { Trade } from "../../src/domain/types.js";
import { InMemoryTradeGateway } from "../fakes/InMemoryTradeGateway.js";
import { InMemoryAccountRiskStateRepository, InMemoryCapitalFactsProvider } from "../fakes/InMemoryRiskEngineDependencies.js";

const ACCOUNT_ID = "acc-1";
const TRADE_ID = "trade-1";

function openTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: TRADE_ID,
    account_id: ACCOUNT_ID,
    management_plan_id: "plan-1",
    status: "open",
    risk_amount: money("100.0000"),
    rr_objective: rvalue("3.0000"),
    be_trigger: BETrigger.NONE,
    r_max: null,
    r_final: null,
    pnl_amount: null,
    closure_reason: null,
    cierre_manual_rr: null,
    ...overrides,
  };
}

describe("OperationsEngineService.cerrarOperacion", () => {
  let gateway: InMemoryTradeGateway;
  let riskRepo: InMemoryAccountRiskStateRepository;
  let service: OperationsEngineService;

  beforeEach(() => {
    gateway = new InMemoryTradeGateway();
    riskRepo = new InMemoryAccountRiskStateRepository();
    riskRepo.seed(ACCOUNT_ID);
    const riskEngineService = new RiskEngineService(riskRepo, new InMemoryCapitalFactsProvider());
    service = new OperationsEngineService(gateway, riskEngineService);
  });

  it("cierra con Stop Loss puro (sin parciales) y obtiene R_final=-1.0000 vía Risk Engine, nunca calculado aquí", async () => {
    gateway.seedTrade(openTrade());

    const result = await service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T00:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.trade.status).toBe("closed");
    expect(toDisplayString(result.value.trade.r_final!)).toBe("-1.0000");
    expect(toDisplayString(result.value.trade.pnl_amount!)).toBe("-100.0000");
    expect(result.value.accumulator_update.ok).toBe(true);
    if (result.value.accumulator_update.ok) {
      expect(result.value.accumulator_update.value.outcome.kind).toBe("applied");
    }
  });

  it("es idempotente ante un reintento del mismo cierre a nivel de acumulador (event_id = trade_id)", async () => {
    gateway.seedTrade(openTrade());
    const closeInput = {
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T00:00:00Z",
      closure_reason: "STOP_LOSS" as const,
      r_max: rvalue("0.4000"),
    };

    const first = await service.cerrarOperacion(closeInput);
    expect(first.ok).toBe(true);

    // Reabrir artificialmente en el doble para simular un reintento de la
    // MISMA petición de cierre (en producción esto lo bloquearía la máquina
    // de estados de SQL antes de llegar aquí — este test aísla solo el
    // comportamiento del acumulador ante el mismo event_id).
    gateway.seedTrade({ ...openTrade(), status: "open" });
    const second = await service.cerrarOperacion(closeInput);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("unreachable");
    expect(second.value.accumulator_update.ok).toBe(true);
    if (second.value.accumulator_update.ok) {
      expect(second.value.accumulator_update.value.outcome.kind).toBe("already_processed");
    }
  });

  it("rechaza cerrar una Operación que no está Abierta", async () => {
    gateway.seedTrade(openTrade({ status: "closed" }));

    const result = await service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T00:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_STATE_TRANSITION", from: "closed", to: "closed" } });
  });

  it("propaga un error de Risk Engine sin envolverlo en excepción cuando el input es inválido", async () => {
    gateway.seedTrade(openTrade({ risk_amount: money("0.0000") }));

    const result = await service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T00:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("RISK_ENGINE_ERROR");
  });

  it("propaga TRADE_NOT_FOUND cuando la Operación no existe", async () => {
    const result = await service.cerrarOperacion({
      trade_id: "inexistente",
      closed_at: "2026-01-01T00:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });
    expect(result).toEqual({ ok: false, error: { code: "TRADE_NOT_FOUND", trade_id: "inexistente" } });
  });
});

describe("OperationsEngineService.editarOperacion", () => {
  let gateway: InMemoryTradeGateway;
  let riskRepo: InMemoryAccountRiskStateRepository;
  let service: OperationsEngineService;

  beforeEach(() => {
    gateway = new InMemoryTradeGateway();
    riskRepo = new InMemoryAccountRiskStateRepository();
    riskRepo.seed(ACCOUNT_ID);
    const riskEngineService = new RiskEngineService(riskRepo, new InMemoryCapitalFactsProvider());
    service = new OperationsEngineService(gateway, riskEngineService);
  });

  it("edición pura de datos (solo notas) nunca invoca a Risk Engine", async () => {
    gateway.seedTrade(
      openTrade({ status: "closed", r_max: rvalue("0.4000"), r_final: rvalue("-1.0000"), pnl_amount: money("-100.0000") }),
    );

    const result = await service.editarOperacion({ trade_id: TRADE_ID, notes: "corrección de un typo" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.accumulator_update).toBeNull();
  });

  it("editar un campo que afecta a R_final en una Operación todavía Abierta no recalcula (R_final no existe aún)", async () => {
    gateway.seedTrade(openTrade());

    const result = await service.editarOperacion({ trade_id: TRADE_ID, rr_objective: rvalue("5.0000") });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.accumulator_update).toBeNull();
  });

  it("editar rr_objective en una Operación Cerrada recalcula vía Risk Engine y reconstruye el acumulador desde la muestra vigente", async () => {
    gateway.seedTrade(
      openTrade({ status: "closed", r_max: rvalue("0.4000"), r_final: rvalue("-1.0000"), pnl_amount: money("-100.0000") }),
    );
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("-1.0000"), rvalue("2.0000")]);

    const result = await service.editarOperacion({ trade_id: TRADE_ID, rr_objective: rvalue("5.0000") });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.trade.rr_objective).toEqual(rvalue("5.0000"));
    expect(result.value.accumulator_update).not.toBeNull();
    expect(result.value.accumulator_update?.ok).toBe(true);
    if (result.value.accumulator_update?.ok) {
      // n=2 porque la reconstrucción usa la muestra vigente completa (2
      // elementos sembrados), no un incremento de +1 sobre el estado previo.
      expect(result.value.accumulator_update.value.outcome.kind).toBe("applied");
      if (result.value.accumulator_update.value.outcome.kind === "applied") {
        expect(result.value.accumulator_update.value.outcome.state.accumulator.n).toBe(2);
      }
    }
  });

  it("propaga TRADE_NOT_FOUND cuando la Operación no existe", async () => {
    const result = await service.editarOperacion({ trade_id: "inexistente", notes: "x" });
    expect(result).toEqual({ ok: false, error: { code: "TRADE_NOT_FOUND", trade_id: "inexistente" } });
  });
});
