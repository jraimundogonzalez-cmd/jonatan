/**
 * Adaptador Supabase de `AccountRiskStateRepository` (26 §8, 22.5 §2.3) —
 * habla exclusivamente en términos de las RPC atómicas de la migración
 * `20260803120400_risk_engine.sql`. Nunca ejecuta SQL directo desde aquí
 * (mismo principio que `apps/web/lib/api/funding.ts`, mvp-0.1.md §6.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { err, ok, rvalue, toDisplayString, type Result, type WelfordAccumulator } from "@tradepilot/quant-engine";
import type { AccountRiskState, RiskEngineError } from "../domain/types.js";
import type { AccountRiskStateRepository, ApplyAccumulatorOutcome } from "../ports/AccountRiskStateRepository.js";

/**
 * BUILD 020 — PostgREST serializa `numeric` como número JSON, no como cadena,
 * y `rvalue()` exige cadena (I5). Sin esta normalización, cerrar una Operación
 * desde la aplicación reventaba con `value.trim is not a function` en cuanto
 * Risk Engine leía el acumulador.
 *
 * Encontrado ejecutando el producto contra PostgREST real: los tests de este
 * paquete usan repositorios en memoria que devuelven cadenas —lo que el
 * contrato dice— y por eso nunca lo vieron. Es normalización de frontera de
 * entrada, no un cambio del acumulador ni de su matemática.
 */
function texto(v: string | number): string {
  return typeof v === "number" ? v.toFixed(4) : v;
}

interface AccountRiskStateRow {
  readonly account_id: string;
  readonly n: number;
  readonly mean: string | number;
  readonly m2: string | number;
  readonly version: number;
  readonly updated_at: string;
}

interface ApplyAccumulatorUpdateRow {
  readonly applied: boolean;
  readonly current_version: number;
  readonly current_n: number;
  readonly current_mean: string | number;
  readonly current_m2: string | number;
}

function rowToState(accountId: string, row: AccountRiskStateRow): AccountRiskState {
  return {
    account_id: accountId,
    accumulator: { n: row.n, mean: rvalue(texto(row.mean)), m2: rvalue(texto(row.m2)) },
    version: row.version,
    updated_at: row.updated_at,
  };
}

/**
 * `applied_at`/`updated_at` no viaja en la fila que devuelve la RPC atómica
 * (solo n/mean/m2/version) — se rellena con el instante en que el cliente
 * observa la respuesta. Es un campo informativo, ninguna decisión de
 * concurrencia ni de negocio depende de su precisión.
 */
function applyRowToState(accountId: string, row: ApplyAccumulatorUpdateRow): AccountRiskState {
  return {
    account_id: accountId,
    accumulator: { n: row.current_n, mean: rvalue(texto(row.current_mean)), m2: rvalue(texto(row.current_m2)) },
    version: row.current_version,
    updated_at: new Date().toISOString(),
  };
}

function repositoryError(detail: string): RiskEngineError {
  return { code: "REPOSITORY_ERROR", detail };
}

export class SupabaseAccountRiskStateRepository implements AccountRiskStateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async obtener(accountId: string): Promise<Result<AccountRiskState, RiskEngineError>> {
    const { data, error } = await this.client.rpc("risk_engine_obtener_estado", { p_account_id: accountId });
    if (error) return err(repositoryError(error.message));
    if (!data) return err({ code: "ACCOUNT_NOT_FOUND", account_id: accountId });
    return ok(rowToState(accountId, data as AccountRiskStateRow));
  }

  async aplicarActualizacion(params: {
    readonly accountId: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly expectedVersion: number;
    readonly nuevoAcumulador: WelfordAccumulator;
  }): Promise<Result<ApplyAccumulatorOutcome, RiskEngineError>> {
    const { data, error } = await this.client.rpc("risk_engine_apply_accumulator_update", {
      p_account_id: params.accountId,
      p_event_id: params.eventId,
      p_event_type: params.eventType,
      p_expected_version: params.expectedVersion,
      p_new_n: params.nuevoAcumulador.n,
      p_new_mean: toDisplayString(params.nuevoAcumulador.mean),
      p_new_m2: toDisplayString(params.nuevoAcumulador.m2),
    });
    if (error) return err(repositoryError(error.message));

    // `returns table(...)` llega como array vía PostgREST. Un array vacío
    // solo ocurre cuando ni el UPDATE ni el re-SELECT de reserva encontraron
    // ninguna fila — la Cuenta no existe para este usuario (o RLS la oculta,
    // que desde este lado es indistinguible y debe tratarse igual: BUILD 003
    // Challenge Mode, comprobación [9] de supabase/tests/02_risk_engine.sql).
    const rows = data as ApplyAccumulatorUpdateRow[] | null;
    const row = rows?.[0];
    if (!row) return err({ code: "ACCOUNT_NOT_FOUND", account_id: params.accountId });

    if (row.applied) {
      return ok({ kind: "applied", state: applyRowToState(params.accountId, row) });
    }

    // La RPC devuelve `applied=false` tanto para un event_id ya procesado
    // como para un conflicto real de versión, sin distinguirlos en la fila
    // (ver comentario en la migración) — se desambigua con una segunda
    // lectura del ledger de idempotencia, nunca adivinando.
    const current = applyRowToState(params.accountId, row);
    const yaProcesadoResult = await this.yaProcesado(params.eventId);
    if (!yaProcesadoResult.ok) return yaProcesadoResult;

    return ok(
      yaProcesadoResult.value
        ? { kind: "already_processed", current }
        : { kind: "version_conflict", current },
    );
  }

  async yaProcesado(eventId: string): Promise<Result<boolean, RiskEngineError>> {
    const { data, error } = await this.client.rpc("risk_engine_ya_procesado", { p_event_id: eventId });
    if (error) return err(repositoryError(error.message));
    return ok(Boolean(data));
  }
}
