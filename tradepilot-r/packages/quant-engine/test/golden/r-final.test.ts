/**
 * Golden dataset de implementation/mvp-0.1.md §11.1 — comparación exacta
 * (`toBe`, no `toBeCloseTo`): la aritmética es exacta por diseño (SPEC-001
 * §4.3), una tolerancia de comparación escondería justo el tipo de error que
 * este catálogo existe para prevenir.
 *
 * El caso 4 usa el valor corregido `1.7800` — el documento aprobado tenía un
 * error de transcripción (`1.6600`) que no coincidía con su propia fórmula
 * mostrada; ver la corrección documentada en implementation/mvp-0.1.md §14.6.
 */
import { describe, expect, it } from "vitest";
import {
  BETrigger,
  calcularRFinal,
  money,
  percent,
  rvalue,
  toDisplayString,
  type ParcialEjecutado,
  type RFinalInput,
} from "../../src/index.js";

function parcial(sequence: 1 | 2 | 3 | 4 | 5, rrLevel: string, pctClose: string): ParcialEjecutado {
  return {
    sequence,
    rr_level: rvalue(rrLevel),
    pct_close: percent(pctClose),
    executed_at: "2026-01-01T00:00:00Z",
  };
}

describe("calcularRFinal — golden dataset (mvp-0.1.md §11.1)", () => {
  it("Stop Loss puro → -1.0000", () => {
    const input: RFinalInput = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: [],
      r_max: rvalue("0.4000"),
      be_trigger: BETrigger.NONE,
    };
    const result = calcularRFinal(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("-1.0000");
  });

  it("Break Even tras 1 parcial (50% @ 1.0000R) → 0.5000", () => {
    const input: RFinalInput = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "50.00")],
      r_max: rvalue("1.8000"),
      be_trigger: BETrigger.AFTER_NTH_PARTIAL,
    };
    const result = calcularRFinal(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("0.5000");
  });

  it("Take Profit completo, sin parciales → 3.0000", () => {
    const input: RFinalInput = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: [],
      r_max: rvalue("3.2000"),
      be_trigger: BETrigger.NONE,
    };
    const result = calcularRFinal(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("3.0000");
  });

  it("Cierre manual con 2 parciales (30% @ 1R, 30% @ 2R, resto en 2.2R) → 1.7800", () => {
    const input: RFinalInput = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("5.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "30.00"), parcial(2, "2.0000", "30.00")],
      r_max: rvalue("2.5000"),
      be_trigger: BETrigger.NONE,
      cierre_manual_rr: rvalue("2.2000"),
    };
    const result = calcularRFinal(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("1.7800");
  });
});

describe("calcularRFinal — edge cases (SPEC-001 §6.3)", () => {
  const base: RFinalInput = {
    riesgo_eur: money("100.0000"),
    rr_objetivo: rvalue("3.0000"),
    parciales_ejecutados: [],
    r_max: rvalue("1.0000"),
    be_trigger: BETrigger.NONE,
  };

  it("riesgo_eur = 0 → OUT_OF_RANGE", () => {
    const result = calcularRFinal({ ...base, riesgo_eur: money("0.0000") });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toEqual({ code: "OUT_OF_RANGE", field: "riesgo_eur", detail: expect.any(String) });
  });

  it("riesgo_eur negativo → OUT_OF_RANGE", () => {
    const result = calcularRFinal({ ...base, riesgo_eur: money("-50.0000") });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("OUT_OF_RANGE");
  });

  it("rr_level no estrictamente creciente entre parciales → INVALID_PARTIAL_SEQUENCE", () => {
    const result = calcularRFinal({
      ...base,
      r_max: rvalue("2.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "30.00"), parcial(2, "1.0000", "30.00")],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("INVALID_PARTIAL_SEQUENCE");
  });

  it("sequence no consecutiva → INVALID_PARTIAL_SEQUENCE", () => {
    const result = calcularRFinal({
      ...base,
      r_max: rvalue("3.0000"),
      parciales_ejecutados: [parcial(2, "1.0000", "30.00")],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("INVALID_PARTIAL_SEQUENCE");
  });

  it("Σp_i > 100% → PARTIALS_EXCEED_100_PCT", () => {
    const result = calcularRFinal({
      ...base,
      r_max: rvalue("3.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "60.00"), parcial(2, "2.0000", "60.00")],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("PARTIALS_EXCEED_100_PCT");
  });

  it("Σp_i exactamente 100% → válido, sin división por cero", () => {
    const result = calcularRFinal({
      ...base,
      r_max: rvalue("2.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "50.00"), parcial(2, "2.0000", "50.00")],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("1.5000");
  });

  it("parcial marcado ejecutado con rr_level > r_max → INCONSISTENT_TRIGGER_STATE", () => {
    const result = calcularRFinal({
      ...base,
      r_max: rvalue("0.5000"),
      parciales_ejecutados: [parcial(1, "1.0000", "50.00")],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("INCONSISTENT_TRIGGER_STATE");
  });

  it("cierre_manual_rr > r_max → INCONSISTENT_TRIGGER_STATE", () => {
    const result = calcularRFinal({
      ...base,
      r_max: rvalue("2.0000"),
      cierre_manual_rr: rvalue("2.5000"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("INCONSISTENT_TRIGGER_STATE");
  });

  it("k = 0, n = 0 (caso todo o nada) con r_max ≥ rr_objetivo → R_final = rr_objetivo", () => {
    const result = calcularRFinal({ ...base, r_max: rvalue("3.5000") });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("3.0000");
  });
});

describe("calcularRFinal — propiedades (SPEC-001 §6.2)", () => {
  it("R_final ≥ -1 siempre (nunca se pierde más del riesgo asumido)", () => {
    const result = calcularRFinal({
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: [],
      r_max: rvalue("0.0000"),
      be_trigger: BETrigger.NONE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("-1.0000");
  });

  it("monotonía: incrementar r_max (manteniendo el resto fijo) nunca disminuye R_final", () => {
    const low = calcularRFinal({
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("5.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "50.00")],
      r_max: rvalue("1.0000"),
      be_trigger: BETrigger.AFTER_NTH_PARTIAL,
    });
    const high = calcularRFinal({
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("5.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "50.00")],
      r_max: rvalue("5.0000"),
      be_trigger: BETrigger.AFTER_NTH_PARTIAL,
    });
    expect(low.ok && high.ok).toBe(true);
    if (!low.ok || !high.ok) throw new Error("unreachable");
    expect(Number(toDisplayString(high.value.value))).toBeGreaterThanOrEqual(
      Number(toDisplayString(low.value.value)),
    );
  });
});
