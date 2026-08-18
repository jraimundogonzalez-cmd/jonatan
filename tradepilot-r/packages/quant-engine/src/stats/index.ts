export type { WelfordAccumulator, Histogram, HistogramBucket } from "./types.js";
export {
  EMPTY_WELFORD_ACCUMULATOR,
  calcularEsperanzaIncremental,
  calcularDesviacionDesdeAcumulador,
  calcularEsperanza,
  calcularDesviacionR,
} from "./welford.js";
export { calcularRatioConsistencia } from "./ratio-consistencia.js";
export { calcularProfitFactor } from "./profit-factor.js";
export { calcularWinRate } from "./win-rate.js";
export { calcularRecoveryFactor } from "./recovery-factor.js";
export { calcularRachaMaxima, type RachaMaxima } from "./racha-maxima.js";
export { calcularTiempoMedioEnMercado, type Seconds } from "./tiempo-en-mercado.js";
export { calcularDistribucionR } from "./distribucion-r.js";
