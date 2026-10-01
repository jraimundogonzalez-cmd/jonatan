import type { BETrigger, Money, Percent, RValue, RiskEngineError } from "@tradepilot/risk-engine";

export type TradeStatus = "open" | "closed" | "cancelled";

/**
 * Las cuatro ramas ya formalizadas de `R_cierre_resto` (02 §2), expuestas
 * como campo obligatorio del cierre (SPEC-002 §5.3) — no es un input nuevo
 * de Quant Engine, es el selector que `calcularRFinal` ya infería
 * implícitamente de `r_max`/`parciales_ejecutados`/`cierre_manual_rr`.
 */
export type ClosureReason = "STOP_LOSS" | "BREAK_EVEN" | "TAKE_PROFIT_FULL" | "MANUAL_CLOSE";

/**
 * BUILD 019 — se añaden los campos que `obtener_operacion` **ya devolvía** y
 * este tipo descartaba. La RPC retorna `public.trades` entera; hasta ahora
 * 016B/017/018 no necesitaban más que el subconjunto de cálculo, pero la UI sí
 * necesita presentar la Operación completa.
 *
 * Todos los añadidos son de **sólo lectura**: aparecen aquí y en ningún
 * `*Params` de escritura. Un campo que no existe en un tipo de escritura no
 * puede escribirse por descuido — la misma disciplina por la que `r_final` y
 * `pnl_amount` no están en `CerrarOperacionInput`.
 */
export interface Trade {
  readonly id: string;
  readonly account_id: string;
  readonly management_plan_id: string;
  readonly status: TradeStatus;
  readonly risk_amount: Money;
  readonly rr_objective: RValue;
  readonly be_trigger: BETrigger;
  readonly r_max: RValue | null;
  readonly r_final: RValue | null;
  readonly pnl_amount: Money | null;
  readonly closure_reason: ClosureReason | null;
  readonly cierre_manual_rr: RValue | null;
  // ── identidad (inmutable desde 016B) ──
  readonly symbol: string;
  readonly side: TradeSide;
  readonly opened_at: string;
  readonly risk_pct: string;
  /** Heredado de la Intención que la originó (017). Nulo en Operaciones libres. */
  readonly instrument_key: string | null;
  // ── desenlace ──
  readonly closed_at: string | null;
  /** Derivado por trigger (018). Nunca un input. */
  readonly time_in_market_sec: number | null;
  /** Se escribe una vez al cerrar y es inmutable (018). */
  readonly closure_idempotency_key: string | null;
  readonly cancellation_reason: string | null;
  // ── anotación ──
  readonly notes: string | null;
  readonly comments: string | null;
}

export type TradeSide = "long" | "short";

export interface TradePartialExecuted {
  readonly sequence: 1 | 2 | 3 | 4 | 5;
  readonly rr_level: RValue;
  readonly pct_close: Percent;
  readonly executed_at: string;
}

/**
 * Catálogo de errores tipados de Operations Engine (SPEC-002 §7,
 * `OperationsError`) — `RISK_ENGINE_ERROR` nunca oculta el error original,
 * lo envuelve tal cual (Trust Layer, SPEC-014), igual que Risk Engine hace
 * con los de Quant Engine.
 */
