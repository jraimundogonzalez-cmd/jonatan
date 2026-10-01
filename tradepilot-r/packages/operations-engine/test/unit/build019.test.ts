// BUILD 019 — previsualización, borrado explícito de `cierre_manual_rr` y
// traducción tipada de errores.
import { beforeEach, describe, expect, it } from "vitest";
import { BETrigger, RiskEngineService, money, percent, rvalue, toDisplayString } from "@tradepilot/risk-engine";
import { OperationsEngineService } from "../../src/services/OperationsEngineService.js";
import { parseOperationsError } from "../../src/adapters/SupabaseTradeGateway.js";
import type { Trade } from "../../src/domain/types.js";
import { InMemoryTradeGateway } from "../fakes/InMemoryTradeGateway.js";
import { InMemoryAccountRiskStateRepository, InMemoryCapitalFactsProvider } from "../fakes/InMemoryRiskEngineDependencies.js";

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

function nuevoServicio() {
  const gateway = new InMemoryTradeGateway();
  const riskRepo = new InMemoryAccountRiskStateRepository();
  riskRepo.seed(ACCOUNT_ID);
  const service = new OperationsEngineService(
    gateway,
    new RiskEngineService(riskRepo, new InMemoryCapitalFactsProvider()),
  );
  return { gateway, service };
}

describe("BUILD 019 · previsualización del desenlace", () => {
  let harness: ReturnType<typeof nuevoServicio>;
  beforeEach(() => {
    harness = nuevoServicio();
  });

  it("no escribe absolutamente nada: la Operación sigue Abierta y no se llamó al cierre", async () => {
    harness.gateway.seedTrade(trade());

    const result = await harness.service.previsualizarCierre({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });

    expect(result.ok).toBe(true);
    expect(harness.gateway.cierreCallCount).toBe(0);
    const despues = await harness.gateway.obtenerOperacion(TRADE_ID);
    expect(despues.ok && despues.value.status).toBe("open");
  });

  // La aserción que impide que alguien introduzca una segunda fórmula: si
  // previsualizar y cerrar dejaran de coincidir, sería porque el cálculo se ha
  // duplicado en algún sitio.
  it("previsualizar y cerrar con la MISMA entrada producen el mismo R_final y el mismo P&L", async () => {
    harness.gateway.seedTrade(trade());
    harness.gateway.seedExecutedPartials(TRADE_ID, [
      { sequence: 1, rr_level: rvalue("1.0000"), pct_close: percent("50.00"), executed_at: "2026-01-01T00:30:00Z" },
    ]);
    const entrada = {
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "BREAK_EVEN" as const,
      r_max: rvalue("2.0000"),
    };

    const previa = await harness.service.previsualizarCierre(entrada);
    const cierre = await harness.service.cerrarOperacion(entrada);

    expect(previa.ok && cierre.ok).toBe(true);
    if (!previa.ok || !cierre.ok) throw new Error("unreachable");
    expect(toDisplayString(previa.value.r_final)).toBe(toDisplayString(cierre.value.trade.r_final!));
    expect(toDisplayString(previa.value.pnl_amount)).toBe(toDisplayString(cierre.value.trade.pnl_amount!));
    expect(previa.value.evidencia_leida).toBe(1);
  });

  it("rechaza previsualizar una Operación que no está Abierta", async () => {
    harness.gateway.seedTrade(trade({ status: "closed" }));
    const result = await harness.service.previsualizarCierre({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });
    expect(result).toEqual({ ok: false, error: { code: "INVALID_STATE_TRANSITION", from: "closed", to: "closed" } });
  });
});

