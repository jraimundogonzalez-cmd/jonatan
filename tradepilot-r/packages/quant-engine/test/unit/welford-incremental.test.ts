/**
 * Invariante de SPEC-001 §5.3: la forma incremental (Welford, O(1) por
 * actualización) debe producir exactamente el mismo resultado que la forma
 * batch — es el mismo algoritmo, no una segunda implementación que pueda
 * divergir.
 */
import { describe, expect, it } from "vitest";
import {
  EMPTY_WELFORD_ACCUMULATOR,
  calcularDesviacionDesdeAcumulador,
  calcularDesviacionR,
  calcularEsperanza,
  calcularEsperanzaIncremental,
  rvalue,
  toDisplayString,
} from "../../src/index.js";

const MUESTRA = ["1", "-1", "2", "-1", "3", "4.5", "-2.25", "0.75"].map(rvalue);

describe("Welford — equivalencia incremental vs. batch", () => {
  it("la media incremental (plegando la muestra) coincide exactamente con calcularEsperanza", () => {
    const acc = MUESTRA.reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);
    const batch = calcularEsperanza(MUESTRA);
    expect(batch.ok).toBe(true);
    if (!batch.ok) throw new Error("unreachable");
    expect(toDisplayString(acc.mean)).toBe(toDisplayString(batch.value.value));
  });

  it("la desviación desde el acumulador coincide exactamente con calcularDesviacionR", () => {
    const acc = MUESTRA.reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);
    const incremental = calcularDesviacionDesdeAcumulador(acc);
    const batch = calcularDesviacionR(MUESTRA);
    expect(incremental.ok && batch.ok).toBe(true);
    if (!incremental.ok || !batch.ok) throw new Error("unreachable");
    expect(toDisplayString(incremental.value.value)).toBe(toDisplayString(batch.value.value));
  });

  it("calcularEsperanzaIncremental nunca muta el acumulador recibido (pureza)", () => {
    const original = EMPTY_WELFORD_ACCUMULATOR;
    const originalSnapshot = { ...original };
    calcularEsperanzaIncremental(original, rvalue("5"));
    expect(original).toEqual(originalSnapshot);
  });

  it("acumular en dos lotes (primero 4 elementos, luego los 4 restantes) da el mismo resultado que un único fold", () => {
    const primerLote = MUESTRA.slice(0, 4).reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);
    const accCompleto = MUESTRA.slice(4).reduce(calcularEsperanzaIncremental, primerLote);
    const foldUnico = MUESTRA.reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);

    expect(toDisplayString(accCompleto.mean)).toBe(toDisplayString(foldUnico.mean));
    expect(toDisplayString(accCompleto.m2)).toBe(toDisplayString(foldUnico.m2));
  });
});