export type OperationsError =
  // ── las cuatro originales, intactas en forma y semántica ──
  | { readonly code: "TRADE_NOT_FOUND"; readonly trade_id: string }
  | { readonly code: "INVALID_STATE_TRANSITION"; readonly from: TradeStatus; readonly to: TradeStatus }
  | { readonly code: "RISK_ENGINE_ERROR"; readonly error: RiskEngineError }
  /** Último recurso: el mensaje no pudo reconocerse. Se conserva íntegro. */
  | { readonly code: "GATEWAY_ERROR"; readonly detail: string }
  // ── BUILD 019: ampliación estrictamente aditiva ──
  //
  // Hasta 019 el adaptador Supabase aplastaba los 22 códigos tipados de
  // `OPERATIONS_ERROR` en `GATEWAY_ERROR` con el mensaje crudo. El más grave
  // era `EVIDENCE_CHANGED`: BUILD 018 lo construyó precisamente para que el
  // orquestador recalculase, y llegaba a la aplicación como una cadena opaca
  // que sólo podía reconocerse con `string.includes()`. `funding.ts` ya
  // traducía sus errores desde BUILD 002; Operations no.
  | { readonly code: "UNAUTHORIZED" }
  | { readonly code: "EVIDENCE_CHANGED"; readonly esperados: number; readonly actuales: number }
  | { readonly code: "INCOHERENT_PNL"; readonly detail: string }
  | { readonly code: "OUTCOME_OUT_OF_RANGE"; readonly detail: string }
  | { readonly code: "OUTCOME_EXCEEDS_R_MAX"; readonly detail: string }
  | { readonly code: "INCOHERENT_CLOSURE_REASON"; readonly detail: string }
  | { readonly code: "INCOMPLETE_OUTCOME"; readonly detail: string }
  | { readonly code: "INCONSISTENT_TRIGGER_STATE"; readonly detail: string }
  | { readonly code: "INVALID_PARTIAL_SEQUENCE"; readonly detail: string }
  | { readonly code: "PARTIALS_EXCEED_100_PCT"; readonly detail: string }
  | { readonly code: "DUPLICATE_PARTIAL_SEQUENCE"; readonly sequence: number | null }
  /** El campo viene nombrado por la RPC — `IMMUTABLE_IDENTITY_FACT:<campo>:...` */
  | { readonly code: "IMMUTABLE_IDENTITY_FACT"; readonly campo: string }
  | { readonly code: "IMMUTABLE_INHERITED_FACT"; readonly detail: string }
  | { readonly code: "IMMUTABLE_CLOSURE_KEY"; readonly detail: string }
  | { readonly code: "IMMUTABLE_EVIDENCE"; readonly tabla: string }
  | { readonly code: "TRADE_NOT_DELETABLE"; readonly detail: string }
  | { readonly code: "IMMUTABLE_ACCOUNT_ID"; readonly detail: string }
  | { readonly code: "ACCOUNT_NOT_FOUND"; readonly detail: string }
  | { readonly code: "PLAN_NOT_FOUND"; readonly detail: string }
  | { readonly code: "PLAN_ARCHIVED"; readonly detail: string }
  | { readonly code: "CONFIRMATION_REQUIRED"; readonly detail: string }
  | { readonly code: "CANCELLATION_REQUIRES_REASON"; readonly detail: string }
  | { readonly code: "VALIDATION_ERROR"; readonly campo: string; readonly detail: string }
  /**
   * Código bien formado (`OPERATIONS_ERROR:<CODE>:<detalle>`) pero que este
   * catálogo todavía no conoce. No es un fallo: es la degradación explícita
   * que exige el Trust Layer (SPEC-014). El código real viaja entero, así que
   * la UI puede registrarlo aunque no sepa reaccionar a él.
   */
  | { readonly code: "DOMAIN_ERROR"; readonly domain_code: string; readonly detail: string };

/** Los códigos que `parseOperationsError` reconoce por nombre. */
export const KNOWN_OPERATIONS_ERROR_CODES: ReadonlySet<string> = new Set([
  "TRADE_NOT_FOUND",
  "INVALID_STATE_TRANSITION",
  "EVIDENCE_CHANGED",
  "INCOHERENT_PNL",
  "OUTCOME_OUT_OF_RANGE",
  "OUTCOME_EXCEEDS_R_MAX",
  "INCOHERENT_CLOSURE_REASON",
  "INCOMPLETE_OUTCOME",
  "INCONSISTENT_TRIGGER_STATE",
  "INVALID_PARTIAL_SEQUENCE",
  "PARTIALS_EXCEED_100_PCT",
  "DUPLICATE_PARTIAL_SEQUENCE",
  "IMMUTABLE_IDENTITY_FACT",
  "IMMUTABLE_INHERITED_FACT",
  "IMMUTABLE_CLOSURE_KEY",
  "IMMUTABLE_EVIDENCE",
  "IMMUTABLE_ACCOUNT_ID",
  "TRADE_NOT_DELETABLE",
  "ACCOUNT_NOT_FOUND",
  "PLAN_NOT_FOUND",
  "PLAN_ARCHIVED",
  "CONFIRMATION_REQUIRED",
  "CANCELLATION_REQUIRES_REASON",
  "VALIDATION_ERROR",
]);
