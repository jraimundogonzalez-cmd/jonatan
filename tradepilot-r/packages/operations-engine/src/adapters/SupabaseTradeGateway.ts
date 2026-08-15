/**
 * Adaptador Supabase de `TradeGateway` — habla exclusivamente en términos de
 * las RPC de `supabase/functions/sql/operations.sql`. Nunca ejecuta SQL
 * directo desde aquí (mismo principio que los adaptadores de Risk Engine y
 * `apps/web/lib/api/funding.ts`, mvp-0.1.md §6.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { err, money, ok, percent, rvalue, toDisplayString, type Result, type RValue } from "@tradepilot/risk-engine";
import {
  KNOWN_OPERATIONS_ERROR_CODES,
  type ClosureReason,
  type OperationsError,
  type Trade,
  type TradePartialExecuted,
  type TradeSide,
  type TradeStatus,
} from "../domain/types.js";
import type { AplicarCierreParams, AplicarEdicionParams, TradeGateway } from "../ports/TradeGateway.js";

interface TradeRow {
  readonly id: string;
  readonly account_id: string;
  readonly management_plan_id: string;
  readonly status: TradeStatus;
  readonly risk_amount: string | number;
  readonly rr_objective: string | number;
  readonly be_trigger: string;
  readonly r_max: string | number | null;
  readonly r_final: string | number | null;
  readonly pnl_amount: string | number | null;
  readonly closure_reason: ClosureReason | null;
  readonly cierre_manual_rr: string | number | null;
  readonly symbol: string;
  readonly side: TradeSide;
  readonly opened_at: string;
  readonly risk_pct: string | number;
  readonly instrument_key: string | null;
  readonly closed_at: string | null;
  readonly time_in_market_sec: number | null;
  readonly closure_idempotency_key: string | null;
  readonly cancellation_reason: string | null;
  readonly notes: string | null;
  readonly comments: string | null;
}

interface TradePartialExecutedRow {
  readonly sequence: 1 | 2 | 3 | 4 | 5;
  readonly rr_level: string | number;
  readonly pct_close: string | number;
  readonly executed_at: string;
}

/**
 * BUILD 020 — PostgREST serializa `numeric` como número JSON, no como cadena.
 * `money()` y `rvalue()` esperan cadena (I5), así que se normaliza aquí, en la
 * frontera de entrada, antes de que el kernel decimal vea el valor.
 *
 * Encontrado ejecutando la aplicación contra PostgREST real: los dobles de los
 * tests devuelven cadenas —que es lo que el contrato dice— y por eso ninguno lo
 * detectó. El contrato es correcto; lo que faltaba era comprobar qué entrega la
 * plataforma. No recupera precisión ya perdida en `JSON.parse`; sólo devuelve
 * el valor a la forma que el resto del código exige.
 */
function texto(v: string | number): string {
  return typeof v === "number" ? v.toFixed(4) : v;
}

/** Aplica `f` sobre el valor normalizado, o `null` si no hay valor. */
function opcional<T>(v: string | number | null | undefined, f: (s: string) => T): T | null {
  return v === null || v === undefined ? null : f(texto(v));
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    account_id: row.account_id,
    management_plan_id: row.management_plan_id,
    // El check constraint de `trades.be_trigger` ya garantiza uno de los 3
    // valores del enum — frontera de entrada, mismo patrón que `rvalue(...)`.
    be_trigger: row.be_trigger as Trade["be_trigger"],
    status: row.status,
    risk_amount: money(texto(row.risk_amount)),
    rr_objective: rvalue(texto(row.rr_objective)),
    r_max: opcional(row.r_max, rvalue),
    r_final: opcional(row.r_final, rvalue),
    pnl_amount: opcional(row.pnl_amount, money),
    closure_reason: row.closure_reason,
    cierre_manual_rr: opcional(row.cierre_manual_rr, rvalue),
    symbol: row.symbol,
    side: row.side,
    opened_at: row.opened_at,
    risk_pct: texto(row.risk_pct),
    instrument_key: row.instrument_key ?? null,
    closed_at: row.closed_at ?? null,
    time_in_market_sec: row.time_in_market_sec ?? null,
    closure_idempotency_key: row.closure_idempotency_key ?? null,
    cancellation_reason: row.cancellation_reason ?? null,
    notes: row.notes ?? null,
    comments: row.comments ?? null,
  };
}

const TRADE_STATUSES: ReadonlySet<string> = new Set(["open", "closed", "cancelled"]);

