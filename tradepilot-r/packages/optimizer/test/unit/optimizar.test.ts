import { describe, expect, it } from "vitest";
import { BETrigger, money, rvalue, toDisplayString } from "@tradepilot/quant-engine";
import { optimizar } from "../../src/optimizar.js";
import { BOUNDED_RANDOM_SEARCH_ID } from "../../src/search/bounded-random-search.js";
import { MAX_WINNERS } from "../../src/comparator/index.js";
import type { HistoricalTrade, OptimizationProblem } from "../../src/domain/types.js";

const R_MAX = ["4.2000", "6.0000", "0.8000", "1.0000", "5.5000", "2.4000", "3.1000", "0.5000"];
const R_FINAL_REAL = ["1.0000", "3.5000", "-1.0000", "-1.0000", "3.5000", "0.8000", "1.2000", "-1.0000"];

const TRADES: readonly HistoricalTrade[] = R_MAX.map((r, i) => ({
  r_max: rvalue(r),
  r_final: rvalue(R_FINAL_REAL[i]!),
  risk_amount: money("100.0000"),
  closed_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
}));

function problema(overrides: Partial<OptimizationProblem> = {}): OptimizationProblem {
  return {
    base_scenario_space: {
      rr_objetivo: rvalue("5.0000"),
      max_partials: 5,
      be_triggers: [BETrigger.NONE, BETrigger.AFTER_NTH_PARTIAL],
    },
    objectives: [{ metric: "score", direction: "maximize" }],
    constraints: [],
    bootstrap_trade_set: TRADES,
    evaluation_budget: 60,
    lambda: rvalue("0.2500"),
    ...overrides,
  };
}

describe("optimizar — reproducibilidad (§6.1 deterministic_given_seed, §13.3)", () => {
  it("misma semilla + mismo problema + misma estrategia ⇒ resultado idéntico", () => {
    const a = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 12345);
    const b = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 12345);
    expect(a.ok).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("semillas distintas exploran candidatas distintas (búsqueda real, no un resultado fijo)", () => {
    const a = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 1);
    const b = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 999);
    if (!a.ok || !b.ok) throw new Error("unreachable");
    expect(JSON.stringify(a.value.winners)).not.toBe(JSON.stringify(b.value.winners));
  });

  it("el presupuesto se expresa en evaluaciones consumidas, nunca en tiempo (§5.3)", () => {
    const r = optimizar(problema({ evaluation_budget: 25 }), BOUNDED_RANDOM_SEARCH_ID, 7);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.evaluations_consumed).toBe(25);
  });

  it("el resultado ecoa estrategia y versión — trazabilidad para versionar sin romper histórico (§8)", () => {
    const r = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 3);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.strategy_id).toBe("bounded_random_search");
    expect(r.value.strategy_version).toBe("v1");
    expect(r.value.seed).toBe(3);
  });
});

describe("optimizar — validación y errores tipados (§11)", () => {
  it("rechaza una estrategia no registrada/no aprobada", () => {
    const r = optimizar(problema(), "genetic.v1", 1);
    expect(r).toEqual({ ok: false, error: { code: "STRATEGY_NOT_APPROVED", strategy_id: "genetic.v1" } });
  });

  it("rechaza un Trade Set vacío", () => {
    const r = optimizar(problema({ bootstrap_trade_set: [] }), BOUNDED_RANDOM_SEARCH_ID, 1);
    expect(r).toEqual({ ok: false, error: { code: "EMPTY_BOOTSTRAP_SAMPLE" } });
  });

  it("exige lambda explícito cuando algún objetivo es score", () => {
    const p = problema();
    const sinLambda: OptimizationProblem = {
      base_scenario_space: p.base_scenario_space,
      objectives: p.objectives,
      constraints: p.constraints,
      bootstrap_trade_set: p.bootstrap_trade_set,
      evaluation_budget: p.evaluation_budget,
    };
    const r = optimizar(sinLambda, BOUNDED_RANDOM_SEARCH_ID, 1);
    expect(r).toEqual({ ok: false, error: { code: "MISSING_LAMBDA_FOR_SCORE_OBJECTIVE" } });
  });

  it("devuelve NO_FEASIBLE_CANDIDATE cuando ninguna candidata satisface la restricción dura", () => {
    const r = optimizar(
      problema({ constraints: [{ metric: "expectancy", operator: "gte", threshold: rvalue("999.0000") }] }),
      BOUNDED_RANDOM_SEARCH_ID,
      5,
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.code).toBe("NO_FEASIBLE_CANDIDATE");
  });
});

