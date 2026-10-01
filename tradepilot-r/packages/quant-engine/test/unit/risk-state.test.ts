import { describe, expect, it } from "vitest";
import { calcularDrawdownState, money, percent, toDisplayString } from "../../src/index.js";

describe("calcularDrawdownState — static", () => {
  it("piso_estático = initial_capital × (1 − pct/100); restante_€ y restante_% (18 §2)", () => {
    const result = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      drawdown_type: "static",
      max_total_drawdown_pct: percent("10"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value.piso_vigente)).toBe("9000.0000");
    expect(toDisplayString(result.value.value.drawdown_restante_eur)).toBe("500.0000");
    expect(toDisplayString(result.value.value.drawdown_restante_pct)).toBe("5.26");
  });
});

describe("calcularDrawdownState — trailing y eod", () => {
  it("trailing: piso = peak_capital_basis × (1 − pct/100) — puede dar restante negativo (incumplimiento, no es un error)", () => {
    const result = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      peak_capital_basis: money("12000"),
      drawdown_type: "trailing",
      max_total_drawdown_pct: percent("10"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value.piso_vigente)).toBe("10800.0000");
    expect(toDisplayString(result.value.value.drawdown_restante_eur)).toBe("-1300.0000");
    expect(toDisplayString(result.value.value.drawdown_restante_pct)).toBe("-13.68");
  });

  it("eod usa exactamente la misma fórmula que trailing — la única diferencia es qué peak_capital_basis aporta el llamador", () => {
    const trailing = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      peak_capital_basis: money("11000"),
      drawdown_type: "trailing",
      max_total_drawdown_pct: percent("10"),
    });
    const eod = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      peak_capital_basis: money("11000"),
      drawdown_type: "eod",
      max_total_drawdown_pct: percent("10"),
    });
    expect(trailing.ok && eod.ok).toBe(true);
    if (!trailing.ok || !eod.ok) throw new Error("unreachable");
    expect(trailing.value.value).toEqual(eod.value.value);
  });

  it("OUT_OF_RANGE si drawdown_type≠static y falta peak_capital_basis", () => {
    const result = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      drawdown_type: "trailing",
      max_total_drawdown_pct: percent("10"),
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "OUT_OF_RANGE", field: "peak_capital_basis", detail: expect.any(String) },
    });
  });
});

describe("calcularDrawdownState — errores", () => {
  it("OUT_OF_RANGE si max_total_drawdown_pct es negativo", () => {
    const result = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      drawdown_type: "static",
      max_total_drawdown_pct: percent("-5"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toEqual({ code: "OUT_OF_RANGE", field: "max_total_drawdown_pct", detail: expect.any(String) });
  });

  it("OUT_OF_RANGE si max_total_drawdown_pct > 100", () => {
    const result = calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      drawdown_type: "static",
      max_total_drawdown_pct: percent("150"),
    });
    expect(result.ok).toBe(false);
  });

  it("UNDEFINED_RATIO ZERO_CAPITAL si current_capital = 0", () => {
    const result = calcularDrawdownState({
      current_capital: money("0"),
      initial_capital: money("10000"),
      drawdown_type: "static",
      max_total_drawdown_pct: percent("10"),
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "UNDEFINED_RATIO", reason: "ZERO_CAPITAL", detail: expect.any(String) },
    });
  });

  it("nunca decide si el drawdown restante es aceptable — un restante negativo se calcula igual que uno positivo", () => {
    const result = calcularDrawdownState({
      current_capital: money("1"),
      initial_capital: money("10000"),
      drawdown_type: "static",
      max_total_drawdown_pct: percent("10"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // piso=9000, restante_eur=1-9000=-8999 — muy negativo, pero Quant Engine lo calcula sin más.
    expect(toDisplayString(result.value.value.drawdown_restante_eur)).toBe("-8999.0000");
  });
});
