import type { Result } from "@tradepilot/quant-engine";
import type { CapitalFacts, RiskEngineError } from "../domain/types.js";

/**
 * Puerto hacia Funding Management — Risk Engine nunca importa su esquema,
 * solo consume estos dos hechos ya resueltos (SPEC-003 §8.2).
 */
export interface CapitalFactsProvider {
  obtenerHechosDeCapital(accountId: string): Promise<Result<CapitalFacts, RiskEngineError>>;
}
