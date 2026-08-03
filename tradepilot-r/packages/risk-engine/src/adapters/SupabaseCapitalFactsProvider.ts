/**
 * Adaptador Supabase de `CapitalFactsProvider` — reutiliza la RPC de lectura
 * `obtener_cuenta` que ya expone Funding Management (SPEC-003,
 * `apps/web/lib/api/funding.ts`), nunca una tabla propia: Risk Engine no
 * duplica el esquema de `accounts`, solo consume los dos campos que necesita.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { err, money, ok, type Result } from "@tradepilot/quant-engine";
import type { CapitalFacts, RiskEngineError } from "../domain/types.js";
import type { CapitalFactsProvider } from "../ports/CapitalFactsProvider.js";

interface AccountRow {
  readonly current_capital: string;
  readonly initial_capital: string;
}

export class SupabaseCapitalFactsProvider implements CapitalFactsProvider {
  constructor(private readonly client: SupabaseClient) {}

  async obtenerHechosDeCapital(accountId: string): Promise<Result<CapitalFacts, RiskEngineError>> {
    const { data, error } = await this.client.rpc("obtener_cuenta", { p_id: accountId });
    if (error) {
      return err({ code: "CAPITAL_FACTS_UNAVAILABLE", account_id: accountId, detail: error.message });
    }
    if (!data) return err({ code: "ACCOUNT_NOT_FOUND", account_id: accountId });

    const row = data as AccountRow;
    return ok({
      current_capital: money(row.current_capital),
      initial_capital: money(row.initial_capital),
    });
  }
}
