// API pública de @tradepilot/risk-engine — primer consumidor oficial de
// @tradepilot/quant-engine (26 §8, 22.5 §2.3). Orquesta, nunca calcula.

// Re-exportado para que Operations Engine (BUILD 004, SPEC-002 §4.1: "no
// importa el paquete quant-engine") pueda tipar/ensamblar el RFinalInput que
// calcularResultado espera sin depender directamente de @tradepilot/quant-engine
// en su propio package.json — un único canal aprobado, no una excepción.
export type { RFinalInput, Money, RValue, Percent, ParcialEjecutado, Result, QuantError } from "@tradepilot/quant-engine";
export { BETrigger, ok, err, money, rvalue, percent, toDisplayString, compare, toDecimal } from "@tradepilot/quant-engine";

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
