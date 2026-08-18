export interface TimeSeriesPoint<T> {
  readonly timestamp: string; // ISO 8601
  readonly value: T;
}

export type TimeSeries<T> = readonly TimeSeriesPoint<T>[];

/**
 * Brands válidos para una curva de equity/drawdown — SPEC-001 §3.6 tipaba
 * `calcularCurvaEquity` como `muestra_ordenada: Money[]` incondicionalmente,
 * incluso cuando `unidad = "R"` (un `RValue` no es un `Money`). Corregido
 * generalizando la función sobre este brand: el propio tipo del dato ya
 * determina la unidad, así que el parámetro `unidad` separado desaparece —
 * elimina por construcción la posibilidad de que ambos diverjan.
 */
export type EquityBrand = "Money" | "RValue";
