// API pública de @tradepilot/operations-engine (SPEC-002). Dueño del ciclo
// de vida de la Operación — solo cerrar/editar viven aquí (TypeScript);
// abrir/registrar parciales/cancelar son capital-neutral y viven en SQL
// (supabase/functions/sql/operations.sql), sin necesitar este paquete.

export type { ClosureReason, OperationsError, Trade, TradePartialExecuted, TradeStatus } from "./domain/types.js";

export type { AplicarCierreParams, AplicarEdicionParams, TradeGateway } from "./ports/TradeGateway.js";

export {
  OperationsEngineService,
  type CerrarOperacionInput,
  type CierreOperacionResultado,
  type EditarOperacionInput,
  type EdicionOperacionResultado,
} from "./services/OperationsEngineService.js";

export { SupabaseTradeGateway } from "./adapters/SupabaseTradeGateway.js";
