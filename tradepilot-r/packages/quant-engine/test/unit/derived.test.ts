import { describe, expect, it } from "vitest";
import {
  BETrigger,
  calcularBeneficioMaximo,
  calcularBeneficioReal,
  calcularBeneficioSacrificado,
  calcularImpactoPorParcial,
  calcularPorcentajeConservado,
  calcularRFinal,
  money,
  percent,
  rvalue,
  toDisplayString,
  type ParcialEjecutado,
  type RFinalInput,
} from "../../src/index.js";

function parcial(sequence: 1 | 2 | 3 | 4 | 5, rrLevel: string, pctClose: string): ParcialEjecutado {
  return { sequence, rr_level: rvalue(rrLevel), pct_close: percent(pctClose), executed_at: "2026-01-01T00:00:00Z" };
}

describe("calcularBeneficioReal / calcularBeneficioMaximo / calcularBeneficioSacrificado", () => {
  it("Riesgo€ × R_final, Riesgo€ × RR_obj, y su diferencia", () => {
    const riesgoEur = money("200.0000");
    const rFinal = rvalue("1.5000");
    const rrObjetivo = rvalue("3.0000");

    const real = calcularBeneficioReal(riesgoEur, rFinal);
    expect(toDisplayString(real.value)).toBe("300.0000");

    const maximo = calcularBeneficioMaximo(riesgoEur, rrObjetivo);
    expect(toDisplayString(maximo.value)).toBe("600.0000");

    const sacrificado = calcularBeneficioSacrificado(maximo.value, real.value);
    expect(toDisplayString(sacrificado.value)).toBe("300.0000");
  });
});

describe("calcularPorcentajeConservado", () => {
  it("R_final / R_max × 100", () => {
    const result = calcularPorcentajeConservado(rvalue("1.5000"), rvalue("3.0000"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("50.00");
  });

  it("r_max = 0 → UNDEFINED_RATIO ZERO_R_MAX, nunca NaN", () => {
    const result = calcularPorcentajeConservado(rvalue("1.0000"), rvalue("0.0000"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toEqual({ code: "UNDEFINED_RATIO", reason: "ZERO_R_MAX", detail: expect.any(String) });
  });
});

describe("calcularImpactoPorParcial — conservación de Σp_i (SPEC-001 §6.2.4)", () => {
  it("la suma de todas las contribuciones es exactamente R_final, sin pérdida por redondeo", () => {
    const input: RFinalInput = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("5.0000"),
      parciales_ejecutados: [parcial(1, "1.0000", "30.00"), parcial(2, "2.0000", "30.00")],
      r_max: rvalue("2.5000"),
      be_trigger: BETrigger.NONE,
      cierre_manual_rr: rvalue("2.2000"),
    };
    const rFinalResult = calcularRFinal(input);
    expect(rFinalResult.ok).toBe(true);
    if (!rFinalResult.ok) throw new Error("unreachable");

    const impacto = calcularImpactoPorParcial(input, rFinalResult.value.value);
    expect(impacto.ok).toBe(true);
    if (!impacto.ok) throw new Error("unreachable");

    const sum = impacto.value.value.reduce((acc, item) => acc + Number(toDisplayString(item.contribution)), 0);
    expect(sum.toFixed(4)).toBe(toDisplayString(rFinalResult.value.value));
  });
});
