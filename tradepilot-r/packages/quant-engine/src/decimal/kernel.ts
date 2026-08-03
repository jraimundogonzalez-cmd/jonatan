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

const KERNEL_PRECISION = 50;

Decimal.set({
  precision: KERNEL_PRECISION,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export type FixedDecimalBrand = "Money" | "RValue" | "Percent";

const SCALE_BY_BRAND: Record<FixedDecimalBrand, number> = {
  Money: 4, // numeric(18,4) — 04 §1.2
  RValue: 4, // numeric(8,4)
  Percent: 2, // numeric(5,2)
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

function wrap<Brand extends FixedDecimalBrand>(
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

export { Decimal };