describe("BUILD 019 · la ventana previsualización → confirmación", () => {
  let harness: ReturnType<typeof nuevoServicio>;
  beforeEach(() => {
    harness = nuevoServicio();
  });

  it("si la evidencia cambió desde la previsualización, devuelve EVIDENCE_CHANGED y NO llama a la RPC", async () => {
    harness.gateway.seedTrade(trade());
    harness.gateway.seedExecutedPartials(TRADE_ID, [
      { sequence: 1, rr_level: rvalue("1.0000"), pct_close: percent("50.00"), executed_at: "2026-01-01T00:30:00Z" },
    ]);

    // El usuario previsualizó cuando no había ningún parcial; al confirmar ya hay uno.
    const result = await harness.service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("2.0000"),
      evidencia_previsualizada: 0,
    });

    expect(result).toEqual({ ok: false, error: { code: "EVIDENCE_CHANGED", esperados: 0, actuales: 1 } });
    // Lo decisivo: no se intentó escribir. El desenlace no llegó a existir.
    expect(harness.gateway.cierreCallCount).toBe(0);
  });

  it("si la evidencia coincide, cierra con normalidad", async () => {
    harness.gateway.seedTrade(trade());
    harness.gateway.seedExecutedPartials(TRADE_ID, [
      { sequence: 1, rr_level: rvalue("1.0000"), pct_close: percent("50.00"), executed_at: "2026-01-01T00:30:00Z" },
    ]);

    const result = await harness.service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "BREAK_EVEN",
      r_max: rvalue("2.0000"),
      evidencia_previsualizada: 1,
    });

    expect(result.ok).toBe(true);
    expect(harness.gateway.cierreCallCount).toBe(1);
  });

  it("omitir la evidencia previsualizada no desactiva el testigo de BUILD 018", async () => {
    harness.gateway.seedTrade(trade());
    const result = await harness.service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });
    expect(result.ok).toBe(true);
    expect(harness.gateway.lastCierreParams?.expectedPartials).toBe(0);
  });
});

// La idempotencia del cierre existía en la RPC desde BUILD 018, pero este
// servicio cortaba antes con `status !== "open"` y la RPC nunca llegaba a
// ejecutarse en un reintento. Por la ruta real de la aplicación —la única que
// la interfaz puede usar— reenviar el mismo cierre devolvía
// INVALID_STATE_TRANSITION en vez de la Operación ya cerrada. Lo detectó la
// verificación end-to-end contra Postgres, no estos dobles.
describe("BUILD 019 · la idempotencia del cierre es alcanzable desde el servicio", () => {
  let harness: ReturnType<typeof nuevoServicio>;
  beforeEach(() => {
    harness = nuevoServicio();
  });

  const CLAVE = "11111111-2222-3333-4444-555555555555";

  it("un reenvío con la MISMA clave devuelve la Operación cerrada, sin error y sin reescribir", async () => {
    harness.gateway.seedTrade(
      trade({
        status: "closed",
        r_max: rvalue("0.4000"),
        r_final: rvalue("-1.0000"),
        pnl_amount: money("-100.0000"),
        closure_reason: "STOP_LOSS",
        closure_idempotency_key: CLAVE,
      }),
    );

    const result = await harness.service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
      idempotency_key: CLAVE,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.trade.id).toBe(TRADE_ID);
    // Lo decisivo: no se volvió a escribir, luego no se duplicó `trade_pnl`.
    expect(harness.gateway.cierreCallCount).toBe(0);
  });

  it("un segundo cierre con clave DISTINTA sigue rechazándose", async () => {
    harness.gateway.seedTrade(
      trade({ status: "closed", closure_reason: "STOP_LOSS", closure_idempotency_key: CLAVE }),
    );
    const result = await harness.service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
      idempotency_key: "99999999-9999-9999-9999-999999999999",
    });
    expect(result).toEqual({ ok: false, error: { code: "INVALID_STATE_TRANSITION", from: "closed", to: "closed" } });
  });

  it("cerrar una Operación ya cerrada SIN clave sigue rechazándose", async () => {
    harness.gateway.seedTrade(
      trade({ status: "closed", closure_reason: "STOP_LOSS", closure_idempotency_key: CLAVE }),
    );
    const result = await harness.service.cerrarOperacion({
      trade_id: TRADE_ID,
      closed_at: "2026-01-01T01:00:00Z",
      closure_reason: "STOP_LOSS",
      r_max: rvalue("0.4000"),
    });
    expect(result.ok).toBe(false);
  });
});

