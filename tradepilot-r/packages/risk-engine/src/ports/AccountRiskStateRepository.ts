import type { Result, WelfordAccumulator } from "@tradepilot/quant-engine";
import type { AccountRiskState, RiskEngineError } from "../domain/types.js";

export type ApplyAccumulatorOutcome =
  | { readonly kind: "applied"; readonly state: AccountRiskState }
  | { readonly kind: "version_conflict"; readonly current: AccountRiskState }
  | { readonly kind: "already_processed"; readonly current: AccountRiskState };

/**
 * Puerto (Dependency Inversion) — el servicio de Risk Engine depende de esta
 * abstracción, nunca de Supabase directamente. Permite probar toda la lógica
 * de orquestación con un repositorio en memoria, sin red ni base de datos.
 */
export interface AccountRiskStateRepository {
  obtener(accountId: string): Promise<Result<AccountRiskState, RiskEngineError>>;

  /**
   * Aplica una actualización del acumulador de forma atómica en una única
   * operación: comprueba idempotencia (`eventId` ya procesado) y
   * concurrencia optimista (`expectedVersion`) en la misma transacción del
   * lado del repositorio — nunca dos pasos separados que puedan dejar una
   * escritura a medias entre ellos.
   */
  aplicarActualizacion(params: {
    readonly accountId: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly expectedVersion: number;
    readonly nuevoAcumulador: WelfordAccumulator;
  }): Promise<Result<ApplyAccumulatorOutcome, RiskEngineError>>;

  yaProcesado(eventId: string): Promise<Result<boolean, RiskEngineError>>;
}
