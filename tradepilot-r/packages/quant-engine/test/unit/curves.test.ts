import { describe, expect, it } from "vitest";
import {
  calcularCurvaEquity,
  calcularDrawdownHistorico,
  money,
  rvalue,
  toDisplayString,
  type TimeSeries,
} from "../../src/index.js";

function puntosMoney(valores: string[]): TimeSeries<ReturnType<typeof money>> {
  return valores.map((valor, i) => ({ timestamp: `2026-01-0${i + 1}T00:00:00Z`, value: money(valor) }));
}

describe("calcularCurvaEquity", () => {
  it("acumula Beneficio_real en orden cronológico: [100, -50, 200] → [100, 50, 250]", () => {
    const result = calcularCurvaEquity(puntosMoney(["100", "-50", "200"]));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.value.map((p) => toDisplayString(p.value))).toEqual([
      "100.0000",
      "50.0000",
      "250.0000",
    ]);
  });

  it("es genérica sobre el brand — funciona igual para RValue (unidad R) que para Money (unidad EUR)", () => {
    const puntosR: TimeSeries<ReturnType<typeof rvalue>> = ["1", "-0.5", "2"].map((valor, i) => ({
      timestamp: `2026-01-0${i + 1}T00:00:00Z`,
      value: rvalue(valor),
    }));
    const result = calcularCurvaEquity(puntosR);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.value.map((p) => toDisplayString(p.value))).toEqual(["1.0000", "0.5000", "2.5000"]);
  });

  it("INCONSISTENT_TRIGGER_STATE si los timestamps no son estrictamente crecientes — nunca reordena en silencio", () => {
    const puntos = [
      { timestamp: "2026-01-02T00:00:00Z", value: money("100") },
      { timestamp: "2026-01-01T00:00:00Z", value: money("50") },
    ];
    const result = calcularCurvaEquity(puntos);
    expect(result).toEqual({
      ok: false,
      error: { code: "INCONSISTENT_TRIGGER_STATE", detail: expect.any(String) },
    });
  });

  it("rechaza timestamps duplicados (no estrictamente crecientes)", () => {
    const puntos = [
      { timestamp: "2026-01-01T00:00:00Z", value: money("100") },
      { timestamp: "2026-01-01T00:00:00Z", value: money("50") },
    ];
    const result = calcularCurvaEquity(puntos);
    expect(result.ok).toBe(false);
  });

  it("EMPTY_SAMPLE con 0 puntos", () => {
    expect(calcularCurvaEquity([])).toEqual({ ok: false, error: { code: "EMPTY_SAMPLE", detail: expect.any(String) } });
  });
});

describe("calcularDrawdownHistorico", () => {
  it("Drawdown_t = Equity_t − max histórico corriente", () => {
    const equityResult = calcularCurvaEquity(puntosMoney(["100", "-50", "200"]));
    expect(equityResult.ok).toBe(true);
    if (!equityResult.ok) throw new Error("unreachable");

    const result = calcularDrawdownHistorico(equityResult.value.value);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    expect(result.value.value.serie.map((p) => toDisplayString(p.value))).toEqual([
      "0.0000",
      "-50.0000",
      "0.0000",
    ]);
    expect(toDisplayString(result.value.value.max_drawdown)).toBe("-50.0000");
  });

  it("max_drawdown = 0 para una curva siempre creciente — resultado válido, nunca un error", () => {
    const equityResult = calcularCurvaEquity(puntosMoney(["100", "50", "75"]));
    expect(equityResult.ok).toBe(true);
    if (!equityResult.ok) throw new Error("unreachable");

    const result = calcularDrawdownHistorico(equityResult.value.value);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value.max_drawdown)).toBe("0.0000");
  });

  it("EMPTY_SAMPLE con curva vacía", () => {
    expect(calcularDrawdownHistorico([])).toEqual({
      ok: false,
      error: { code: "EMPTY_SAMPLE", detail: expect.any(String) },
    });
  });
});
