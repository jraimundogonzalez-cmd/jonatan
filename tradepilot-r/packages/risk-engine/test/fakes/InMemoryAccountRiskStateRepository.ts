import { EMPTY_WELFORD_ACCUMULATOR, err, ok, type Result, type WelfordAccumulator } from "@tradepilot/quant-engine";
import type { AccountRiskState, RiskEngineError } from "../../src/domain/types.js";
import type { AccountRiskStateRepository, ApplyAccumulatorOutcome } from "../../src/ports/AccountRiskStateRepository.js";

/**
 * Doble en memoria de `AccountRiskStateRepository` — replica exactamente la
 * semántica atómica de `risk_engine_apply_accumulator_update` (idempotencia
 * + concurrencia optimista resueltas en una sola operación, nunca dos pasos
 * separados), para poder probar `RiskEngineService` sin red ni base de
 * datos (Dependency Inversion, 26 §8).
 */
export class InMemoryAccountRiskStateRepository implements AccountRiskStateRepository {
  private readonly states = new Map<string, AccountRiskState>();
  private readonly processedEvents = new Set<string>();
  readonly outbox: AccountRiskState[] = [];

  seed(accountId: string, overrides: Partial<Pick<AccountRiskState, "accumulator" | "version">> = {}): void {
    this.states.set(accountId, {
      account_id: accountId,
      accumulator: overrides.accumulator ?? EMPTY_WELFORD_ACCUMULATOR,
      version: overrides.version ?? 0,
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
    readonly nuevoAcumulador: WelfordAccumulator;
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
    this.outbox.push(next);
    return ok({ kind: "applied", state: next });
  }

  async yaProcesado(eventId: string): Promise<Result<boolean, RiskEngineError>> {
    return ok(this.processedEvents.has(eventId));
  }
}
