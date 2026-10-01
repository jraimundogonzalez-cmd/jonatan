/**
 * Tiempo medio en mercado (SPEC-001 §3.5, §4.1): media de `time_in_market_sec`.
 * Usa el brand `Seconds` del kernel decimal — ver nota de corrección en
 * decimal/kernel.ts (SPEC-001 tipaba esta función sobre `number[]` nativo).
 */
import { Decimal, toDecimal, secondsFromDecimal } from "../decimal/kernel.js";
import type { FixedDecimal } from "../decimal/kernel.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

export type Seconds = FixedDecimal<"Seconds">;

export function calcularTiempoMedioEnMercado(muestra: readonly Seconds[]): Result<QuantResult<Seconds>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularTiempoMedioEnMercado requiere al menos 1 elemento" });
  }

  let suma = new Decimal(0);
  for (const valor of muestra) {
    suma = suma.plus(toDecimal(valor));
  }
  const media = suma.div(muestra.length);

  return ok(wrapExact(secondsFromDecimal(media), "calcularTiempoMedioEnMercado", { n: muestra.length }));
}
