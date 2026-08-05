/**
 * El generador debe producir candidatas **estructuralmente válidas por
 * construcción** (SPEC-005 §5.1): el rechazo queda reservado a errores de
 * implementación, nunca es el mecanismo normal de generación. Se verifica
 * como property test sobre muchas semillas, no con un par de casos sueltos.
 */
import { describe, expect, it } from "vitest";
import { BETrigger, rvalue, toDisplayString } from "@tradepilot/quant-engine";
import { generarScenario } from "../../src/scenario/generator.js";
import { crearRng } from "../../src/prng.js";
import type { ScenarioSpaceParams } from "../../src/domain/types.js";

const SPACE: ScenarioSpaceParams = {
  rr_objetivo: rvalue("5.0000"),
  max_partials: 5,
  be_triggers: [BETrigger.NONE, BETrigger.AFTER_NTH_PARTIAL, BETrigger.CUSTOM_LEVEL],
};

describe("scenario-generator — validez estructural por construcción", () => {
  it("2.000 candidatas de 200 semillas distintas cumplen todas las reglas de forma", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = crearRng(seed);
      for (let i = 0; i < 10; i++) {
        const scenario = generarScenario(SPACE, rng);
        const parciales = scenario.parciales_planificados;

        expect(parciales.length).toBeLessThanOrEqual(5);

        let sumaPct = 0;
        let prevRr = 0;
        parciales.forEach((p, idx) => {
          // sequence consecutiva desde 1 — exigido por la validación de Quant Engine
          expect(p.sequence).toBe(idx + 1);
          // rr_level estrictamente creciente
          const rr = Number(toDisplayString(p.rr_level));
          expect(rr).toBeGreaterThan(prevRr);
          prevRr = rr;
          // dentro del grid y del objetivo
          expect(rr).toBeLessThanOrEqual(5);
          // pct_close > 0 y múltiplo del grid de 5%
          const pct = Number(toDisplayString(p.pct_close));
          expect(pct).toBeGreaterThan(0);
          expect(pct % 5).toBe(0);
          sumaPct += pct;
        });

        expect(sumaPct).toBeLessThanOrEqual(100);
        expect(SPACE.be_triggers).toContain(scenario.be_trigger);
      }
    }
  });

  it("es determinista: la misma semilla produce exactamente la misma secuencia", () => {
    const a = Array.from({ length: 25 }, (() => { const rng = crearRng(42); return () => generarScenario(SPACE, rng); })());
    const b = Array.from({ length: 25 }, (() => { const rng = crearRng(42); return () => generarScenario(SPACE, rng); })());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("respeta max_partials = 0 (gestión sin parciales, todo al objetivo)", () => {
    const rng = crearRng(7);
    for (let i = 0; i < 20; i++) {
      const scenario = generarScenario({ ...SPACE, max_partials: 0 }, rng);
      expect(scenario.parciales_planificados).toHaveLength(0);
    }
  });
});
