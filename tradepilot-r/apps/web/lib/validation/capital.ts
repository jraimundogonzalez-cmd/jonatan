// Validación de importes monetarios — reutiliza el kernel decimal de
// Quant Engine (@tradepilot/quant-engine) en vez de reimplementar la regex de
// cadena decimal aquí, para no duplicar la única fuente de verdad de "qué es
// una cadena decimal válida" (mismo principio de no-duplicación que
// SPEC-001 §Riesgos #1 aplica a fórmulas, aquí aplicado a validación de forma).
import { isNegative, isZero, money } from "@tradepilot/quant-engine";

export function validateInitialCapital(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "Introduce el capital inicial" };
  }
  try {
    const parsed = money(value);
    if (isZero(parsed) || isNegative(parsed)) {
      return { ok: false, message: "El capital inicial debe ser mayor que 0" };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, message: "Ese importe no es un número válido" };
  }
}

/**
 * A diferencia de `initial_capital`, un evento de capital admite valores
 * negativos (retiradas, ajustes a la baja) — solo se valida que sea un
 * número parseable, nunca su signo (mismo criterio que
 * supabase/functions/sql/funding.sql, `registrar_evento_capital`).
 */
export function validateCapitalEventAmount(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "Introduce un importe" };
  }
  try {
    money(value);
    return { ok: true, value };
  } catch {
    return { ok: false, message: "Ese importe no es un número válido" };
  }
}
