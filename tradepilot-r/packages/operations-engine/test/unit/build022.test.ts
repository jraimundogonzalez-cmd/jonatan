// BUILD 022 — R realizado en una Operación abierta, R agregado de la Cuenta y
// la previsualización de la corrección.
import { beforeEach, describe, expect, it } from "vitest";
import { BETrigger, RiskEngineService, money, percent, rvalue, toDisplayString } from "@tradepilot/risk-engine";
import { OperationsEngineService } from "../../src/services/OperationsEngineService.js";
import type { Trade } from "../../src/domain/types.js";
import { InMemoryTradeGateway } from "../fakes/InMemoryTradeGateway.js";
import {
  InMemoryAccountRiskStateRepository,
  InMemoryCapitalFactsProvider,
} from "../fakes/InMemoryRiskEngineDependencies.js";

const ACCOUNT_ID = "acc-1";
const TRADE_ID = "trade-1";

function trade(overrides: Partial<Trade> = {}): Trade {
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
    symbol: "EURUSD",
    side: "long",
    opened_at: "2026-01-01T00:00:00Z",
    risk_pct: "1.00",
    instrument_key: null,
    closed_at: null,
    time_in_market_sec: null,
    closure_idempotency_key: null,
    cancellation_reason: null,
    notes: null,
    comments: null,
    ...overrides,
  };
}

const PARCIALES = [
  { sequence: 1 as const, rr_level: rvalue("1.0000"), pct_close: percent("50.00"), executed_at: "2026-01-01T01:00:00Z" },
  { sequence: 2 as const, rr_level: rvalue("2.0000"), pct_close: percent("25.00"), executed_at: "2026-01-01T02:00:00Z" },
];

let gateway: InMemoryTradeGateway;
let service: OperationsEngineService;

beforeEach(() => {
  gateway = new InMemoryTradeGateway();
  const repo = new InMemoryAccountRiskStateRepository();
  repo.seed(ACCOUNT_ID);
  service = new OperationsEngineService(gateway, new RiskEngineService(repo, new InMemoryCapitalFactsProvider()));
});

describe("resumenEvidencia — R realizado con la Operación abierta", () => {
  it("devuelve el R ya materializado por los parciales", async () => {
    gateway.seedTrade(trade());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    const r = await service.resumenEvidencia(TRADE_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(toDisplayString(r.value.r_realizado)).toBe("1.0000");
    expect(toDisplayString(r.value.pct_cerrado)).toBe("75.00");
    expect(toDisplayString(r.value.pct_abierto)).toBe("25.00");
  });

  it("funciona SIN r_max — que es el punto: la Operación sigue abierta", async () => {
    gateway.seedTrade(trade({ r_max: null }));
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    const r = await service.resumenEvidencia(TRADE_ID);
    expect(r.ok).toBe(true);
  });

  it("expone el mayor R evidenciado, que es el suelo de r_max", async () => {
    gateway.seedTrade(trade());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    const r = await service.resumenEvidencia(TRADE_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.r_maximo_evidenciado!)).toBe("2.0000");
  });

  it("no escribe nada", async () => {
    gateway.seedTrade(trade());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    await service.resumenEvidencia(TRADE_ID);
    expect(gateway.cierreCallCount).toBe(0);
    expect(gateway.edicionCallCount).toBe(0);
  });
});

describe("resumenDeCuenta — R agregado (decisión E-1)", () => {
  it("suma la MUESTRA VIGENTE, no un acumulador aparte", async () => {
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("2.0000"), rvalue("-1.0000"), rvalue("1.7500")]);

    const r = await service.resumenDeCuenta(ACCOUNT_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(toDisplayString(r.value.r_agregado)).toBe("2.7500");
    expect(r.value.operaciones_en_la_muestra).toBe(3);
  });

  it("cuenta los estados por separado", async () => {
    gateway.seedTrade(trade({ id: "t1", status: "closed" }));
    gateway.seedTrade(trade({ id: "t2", status: "open" }));
    gateway.seedTrade(trade({ id: "t3", status: "cancelled", cancellation_reason: "Registrada por error" }));
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("2.0000")]);

    const r = await service.resumenDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.cerradas).toBe(1);
    expect(r.value.abiertas).toBe(1);
    expect(r.value.canceladas).toBe(1);
  });

  it("una Cancelada NO altera el R agregado", async () => {
    // La muestra vigente excluye las Canceladas por construcción
    // (`listar_r_final_vigente_por_cuenta` filtra `status = 'closed'`). Aquí se
    // comprueba que el servicio no las reintroduce por otra vía al contar.
    gateway.seedTrade(trade({ id: "t1", status: "closed", r_final: rvalue("2.0000") }));
    gateway.seedTrade(trade({ id: "t2", status: "cancelled", cancellation_reason: "Error" }));
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("2.0000")]);

    const r = await service.resumenDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.r_agregado)).toBe("2.0000");
    expect(r.value.operaciones_en_la_muestra).toBe(1);
    expect(r.value.canceladas).toBe(1);
  });

  it("una Cuenta sin Operaciones cerradas da 0, no un error", async () => {
    const r = await service.resumenDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.r_agregado)).toBe("0.0000");
  });
});

