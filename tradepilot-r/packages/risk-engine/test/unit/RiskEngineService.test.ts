import { beforeEach, describe, expect, it } from "vitest";
import {
  BETrigger,
  calcularEsperanzaIncremental,
  EMPTY_WELFORD_ACCUMULATOR,
  money,
  percent,
  rvalue,
  toDisplayString,
  type RFinalInput,
} from "@tradepilot/quant-engine";
import { RiskEngineService } from "../../src/services/RiskEngineService.js";
import type { OperacionCerradaEvent, OperacionEditadaEvent } from "../../src/domain/events.js";
import { InMemoryAccountRiskStateRepository } from "../fakes/InMemoryAccountRiskStateRepository.js";
import { InMemoryCapitalFactsProvider } from "../fakes/InMemoryCapitalFactsProvider.js";

const ACCOUNT_ID = "acc-1";

/** Caso golden de quant-engine (test/golden/r-final.test.ts): Stop Loss puro → R_final = -1.0000. */
function stopLossPuroInput(): RFinalInput {
  return {
    riesgo_eur: money("100.0000"),
    rr_objetivo: rvalue("3.0000"),
    parciales_ejecutados: [],
    r_max: rvalue("0.4000"),
    be_trigger: BETrigger.NONE,
  };
}

function operacionCerrada(eventId: string, input: RFinalInput = stopLossPuroInput()): OperacionCerradaEvent {
  return {
    kind: "OperacionCerrada",
    event_id: eventId,
    account_id: ACCOUNT_ID,
    trade_id: `trade-${eventId}`,
    occurred_at: "2026-01-01T00:00:00Z",
    r_final_input: input,
  };
}

