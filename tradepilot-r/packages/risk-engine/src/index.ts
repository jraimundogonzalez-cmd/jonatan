// API pública de @tradepilot/risk-engine — primer consumidor oficial de
// @tradepilot/quant-engine (26 §8, 22.5 §2.3). Orquesta, nunca calcula.

export type { AccountRiskState, CapitalFacts, DrawdownConfig, RiskEngineError } from "./domain/types.js";
export type {
  AcumuladorActualizadoEvent,
  OperacionCanceladaEvent,
  OperacionCerradaEvent,
  OperacionEditadaEvent,
  RiskEngineInboundEvent,
} from "./domain/events.js";

export type { AccountRiskStateRepository, ApplyAccumulatorOutcome } from "./ports/AccountRiskStateRepository.js";
export type { CapitalFactsProvider } from "./ports/CapitalFactsProvider.js";

export { RiskEngineService, type ProcesarEventoResultado, type ResultadoOperacion } from "./services/RiskEngineService.js";

export { SupabaseAccountRiskStateRepository } from "./adapters/SupabaseAccountRiskStateRepository.js";
export { SupabaseCapitalFactsProvider } from "./adapters/SupabaseCapitalFactsProvider.js";
