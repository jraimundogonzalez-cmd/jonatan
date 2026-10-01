/**
 * Stress tests de escala (SPEC-001 §6.4) — verifican estabilidad y ausencia
 * de degradación cuadrática a los tamaños de muestra que 19 §7 exige
 * soportar. N reducido respecto a los 1.000.000/500.000 literales de §6.4
 * para mantener el tiempo de CI razonable — documentado explícitamente aquí,
 * no una sustitución silenciosa; los objetivos de latencia p95 reales se
 * miden en test/bench/quant-engine.bench.ts.
 */
import { describe, expect, it } from "vitest";
import {
  calcularCurvaEquity,
  calcularDesviacionR,
  calcularDrawdownHistorico,
  calcularEsperanza,
  calcularEsperanzaIncremental,
  calcularScore,
  EMPTY_WELFORD_ACCUMULATOR,
  money,
  rvalue,
  toDisplayString,
  type TimeSeries,
} from "../../src/index.js";
import { mulberry32, randomDecimalString } from "../util/prng.js";

describe("Stress — agregados de cartera a gran escala (SPEC-001 §5.3/§6.4)", () => {
  const N = 100_000;
  const rng = mulberry32(42);
  const muestra = Array.from({ length: N }, () => rvalue(randomDecimalString(rng, -5, 5)));

  it(`el acumulador incremental sobre ${N} elementos coincide exactamente con el cálculo batch`, () => {
    const inicio = performance.now();
    const acc = muestra.reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);
    const duracionIncremental = performance.now() - inicio;

    expect(acc.n).toBe(N);

    const batch = calcularEsperanza(muestra);
    expect(batch.ok).toBe(true);
    if (!batch.ok) throw new Error("unreachable");
    expect(toDisplayString(acc.mean)).toBe(toDisplayString(batch.value.value));

    // Sin degradación cuadrática: 100k actualizaciones O(1) deben completarse
    // en un tiempo razonable (límite generoso, no un objetivo de p95 estricto).
    expect(duracionIncremental).toBeLessThan(5_000);
  });

  it(`calcularDesviacionR sobre ${N} elementos es numéricamente estable (Welford, sin cancelación catastrófica)`, () => {
    const result = calcularDesviacionR(muestra);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // La muestra es uniforme en [-5, 5] — desviación teórica ≈ 10/√12 ≈ 2.8868.
    // Verificamos que el resultado esté en un rango razonable (sanity check
    // de estabilidad numérica, no un valor exacto — la muestra es aleatoria).
    const desviacion = Number(toDisplayString(result.value.value));
    expect(desviacion).toBeGreaterThan(2.7);
    expect(desviacion).toBeLessThan(3.0);
  });
});

describe("Stress — curvas de equity/drawdown a gran escala (SPEC-001 §6.4)", () => {
  const N = 50_000;
  const rng = mulberry32(7);
  const puntos: TimeSeries<ReturnType<typeof money>> = Array.from({ length: N }, (_, i) => ({
    timestamp: new Date(Date.UTC(2020, 0, 1) + i * 60_000).toISOString(),
    value: money(randomDecimalString(rng, -100, 120)),
  }));

  it(`calcularCurvaEquity + calcularDrawdownHistorico sobre ${N} puntos: memoria lineal, sin crecimiento cuadrático`, () => {
    const inicio = performance.now();
    const equityResult = calcularCurvaEquity(puntos);
    expect(equityResult.ok).toBe(true);
    if (!equityResult.ok) throw new Error("unreachable");

    const drawdownResult = calcularDrawdownHistorico(equityResult.value.value);
    expect(drawdownResult.ok).toBe(true);
    if (!drawdownResult.ok) throw new Error("unreachable");
    const duracion = performance.now() - inicio;

    expect(equityResult.value.value).toHaveLength(N);
    expect(drawdownResult.value.value.serie).toHaveLength(N);

    // Identidad de construcción: max_drawdown es exactamente el mínimo de la
    // serie de drawdown (verificación independiente, no solo "no lanzó").
    const minimoDeLaSerie = drawdownResult.value.value.serie.reduce(
      (min, punto) => (Number(toDisplayString(punto.value)) < min ? Number(toDisplayString(punto.value)) : min),
      0,
    );
    expect(Number(toDisplayString(drawdownResult.value.value.max_drawdown))).toBe(minimoDeLaSerie);

    expect(duracion).toBeLessThan(10_000);
  });
});

describe("Stress — llamadas repetidas a calcularScore/simularGestion sin degradación (SPEC-001 §6.4)", () => {
  it("10.000 llamadas consecutivas a calcularScore no degradan su latencia (sin fugas de memoria/estado acumulado)", () => {
    const rng = mulberry32(99);
    const muestraCandidata = Array.from({ length: 20 }, () => rvalue(randomDecimalString(rng, -3, 5)));
    const lambda = rvalue("0.25");

    const medirLoteDe = (n: number): number => {
      const inicio = performance.now();
      for (let i = 0; i < n; i++) {
        const result = calcularScore({ muestra_r_final_candidata: muestraCandidata, lambda });
        if (!result.ok) throw new Error("no debería fallar con esta muestra");
      }
      return (performance.now() - inicio) / n;
    };

    const latenciaPrimerLote = medirLoteDe(1_000);
    const latenciaUltimoLote = medirLoteDe(9_000);

    // La latencia media por llamada del último lote no debe ser
    // sustancialmente peor que la del primero — Quant Engine no retiene
    // estado entre invocaciones (SPEC-001 §2.3).
    expect(latenciaUltimoLote).toBeLessThan(latenciaPrimerLote * 5 + 1);
  });
});
