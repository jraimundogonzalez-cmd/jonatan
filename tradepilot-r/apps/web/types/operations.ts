// DTO de presentación de Operations — mismo estatus que `types/funding.ts`:
// describe lo que la RPC devuelve para poder pintarlo, no lo que el dominio
// significa. La autoridad sobre el dominio vive en @tradepilot/operations-engine
// y en supabase/functions/sql/operations.sql; aquí no hay ni una regla.
//
// Todos los números viajan como **cadenas** (I5): `numeric(18,4)` y
// `numeric(8,4)` no caben en un `number` de JS sin perder precisión, y esta
// capa nunca los convierte — sólo los formatea para la pantalla.

import type { OperationsError } from "@tradepilot/operations-engine";

export type TradeStatus = "open" | "closed" | "cancelled";
export type TradeSide = "long" | "short";
export type ClosureReason = "STOP_LOSS" | "BREAK_EVEN" | "TAKE_PROFIT_FULL" | "MANUAL_CLOSE";
export type BETriggerValue = "NONE" | "AFTER_NTH_PARTIAL" | "AT_RR_LEVEL";

/** Fila de `public.trades` tal como la devuelven `obtener_operacion`/`listar_operaciones`. */
export interface OperacionRow {
  readonly id: string;
  readonly account_id: string;
  readonly user_id: string;
  readonly management_plan_id: string;
  readonly status: TradeStatus;
  readonly symbol: string;
  readonly side: TradeSide;
  readonly instrument_key: string | null;
  readonly opened_at: string;
  readonly closed_at: string | null;
  readonly risk_pct: string;
  readonly risk_amount: string;
  readonly rr_objective: string;
  readonly be_trigger: BETriggerValue;
  readonly r_max: string | null;
  readonly r_final: string | null;
  readonly pnl_amount: string | null;
  readonly closure_reason: ClosureReason | null;
  readonly cierre_manual_rr: string | null;
  readonly time_in_market_sec: number | null;
  readonly closure_idempotency_key: string | null;
  readonly cancellation_reason: string | null;
  readonly notes: string | null;
  readonly comments: string | null;
  readonly source: string;
  readonly created_at: string;
}

export interface ParcialEjecutadoRow {
  readonly id: string;
  readonly trade_id: string;
  readonly sequence: number;
  readonly rr_level: string;
  readonly pct_close: string;
  readonly executed_at: string;
}

export interface ParcialPlanificadoRow {
  readonly id: string;
  readonly trade_id: string;
  readonly sequence: number;
  readonly rr_level: string;
  readonly pct_close: string;
}

export interface PlanGestionRow {
  readonly id: string;
  readonly name: string | null;
  readonly rr_objective: string;
  readonly be_trigger: BETriggerValue;
  readonly archived_at: string | null;
}

/** Fila de `audit_log` — la evidencia de que una corrección quedó registrada. */
export interface AuditEntryRow {
  readonly id: number;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly action: string;
  readonly diff: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  /**
   * BUILD 022 (BUG-021-1) — la columna de `audit_log` se llama `occurred_at`,
   * no `created_at`. Este tipo declaraba un campo que la fila no traía nunca,
   * así que `new Date(undefined)` pintaba literalmente «Invalid Date» en cada
   * entrada de la auditoría: el único sitio donde la fecha ES el dato.
   */
  readonly occurred_at: string;
}

/** Destino de Intención disponible para materializar (`listar_destinos_disponibles`). */
export interface DestinoDisponibleRow {
  readonly destination_id: string;
  readonly intent_id: string;
  readonly account_id: string;
  readonly side: TradeSide;
  readonly instrument_key: string;
  readonly decided_at: string;
  readonly valid_until: string;
  readonly risk_pct: string | null;
  readonly risk_cap_applied: boolean;
  readonly risk_cap_reason: string | null;
  readonly frozen_plan: Record<string, unknown> | null;
}

export type OperationsResult<T> = { ok: true; value: T } | { ok: false; error: OperationsError };

/**
 * Las tres categorías del §14 del contrato de BUILD 019. Determinan **cómo**
 * reacciona la interfaz, no **qué** significa el error: el significado ya lo
 * fija el código de dominio.
 *
 *  · `usuario` → señalar el campo, no bloquear. Es corregible escribiendo otra cosa.
 *  · `estado`  → recargar y reencuadrar: el mundo cambió bajo los pies.
 *  · `bug`     → mensaje genérico, código real registrado, flujo bloqueado.
 */
export type ErrorCategoria = "usuario" | "estado" | "bug";

const CAMPO_POR_CODIGO: Partial<Record<OperationsError["code"], string>> = {
  OUTCOME_EXCEEDS_R_MAX: "r_max",
  INCONSISTENT_TRIGGER_STATE: "r_max",
  INCOHERENT_CLOSURE_REASON: "closure_reason",
};

