/**
 * Los evaluadores son funciones puras. Se prueban de forma aislada, sin
 * repositorios ni orquestador — es la garantía estructural de que el orden de
 * evaluación entre reglas independientes nunca altera un resultado
 * (SPEC-004 §14.3).
 */
import { describe, expect, it } from "vitest";
import { toDisplayString } from "@tradepilot/risk-engine";
import {
  composite,
  dynamicThreshold,
  progressToTarget,
  setMembership,
  staticThreshold,
  timeWindow,
} from "../../src/evaluators/index.js";
import type { EvaluationInputs, Veredicto } from "../../src/domain/types.js";
import { HECHOS_CUENTA, HECHOS_OPERACION, MAGNITUDES } from "../fakes/index.js";

const INPUTS: EvaluationInputs = {
  account_facts: HECHOS_CUENTA,
  risk_magnitudes: MAGNITUDES,
  operation_facts: HECHOS_OPERACION,
};

describe("static_threshold / dynamic_threshold", () => {
  it("cumple cuando el drawdown restante supera el mínimo exigido, con margen exacto", () => {
    const v = staticThreshold(
      { input: "drawdown_restante_pct", operator: "gte", threshold: "2.0000" },
      INPUTS,
    );
    expect(v.verdict).toBe("compliant");
    if (v.verdict === "unavailable") throw new Error("unreachable");
    // 5.26 − 2.00 = 3.26, calculado con el kernel decimal, nunca con float
    expect(toDisplayString(v.margin)).toBe("3.2600");
  });

  it("incumple cuando el drawdown restante cae por debajo del mínimo", () => {
    const v = staticThreshold(
      { input: "drawdown_restante_pct", operator: "gte", threshold: "8.0000" },
      INPUTS,
    );
    expect(v.verdict).toBe("violated");
  });

  it("devuelve unavailable —nunca compliant— si la magnitud de Risk Engine falta", () => {
    const v = dynamicThreshold(
      { input: "drawdown_restante_pct", operator: "gte", threshold: "2.0000" },
      { account_facts: HECHOS_CUENTA },
    );
    expect(v.verdict).toBe("unavailable");
  });

  it("devuelve unavailable si el parámetro no está bien formado", () => {
    expect(staticThreshold({ input: "inventado", operator: "gte", threshold: "1" }, INPUTS).verdict).toBe("unavailable");
    expect(staticThreshold({ input: "current_capital", operator: "??", threshold: "1" }, INPUTS).verdict).toBe("unavailable");
    expect(staticThreshold({ input: "current_capital", operator: "gte" }, INPUTS).verdict).toBe("unavailable");
  });
});

describe("progress_to_target", () => {
  it("cumple al alcanzar el objetivo y reporta el exceso como margen", () => {
    const v = progressToTarget({ input: "current_capital", target: "9000.0000" }, INPUTS);
    expect(v.verdict).toBe("compliant");
    if (v.verdict === "unavailable") throw new Error("unreachable");
    expect(toDisplayString(v.margin)).toBe("500.0000");
  });

  it("incumple —con margen negativo— cuando aún no se alcanzó", () => {
    const v = progressToTarget({ input: "current_capital", target: "12000.0000" }, INPUTS);
    expect(v.verdict).toBe("violated");
    if (v.verdict === "unavailable") throw new Error("unreachable");
    expect(toDisplayString(v.margin)).toBe("-2500.0000");
  });
});

describe("set_membership", () => {
  it("respeta una lista de permitidos", () => {
    expect(setMembership({ field: "symbol", allowed: ["EURUSD", "GBPUSD"] }, INPUTS).verdict).toBe("compliant");
    expect(setMembership({ field: "symbol", allowed: ["XAUUSD"] }, INPUTS).verdict).toBe("violated");
  });

  it("respeta una lista de prohibidos", () => {
    expect(setMembership({ field: "symbol", denied: ["EURUSD"] }, INPUTS).verdict).toBe("violated");
    expect(setMembership({ field: "symbol", denied: ["XAUUSD"] }, INPUTS).verdict).toBe("compliant");
  });

  it("sin operation_facts es unavailable, nunca compliant", () => {
    const v = setMembership({ field: "symbol", allowed: ["EURUSD"] }, { account_facts: HECHOS_CUENTA });
    expect(v.verdict).toBe("unavailable");
  });
});

describe("time_window", () => {
  it("evalúa contra opened_at real, no contra el momento de ejecución", () => {
    expect(timeWindow({ allowed_hour_from_utc: 8, allowed_hour_to_utc: 17 }, INPUTS).verdict).toBe("compliant");
    expect(timeWindow({ allowed_hour_from_utc: 18, allowed_hour_to_utc: 22 }, INPUTS).verdict).toBe("violated");
  });

  it("soporta restricción de fin de semana por día UTC", () => {
    // 2026-01-05 es lunes (getUTCDay() === 1)
    expect(timeWindow({ allowed_weekdays_utc: [1, 2, 3, 4, 5] }, INPUTS).verdict).toBe("compliant");
    expect(timeWindow({ allowed_weekdays_utc: [0, 6] }, INPUTS).verdict).toBe("violated");
  });

  it("soporta ventanas que cruzan la medianoche", () => {
    expect(timeWindow({ allowed_hour_from_utc: 22, allowed_hour_to_utc: 6 }, INPUTS).verdict).toBe("violated");
  });
});

describe("composite", () => {
  const cumple: Veredicto = { verdict: "compliant", margin: HECHOS_OPERACION.risk_pct as never };

  it("cumple solo si todas sus dependencias cumplen", () => {
    const v = composite(
      { requires_compliant: ["profit_target"] },
      { account_facts: HECHOS_CUENTA, sibling_verdicts: { profit_target: cumple } },
    );
    expect(v.verdict).toBe("compliant");
  });

  it("incumple si alguna dependencia incumple", () => {
    const v = composite(
      { requires_compliant: ["profit_target"] },
      {
        account_facts: HECHOS_CUENTA,
        sibling_verdicts: { profit_target: { verdict: "violated", margin: cumple.margin as never } },
      },
    );
    expect(v.verdict).toBe("violated");
  });

  it("propaga unavailable en vez de asumir cumplimiento cuando falta una dependencia", () => {
    const sinHermano = composite({ requires_compliant: ["profit_target"] }, { account_facts: HECHOS_CUENTA });
    expect(sinHermano.verdict).toBe("unavailable");

    const noDisponible = composite(
      { requires_compliant: ["profit_target"] },
      {
        account_facts: HECHOS_CUENTA,
        sibling_verdicts: { profit_target: { verdict: "unavailable", reason: "sin datos" } },
      },
    );
    expect(noDisponible.verdict).toBe("unavailable");
  });
});

describe("pureza / determinismo", () => {
  it("mil invocaciones idénticas producen exactamente el mismo veredicto", () => {
    const params = { input: "drawdown_restante_pct", operator: "gte", threshold: "2.0000" };
    const primero = JSON.stringify(staticThreshold(params, INPUTS));
    for (let i = 0; i < 1000; i++) {
      expect(JSON.stringify(staticThreshold(params, INPUTS))).toBe(primero);
    }
  });
});