function toStatus(raw: string | undefined): TradeStatus {
  return raw !== undefined && TRADE_STATUSES.has(raw) ? (raw as TradeStatus) : "open";
}

/**
 * BUILD 019 — traducción de los errores de dominio de Operations, en el mismo
 * sitio donde `apps/web/lib/api/funding.ts` hace la suya: junto a la llamada
 * `.rpc()` que los produce, nunca en la UI.
 *
 * Hasta 019 las cinco llamadas de este adaptador devolvían `GATEWAY_ERROR` con
 * el mensaje crudo, y la aplicación sólo podía distinguir un `EVIDENCE_CHANGED`
 * de un `INCOHERENT_PNL` con `string.includes()` sobre texto de PostgreSQL. El
 * formato `OPERATIONS_ERROR:<CODE>:<detalle>` existe desde BUILD 004
 * precisamente para no tener que hacer eso.
 *
 * Regla de degradación (Trust Layer, SPEC-014): un error nunca se descarta ni
 * se aplana. Si el código es desconocido pero está bien formado se propaga como
 * `DOMAIN_ERROR` con su código intacto; si el mensaje entero es irreconocible,
 * `GATEWAY_ERROR` conserva el texto original.
 */
export function parseOperationsError(message: string): OperationsError {
  // RLS y privilegios no siguen el formato de dominio: los emite PostgreSQL.
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return { code: "UNAUTHORIZED" };
  }

  const match = /^OPERATIONS_ERROR:([A-Z_]+):(.*)$/s.exec(message);
  if (!match) return { code: "GATEWAY_ERROR", detail: message };

  const code = match[1] ?? "";
  const detail = match[2] ?? "";
  if (!KNOWN_OPERATIONS_ERROR_CODES.has(code)) {
    return { code: "DOMAIN_ERROR", domain_code: code, detail };
  }

  switch (code) {
    case "TRADE_NOT_FOUND":
      return { code: "TRADE_NOT_FOUND", trade_id: /([0-9a-f-]{36})/i.exec(detail)?.[1] ?? "" };

    case "INVALID_STATE_TRANSITION": {
      // "<from>:<to>:<explicación>"
      const [from, to] = detail.split(":");
      return { code: "INVALID_STATE_TRANSITION", from: toStatus(from), to: toStatus(to) };
    }

    case "EVIDENCE_CHANGED": {
      const nums = /\(esperados (\d+), actuales (\d+)\)/.exec(detail);
      return {
        code: "EVIDENCE_CHANGED",
        esperados: nums ? Number(nums[1]) : -1,
        actuales: nums ? Number(nums[2]) : -1,
      };
    }

    case "DUPLICATE_PARTIAL_SEQUENCE": {
      const seq = /sequence (\d+)/.exec(detail);
      return { code: "DUPLICATE_PARTIAL_SEQUENCE", sequence: seq ? Number(seq[1]) : null };
    }

    // El campo concreto es el primer segmento del detalle — es la razón por la
    // que BUILD 018 lo puso ahí en vez de dejar un mensaje genérico.
    case "IMMUTABLE_IDENTITY_FACT":
      return { code: "IMMUTABLE_IDENTITY_FACT", campo: detail.split(":")[0] ?? "" };

    case "IMMUTABLE_EVIDENCE":
      return { code: "IMMUTABLE_EVIDENCE", tabla: detail.split(":")[0] ?? "" };

    case "VALIDATION_ERROR": {
      const [campo, ...rest] = detail.split(":");
      return { code: "VALIDATION_ERROR", campo: campo ?? "unknown", detail: rest.join(":") || detail };
    }

    case "INCOHERENT_PNL":
    case "OUTCOME_OUT_OF_RANGE":
    case "OUTCOME_EXCEEDS_R_MAX":
    case "INCOHERENT_CLOSURE_REASON":
    case "INCOMPLETE_OUTCOME":
    case "INCONSISTENT_TRIGGER_STATE":
    case "INVALID_PARTIAL_SEQUENCE":
    case "PARTIALS_EXCEED_100_PCT":
    case "IMMUTABLE_INHERITED_FACT":
    case "IMMUTABLE_CLOSURE_KEY":
    case "IMMUTABLE_ACCOUNT_ID":
    case "TRADE_NOT_DELETABLE":
    case "ACCOUNT_NOT_FOUND":
    case "PLAN_NOT_FOUND":
    case "PLAN_ARCHIVED":
    case "CONFIRMATION_REQUIRED":
    case "CANCELLATION_REQUIRES_REASON":
      return { code, detail } as OperationsError;

    default:
      return { code: "DOMAIN_ERROR", domain_code: code, detail };
  }
}

