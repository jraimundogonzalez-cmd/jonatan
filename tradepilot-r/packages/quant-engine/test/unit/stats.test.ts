import { describe, expect, it } from "vitest";
import {
  calcularDesviacionR,
  calcularDistribucionR,
  calcularEsperanza,
  calcularProfitFactor,
  calcularRachaMaxima,
  calcularRatioConsistencia,
  calcularRecoveryFactor,
  calcularTiempoMedioEnMercado,
  calcularWinRate,
  money,
  rvalue,
  seconds,
  toDisplayString,
} from "../../src/index.js";

const M = (v: string) => money(v);
const R = (v: string) => rvalue(v);

describe("calcularEsperanza", () => {
  it("media exacta de una muestra de 5 (4/5 = 0.8 exacto)", () => {
    const result = calcularEsperanza(["1", "-1", "2", "-1", "3"].map(R));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("0.8000");
  });

  it("EMPTY_SAMPLE con N=0", () => {
    const result = calcularEsperanza([]);
    expect(result).toEqual({ ok: false, error: { code: "EMPTY_SAMPLE", detail: expect.any(String) } });
  });

  it("invariante de orden: la media es conmutativa (permutar la muestra no cambia el resultado)", () => {
    const muestra = ["1", "-1", "2", "-1", "3"].map(R);
    const permutada = ["3", "2", "-1", "-1", "1"].map(R);
    const a = calcularEsperanza(muestra);
    const b = calcularEsperanza(permutada);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("unreachable");
    expect(toDisplayString(a.value.value)).toBe(toDisplayString(b.value.value));
  });

  it("determinismo: 100 invocaciones repetidas producen el mismo resultado exacto", () => {
    const muestra = ["1", "-1", "2", "-1", "3"].map(R);
    const resultados = new Set(
      Array.from({ length: 100 }, () => {
        const r = calcularEsperanza(muestra);
        return r.ok ? toDisplayString(r.value.value) : "error";
      }),
    );
    expect(resultados.size).toBe(1);
  });
});