describe("RiskEngineService.calcularResultado", () => {
  it("delega el R_final íntegro a calcularRFinal — el golden dataset de quant-engine sigue valiendo aquí", () => {
    const service = new RiskEngineService(new InMemoryAccountRiskStateRepository(), new InMemoryCapitalFactsProvider());
    const result = service.calcularResultado(stopLossPuroInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.r_final.value)).toBe("-1.0000");
  });

  it("propaga un QuantError tipado sin envolverlo en excepción cuando el input es inválido", () => {
    const service = new RiskEngineService(new InMemoryAccountRiskStateRepository(), new InMemoryCapitalFactsProvider());
    const result = service.calcularResultado({
      riesgo_eur: money("0.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: [],
      r_max: rvalue("0.4000"),
      be_trigger: BETrigger.NONE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("QUANT_ENGINE_ERROR");
  });
});

describe("RiskEngineService.procesarOperacionCerrada", () => {
  let repo: InMemoryAccountRiskStateRepository;
  let facts: InMemoryCapitalFactsProvider;
  let service: RiskEngineService;

  beforeEach(() => {
    repo = new InMemoryAccountRiskStateRepository();
    repo.seed(ACCOUNT_ID);
    facts = new InMemoryCapitalFactsProvider();
    service = new RiskEngineService(repo, facts);
  });

  it("actualiza el acumulador con O(1) y emite AcumuladorActualizado con trigger=incremental", async () => {
    const result = await service.procesarOperacionCerrada(operacionCerrada("evt-1"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.outcome.kind).toBe("applied");
    if (result.value.outcome.kind !== "applied") throw new Error("unreachable");
    expect(result.value.outcome.state.accumulator.n).toBe(1);
    expect(toDisplayString(result.value.outcome.state.accumulator.mean)).toBe("-1.0000");
    expect(result.value.outcome.state.version).toBe(1);
    expect(result.value.evento_emitido).toEqual({
      kind: "AcumuladorActualizado",
      account_id: ACCOUNT_ID,
      accumulator: result.value.outcome.state.accumulator,
      trigger: "incremental",
      occurred_at: expect.any(String) as unknown as string,
    });
  });

  it("es idempotente frente al mismo event_id — no reprocesa ni emite un segundo evento", async () => {
    const first = await service.procesarOperacionCerrada(operacionCerrada("evt-dup"));
    expect(first.ok).toBe(true);

    const second = await service.procesarOperacionCerrada(operacionCerrada("evt-dup"));
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("unreachable");
    expect(second.value.outcome.kind).toBe("already_processed");
    expect(second.value.evento_emitido).toBeNull();
    expect(repo.outbox).toHaveLength(1);
  });

  it("reintenta automáticamente tras un conflicto de versión y termina aplicando la escritura", async () => {
    const originalAplicar = repo.aplicarActualizacion.bind(repo);
    let calls = 0;
    repo.aplicarActualizacion = async (params) => {
      calls += 1;
      if (calls === 1) {
        // Simula que otra actualización concurrente ganó la carrera entre la
        // lectura inicial y la escritura — la fila real ya está en version=1.
        const winner = await originalAplicar({ ...params, eventId: "evt-concurrent-winner" });
        if (winner.ok && winner.value.kind === "applied") {
          return { ok: true, value: { kind: "version_conflict", current: winner.value.state } };
        }
      }
      return originalAplicar(params);
    };

    const result = await service.procesarOperacionCerrada(operacionCerrada("evt-retry"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.outcome.kind).toBe("applied");
    if (result.value.outcome.kind !== "applied") throw new Error("unreachable");
    // n=2: la escritura "ganadora" simulada + la propia, ambas con R_final=-1.
    expect(result.value.outcome.state.accumulator.n).toBe(2);
    expect(calls).toBeGreaterThan(1);
  });

  it("agota los reintentos y devuelve VERSION_CONFLICT_EXCEEDED si el conflicto nunca se resuelve", async () => {
    repo.aplicarActualizacion = async (params) => {
      const current = await repo.obtener(params.accountId);
      if (!current.ok) return current;
      return { ok: true, value: { kind: "version_conflict", current: current.value } };
    };

    const result = await service.procesarOperacionCerrada(operacionCerrada("evt-never-resolves"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toEqual({ code: "VERSION_CONFLICT_EXCEEDED", account_id: ACCOUNT_ID, attempts: 5 });
  });

  it("propaga ACCOUNT_NOT_FOUND cuando la Cuenta no tiene estado de riesgo provisionado", async () => {
    const result = await service.procesarOperacionCerrada(operacionCerrada("evt-1", stopLossPuroInput()));
    // Cuenta distinta, nunca sembrada en el repositorio.
    const eventoOtraCuenta = { ...operacionCerrada("evt-otra"), account_id: "acc-inexistente" };
    const otro = await service.procesarOperacionCerrada(eventoOtraCuenta);
    expect(otro.ok).toBe(false);
    if (otro.ok) throw new Error("unreachable");
    expect(otro.error).toEqual({ code: "ACCOUNT_NOT_FOUND", account_id: "acc-inexistente" });
    expect(result.ok).toBe(true);
  });
});

describe("RiskEngineService.procesarOperacionEditada / procesarOperacionCancelada", () => {
  it("reconstruye el acumulador completo desde la muestra vigente (Welford no admite resta O(1))", async () => {
    const repo = new InMemoryAccountRiskStateRepository();
    const yaAplicado = [rvalue("-1.0000"), rvalue("2.0000"), rvalue("0.5000")].reduce(
      calcularEsperanzaIncremental,
      EMPTY_WELFORD_ACCUMULATOR,
    );
    repo.seed(ACCOUNT_ID, { accumulator: yaAplicado, version: 3 });
    const service = new RiskEngineService(repo, new InMemoryCapitalFactsProvider());

    const event: OperacionEditadaEvent = {
      kind: "OperacionEditada",
      event_id: "evt-edit-1",
      account_id: ACCOUNT_ID,
      trade_id: "trade-1",
      occurred_at: "2026-01-01T00:00:00Z",
      // La operación editada cambió: la muestra vigente ya no incluye -1.0000.
      muestra_r_final_vigente: [rvalue("2.0000"), rvalue("0.5000")],
    };

    const result = await service.procesarOperacionEditada(event);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    if (result.value.outcome.kind !== "applied") throw new Error("unreachable");
    expect(result.value.outcome.state.accumulator.n).toBe(2);
    expect(toDisplayString(result.value.outcome.state.accumulator.mean)).toBe("1.2500");
    expect(result.value.evento_emitido?.trigger).toBe("reconstruccion");
  });
});

describe("RiskEngineService.obtenerEstadoDrawdown", () => {
  it("ensambla DrawdownStateInput solo con los hechos de capital del proveedor, sin peak_capital_basis cuando el tipo es static", async () => {
    const repo = new InMemoryAccountRiskStateRepository();
    const facts = new InMemoryCapitalFactsProvider();
    facts.seed(ACCOUNT_ID, { current_capital: money("9000.0000"), initial_capital: money("10000.0000") });
    const service = new RiskEngineService(repo, facts);

    const result = await service.obtenerEstadoDrawdown(ACCOUNT_ID, {
      drawdown_type: "static",
      max_total_drawdown_pct: percent("10.00"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.drawdown_restante_pct).toBeDefined();
  });

  it("propaga CAPITAL_FACTS_UNAVAILABLE cuando Funding Management no tiene datos de la Cuenta", async () => {
    const service = new RiskEngineService(new InMemoryAccountRiskStateRepository(), new InMemoryCapitalFactsProvider());
    const result = await service.obtenerEstadoDrawdown(ACCOUNT_ID, {
      drawdown_type: "static",
      max_total_drawdown_pct: percent("10.00"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("CAPITAL_FACTS_UNAVAILABLE");
  });
});

describe("RiskEngineService.obtenerEsperanzaAgregada / obtenerDesviacionAgregada", () => {
  it("lee la esperanza directamente del acumulador persistido, sin recalcular nada", async () => {
    const repo = new InMemoryAccountRiskStateRepository();
    const acc = [rvalue("1.0000"), rvalue("-1.0000"), rvalue("2.0000")].reduce(
      calcularEsperanzaIncremental,
      EMPTY_WELFORD_ACCUMULATOR,
    );
    repo.seed(ACCOUNT_ID, { accumulator: acc, version: 3 });
    const service = new RiskEngineService(repo, new InMemoryCapitalFactsProvider());

    const esperanza = await service.obtenerEsperanzaAgregada(ACCOUNT_ID);
    expect(esperanza.ok).toBe(true);
    if (!esperanza.ok) throw new Error("unreachable");
    expect(toDisplayString(esperanza.value)).toBe(toDisplayString(acc.mean));

    const desviacion = await service.obtenerDesviacionAgregada(ACCOUNT_ID);
    expect(desviacion.ok).toBe(true);
  });

  it("devuelve un error tipado (no NaN, no excepción) cuando la Cuenta no tiene operaciones todavía", async () => {
    const repo = new InMemoryAccountRiskStateRepository();
    repo.seed(ACCOUNT_ID);
    const service = new RiskEngineService(repo, new InMemoryCapitalFactsProvider());

    const esperanza = await service.obtenerEsperanzaAgregada(ACCOUNT_ID);
    expect(esperanza.ok).toBe(false);
    if (esperanza.ok) throw new Error("unreachable");
    expect(esperanza.error.code).toBe("QUANT_ENGINE_ERROR");
  });
});
