/**
 * Puertos (Dependency Inversion, mismo patrón que Risk Engine y Operations
 * Engine). El servicio depende solo de estas abstracciones, nunca de Supabase
 * ni de Risk Engine directamente — es lo que permite probar todo el pipeline
 * con dobles en memoria y lo que mantiene la frontera con Quant Engine
 * verificable.
 */
import type { Result } from "@tradepilot/risk-engine";
import type {
  AccountFacts,
  DomainEventRef,
  OperationFacts,
  RiskMagnitudes,
  RuleEngineError,
  RuleEvaluation,
  RuleProfileSnapshot,
} from "../domain/types.js";

export interface SnapshotRepository {
  /** Snapshot de reglas vigente de la Cuenta. `null` = la Cuenta no adoptó ninguno. */
  obtenerVigente(accountId: string): Promise<Result<RuleProfileSnapshot | null, RuleEngineError>>;
}

/** Hechos de Funding Management. Rule Engine los lee, nunca los escribe. */
export interface AccountFactsProvider {
  obtenerHechos(accountId: string): Promise<Result<AccountFacts, RuleEngineError>>;
}

/**
 * Magnitudes de **Risk Engine**, nunca de Quant Engine directamente
 * (SPEC-004 §14.1). El adaptador de este puerto es el único punto que
 * conoce `RiskEngineService`; Rule Engine no importa `quant-engine` en
 * ningún archivo.
 *
 * Devuelve `null` cuando la magnitud no puede obtenerse: el pipeline lo
 * traduce a `unavailable`, jamás a un veredicto por defecto (SPEC-004 §7).
 */
export interface RiskMagnitudesProvider {
  obtenerDrawdownState(
    accountId: string,
    parametros: Readonly<Record<string, unknown>>,
  ): Promise<Result<RiskMagnitudes | null, RuleEngineError>>;
}

export interface OperationFactsProvider {
  obtenerHechosOperacion(tradeId: string): Promise<Result<OperationFacts | null, RuleEngineError>>;
}

export interface EvaluationRepository {
  /**
   * Persiste la pasada completa de forma atómica y emite `ReglaIncumplida`
   * por cada veredicto `violated` en modo `enforced`. Idempotente por
   * `event_id`: reprocesar el mismo evento nunca duplica evaluaciones.
   *
   * **Nunca escribe en `accounts`** — Resolución 1: el caché
   * `compliance_flag` lo actualiza su módulo propietario reaccionando al
   * evento emitido.
   */
  persistir(params: {
    readonly accountId: string;
    readonly evento: DomainEventRef;
    readonly snapshotId: string;
    readonly evaluaciones: readonly RuleEvaluation[];
  }): Promise<Result<{ readonly persisted: boolean; readonly insertadas: number }, RuleEngineError>>;
}
