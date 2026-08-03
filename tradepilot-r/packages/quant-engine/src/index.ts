// API pública de @tradepilot/quant-engine (SPEC-001 §3).
// Ningún consumidor debe importar rutas internas (p.ej. "../decimal/kernel") —
// todo lo público se re-exporta aquí.

export type { FixedDecimal, FixedDecimalBrand } from "./decimal/kernel.js";
export {
  money,
  rvalue,
  percent,
  seconds,
  toDecimal,
  toDisplayString,
  compare,
  isNegative,
  isPositive,
  isZero,
} from "./decimal/kernel.js";

export type { Money, RValue, Percent, ParcialEjecutado, RFinalInput, ImpactoPorParcialItem } from "./core/types.js";
export { BETrigger } from "./core/types.js";

// Grupo B — core (resultado de una operación individual)
export {
  calcularRFinal,
  calcularBeneficioReal,
  calcularBeneficioMaximo,
  calcularBeneficioSacrificado,
  calcularPorcentajeConservado,
  calcularImpactoPorParcial,
} from "./core/r-final.js";

// Grupo C+G — stats (agregados de cartera)
export type { WelfordAccumulator, Histogram, HistogramBucket } from "./stats/types.js";
export {
  EMPTY_WELFORD_ACCUMULATOR,
  calcularEsperanzaIncremental,
  calcularDesviacionDesdeAcumulador,
  calcularEsperanza,
  calcularDesviacionR,
  calcularRatioConsistencia,
  calcularProfitFactor,
  calcularWinRate,
  calcularRecoveryFactor,
  calcularRachaMaxima,
  calcularTiempoMedioEnMercado,
  calcularDistribucionR,
} from "./stats/index.js";
export type { RachaMaxima, Seconds } from "./stats/index.js";

// Grupo D — curves (curvas de equity/drawdown histórico)
export type { TimeSeries, TimeSeriesPoint, EquityBrand, DrawdownHistoricoResult } from "./curves/index.js";
export { calcularCurvaEquity, calcularDrawdownHistorico } from "./curves/index.js";

// Grupo E — risk-state (estado de drawdown prospectivo)
export type { DrawdownType, DrawdownStateInput, DrawdownState } from "./risk-state/index.js";
export { calcularDrawdownState } from "./risk-state/index.js";

// Grupo F — simulation (consumido por Optimizer/Simulation Engine)
export type { ScoreInput } from "./simulation/index.js";
export { simularGestion, calcularScore } from "./simulation/index.js";

export type { QuantError, Result } from "./errors/index.js";
export { ok, err } from "./errors/index.js";

export type { QuantResult, Confidence } from "./explain/index.js";