describe("calcularDesviacionR", () => {
  it("N=2 exacto: muestra [1,3] → σ = √2 = 1.4142 (SPEC-001 §4.3, ROUND_HALF_EVEN)", () => {
    const result = calcularDesviacionR([R("1"), R("3")]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("1.4142");
  });

  it("N=5: muestra [1,-1,2,-1,3] → σ = √3.2 = 1.7889", () => {
    const result = calcularDesviacionR(["1", "-1", "2", "-1", "3"].map(R));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("1.7889");
  });

  it("EMPTY_SAMPLE con N=0", () => {
    expect(calcularDesviacionR([])).toEqual({ ok: false, error: { code: "EMPTY_SAMPLE", detail: expect.any(String) } });
  });

  it("UNDEFINED_RATIO ZERO_VARIANCE con N=1", () => {
    const result = calcularDesviacionR([R("1")]);
    expect(result).toEqual({
      ok: false,
      error: { code: "UNDEFINED_RATIO", reason: "ZERO_VARIANCE", detail: expect.any(String) },
    });
  });
});

describe("calcularRatioConsistencia", () => {
  it("N=2 exacto: muestra [1,3] → E/σ = 2/√2 = √2 = 1.4142", () => {
    const result = calcularRatioConsistencia([R("1"), R("3")]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("1.4142");
  });

  it("N=5: muestra [1,-1,2,-1,3] → E/σ = 0.8/√3.2 = 1/√5 = 0.4472", () => {
    const result = calcularRatioConsistencia(["1", "-1", "2", "-1", "3"].map(R));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("0.4472");
  });

  it("propaga ZERO_VARIANCE con N=1 (nunca calcula sobre datos indefinidos)", () => {
    const result = calcularRatioConsistencia([R("1")]);
    expect(result.ok).toBe(false);
  });

  it("hallazgo de Challenge Mode: N≥2 con todos los valores idénticos → ZERO_VARIANCE, nunca división por cero silenciosa", () => {
    const result = calcularRatioConsistencia([R("2"), R("2"), R("2")]);
    expect(result).toEqual({
      ok: false,
      error: { code: "UNDEFINED_RATIO", reason: "ZERO_VARIANCE", detail: expect.any(String) },
    });
  });
});

describe("calcularProfitFactor", () => {
  it("Σganancias / |Σpérdidas| = 350/150 = 2.3333", () => {
    const result = calcularProfitFactor([M("200"), M("-100"), M("150"), M("-50")]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("2.3333");
  });

  it("EMPTY_SAMPLE con N=0", () => {
    expect(calcularProfitFactor([])).toEqual({ ok: false, error: { code: "EMPTY_SAMPLE", detail: expect.any(String) } });
  });

  it("UNDEFINED_RATIO ZERO_LOSSES sin pérdidas, nunca Infinity", () => {
    const result = calcularProfitFactor([M("100"), M("200")]);
    expect(result).toEqual({
      ok: false,
      error: { code: "UNDEFINED_RATIO", reason: "ZERO_LOSSES", detail: expect.any(String) },
    });
  });
});

describe("calcularWinRate", () => {
  it("nº(R>0)/N — R=0 (breakeven) nunca cuenta como ganadora", () => {
    const result = calcularWinRate([R("1"), R("-1"), R("2"), R("0"), R("-3")]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("40.00");
  });

  it("EMPTY_SAMPLE con N=0", () => {
    expect(calcularWinRate([])).toEqual({ ok: false, error: { code: "EMPTY_SAMPLE", detail: expect.any(String) } });
  });
});

describe("calcularRecoveryFactor", () => {
  it("Beneficio_neto / |Max_Drawdown| = 500/200 = 2.5000, toma valor absoluto sin importar el signo de entrada", () => {
    const conNegativo = calcularRecoveryFactor(M("500"), M("-200"));
    const conPositivo = calcularRecoveryFactor(M("500"), M("200"));
    expect(conNegativo.ok && conPositivo.ok).toBe(true);
    if (!conNegativo.ok || !conPositivo.ok) throw new Error("unreachable");
    expect(toDisplayString(conNegativo.value.value)).toBe("2.5000");
    expect(toDisplayString(conPositivo.value.value)).toBe("2.5000");
  });

  it("UNDEFINED_RATIO ZERO_DRAWDOWN si max_drawdown=0 (curva siempre creciente), nunca Infinity", () => {
    const result = calcularRecoveryFactor(M("500"), M("0"));
    expect(result).toEqual({
      ok: false,
      error: { code: "UNDEFINED_RATIO", reason: "ZERO_DRAWDOWN", detail: expect.any(String) },
    });
  });
});

describe("calcularRachaMaxima", () => {
  it("encuentra la racha positiva más larga, R=0 interrumpe cualquier racha", () => {
    const muestra = ["1", "2", "-1", "-2", "-3", "1", "2", "3", "4", "0", "-1"].map(R);
    const result = calcularRachaMaxima(muestra);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.value).toEqual({ longitud: 4, signo: "positiva" });
  });

  it("EMPTY_SAMPLE con N=0", () => {
    expect(calcularRachaMaxima([])).toEqual({ ok: false, error: { code: "EMPTY_SAMPLE", detail: expect.any(String) } });
  });

  it("muestra íntegramente en breakeven → longitud 0, convención documentada", () => {
    const result = calcularRachaMaxima([R("0"), R("0")]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.value).toEqual({ longitud: 0, signo: "positiva" });
  });
});

describe("calcularTiempoMedioEnMercado", () => {
  it("media exacta de duraciones en segundos (brand Seconds, nunca number nativo)", () => {
    const result = calcularTiempoMedioEnMercado(["100", "200", "300"].map(seconds));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.value)).toBe("200");
  });

  it("EMPTY_SAMPLE con N=0", () => {
    expect(calcularTiempoMedioEnMercado([])).toEqual({
      ok: false,
      error: { code: "EMPTY_SAMPLE", detail: expect.any(String) },
    });
  });
});

describe("calcularDistribucionR", () => {
  it("construye buckets de ancho fijo cubriendo min..max", () => {
    const muestra = ["-1.5", "-0.5", "0.2", "0.7", "1.3", "2.1"].map(R);
    const result = calcularDistribucionR(muestra, R("1"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    const histogram = result.value.value;
    expect(histogram).toHaveLength(5);
    expect(histogram.map((b) => b.count)).toEqual([1, 1, 2, 1, 1]);
    expect(toDisplayString(histogram[0]!.range_start)).toBe("-2.0000");
    expect(toDisplayString(histogram[0]!.range_end)).toBe("-1.0000");

    const totalCount = histogram.reduce((acc, b) => acc + b.count, 0);
    expect(totalCount).toBe(muestra.length);
  });

  it("OUT_OF_RANGE si bucket_width ≤ 0", () => {
    const result = calcularDistribucionR([R("1")], R("0"));
    expect(result).toEqual({
      ok: false,
      error: { code: "OUT_OF_RANGE", field: "bucket_width", detail: expect.any(String) },
    });
  });

  it("EMPTY_SAMPLE con N=0", () => {
    expect(calcularDistribucionR([], R("1"))).toEqual({
      ok: false,
      error: { code: "EMPTY_SAMPLE", detail: expect.any(String) },
    });
  });
});
