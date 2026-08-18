import {
  err,
  ok,
  rvalue,
  type AccountRiskState,
  type AccountRiskStateRepository,
  type ApplyAccumulatorOutcome,
  type CapitalFacts,
  type CapitalFactsProvider,
  type Result,
  type RiskEngineError,
} from "@tradepilot/risk-engine";

/**
 * Dobles mínimos de los puertos de Risk Engine — no reimplementan la
 * semántica de concurrencia/idempotencia real (eso ya está probado a fondo
 * en `packages/risk-engine`, BUILD 003); aquí solo existen para poder
 * construir un `RiskEngineService` real y ejercer la orquestación de
 * `OperationsEngineService` de punta a punta sin red.
 */
export class InMemoryAccountRiskStateRepository implements AccountRiskStateRepository {
  private readonly states = new Map<string, AccountRiskState>();
  private readonly processedEvents = new Set<string>();

  seed(accountId: string): void {
    this.states.set(accountId, {
      account_id: accountId,
      accumulator: { n: 0, mean: rvalue("0.0000"), m2: rvalue("0.0000") },
      version: 0,
      updated_at: new Date(0).toISOString(),
    });
  }

  async obtener(accountId: string): Promise<Result<AccountRiskState, RiskEngineError>> {
    const state = this.states.get(accountId);
    if (!state) return err({ code: "ACCOUNT_NOT_FOUND", account_id: accountId });
    return ok(state);
  }

  async aplicarActualizacion(params: {
    readonly accountId: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly expectedVersion: number;
    readonly nuevoAcumulador: AccountRiskState["accumulator"];
  }): Promise<Result<ApplyAccumulatorOutcome, RiskEngineError>> {
    const current = this.states.get(params.accountId);
    if (!current) return err({ code: "ACCOUNT_NOT_FOUND", account_id: params.accountId });

    if (this.processedEvents.has(params.eventId)) {
      return ok({ kind: "already_processed", current });
    }
    if (current.version !== params.expectedVersion) {
      return ok({ kind: "version_conflict", current });
    }

    const next: AccountRiskState = {
      account_id: params.accountId,
      accumulator: params.nuevoAcumulador,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    };
    this.states.set(params.accountId, next);
    this.processedEvents.add(params.eventId);
    return ok({ kind: "applied", state: next });
  }

  async yaProcesado(eventId: string): Promise<Result<boolean, RiskEngineError>> {
    return ok(this.processedEvents.has(eventId));
  }
}

export class InMemoryCapitalFactsProvider implements CapitalFactsProvider {
  async obtenerHechosDeCapital(accountId: string): Promise<Result<CapitalFacts, RiskEngineError>> {
    return err({ code: "CAPITAL_FACTS_UNAVAILABLE", account_id: accountId, detail: "no usado por estos tests" });
  }
}
