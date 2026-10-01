import { err, ok, type Result } from "@tradepilot/quant-engine";
import type { CapitalFacts, RiskEngineError } from "../../src/domain/types.js";
import type { CapitalFactsProvider } from "../../src/ports/CapitalFactsProvider.js";

/** Doble en memoria de `CapitalFactsProvider` — evita acoplar los tests de RiskEngineService a Funding Management. */
export class InMemoryCapitalFactsProvider implements CapitalFactsProvider {
  private readonly facts = new Map<string, CapitalFacts>();

  seed(accountId: string, facts: CapitalFacts): void {
    this.facts.set(accountId, facts);
  }

  async obtenerHechosDeCapital(accountId: string): Promise<Result<CapitalFacts, RiskEngineError>> {
    const facts = this.facts.get(accountId);
    if (!facts) {
      return err({ code: "CAPITAL_FACTS_UNAVAILABLE", account_id: accountId, detail: "no seeded en el doble de prueba" });
    }
    return ok(facts);
  }
}
