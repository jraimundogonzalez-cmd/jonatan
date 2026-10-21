/**
 * Racha máxima (SPEC-001 §3.5, §4.1): longitud máxima de signo constante
 * consecutivo.
 *
 * **Decisión de dominio resuelta aquí** (SPEC-001 no la precisaba): un
 * `R_final = 0` (cierre en breakeven exacto) no tiene signo — no puede
 * extender ni una racha ganadora ni una perdedora, así que la interrumpe.
 * En caso de empate entre la racha positiva y la negativa más larga, se
 * devuelve la que ocurre primero cronológicamente en la muestra (criterio
 * determinista, documentado explícitamente para que ninguna implementación
 * futura lo decida de otra forma sin darse cuenta).
 */
import { isPositive, isZero } from "../decimal/kernel.js";
import type { RValue } from "../core/types.js";
import { err, ok, type Result, type QuantError } from "../errors/index.js";
import { wrapExact, type QuantResult } from "../explain/index.js";

export interface RachaMaxima {
  readonly longitud: number;
  readonly signo: "positiva" | "negativa";
}

function signoDe(valor: RValue): "positiva" | "negativa" | "neutro" {
  if (isZero(valor)) return "neutro";
  return isPositive(valor) ? "positiva" : "negativa";
}

export function calcularRachaMaxima(muestra: readonly RValue[]): Result<QuantResult<RachaMaxima>, QuantError> {
  if (muestra.length === 0) {
    return err({ code: "EMPTY_SAMPLE", detail: "calcularRachaMaxima requiere al menos 1 elemento" });
  }

  let mejor: RachaMaxima | null = null;
  let rachaActualSigno: "positiva" | "negativa" | "neutro" = "neutro";
  let rachaActualLongitud = 0;

  for (const valor of muestra) {
    const signo = signoDe(valor);

    if (signo === "neutro") {
      rachaActualSigno = "neutro";
      rachaActualLongitud = 0;
      continue;
    }

    if (signo === rachaActualSigno) {
      rachaActualLongitud += 1;
    } else {
      rachaActualSigno = signo;
      rachaActualLongitud = 1;
    }

    if (!mejor || rachaActualLongitud > mejor.longitud) {
      mejor = { longitud: rachaActualLongitud, signo: rachaActualSigno };
    }
  }

  // Muestra íntegramente en breakeven (todo R_final = 0) — no hay racha de
  // ningún signo; se reporta longitud 0 con "positiva" como convención fija
  // y documentada, nunca como un valor con significado real.
  const resultado = mejor ?? { longitud: 0, signo: "positiva" as const };

  return ok(wrapExact(resultado, "calcularRachaMaxima", { n: muestra.length }));
}
