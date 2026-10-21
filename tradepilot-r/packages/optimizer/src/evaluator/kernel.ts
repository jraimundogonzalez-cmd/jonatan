/**
 * **Único punto de todo el paquete que importa `@tradepilot/quant-engine` como
 * valor** (SPEC-005 §3.3). El resto del componente (generador, estrategias,
 * comparador, explicación) importa desde aquí, nunca del paquete directamente
 * — así el choke point es verificable con un solo `grep`, no una convención.
 *
 * Ninguna función de este archivo implementa una fórmula del catálogo de
 * SPEC-001: son constructores del kernel decimal y operaciones aritméticas
 * genéricas (resta, cociente) sobre valores **ya calculados** por Quant
 * Engine. La distinción es la que SPEC-005 §13.1 exige: `comparator`/`explain`
 * pueden restar dos resultados, nunca recalcular ninguno.
 *
 * Toda la aritmética usa el `Decimal` que `toDecimal` devuelve y vuelve a
 * entrar por una cadena decimal exacta (`toFixed` → `rvalue`/`percent`) —
 * nunca `number` intermedio, por lo que no hay contaminación de coma flotante
 * (SPEC-001 §4.3, I15).
 */
import { percent, rvalue, toDecimal, toDisplayString } from "@tradepilot/quant-engine";
import type { Percent, RValue } from "@tradepilot/quant-engine";

export { compare, money, percent, rvalue, toDecimal, toDisplayString } from "@tradepilot/quant-engine";

const R_SCALE = 4;
const PCT_SCALE = 2;

/** Diferencia entre dos valores ya calculados (`candidata − baseline`). */
export function restarR(a: RValue, b: RValue): RValue {
  return rvalue(toDecimal(a).minus(toDecimal(b)).toFixed(R_SCALE));
}

/** `parte / total × 100`, con `total > 0` garantizado por el llamador. */
export function porcentajeDeConteo(parte: number, total: number): Percent {
  const parteD = toDecimal(rvalue(String(parte)));
  const totalD = toDecimal(rvalue(String(total)));
  return percent(parteD.div(totalD).times(100).toFixed(PCT_SCALE));
}

/** `paso × indice` — construye un valor del grid de búsqueda, nunca un resultado de dominio. */
export function valorDeGrid(pasoDecimalString: string, indice: number): RValue {
  return rvalue(toDecimal(rvalue(pasoDecimalString)).times(indice).toFixed(R_SCALE));
}

/** Nº de escalones de `paso` que caben en `total` — solo acota una enumeración, nunca produce un valor. */
export function escalonesDeGrid(total: RValue, pasoDecimalString: string): number {
  return Math.floor(toDecimal(total).div(toDecimal(rvalue(pasoDecimalString))).toNumber());
}

/** Porcentaje construido desde un número entero de escalones de 5% (grid de 02 §5.1). */
export function porcentajeDeEscalones(escalones: number, pasoPct: number): Percent {
  return percent((escalones * pasoPct).toFixed(PCT_SCALE));
}

export function esMayor(a: RValue, b: RValue): boolean {
  return toDecimal(a).greaterThan(toDecimal(b));
}

/** −1 / 0 / 1 — orden total exacto sobre el kernel decimal, nunca sobre `number`. */
export function compararR(a: RValue, b: RValue): number {
  return toDecimal(a).comparedTo(toDecimal(b));
}

export function claveDeOrden(v: RValue): string {
  return toDisplayString(v);
}
