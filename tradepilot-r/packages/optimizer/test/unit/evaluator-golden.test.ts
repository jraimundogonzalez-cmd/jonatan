/**
 * Golden test contra 12 §6 — la demostración numérica de dominancia ya
 * aprobada en el blueprint. Valida el camino completo
 * `simularCandidataSobreHistorial` (filtro de parciales disparados + delegación
 * a `simularGestion`) contra números que el proyecto fijó antes de existir
 * este código: si el filtro de disparo fuera distinto, estos valores no
 * saldrían.
 */
import { describe, expect, it } from "vitest";
import { BETrigger, money, percent, rvalue, toDisplayString } from "@tradepilot/quant-engine";
import {
  evaluarMuestra,
  ordenarCronologicamente,
  simularCandidataSobreHistorial,
} from "../../src/evaluator/evaluator-bridge.js";
import type { HistoricalTrade, ObjectiveMetric, Scenario } from "../../src/domain/types.js";

/** `R_max` histórico exacto de 12 §4/§6. */
const R_MAX_12_6 = ["4.2000", "6.0000", "0.8000", "1.0000", "5.5000"];

function tradesDe(rMax: readonly string[], rFinalReal: readonly string[]): readonly HistoricalTrade[] {
  return rMax.map((r, i) => ({
    r_max: rvalue(r),
    r_final: rvalue(rFinalReal[i] ?? "0.0000"),
    risk_amount: money("100.0000"),
    closed_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
  }));
}

/** Config B de 12 §6: un único parcial en 2R al 50%, resto al objetivo de 5R. */
const CONFIG_B: Scenario = {
  rr_objetivo: rvalue("5.0000"),
  parciales_planificados: [{ sequence: 1, rr_level: rvalue("2.0000"), pct_close: percent("50.00") }],
  be_trigger: BETrigger.NONE,
};

describe("evaluator-bridge — golden 12 §6 (Config B)", () => {
  const trades = ordenarCronologicamente(tradesDe(R_MAX_12_6, R_MAX_12_6));

  it("reproduce exactamente la muestra de R_final de 12 §6", () => {
    const simulada = simularCandidataSobreHistorial(CONFIG_B, trades);
    expect(simulada.ok).toBe(true);
    if (!simulada.ok) throw new Error("unreachable");
    expect(simulada.muestra.map(toDisplayString)).toEqual([
      "1.0000",
      "3.5000",
      "-1.0000",
      "-1.0000",
      "3.5000",
    ]);
  });

  it("reproduce E[R]_B = 1.20 R de 12 §6, calculado por Quant Engine", () => {
    const simulada = simularCandidataSobreHistorial(CONFIG_B, trades);
    if (!simulada.ok) throw new Error("unreachable");
    const metricas: ReadonlySet<ObjectiveMetric> = new Set<ObjectiveMetric>(["expectancy"]);
    const evaluada = evaluarMuestra(simulada.muestra, trades, metricas, undefined);
    expect(evaluada.ok).toBe(true);
    if (!evaluada.ok) throw new Error("unreachable");
    expect(toDisplayString(evaluada.value.values.expectancy!)).toBe("1.2000");
  });

  it("un parcial cuyo rr_level nunca fue alcanzado no cuenta como ejecutado (triggered(0.8≥2)=0)", () => {
    const soloNoAlcanzado = ordenarCronologicamente(tradesDe(["0.8000"], ["0.8000"]));
    const simulada = simularCandidataSobreHistorial(CONFIG_B, soloNoAlcanzado);
    if (!simulada.ok) throw new Error("unreachable");
    // k=0 y r_max < rr_objetivo ⇒ stop original ⇒ R_final = −1
    expect(toDisplayString(simulada.muestra[0]!)).toBe("-1.0000");
  });

  it("las cinco métricas declaradas en §4.2 son computables desde el Trade Set", () => {
    const simulada = simularCandidataSobreHistorial(CONFIG_B, trades);
    if (!simulada.ok) throw new Error("unreachable");
    const metricas: ReadonlySet<ObjectiveMetric> = new Set<ObjectiveMetric>([
      "expectancy",
      "consistency_ratio",
      "score",
      "drawdown",
      "recovery_factor",
    ]);
    const evaluada = evaluarMuestra(simulada.muestra, trades, metricas, rvalue("0.2500"));
    expect(evaluada.ok).toBe(true);
    if (!evaluada.ok) throw new Error("unreachable");
    expect(Object.keys(evaluada.value.values).sort()).toEqual([
      "consistency_ratio",
      "drawdown",
      "expectancy",
      "recovery_factor",
      "score",
    ]);
    // Toda métrica llega acompañada de su envelope real de Quant Engine.
    expect(evaluada.value.evidence).toHaveLength(5);
    for (const evidencia of evaluada.value.evidence) {
      expect(evidencia.quant_result.formula_id).toBeTruthy();
    }
  });

  it("exige lambda explícito para el objetivo score — nunca un valor por defecto oculto", () => {
    const simulada = simularCandidataSobreHistorial(CONFIG_B, trades);
    if (!simulada.ok) throw new Error("unreachable");
    const evaluada = evaluarMuestra(simulada.muestra, trades, new Set<ObjectiveMetric>(["score"]), undefined);
    expect(evaluada.ok).toBe(false);
    if (evaluada.ok) throw new Error("unreachable");
    expect(evaluada.error.code).toBe("MISSING_LAMBDA_FOR_SCORE_OBJECTIVE");
  });
});
