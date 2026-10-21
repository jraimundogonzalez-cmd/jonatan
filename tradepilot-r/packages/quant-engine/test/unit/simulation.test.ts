import { describe, expect, it } from "vitest";
import { BETrigger, calcularRFinal, calcularScore, money, rvalue, simularGestion, toDisplayString } from "../../src/index.js";
import type { RFinalInput } from "../../src/index.js";

describe("simularGestion", () => {
  const input: RFinalInput = {
    riesgo_eur: money("100.0000"),
    rr_objetivo: rvalue("3.0000"),
    parciales_ejecutados: [],
    r_max: rvalue("3.2000"),
    be_trigger: BETrigger.NONE,
  };

  it("produce exactamente el mismo valor que calcularRFinal — es la misma fórmula, no una segunda copia", () => {
    const real = calcularRFinal(input);
    const simulado = simularGestion(input);
    expect(real.ok && simulado.ok).toBe(true);
    if (!real.ok || !simulado.ok) throw new Error("unreachable");
    expect(toDisplayString(simulado.value.value)).toBe(toDisplayString(real.value.value));
    expect(toDisplayString(simulado.value.value)).toBe("3.0000");
  });

  it("el envelope público distingue el origen vía formula_id, aunque el valor sea idéntico", () => {
    const real = calcularRFinal(input);
    const simulado = simularGestion(input);
    expect(real.ok && simulado.ok).toBe(true);
    if (!real.ok || !simulado.ok) throw new Error("unreachable");
    expect(real.value.formula_id).toBe("calcularRFinal");
    expect(simulado.value.formula_id).toBe("simularGestion");
  });

  it("propaga los mismos errores tipados que calcularRFinal", () => {
    const invalido: RFinalInput = { ...input, riesgo_eur: money("0") };
    const result = simularGestion(invalido);
    expect(result).toEqual({
      ok: false,
      error: { code: "OUT_OF_RANGE", field: "riesgo_eur", detail: expect.any(String) },
    });
  });
});

describe("calcularScore", () => {
  it("Score = E[R] − λ·σ[R], formula_version = score.v1", () => {
    const result = calcularScore({
      muestra_r_final_candidata: ["1", "-1", "2", "-1", "3"].map(rvalue),
      lambda: rvalue("0.25"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // E=0.8000, σ=1.7889 (ya redondeados, SPEC-001 §8.3: Score compone
    // los resultados públicos ya calculados, no reintegra precisión interna).
    // Score = 0.8000 - 0.25*1.7889 = 0.8000 - 0.447225 = 0.352775 → 0.3528
    expect(toDisplayString(result.value.value)).toBe("0.3528");
    expect(result.value.formula_version).toBe("score.v1");
  });

  it("lambda siempre explícito — nunca un valor por defecto oculto (SPEC-001 §3.8)", () => {
    const conLambdaCero = calcularScore({
      muestra_r_final_candidata: ["1", "2", "3"].map(rvalue),
      lambda: rvalue("0"),
    });
    expect(conLambdaCero.ok).toBe(true);
    if (!conLambdaCero.ok) throw new Error("unreachable");
    // λ=0 → Score = E[R] exactamente, sin penalización por dispersión
    expect(toDisplayString(conLambdaCero.value.value)).toBe("2.0000");
  });

  it("propaga ZERO_VARIANCE si N=1 (no puede calcular σ)", () => {
    const result = calcularScore({ muestra_r_final_candidata: [rvalue("1")], lambda: rvalue("0.25") });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toEqual({ code: "UNDEFINED_RATIO", reason: "ZERO_VARIANCE", detail: expect.any(String) });
  });

  it("propaga EMPTY_SAMPLE si N=0", () => {
    const result = calcularScore({ muestra_r_final_candidata: [], lambda: rvalue("0.25") });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("EMPTY_SAMPLE");
  });
});