export class SupabaseTradeGateway implements TradeGateway {
  constructor(private readonly client: SupabaseClient) {}

  async obtenerOperacion(tradeId: string): Promise<Result<Trade, OperationsError>> {
    const { data, error } = await this.client.rpc("obtener_operacion", { p_id: tradeId });
    if (error) return err(parseOperationsError(error.message));
    if (!data) return err({ code: "TRADE_NOT_FOUND", trade_id: tradeId });
    return ok(rowToTrade(data as TradeRow));
  }

  async listarParcialesEjecutados(tradeId: string): Promise<Result<readonly TradePartialExecuted[], OperationsError>> {
    const { data, error } = await this.client.rpc("listar_parciales_ejecutados", { p_trade_id: tradeId });
    if (error) return err(parseOperationsError(error.message));
    const rows = (data ?? []) as TradePartialExecutedRow[];
    return ok(
      rows.map((row) => ({
        sequence: row.sequence,
        rr_level: rvalue(texto(row.rr_level)),
        pct_close: percent(texto(row.pct_close)),
        executed_at: row.executed_at,
      })),
    );
  }

  async listarRFinalVigentePorCuenta(accountId: string): Promise<Result<readonly RValue[], OperationsError>> {
    const { data, error } = await this.client.rpc("listar_r_final_vigente_por_cuenta", { p_account_id: accountId });
    if (error) return err(parseOperationsError(error.message));
    const rows = (data ?? []) as ReadonlyArray<{ r_final: string | number }>;
    return ok(rows.map((row) => rvalue(texto(row.r_final))));
  }

  async listarOperacionesPorCuenta(accountId: string): Promise<Result<readonly Trade[], OperationsError>> {
    const { data, error } = await this.client.rpc("listar_operaciones", { p_account_id: accountId });
    if (error) return err(parseOperationsError(error.message));
    return ok(((data ?? []) as TradeRow[]).map(rowToTrade));
  }

  async aplicarCierre(params: AplicarCierreParams): Promise<Result<Trade, OperationsError>> {
    const { data, error } = await this.client.rpc("aplicar_cierre_operacion", {
      p_trade_id: params.tradeId,
      p_closed_at: params.closedAt,
      p_closure_reason: params.closureReason,
      p_cierre_manual_rr: params.cierreManualRr ? toDisplayString(params.cierreManualRr) : null,
      p_r_max: toDisplayString(params.rMax),
      p_r_final: toDisplayString(params.rFinal),
      p_pnl_amount: toDisplayString(params.pnlAmount),
      p_expected_partials: params.expectedPartials,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) return err(parseOperationsError(error.message));
    return ok(rowToTrade(data as TradeRow));
  }

  async aplicarEdicion(params: AplicarEdicionParams): Promise<Result<Trade, OperationsError>> {
    const { data, error } = await this.client.rpc("aplicar_edicion_operacion", {
      p_trade_id: params.tradeId,
      // `p_risk_amount` y `p_rr_objective` existen en la firma SQL por
      // compatibilidad histórica, pero son identidad: se envían siempre nulos
      // porque la superficie de aplicación ya no los ofrece (BUILD 016B/018).
      p_risk_amount: null,
      p_rr_objective: null,
      p_r_max: params.rMax ? toDisplayString(params.rMax) : null,
      p_closure_reason: params.closureReason ?? null,
      p_cierre_manual_rr: params.cierreManualRr ? toDisplayString(params.cierreManualRr) : null,
      p_r_final: params.rFinal ? toDisplayString(params.rFinal) : null,
      p_pnl_amount: params.pnlAmount ? toDisplayString(params.pnlAmount) : null,
      p_notes: params.notes ?? null,
      p_comments: params.comments ?? null,
      // BUILD 019 — `false` explícito, no `undefined`: el valor por defecto de
      // la RPC ya es `false`, pero enviarlo siempre deja el contrato visible en
      // el payload y hace que un futuro cambio de defecto no altere el sentido.
      p_borrar_cierre_manual_rr: params.borrarCierreManualRr ?? false,
    });
    if (error) return err(parseOperationsError(error.message));
    return ok(rowToTrade(data as TradeRow));
  }
}
