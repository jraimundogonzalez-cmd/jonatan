// API pública de @tradepilot/quant-engine (SPEC-001 §3).
// Ningún consumidor debe importar rutas internas (p.ej. "../decimal/kernel") —
// todo lo público se re-exporta aquí.

export type { FixedDecimal, FixedDecimalBrand } from "./decimal/kernel.js";
export {
  money,
  rvalue,
  percent,
  toDecimal,
  toDisplayString,
  compare,
  isNegative,
  isZero,
} from "./decimal/kernel.js";

export type { Money, RValue, Percent, ParcialEjecutado, RFinalInput, ImpactoPorParcialItem } from "./core/types.js";
export { BETrigger } from "./core/types.js";

export {
  calcularRFinal,
  calcularBeneficioReal,
  calcularBeneficioMaximo,
  calcularBeneficioSacrificado,
  calcularPorcentajeConservado,
  calcularImpactoPorParcial,
} from "./core/r-final.js";

export type { QuantError, Result } from "./errors/index.js";
export { ok, err } from "./errors/index.js";

export type { QuantResult, Confidence } from "./explain/index.js";
