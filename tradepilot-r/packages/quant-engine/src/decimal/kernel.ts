/**
 * Kernel decimal — único punto de import de `decimal.js` en todo el monorepo
 * (mvp-0.1.md §6.4, SPEC-001 §4.3). Ningún otro archivo debe importar
 * "decimal.js" directamente — la regla de ESLint en la raíz del repo lo hace
 * cumplir, no solo la disciplina de revisión.
 *
 * Redondeo bancario (ROUND_HALF_EVEN) en el límite público de cada función,
 * nunca en un paso intermedio (SPEC-001 §4.3.2-3).
 */
import Decimal from "decimal.js";

/**
 * Precisión global de guarda (dígitos SIGNIFICATIVOS, no decimales) — SPEC-001
 * §4.3.2 exige "scale + 10" dígitos de guarda para la división. Para el brand
 * más grande del kernel (Money/RValue, `numeric(18,4)`: hasta 14 dígitos
 * enteros + 4 de escala), eso son 14 + 4 + 10 = 28 dígitos significativos —
 * se redondea a 30 con margen.
 *
 * **Hallazgo de rendimiento (Challenge Mode, encontrado por benchmark real,
 * no por inspección)**: el valor original de esta constante era 50, casi el
 * doble de lo que el propio §4.3.2 exige. `Decimal.div()` en decimal.js tiene
 * coste creciente con la precisión configurada — con 50 dígitos, los
 * benchmarks de Grupo C (`calcularEsperanza`/`calcularDesviacionR`, N=10.000)
 * medían ~50-58ms, **por encima** del objetivo de <15ms de SPEC-001 §5.1;
 * Grupo D (`calcularCurvaEquity`, N=10.000) rondaba el límite de 20ms. Con
 * `KERNEL_PRECISION = 30` (todavía con margen de guarda de sobra para el
 * dominio real), ambos grupos vuelven a cumplir sus objetivos — ver
 * test/bench/quant-engine.bench.ts para las cifras reales antes/después.
 */
const KERNEL_PRECISION = 30;

Decimal.set({
  precision: KERNEL_PRECISION,
  rounding: Decimal.ROUND_HALF_EVEN,
});

/**
 * `Seconds` — añadido al implementar Grupo C (`calcularTiempoMedioEnMercado`,
 * SPEC-001 §3.5). Hallazgo de Challenge Mode: la especificación tipaba esa
 * función sobre `number[]`/`number` nativos — la única función de todo el
 * catálogo que violaba §1.2 punto 2 ("nunca usa coma flotante, ni siquiera en
 * un paso intermedio") en su propia firma. Escala 0 (segundos enteros, acorde
 * al nombre `time_in_market_sec`) — si en el futuro hiciera falta precisión
 * de sub-segundo, se sube la escala aquí, en el único punto de configuración.
 */
export type FixedDecimalBrand = "Money" | "RValue" | "Percent" | "Seconds";

const SCALE_BY_BRAND: Record<FixedDecimalBrand, number> = {
  Money: 4, // numeric(18,4) — 04 §1.2
  RValue: 4, // numeric(8,4)
  Percent: 2, // numeric(5,2)
  Seconds: 0, // duración en segundos enteros
};

/**
 * FixedDecimal<Brand> — nunca un `number` nativo de JS/TS (SPEC-001 §3.1).
 * El brand distingue nominalmente Money de RValue aunque compartan escala 4,
 * para que un `Money` nunca se pase por error donde se espera un `RValue`.
 */
export interface FixedDecimal<Brand extends FixedDecimalBrand> {
  readonly brand: Brand;
  readonly scale: number;
  readonly raw: Decimal;
}

const DECIMAL_STRING_RE = /^-?\d+(\.\d+)?$/;

export class InvalidDecimalStringError extends Error {
  constructor(value: string) {
    super(`FixedDecimal: "${value}" no es una cadena decimal válida`);
    this.name = "InvalidDecimalStringError";
  }
}

function assertFiniteDecimalString(value: string): void {
  if (!DECIMAL_STRING_RE.test(value.trim())) {
    throw new InvalidDecimalStringError(value);
  }
}

/**
 * Envoltura genérica desde un `Decimal` ya calculado, parametrizada por
 * brand — usada por código genérico sobre brand (p.ej. `curves/`, que opera
 * indistintamente sobre `Money` o `RValue` según la unidad elegida por el
 * llamador). Las envolturas específicas (`moneyFromDecimal`, etc.) siguen
 * siendo la vía preferida cuando el brand es estático en el punto de uso.
 */
export function wrap<Brand extends FixedDecimalBrand>(
  brand: Brand,
  value: Decimal,
): FixedDecimal<Brand> {
  const scale = SCALE_BY_BRAND[brand];
  return {
    brand,
    scale,
    raw: value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN),
  };
}

/**
 * Constructores desde `string` — nunca desde `number`, para que ningún dato
 * monetario/R entre al kernel ya contaminado por coma flotante (mvp-0.1.md §8,
 * regla de borde de API).
 */
export function money(value: string): FixedDecimal<"Money"> {
  assertFiniteDecimalString(value);
  return wrap("Money", new Decimal(value));
}

export function rvalue(value: string): FixedDecimal<"RValue"> {
  assertFiniteDecimalString(value);
  return wrap("RValue", new Decimal(value));
}

export function percent(value: string): FixedDecimal<"Percent"> {
  assertFiniteDecimalString(value);
  return wrap("Percent", new Decimal(value));
}

export function seconds(value: string): FixedDecimal<"Seconds"> {
  assertFiniteDecimalString(value);
  return wrap("Seconds", new Decimal(value));
}

/** Envoltura interna desde un `Decimal` ya calculado — frontera de salida de una función pública. */
export function moneyFromDecimal(value: Decimal): FixedDecimal<"Money"> {
  return wrap("Money", value);
}
export function rvalueFromDecimal(value: Decimal): FixedDecimal<"RValue"> {
  return wrap("RValue", value);
}
export function percentFromDecimal(value: Decimal): FixedDecimal<"Percent"> {
  return wrap("Percent", value);
}
export function secondsFromDecimal(value: Decimal): FixedDecimal<"Seconds"> {
  return wrap("Seconds", value);
}

/** Acceso al `Decimal` subyacente — frontera de entrada a un bloque de cálculo interno. */
export function toDecimal<Brand extends FixedDecimalBrand>(
  fd: FixedDecimal<Brand>,
): Decimal {
  return fd.raw;
}

export function toDisplayString<Brand extends FixedDecimalBrand>(
  fd: FixedDecimal<Brand>,
): string {
  return fd.raw.toFixed(fd.scale);
}

export function compare<Brand extends FixedDecimalBrand>(
  a: FixedDecimal<Brand>,
  b: FixedDecimal<Brand>,
): -1 | 0 | 1 {
  return a.raw.comparedTo(b.raw) as -1 | 0 | 1;
}

export function isNegative<Brand extends FixedDecimalBrand>(
  fd: FixedDecimal<Brand>,
): boolean {
  return fd.raw.isNegative();
}

export function isZero<Brand extends FixedDecimalBrand>(
  fd: FixedDecimal<Brand>,
): boolean {
  return fd.raw.isZero();
}

export function isPositive<Brand extends FixedDecimalBrand>(
  fd: FixedDecimal<Brand>,
): boolean {
  return fd.raw.isPositive() && !fd.raw.isZero();
}

export { Decimal };
