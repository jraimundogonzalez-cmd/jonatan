import { describe, expect, it } from "vitest";
import {
  calcularEvidenciaParciales,
  calcularImpactoPorParcial,
  calcularRAgregado,
  calcularRFinal,
  BETrigger,
  money,
  percent,
  rvalue,
  toDisplayString,
  type ParcialEjecutado,
} from "../../src/index.js";

// BUILD 022 — «R realizado» (decisión E-2) y «R agregado» (decisión E-1).

function parcial(sequence: 1 | 2 | 3 | 4 | 5, rr: string, pct: string): ParcialEjecutado {
  return {
    sequence,
    rr_level: rvalue(rr),
    pct_close: percent(pct),
    executed_at: `2026-01-0${sequence}T00:00:00Z`,
  };
}

/** El caso que BUILD 021 usó como evidencia del hueco. */
const CASO_021 = [parcial(1, "1.0000", "50.00"), parcial(2, "2.0000", "25.00")];

describe("calcularEvidenciaParciales — R realizado", () => {
  it("0,5×1R + 0,25×2R = +1,0000 R", () => {
    const r = calcularEvidenciaParciales(CASO_021);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(toDisplayString(r.value.value.r_realizado)).toBe("1.0000");
  });

  it("reparte la posición sin que nadie tenga que restar de 100", () => {
    const r = calcularEvidenciaParciales(CASO_021);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.value.pct_cerrado)).toBe("75.00");
    expect(toDisplayString(r.value.value.pct_abierto)).toBe("25.00");
  });

  it("devuelve el mayor R evidenciado — la cota inferior de r_max", () => {
    const r = calcularEvidenciaParciales(CASO_021);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.value.r_maximo_evidenciado!)).toBe("2.0000");
  });

  it("sin parciales: 0 R realizado, 100 % abierto y ningún máximo", () => {
    const r = calcularEvidenciaParciales([]);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.value.r_realizado)).toBe("0.0000");
    expect(toDisplayString(r.value.value.pct_cerrado)).toBe("0.00");
    expect(toDisplayString(r.value.value.pct_abierto)).toBe("100.00");
    expect(r.value.value.r_maximo_evidenciado).toBeNull();
  });

  it("no necesita r_max: se pregunta con la Operación todavía abierta", () => {
    // Ésta es la razón de existir de `validarParciales(parciales, null)`. Si
    // exigiera r_max, «R realizado» sería incalculable justo cuando importa.
    const r = calcularEvidenciaParciales([parcial(1, "9.9999", "10.00")]);
    expect(r.ok).toBe(true);
  });

  it("sigue rechazando evidencia imposible: Σ pct > 100", () => {
    const r = calcularEvidenciaParciales([parcial(1, "1.0000", "60.00"), parcial(2, "2.0000", "50.00")]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("PARTIALS_EXCEED_100_PCT");
  });

  it("sigue rechazando rr_level no creciente", () => {
    const r = calcularEvidenciaParciales([parcial(1, "2.0000", "25.00"), parcial(2, "1.0000", "25.00")]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INVALID_PARTIAL_SEQUENCE");
  });

  it("R realizado NO es R final: le falta el término del resto", () => {
    // Mismos parciales, mismo instante. Con el desenlace BREAK_EVEN el resto
    // aporta 0 y ambos coinciden; con TAKE_PROFIT el resto aporta y divergen.
    // Que el número coincida a veces no los convierte en el mismo concepto.
    const input = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: CASO_021,
      r_max: rvalue("3.0000"),
      be_trigger: BETrigger.NONE,
    };
    const realizado = calcularEvidenciaParciales(CASO_021);
    const final = calcularRFinal(input);
    if (!realizado.ok || !final.ok) throw new Error("unreachable");
    expect(toDisplayString(realizado.value.value.r_realizado)).toBe("1.0000");
    // 0,5 + 0,5 + 0,25×3 = 1,75
    expect(toDisplayString(final.value.value)).toBe("1.7500");
  });

  it("coincide, término a término, con el desglose de R_final", () => {
    // La propiedad que garantiza que no hay dos fórmulas: la suma de las
    // contribuciones de los parciales en `calcularImpactoPorParcial` es
    // exactamente el R realizado.
    const input = {
      riesgo_eur: money("100.0000"),
      rr_objetivo: rvalue("3.0000"),
      parciales_ejecutados: CASO_021,
      r_max: rvalue("2.5000"),
      be_trigger: BETrigger.NONE,
    };
    const final = calcularRFinal(input);
    if (!final.ok) throw new Error("unreachable");
    const impacto = calcularImpactoPorParcial(input, final.value.value);
    const realizado = calcularEvidenciaParciales(CASO_021);
    if (!impacto.ok || !realizado.ok) throw new Error("unreachable");

    const sumaParciales = impacto.value.value
      .filter((i) => i.kind === "parcial")
      .reduce((acc, i) => acc + Number(toDisplayString(i.contribution)), 0);
    expect(sumaParciales.toFixed(4)).toBe(toDisplayString(realizado.value.value.r_realizado));
  });
});

describe("calcularRAgregado — R de la Cuenta", () => {
  it("suma la muestra vigente", () => {
    const r = calcularRAgregado([rvalue("2.0000"), rvalue("-1.0000"), rvalue("1.7500")]);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.value)).toBe("2.7500");
  });

  it("una Cuenta sin Operaciones cerradas suma 0, no falla", () => {
    const r = calcularRAgregado([]);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.value)).toBe("0.0000");
  });

  it("no pierde precisión en muestras largas", () => {
    const muestra = Array.from({ length: 300 }, () => rvalue("0.3333"));
    const r = calcularRAgregado(muestra);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.value)).toBe("99.9900");
  });

  it("declara su formula_id, como cualquier otra capacidad del catálogo", () => {
    const r = calcularRAgregado([rvalue("1.0000")]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.formula_id).toBe("calcularRAgregado");
    expect(r.value.confidence.type).toBe("exact");
  });
});