describe("previsualizarCorreccion — enseñar antes de mover capital", () => {
  const cerrada = () =>
    trade({
      status: "closed",
      r_max: rvalue("2.5000"),
      r_final: rvalue("1.0000"),
      pnl_amount: money("100.0000"),
      closure_reason: "BREAK_EVEN",
    });

  it("muestra el R nuevo y la diferencia exacta", async () => {
    gateway.seedTrade(cerrada());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    // Subir r_max a 3.0 hace que el resto pase a valer rr_objetivo (3.0):
    // 0,5 + 0,5 + 0,25×3 = 1,75.
    const r = await service.previsualizarCorreccion({
      trade_id: TRADE_ID,
      r_max: rvalue("3.0000"),
      closure_reason: "TAKE_PROFIT_FULL",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(toDisplayString(r.value.r_actual!)).toBe("1.0000");
    expect(toDisplayString(r.value.r_nuevo)).toBe("1.7500");
    expect(toDisplayString(r.value.delta_r)).toBe("0.7500");
  });

  it("muestra el impacto monetario, que es el que moverá el capital", async () => {
    gateway.seedTrade(cerrada());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    const r = await service.previsualizarCorreccion({
      trade_id: TRADE_ID,
      r_max: rvalue("3.0000"),
      closure_reason: "TAKE_PROFIT_FULL",
    });
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.pnl_actual!)).toBe("100.0000");
    expect(toDisplayString(r.value.pnl_nuevo)).toBe("175.0000");
    expect(toDisplayString(r.value.delta_pnl)).toBe("75.0000");
  });

  it("NO escribe: ni corrección ni cierre", async () => {
    gateway.seedTrade(cerrada());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    await service.previsualizarCorreccion({ trade_id: TRADE_ID, r_max: rvalue("3.0000") });
    expect(gateway.edicionCallCount).toBe(0);
    expect(gateway.cierreCallCount).toBe(0);

    const sinTocar = await gateway.obtenerOperacion(TRADE_ID);
    if (!sinTocar.ok) throw new Error("unreachable");
    expect(toDisplayString(sinTocar.value.r_final!)).toBe("1.0000");
  });

  it("lo que enseña es EXACTAMENTE lo que después persiste", async () => {
    // La propiedad que justifica todo el diseño: previsualizar y aplicar
    // comparten `construirEntradaDeCorreccion` y `calcularResultado`. Si
    // alguien duplicara la fórmula, este test lo vería.
    gateway.seedTrade(cerrada());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);
    const entrada = { trade_id: TRADE_ID, r_max: rvalue("3.0000"), closure_reason: "TAKE_PROFIT_FULL" as const };

    const previa = await service.previsualizarCorreccion(entrada);
    const aplicada = await service.editarOperacion(entrada);
    if (!previa.ok || !aplicada.ok) throw new Error("unreachable");

    expect(toDisplayString(aplicada.value.trade.r_final!)).toBe(toDisplayString(previa.value.r_nuevo));
    expect(toDisplayString(aplicada.value.trade.pnl_amount!)).toBe(toDisplayString(previa.value.pnl_nuevo));
  });

  it("explica de dónde sale el R nuevo, término a término", async () => {
    gateway.seedTrade(cerrada());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    const r = await service.previsualizarCorreccion({ trade_id: TRADE_ID, r_max: rvalue("3.0000") });
    if (!r.ok) throw new Error("unreachable");
    // Dos parciales + el resto.
    expect(r.value.impacto_por_parcial).toHaveLength(3);
    expect(r.value.evidencia_leida).toBe(2);
  });

  it("una Operación abierta no tiene desenlace que corregir", async () => {
    gateway.seedTrade(trade({ status: "open" }));

    const r = await service.previsualizarCorreccion({ trade_id: TRADE_ID, r_max: rvalue("1.0000") });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("refleja el borrado explícito de cierre_manual_rr antes de aplicarlo", async () => {
    gateway.seedTrade(
      trade({
        status: "closed",
        r_max: rvalue("2.5000"),
        r_final: rvalue("1.5000"),
        pnl_amount: money("150.0000"),
        closure_reason: "MANUAL_CLOSE",
        cierre_manual_rr: rvalue("1.5000"),
      }),
    );

    const r = await service.previsualizarCorreccion({
      trade_id: TRADE_ID,
      closure_reason: "TAKE_PROFIT_FULL",
      borrar_cierre_manual_rr: true,
    });
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.cierre_manual_actual!)).toBe("1.5000");
    expect(r.value.cierre_manual_nuevo).toBeNull();
    // Sin la premisa borrada y con r_max (2.5) ≥ objetivo (3.0)? No: 2.5 < 3.0
    // y no hay parciales, así que el resto vale −1 y R_final = −1.
    expect(toDisplayString(r.value.r_nuevo)).toBe("-1.0000");
  });
});

describe("la previsualización del cierre también explica su R", () => {
  it("devuelve el desglose que antes se descartaba", async () => {
    gateway.seedTrade(trade());
    gateway.seedExecutedPartials(TRADE_ID, PARCIALES);

    const r = await service.previsualizarCierre({
      trade_id: TRADE_ID,
      closed_at: "2026-01-02T00:00:00Z",
      closure_reason: "BREAK_EVEN",
      r_max: rvalue("2.5000"),
    });
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.impacto_por_parcial).toHaveLength(3);
    expect(toDisplayString(r.value.r_final)).toBe("1.0000");
    expect(gateway.cierreCallCount).toBe(0);
  });
});