describe("BUILD 019 · borrado explícito de cierre_manual_rr (D1)", () => {
  let harness: ReturnType<typeof nuevoServicio>;
  beforeEach(() => {
    harness = nuevoServicio();
    harness.gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("1.5000")]);
  });

  function cerradaComoManual(): Trade {
    return trade({
      status: "closed",
      r_max: rvalue("4.0000"),
      r_final: rvalue("1.5000"),
      pnl_amount: money("150.0000"),
      closure_reason: "MANUAL_CLOSE",
      cierre_manual_rr: rvalue("1.5000"),
    });
  }

  it("la bandera llega al puerto tal cual, sin deducirse del motivo", async () => {
    harness.gateway.seedTrade(cerradaComoManual());
    await harness.service.editarOperacion({
      trade_id: TRADE_ID,
      closure_reason: "TAKE_PROFIT_FULL",
      borrar_cierre_manual_rr: true,
    });
    expect(harness.gateway.lastEdicionParams?.borrarCierreManualRr).toBe(true);
  });

  it("cambiar SÓLO el motivo no borra nada — el borrado nunca se infiere", async () => {
    harness.gateway.seedTrade(cerradaComoManual());
    await harness.service.editarOperacion({ trade_id: TRADE_ID, closure_reason: "TAKE_PROFIT_FULL" });
    expect(harness.gateway.lastEdicionParams?.borrarCierreManualRr).toBeUndefined();
  });

  it("borrar dispara el recálculo aunque no se toque ningún otro campo de desenlace", async () => {
    harness.gateway.seedTrade(cerradaComoManual());
    const result = await harness.service.editarOperacion({
      trade_id: TRADE_ID,
      borrar_cierre_manual_rr: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // `accumulator_update` no nulo == se recalculó. Con `touchesRFinal` mal
    // escrito sería null y el desenlace quedaría con el R_final antiguo.
    expect(result.value.accumulator_update).not.toBeNull();
  });

  // EL TEST QUE IMPIDE EL FALLO MÁS SUTIL DE ESTE BUILD.
  //
  // Al borrar el cierre manual, el recálculo NO puede arrastrar el valor
  // anterior: la premisa acaba de desaparecer. Con `cierre_manual_rr` = 1.5 la
  // fórmula da 1.5000 (prioridad 1). Sin él, y con r_max 4.0 ≥ rr_objective
  // 3.0, la rama que aplica es la del objetivo: 3.0000.
  //
  // Si alguien "simplificase" el servicio dejando la lectura antigua, el
  // resultado seguiría siendo 1.5000, el trigger de BUILD 018 lo aceptaría por
  // ser internamente coherente, y la Operación quedaría diciendo
  // «take profit completo» con el R de un cierre manual que ya no existe.
  it("el recálculo tras el borrado NO usa el cierre_manual_rr antiguo", async () => {
    harness.gateway.seedTrade(cerradaComoManual());

    const result = await harness.service.editarOperacion({
      trade_id: TRADE_ID,
      closure_reason: "TAKE_PROFIT_FULL",
      borrar_cierre_manual_rr: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.trade.r_final!)).toBe("3.0000");
    expect(toDisplayString(result.value.trade.pnl_amount!)).toBe("300.0000");
    expect(result.value.trade.cierre_manual_rr).toBeNull();
  });

  it("sin la bandera, el recálculo sigue usando el cierre manual vigente", async () => {
    harness.gateway.seedTrade(cerradaComoManual());
    const result = await harness.service.editarOperacion({
      trade_id: TRADE_ID,
      r_max: rvalue("4.0000"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.trade.r_final!)).toBe("1.5000");
  });
});

describe("BUILD 019 · traducción tipada de errores de dominio", () => {
  it("reconoce EVIDENCE_CHANGED con sus dos contadores", () => {
    expect(
      parseOperationsError(
        "OPERATIONS_ERROR:EVIDENCE_CHANGED:los parciales ejecutados cambiaron durante el cierre (esperados 1, actuales 2) — recalcula y reintenta",
      ),
    ).toEqual({ code: "EVIDENCE_CHANGED", esperados: 1, actuales: 2 });
  });

  it("reconoce IMMUTABLE_IDENTITY_FACT y extrae el campo concreto", () => {
    expect(
      parseOperationsError(
        "OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:rr_objective:la identidad de una Operación se fija al nacer y no se corrige",
      ),
    ).toEqual({ code: "IMMUTABLE_IDENTITY_FACT", campo: "rr_objective" });
  });

  it("reconoce INVALID_STATE_TRANSITION y extrae origen y destino", () => {
    expect(
      parseOperationsError("OPERATIONS_ERROR:INVALID_STATE_TRANSITION:closed:closed:solo una Operación Abierta puede cerrarse"),
    ).toEqual({ code: "INVALID_STATE_TRANSITION", from: "closed", to: "closed" });
  });

  it("reconoce VALIDATION_ERROR y separa campo de detalle", () => {
    expect(
      parseOperationsError("OPERATIONS_ERROR:VALIDATION_ERROR:cierre_manual_rr:no se puede fijar y borrar en la misma corrección"),
    ).toEqual({
      code: "VALIDATION_ERROR",
      campo: "cierre_manual_rr",
      detail: "no se puede fijar y borrar en la misma corrección",
    });
  });

  it("reconoce DUPLICATE_PARTIAL_SEQUENCE y extrae la secuencia", () => {
    expect(
      parseOperationsError("OPERATIONS_ERROR:DUPLICATE_PARTIAL_SEQUENCE:ya existe un parcial ejecutado con sequence 2 en esta Operación"),
    ).toEqual({ code: "DUPLICATE_PARTIAL_SEQUENCE", sequence: 2 });
  });

  it("traduce los errores de coherencia de BUILD 018 conservando el detalle", () => {
    const r = parseOperationsError(
      "OPERATIONS_ERROR:INCOHERENT_CLOSURE_REASON:TAKE_PROFIT_FULL exige r_max (2.0000) >= rr_objective (3.0000)",
    );
    expect(r.code).toBe("INCOHERENT_CLOSURE_REASON");
    expect(r).toHaveProperty("detail", "TAKE_PROFIT_FULL exige r_max (2.0000) >= rr_objective (3.0000)");
  });

  it("traduce RLS y privilegios a UNAUTHORIZED", () => {
    expect(parseOperationsError("permission denied for table trades")).toEqual({ code: "UNAUTHORIZED" });
    expect(parseOperationsError('new row violates row-level security policy for table "trades"')).toEqual({
      code: "UNAUTHORIZED",
    });
  });

  // Degradación explícita (Trust Layer, SPEC-014): un código bien formado pero
  // desconocido NO se aplana — viaja entero para poder registrarlo.
  it("un código bien formado pero desconocido degrada a DOMAIN_ERROR sin perder el código", () => {
    expect(parseOperationsError("OPERATIONS_ERROR:ALGO_NUEVO_DE_UN_BUILD_FUTURO:detalle")).toEqual({
      code: "DOMAIN_ERROR",
      domain_code: "ALGO_NUEVO_DE_UN_BUILD_FUTURO",
      detail: "detalle",
    });
  });

  it("un mensaje irreconocible conserva el texto crudo en GATEWAY_ERROR", () => {
    expect(parseOperationsError("deadlock detected")).toEqual({ code: "GATEWAY_ERROR", detail: "deadlock detected" });
  });
});
