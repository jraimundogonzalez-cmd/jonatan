// API de Operations para la interfaz — mismo patrón que `lib/api/funding.ts`:
// una función por RPC, nunca SQL directo desde un componente (mvp-0.1.md §6.3).
//
// FRONTERA IMPORTANTE: aquí viven las **lecturas** y las escrituras
// **capital-neutras** (abrir, registrar parcial, cancelar), que el dominio
// resuelve enteramente en SQL. El **cierre** y la **corrección del desenlace**
// NO están aquí y no deben estarlo nunca: son las dos únicas vías que invocan
// Quant Engine, y pasan obligatoriamente por `OperationsEngineService` desde
// `actions/operaciones.ts`. Si `aplicar_cierre_operacion` o
// `aplicar_edicion_operacion` aparecen alguna vez en este fichero, la frontera
// se ha roto — hay un test que lo comprueba.
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOperationsError, type OperationsError } from "@tradepilot/operations-engine";
import {
  ESCALAS_OPERACION,
  ESCALAS_PARCIAL,
  ESCALAS_PLAN_GESTION,
  normalizarFila,
  normalizarFilas,
} from "./decimales";
import type {
  AuditEntryRow,
  OperacionRow,
  OperationsResult,
  ParcialEjecutadoRow,
  ParcialPlanificadoRow,
  PlanGestionRow,
} from "@/types/operations";

function ok<T>(value: T): OperationsResult<T> {
  return { ok: true, value };
}

function err(error: OperationsError): OperationsResult<never> {
  return { ok: false, error };
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export async function listarOperaciones(
  client: SupabaseClient,
  accountId: string,
): Promise<OperationsResult<OperacionRow[]>> {
  const { data, error } = await client.rpc("listar_operaciones", { p_account_id: accountId });
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFilas((data ?? []) as OperacionRow[], ESCALAS_OPERACION));
}

export async function obtenerOperacion(
  client: SupabaseClient,
  id: string,
): Promise<OperationsResult<OperacionRow>> {
  const { data, error } = await client.rpc("obtener_operacion", { p_id: id });
  if (error) return err(parseOperationsError(error.message));
  if (!data) return err({ code: "TRADE_NOT_FOUND", trade_id: id });
  return ok(normalizarFila(data as OperacionRow, ESCALAS_OPERACION));
}

export async function listarParcialesEjecutados(
  client: SupabaseClient,
  tradeId: string,
): Promise<OperationsResult<ParcialEjecutadoRow[]>> {
  const { data, error } = await client.rpc("listar_parciales_ejecutados", { p_trade_id: tradeId });
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFilas((data ?? []) as ParcialEjecutadoRow[], ESCALAS_PARCIAL));
}

export async function listarParcialesPlanificados(
  client: SupabaseClient,
  tradeId: string,
): Promise<OperationsResult<ParcialPlanificadoRow[]>> {
  const { data, error } = await client.rpc("listar_parciales_planificados", { p_trade_id: tradeId });
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFilas((data ?? []) as ParcialPlanificadoRow[], ESCALAS_PARCIAL));
}

export async function listarPlanesGestion(
  client: SupabaseClient,
): Promise<OperationsResult<PlanGestionRow[]>> {
  const { data, error } = await client.rpc("listar_planes_gestion");
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFilas((data ?? []) as PlanGestionRow[], ESCALAS_PLAN_GESTION));
}

/**
 * Historial de auditoría de una Operación. `audit_log` lo escribe un trigger
 * `SECURITY DEFINER` (BUILD 004) y es de sólo lectura para `authenticated`: la
 * interfaz lo muestra, nunca lo produce.
 */
export async function listarAuditoriaOperacion(
  client: SupabaseClient,
  tradeId: string,
): Promise<OperationsResult<AuditEntryRow[]>> {
  const { data, error } = await client.rpc("listar_auditoria_operacion", { p_trade_id: tradeId });
  if (error) return err(parseOperationsError(error.message));
  return ok((data ?? []) as AuditEntryRow[]);
}

// ── Escrituras capital-neutras (resueltas enteramente en SQL) ───────────────

export interface RegistrarOperacionInput {
  readonly account_id: string;
  readonly symbol: string;
  readonly side: "long" | "short";
  readonly opened_at: string;
  readonly risk_pct: string;
  readonly management_plan_id?: string | null;
  readonly rr_objective?: string | null;
  readonly be_trigger?: string | null;
  readonly idempotency_key?: string | null;
}

export async function registrarOperacion(
  client: SupabaseClient,
  input: RegistrarOperacionInput,
): Promise<OperationsResult<OperacionRow>> {
  const { data, error } = await client.rpc("registrar_operacion", {
    p_account_id: input.account_id,
    p_symbol: input.symbol,
    p_side: input.side,
    p_opened_at: input.opened_at,
    p_risk_pct: input.risk_pct,
    p_idempotency_key: input.idempotency_key ?? null,
    p_management_plan_id: input.management_plan_id ?? null,
    p_rr_objective: input.rr_objective ?? null,
    p_be_trigger: input.be_trigger ?? "NONE",
  });
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFila(data as OperacionRow, ESCALAS_OPERACION));
}

export async function registrarParcialEjecutado(
  client: SupabaseClient,
  tradeId: string,
  sequence: number,
  rrLevel: string,
  pctClose: string,
  executedAt: string,
): Promise<OperationsResult<ParcialEjecutadoRow>> {
  const { data, error } = await client.rpc("registrar_parcial_ejecutado", {
    p_trade_id: tradeId,
    p_sequence: sequence,
    p_rr_level: rrLevel,
    p_pct_close: pctClose,
    p_executed_at: executedAt,
  });
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFila(data as ParcialEjecutadoRow, ESCALAS_PARCIAL));
}

export async function cancelarOperacion(
  client: SupabaseClient,
  tradeId: string,
  motivo: string,
): Promise<OperationsResult<OperacionRow>> {
  const { data, error } = await client.rpc("cancelar_operacion", {
    p_trade_id: tradeId,
    p_motivo: motivo,
  });
  if (error) return err(parseOperationsError(error.message));
  return ok(normalizarFila(data as OperacionRow, ESCALAS_OPERACION));
}
