// API pública de @tradepilot/operations-engine (SPEC-002). Dueño del ciclo
// de vida de la Operación — solo cerrar/editar/previsualizar viven aquí
// (TypeScript); abrir/registrar parciales/cancelar son capital-neutral y viven
// en SQL (supabase/functions/sql/operations.sql), sin necesitar este paquete.

export {
  KNOWN_OPERATIONS_ERROR_CODES,
  type ClosureReason,
  type OperationsError,
  type Trade,
  type TradePartialExecuted,
  type TradeSide,
  type TradeStatus,
} from "./domain/types.js";

export type { AplicarCierreParams, AplicarEdicionParams, TradeGateway } from "./ports/TradeGateway.js";

export {
  OperationsEngineService,
  type CerrarOperacionInput,
  type CierreOperacionResultado,
  type EditarOperacionInput,
  type EdicionOperacionResultado,
  type PrevisualizacionCierre,
  // BUILD 022
  type PrevisualizacionCorreccion,
  type ResumenDeCuenta,
} from "./services/OperationsEngineService.js";
export type { EvidenciaParciales, ImpactoPorParcialItem } from "@tradepilot/risk-engine";

export { SupabaseTradeGateway, parseOperationsError } from "./adapters/SupabaseTradeGateway.js";
