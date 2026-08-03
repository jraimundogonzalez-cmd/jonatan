import type { RValue } from "../core/types.js";

/**
 * Acumulador de Welford (SPEC-001 §5.3) — permite mantener media y varianza
 * muestral con O(1) por actualización, sin volver a leer el histórico
 * completo. `calcularEsperanza`/`calcularDesviacionR` (forma batch) pliegan
 * la muestra completa a través del mismo acumulador — es el mismo algoritmo,
 * nunca una segunda implementación de la media/varianza.
 */
export interface WelfordAccumulator {
  readonly n: number;
  readonly mean: RValue;
  readonly m2: RValue;
}

export interface HistogramBucket {
  readonly range_start: RValue;
  readonly range_end: RValue;
  readonly count: number;
}

export type Histogram = readonly HistogramBucket[];
