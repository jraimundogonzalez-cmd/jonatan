/**
 * Catálogo de errores tipados de Quant Engine (SPEC-001 §3.3). Ninguna función
 * pública retorna `null`/`NaN`/`Infinity` para un caso indefinido — siempre un
 * `QuantError` explícito.
 */
export type QuantError =
  | { code: "INVALID_PARTIAL_SEQUENCE"; detail: string }
  | { code: "PARTIALS_EXCEED_100_PCT"; detail: string }
  | { code: "EMPTY_SAMPLE"; detail: string }
  | {
      code: "UNDEFINED_RATIO";
      detail: string;
      // "ZERO_CAPITAL" añadido al implementar Grupo E (calcularDrawdownState,
      // SPEC-001 §3.7) — Drawdown_restante_% divide por current_capital, un
      // caso indefinido que el catálogo original (§3.3) no había previsto.
      reason: "ZERO_R_MAX" | "ZERO_LOSSES" | "ZERO_DRAWDOWN" | "ZERO_VARIANCE" | "ZERO_CAPITAL";
    }
  | { code: "OUT_OF_RANGE"; field: string; detail: string }
  | { code: "INCONSISTENT_TRIGGER_STATE"; detail: string };

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