const CATEGORIA: Record<string, ErrorCategoria> = {
  OUTCOME_EXCEEDS_R_MAX: "usuario",
  INCONSISTENT_TRIGGER_STATE: "usuario",
  INCOHERENT_CLOSURE_REASON: "usuario",
  VALIDATION_ERROR: "usuario",
  EVIDENCE_CHANGED: "estado",
  INVALID_STATE_TRANSITION: "estado",
  DUPLICATE_PARTIAL_SEQUENCE: "estado",
  TRADE_NOT_FOUND: "estado",
  UNAUTHORIZED: "estado",
  PLAN_ARCHIVED: "estado",
  ACCOUNT_NOT_FOUND: "estado",
  PLAN_NOT_FOUND: "estado",
  CONFIRMATION_REQUIRED: "usuario",
  CANCELLATION_REQUIRES_REASON: "usuario",
};

export function categoriaDeError(error: OperationsError): ErrorCategoria {
  // Todo lo que no esté clasificado explícitamente es un bug: es la opción
  // conservadora. Un `INCOHERENT_PNL` sólo puede aparecer si algo se saltó
  // OperationsEngineService, y un `IMMUTABLE_*` sólo si la interfaz ofreció
  // editar algo que el dominio no permite editar.
  return CATEGORIA[error.code] ?? "bug";
}

/** Campo del formulario al que pertenece el error, si pertenece a alguno. */
export function campoDeError(error: OperationsError): string | null {
  if (error.code === "VALIDATION_ERROR") return error.campo;
  return CAMPO_POR_CODIGO[error.code] ?? null;
}

/**
 * Mensaje humano. Trust Layer (SPEC-014): un error de usuario se explica con
 * precisión; un bug **no** se disfraza de error de usuario, pero tampoco se le
 * suelta al trader un volcado de PostgreSQL. El código real siempre viaja
 * aparte para poder registrarlo.
 */
export function mensajeDeError(error: OperationsError): string {
  switch (error.code) {
    case "EVIDENCE_CHANGED":
      return `La evidencia cambió mientras decidías: había ${error.esperados} parcial(es) y ahora hay ${error.actuales}. El resultado se ha vuelto a calcular.`;
    case "INVALID_STATE_TRANSITION":
      // BUILD 022 — la cancelación reutiliza este código: el trigger rechaza
      // `open → cancelled` cuando ya hay parciales ejecutados. Se distingue
      // por el estado DESTINO, que ya viaja tipado en el error; no se parsea
      // ningún mensaje ni se replica la regla del trigger.
      if (error.to === "cancelled") {
        return "Esta Operación ya tiene parciales ejecutados, así que no puede cancelarse: hubo operativa real. Ciérrala con el desenlace que corresponda.";
      }
      return `Esta Operación ya está en estado «${error.to === "closed" ? "cerrada" : error.to}». Recarga para ver su desenlace actual.`;
    case "OUTCOME_EXCEEDS_R_MAX":
      return `El resultado no puede superar el R máximo que declaras haber alcanzado. ${error.detail}`;
    case "INCONSISTENT_TRIGGER_STATE":
      return `El R máximo que has indicado es menor que un parcial ya ejecutado. ${error.detail}`;
    case "INCOHERENT_CLOSURE_REASON":
      return `Ese motivo de cierre no encaja con los datos: ${error.detail}`;
    case "DUPLICATE_PARTIAL_SEQUENCE":
      return `Ya existe un parcial con esa secuencia${error.sequence !== null ? ` (${error.sequence})` : ""}. Recarga la Operación.`;
    case "VALIDATION_ERROR":
      return error.detail || `Valor no válido en «${error.campo}».`;
    case "TRADE_NOT_FOUND":
      return "Esa Operación no existe o no es tuya.";
    case "UNAUTHORIZED":
      return "No tienes acceso a esa Operación.";
    case "CONFIRMATION_REQUIRED":
      return "Esta acción exige confirmación explícita.";
    case "CANCELLATION_REQUIRES_REASON":
      return "Indica un motivo de cancelación.";
    case "PLAN_ARCHIVED":
      return "Ese Plan de Gestión está archivado.";
    case "PLAN_NOT_FOUND":
      return "Ese Plan de Gestión no existe o no es tuyo.";
    case "ACCOUNT_NOT_FOUND":
      return "Esa Cuenta no existe o no es tuya.";
    case "RISK_ENGINE_ERROR":
      return "El motor de cálculo rechazó los datos del cierre.";
    default:
      return "Se ha producido un error interno y la operación no se ha completado. El detalle técnico queda registrado.";
  }
}

/** El código exacto, para registro y depuración. Nunca se oculta. */
export function codigoDeError(error: OperationsError): string {
  if (error.code === "DOMAIN_ERROR") return `DOMAIN_ERROR:${error.domain_code}`;
  if (error.code === "IMMUTABLE_IDENTITY_FACT") return `IMMUTABLE_IDENTITY_FACT:${error.campo}`;
  return error.code;
}
