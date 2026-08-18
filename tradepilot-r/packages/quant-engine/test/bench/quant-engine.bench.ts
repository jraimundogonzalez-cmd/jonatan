/**
 * Benchmarks reales (vitest bench) contra los objetivos de latencia de
 * SPEC-001 §5.1. Se ejecutan con `npm run bench` (vitest bench) — no forman
 * parte de `vitest run`/`npm test`, igual que cualquier suite de benchmark
 * separada de la suite de corrección.
 */
import { bench, describe } from "vitest";
import {
  BETrigger,
  calcularCurvaEquity,
  calcularDesviacionDesdeAcumulador,
  calcularDesviacionR,
  calcularDrawdownHistorico,
  calcularDrawdownState,
  calcularEsperanza,
  calcularEsperanzaIncremental,
  calcularRFinal,
  calcularScore,
  EMPTY_WELFORD_ACCUMULATOR,
  money,
  percent,
  rvalue,
  simularGestion,
  type RFinalInput,
  type TimeSeries,
  type WelfordAccumulator,
} from "../../src/index.js";
import { mulberry32, randomDecimalString } from "../util/prng.js";

const rFinalInput: RFinalInput = {
  riesgo_eur: money("100.0000"),
  rr_objetivo: rvalue("5.0000"),
  parciales_ejecutados: [
    { sequence: 1, rr_level: rvalue("1.0000"), pct_close: percent("30.00"), executed_at: "2026-01-01T00:00:00Z" },
    { sequence: 2, rr_level: rvalue("2.0000"), pct_close: percent("30.00"), executed_at: "2026-01-01T01:00:00Z" },
  ],
  r_max: rvalue("2.5000"),
  be_trigger: BETrigger.NONE,
  cierre_manual_rr: rvalue("2.2000"),
};

describe("Grupo B — objetivo SPEC-001 §5.1: < 1ms (n≤5 parciales)", () => {
  bench("calcularRFinal", () => {
    calcularRFinal(rFinalInput);
  });

  bench("simularGestion", () => {
    simularGestion(rFinalInput);
  });
});

describe("Grupo C/G — objetivo SPEC-001 §5.1: < 15ms hasta 10.000 operaciones (MODO STREAMING, §5.3)", () => {
  // El propio SPEC-001 §5.1 escribe el objetivo como
  // "Grupo C/G sobre cartera de hasta 10.000 operaciones (modo streaming, §5.3)"
  // — el objetivo de <15ms está explícitamente acotado al modo streaming
  // (actualización O(1) del acumulador de Welford), NUNCA al modo batch
  // (recibir la muestra completa), que §5.3/§8.5 punto 2 declara "utilidad
  // de desarrollo/depuración... nunca el camino de producción para una
  // Cuenta con historial extenso". Medir aquí una única actualización
  // incremental es la comparación correcta contra ese objetivo.
  const rng1 = mulberry32(1);
  const muestraPrevia = Array.from({ length: 10_000 }, () => rvalue(randomDecimalString(rng1, -5, 5)));
  const accPrevio: WelfordAccumulator = muestraPrevia.reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);
  const nuevoValor = rvalue("1.2345");

  bench("calcularEsperanzaIncremental — 1 actualización O(1) sobre un acumulador de 10.000 (modo streaming, producción)", () => {
    calcularEsperanzaIncremental(accPrevio, nuevoValor);
  });

  bench("calcularDesviacionDesdeAcumulador — O(1) sobre un acumulador de 10.000 (modo streaming, producción)", () => {
    calcularDesviacionDesdeAcumulador(accPrevio);
  });

  bench("calcularScore (N=20 candidatos)", () => {
    calcularScore({ muestra_r_final_candidata: muestraPrevia.slice(0, 20), lambda: rvalue("0.25") });
  });
});

describe("Grupo C/G — modo BATCH informativo (SPEC-001 §5.3/§8.5.2: dev/debug, sin objetivo de producción)", () => {
  const rng2 = mulberry32(1);
  const muestra10k = Array.from({ length: 10_000 }, () => rvalue(randomDecimalString(rng2, -5, 5)));

  bench("calcularEsperanza batch (N=10.000) — informativo, no sujeto a <15ms", () => {
    calcularEsperanza(muestra10k);
  });

  bench("calcularDesviacionR batch (N=10.000) — informativo, no sujeto a <15ms", () => {
    calcularDesviacionR(muestra10k);
  });
});

describe("Grupo D — objetivo SPEC-001 §5.1: < 20ms sobre 10.000 puntos", () => {
  const rngCurva = mulberry32(2);
  const puntos10k: TimeSeries<ReturnType<typeof money>> = Array.from({ length: 10_000 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2020, 0, 1) + i * 60_000).toISOString(),
    value: money(randomDecimalString(rngCurva, -100, 120)),
  }));

  const curvaEquityPrecalculada = calcularCurvaEquity(puntos10k);
  if (!curvaEquityPrecalculada.ok) throw new Error("no debería fallar con esta muestra");

  bench("calcularCurvaEquity (N=10.000)", () => {
    calcularCurvaEquity(puntos10k);
  });

  bench("calcularDrawdownHistorico (N=10.000) — aislado, sin el coste de calcularCurvaEquity", () => {
    calcularDrawdownHistorico(curvaEquityPrecalculada.value.value);
  });

  bench("pipeline completo: calcularCurvaEquity + calcularDrawdownHistorico (N=10.000) — informativo", () => {
    const equity = calcularCurvaEquity(puntos10k);
    if (equity.ok) calcularDrawdownHistorico(equity.value.value);
  });
});

describe("Grupo E — objetivo SPEC-001 §5.1: < 1ms", () => {
  bench("calcularDrawdownState", () => {
    calcularDrawdownState({
      current_capital: money("9500"),
      initial_capital: money("10000"),
      peak_capital_basis: money("12000"),
      drawdown_type: "trailing",
      max_total_drawdown_pct: percent("10"),
    });
  });
});