describe("optimizar — restricciones duras, nunca penalización (§4.3)", () => {
  it("toda ganadora satisface la restricción declarada", () => {
    const umbral = rvalue("0.0000");
    const r = optimizar(
      problema({
        objectives: [{ metric: "expectancy", direction: "maximize" }],
        constraints: [{ metric: "expectancy", operator: "gte", threshold: umbral }],
      }),
      BOUNDED_RANDOM_SEARCH_ID,
      11,
    );
    if (!r.ok) throw new Error("unreachable");
    for (const ganadora of r.value.winners) {
      const expectancy = ganadora.metrics.find((m) => m.metric === "expectancy")!;
      expect(Number(toDisplayString(expectancy.value))).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("optimizar — explicabilidad construida solo con evidencia real (§10.2)", () => {
  it("cada ganadora expone métricas con su envelope de Quant Engine y su tamaño de muestra", () => {
    const r = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 2024);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.winners.length).toBeGreaterThan(0);
    expect(r.value.winners.length).toBeLessThanOrEqual(MAX_WINNERS);

    for (const ganadora of r.value.winners) {
      expect(ganadora.metrics.length).toBeGreaterThan(0);
      for (const evidencia of ganadora.metrics) {
        expect(evidencia.quant_result.formula_id).toBeTruthy();
      }
      // Nunca se oculta el tamaño real de la muestra que respalda la recomendación.
      expect(ganadora.evidence_sample_size).toBe(TRADES.length);
      expect(ganadora.comparison_vs_baseline.baseline).toBe("trader_actual_behavior");
      expect(Object.keys(ganadora.comparison_vs_baseline.delta_per_objective).length).toBeGreaterThan(0);
      expect(ganadora.pct_of_historical_trades_that_would_improve).toBeDefined();
      expect(ganadora.variance_delta).toBeDefined();
    }
  });

  it("la ganadora compara contra el runner-up cuando existe", () => {
    const r = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 2024);
    if (!r.ok) throw new Error("unreachable");
    if (r.value.winners.length > 1) {
      expect(r.value.winners[0]!.comparison_vs_runner_up).toBeDefined();
    }
    // La última ganadora nunca tiene runner-up — no se inventa una comparación.
    expect(r.value.winners[r.value.winners.length - 1]!.comparison_vs_runner_up).toBeUndefined();
  });
});

describe("optimizar — multiobjetivo (§9.2)", () => {
  it("devuelve un frente de Pareto acotado a MAX_WINNERS", () => {
    const r = optimizar(
      problema({
        objectives: [
          { metric: "expectancy", direction: "maximize" },
          { metric: "drawdown", direction: "maximize" },
        ],
      }),
      BOUNDED_RANDOM_SEARCH_ID,
      77,
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.winners.length).toBeGreaterThan(0);
    expect(r.value.winners.length).toBeLessThanOrEqual(MAX_WINNERS);
  });

  it("el frente no depende del orden de evaluación: reordenar el Trade Set no cambia el ganador", () => {
    // El Trade Set se ordena cronológicamente dentro del motor, así que
    // barajarlo a la entrada debe producir exactamente el mismo resultado.
    const barajado = [...TRADES].reverse();
    const a = optimizar(problema(), BOUNDED_RANDOM_SEARCH_ID, 31);
    const b = optimizar(problema({ bootstrap_trade_set: barajado }), BOUNDED_RANDOM_SEARCH_ID, 31);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
