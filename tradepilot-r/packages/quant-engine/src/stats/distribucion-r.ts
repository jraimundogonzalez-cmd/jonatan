/**
 * Distribución de R (SPEC-001 §3.5, §4.1): histograma por bucket de ancho
 * fijo `bucket_width`, cubriendo desde el múltiplo de `bucket_width` más
 * cercano por debajo del mínimo de la muestra hasta el máximo.
 */
import { isNegative, isZero, rvalueFromDecimal, toDecimal } from "../decimal/kernel.js";
import type { RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";
import type { Histogram } from "./types.js";

export function calcularDistribucionR(
  muestra: readonly RValue[],
  bucketWidth: RValue,
): Result<QuantResult<Histogram>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularDistribucionR requiere al menos 1 elemento" });
  }
  if (isZero(bucketWidth) || isNegative(bucketWidth)) {
    return err({ code: "OUT_OF_RANGE", field: "bucket_width", detail: "bucket_width debe ser > 0" });
  }

  const width = toDecimal(bucketWidth);
  let min = toDecimal(muestra[0]!);
  let max = min;
  for (const valor of muestra) {
    const decimalValor = toDecimal(valor);
    if (decimalValor.lt(min)) min = decimalValor;
    if (decimalValor.gt(max)) max = decimalValor;
  }

  const base = width.times(min.div(width).floor());
  const numBuckets = max.minus(base).div(width).floor().toNumber() + 1;

  const counts = new Array<number>(numBuckets).fill(0);
  for (const valor of muestra) {
    const idx = toDecimal(valor).minus(base).div(width).floor().toNumber();
    counts[idx] = (counts[idx] ?? 0) + 1;
  }

  const histogram: Histogram = counts.map((count, i) => ({
    range_start: rvalueFromDecimal(base.plus(width.times(i))),
    range_end: rvalueFromDecimal(base.plus(width.times(i + 1))),
    count,
  }));

  return ok(wrapExact(histogram, "calcularDistribucionR", { n: muestra.length, bucket_width: width.toString() }));
}
