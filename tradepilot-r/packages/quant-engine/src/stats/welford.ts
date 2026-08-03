/**
 * Media y desviación muestral de R (SPEC-001 §3.5, §4.1, §5.3, §8.3).
 * Un único algoritmo (Welford, numéricamente estable) sirve tanto a la forma
 * "batch" (recibe la muestra completa) como a la forma incremental (Risk
 * Engine actualiza un acumulador persistido por Cuenta, O(1) por operación
 * cerrada) — la forma batch pliega la muestra a través del mismo paso
 * incremental, nunca reimplementa la media/varianza por separado.
 *
 * `calcularDesviacionR` usa `N−1` en el denominador (estimador insesgado de
 * la varianza muestral) — deliberado: es la corrección que SPEC-001 §8.3
 * documenta como hallazgo (`calcularRatioConsistencia` y `calcularScore`
 * habrían tenido, sin esta función compartida, dos copias potencialmente
 * divergentes del cálculo de varianza).
 */
import { Decimal, rvalueFromDecimal, toDecimal } from "../decimal/kernel.js";
import type { RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import type { WelfordAccumulator } from "./types.js";

export const EMPTY_WELFORD_ACCUMULATOR: WelfordAccumulator = {
  n: 0,
  mean: rvalueFromDecimal(new Decimal(0)),
  m2: rvalueFromDecimal(new Decimal(0)),
};

/** Actualiza el acumulador con un nuevo valor — puro, nunca muta `acc`. */
export function calcularEsperanzaIncremental(acc: WelfordAccumulator, nuevo: RValue): WelfordAccumulator {
  const n = acc.n + 1;
  const x = toDecimal(nuevo);
  const mean = toDecimal(acc.mean);
  const m2 = toDecimal(acc.m2);

  const delta = x.minus(mean);
  const newMean = mean.plus(delta.div(n));
  const delta2 = x.minus(newMean);
  const newM2 = m2.plus(delta.times(delta2));

  return { n, mean: rvalueFromDecimal(newMean), m2: rvalueFromDecimal(newM2) };
}

function foldWelford(muestra: readonly RValue[]): WelfordAccumulator {
  let acc = EMPTY_WELFORD_ACCUMULATOR;
  for (const valor of muestra) {
    acc = calcularEsperanzaIncremental(acc, valor);
  }
  return acc;
}

export function calcularEsperanza(muestra: readonly RValue[]): Result<QuantResult<RValue>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularEsperanza requiere al menos 1 elemento" });
  }
  const acc = foldWelford(muestra);
  return ok(wrapExact(acc.mean, "calcularEsperanza", { n: muestra.length }));
}

/** Varianza/desviación muestral (N−1) a partir de un acumulador ya calculado — O(1). */
export function calcularDesviacionDesdeAcumulador(acc: WelfordAccumulator): Result<QuantResult<RValue>, QuantError> {
  if (acc.n === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularDesviacionDesdeAcumulador requiere al menos 1 elemento" });
  }
  if (acc.n === 1) {
    return err({
      code: "UNDEFINED_RATIO",
      reason: "ZERO_VARIANCE",
      detail: "la varianza muestral no está definida para N = 1",
    });
  }
  const varianza = toDecimal(acc.m2).div(acc.n - 1);
  const desviacion = varianza.sqrt();
  return ok(wrapExact(rvalueFromDecimal(desviacion), "calcularDesviacionR", { n: acc.n }));
}

export function calcularDesviacionR(muestra: readonly RValue[]): Result<QuantResult<RValue>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularDesviacionR requiere al menos 1 elemento" });
  }
  return calcularDesviacionDesdeAcumulador(foldWelford(muestra));
}
