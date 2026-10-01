import { money, ok, percent, rvalue } from "@tradepilot/risk-engine";
import type { Result } from "@tradepilot/risk-engine";
import type {
  AccountFacts,
  DomainEventRef,
  OperationFacts,
  RiskMagnitudes,
  RuleEngineError,
  RuleEvaluation,
  RuleProfileSnapshot,
} from "../../src/domain/types.js";
import type {
  AccountFactsProvider,
  EvaluationRepository,
  OperationFactsProvider,
  RiskMagnitudesProvider,
  SnapshotRepository,
} from "../../src/ports/index.js";

export class FakeSnapshotRepository implements SnapshotRepository {
  constructor(private snapshot: RuleProfileSnapshot | null) {}
  async obtenerVigente(): Promise<Result<RuleProfileSnapshot | null, RuleEngineError>> {
    return ok(this.snapshot);
  }
}

export class FakeAccountFactsProvider implements AccountFactsProvider {
  constructor(private readonly facts: AccountFacts) {}
  async obtenerHechos(): Promise<Result<AccountFacts, RuleEngineError>> {
    return ok(this.facts);
  }
}

export class FakeRiskMagnitudesProvider implements RiskMagnitudesProvider {
  public llamadas = 0;
  constructor(private readonly mags: RiskMagnitudes | null) {}
  async obtenerDrawdownState(): Promise<Result<RiskMagnitudes | null, RuleEngineError>> {
    this.llamadas += 1;
    return ok(this.mags);
  }
}

export class FakeOperationFactsProvider implements OperationFactsProvider {
  constructor(private readonly facts: OperationFacts | null) {}
  async obtenerHechosOperacion(): Promise<Result<OperationFacts | null, RuleEngineError>> {
    return ok(this.facts);
  }
}

/**
 * Replica la semántica idempotente de `rule_engine_persistir_evaluacion`:
 * un `event_id` ya procesado no vuelve a insertar nada.
 */
export class FakeEvaluationRepository implements EvaluationRepository {
  readonly persistidas: RuleEvaluation[] = [];
  readonly eventosEmitidos: string[] = [];
  private readonly procesados = new Set<string>();

  async persistir(params: {
    readonly accountId: string;
    readonly evento: DomainEventRef;
    readonly snapshotId: string;
    readonly evaluaciones: readonly RuleEvaluation[];
  }): Promise<Result<{ persisted: boolean; insertadas: number }, RuleEngineError>> {
    const clave = `${params.evento.event_id}:${params.accountId}`;
    if (this.procesados.has(clave)) return ok({ persisted: false, insertadas: 0 });

    this.procesados.add(clave);
    for (const e of params.evaluaciones) {
      this.persistidas.push(e);
      if (e.verdict === "violated" && e.mode === "enforced") {
        this.eventosEmitidos.push(e.rule_definition_key);
      }
    }
    return ok({ persisted: true, insertadas: params.evaluaciones.length });
  }
}

export const HECHOS_CUENTA: AccountFacts = {
  current_capital: money("9500.0000"),
  peak_capital: money("10200.0000"),
  initial_capital: money("10000.0000"),
  status: "funded",
};

export const MAGNITUDES: RiskMagnitudes = {
  piso_vigente: money("9000.0000"),
  drawdown_restante_eur: money("500.0000"),
  drawdown_restante_pct: percent("5.26"),
};

export const HECHOS_OPERACION: OperationFacts = {
  trade_id: "trade-1",
  symbol: "EURUSD",
  side: "long",
  opened_at: "2026-01-05T14:00:00.000Z", // lunes, 14h UTC
  risk_pct: percent("1.00"),
};

export function evento(overrides: Partial<DomainEventRef> = {}): DomainEventRef {
  return {
    event_id: "evt-1",
    event_sequence: 10,
    event_type: "OperacionCerrada",
    account_id: "acc-1",
    occurred_at: "2026-01-05T14:00:00.000Z",
    ...overrides,
  };
}

export const R = rvalue;
