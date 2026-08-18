// Construcción del stack de dominio de Operations para el servidor.
//
// `OperationsEngineService` importa `randomUUID` de `node:crypto`: sólo puede
// correr en servidor. Este módulo existe para que esa construcción viva en un
// único sitio y no se repita —ni se desvíe— en cada Server Action.
//
// Nada de esto puede importarse desde un Client Component.
import "server-only";

import { OperationsEngineService, SupabaseTradeGateway } from "@tradepilot/operations-engine";
import { RiskEngineService } from "@tradepilot/risk-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAccountRiskStateRepository, SupabaseCapitalFactsProvider } from "@tradepilot/risk-engine";

export function crearOperationsEngine(client: SupabaseClient): OperationsEngineService {
  const riskEngine = new RiskEngineService(
    new SupabaseAccountRiskStateRepository(client),
    new SupabaseCapitalFactsProvider(client),
  );
  return new OperationsEngineService(new SupabaseTradeGateway(client), riskEngine);
}
