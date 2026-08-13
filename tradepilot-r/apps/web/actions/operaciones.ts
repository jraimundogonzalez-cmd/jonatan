"use server";

// Server Actions de Operations.
//
// LA FRONTERA, EN UNA FRASE: abrir, registrar parciales y cancelar van por
// `lib/api/operations.ts` (SQL puro, capital-neutral). **Cerrar, previsualizar
// y corregir van por `OperationsEngineService`**, porque son las únicas tres
// vías que invocan Quant Engine. La interfaz no decide `r_final` ni
// `pnl_amount` en ningún caso: ni siquiera puede, porque los tipos de entrada
// del servicio no los admiten.

import { revalidatePath } from "next/cache";
import { rvalue } from "@tradepilot/risk-engine";
import type { ClosureReason, OperationsError, PrevisualizacionCierre } from "@tradepilot/operations-engine";
import { createClient } from "@/lib/supabase/server";
import { crearOperationsEngine } from "@/lib/operations/engine";
import {
  cancelarOperacion,
  registrarOperacion,
  registrarParcialEjecutado,
  type RegistrarOperacionInput,
} from "@/lib/api/operations";
import type { OperacionRow, OperationsResult, ParcialEjecutadoRow } from "@/types/operations";

/** Invalida las tres rutas que cachean el estado de una Operación y su Cuenta. */
function revalidarOperacion(accountId: string, tradeId?: string): void {
  if (tradeId) revalidatePath(`/operaciones/${tradeId}`);
  revalidatePath(`/cuentas/${accountId}/operaciones`);
  // El Detalle de Cuenta y el Dashboard cachean `current_capital`, que un
  // cierre o una corrección mueven. Revalidar sólo la Operación dejaría el
  // capital desactualizado — mismo criterio que `actions/cuentas.ts`.
  revalidatePath(`/cuentas/${accountId}`);
  revalidatePath("/cuentas");
}

// ── Apertura y gestión (capital-neutral, SQL puro) ──────────────────────────

export async function registrarOperacionAction(
  input: RegistrarOperacionInput,
): Promise<OperationsResult<OperacionRow>> {
  const supabase = await createClient();
  const result = await registrarOperacion(supabase, input);
  if (result.ok) revalidarOperacion(input.account_id, result.value.id);
  return result;
}

export async function registrarParcialAction(
  tradeId: string,
  accountId: string,
  sequence: number,
  rrLevel: string,
  pctClose: string,
  executedAt: string,
): Promise<OperationsResult<ParcialEjecutadoRow>> {
  const supabase = await createClient();
  const result = await registrarParcialEjecutado(supabase, tradeId, sequence, rrLevel, pctClose, executedAt);
  if (result.ok) revalidarOperacion(accountId, tradeId);
  return result;
}

export async function cancelarOperacionAction(
  tradeId: string,
  accountId: string,
  motivo: string,
): Promise<OperationsResult<OperacionRow>> {
  const supabase = await createClient();
  const result = await cancelarOperacion(supabase, tradeId, motivo);
  if (result.ok) revalidarOperacion(accountId, tradeId);
  return result;
}

// ── Previsualización, cierre y corrección (pasan por el motor) ──────────────

export interface CierreFormInput {
  readonly trade_id: string;
  readonly account_id: string;
  readonly closure_reason: ClosureReason;
  readonly r_max: string;
  readonly cierre_manual_rr?: string;
  /** Generada al abrir el formulario, estable durante todos los reintentos. */
  readonly idempotency_key?: string;
  /** Parciales que vio la previsualización que el usuario confirmó. */
  readonly evidencia_previsualizada?: number;
}

function aRValueSeguro(raw: string): { ok: true; value: ReturnType<typeof rvalue> } | { ok: false; error: OperationsError } {
  try {
    // Validación de FORMA, no de dominio: se reutiliza el kernel decimal de
    // Quant Engine en vez de escribir aquí una regex propia — mismo criterio
    // que `lib/validation/capital.ts` desde MVP 0.1.
    return { ok: true, value: rvalue(raw.trim()) };
  } catch {
    return { ok: false, error: { code: "VALIDATION_ERROR", campo: "r_max", detail: "No es un valor de R válido." } };
  }
}

/**
 * Ejecuta el MISMO cálculo de dominio que el cierre, sin escribir nada.
 * No existe una segunda fórmula: hay una segunda invocación de la única que
 * hay. Lo que devuelve es una estimación sobre la evidencia actual, y la
 * interfaz debe presentarlo como tal.
 */
export async function previsualizarCierreAction(
  input: CierreFormInput,
): Promise<OperationsResult<PrevisualizacionCierre>> {
  const rMax = aRValueSeguro(input.r_max);
  if (!rMax.ok) return rMax;

  let cierreManual: ReturnType<typeof rvalue> | undefined;
  if (input.cierre_manual_rr !== undefined && input.cierre_manual_rr.trim() !== "") {
    const parsed = aRValueSeguro(input.cierre_manual_rr);
    if (!parsed.ok) {
      return { ok: false, error: { code: "VALIDATION_ERROR", campo: "cierre_manual_rr", detail: "No es un valor de R válido." } };
    }
    cierreManual = parsed.value;
  }

  const supabase = await createClient();
  const engine = crearOperationsEngine(supabase);
  const result = await engine.previsualizarCierre({
    trade_id: input.trade_id,
    closed_at: new Date().toISOString(),
    closure_reason: input.closure_reason,
    r_max: rMax.value,
    ...(cierreManual ? { cierre_manual_rr: cierreManual } : {}),
  });
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error };
}

/**
 * El cierre definitivo. Vuelve a leer la evidencia y a calcular: el resultado
 * previsualizado NUNCA se persiste. Si la evidencia cambió desde la
 * previsualización que el usuario confirmó, devuelve `EVIDENCE_CHANGED` sin
 * llegar a tocar la RPC.
 */
export async function cerrarOperacionAction(
  input: CierreFormInput,
): Promise<OperationsResult<OperacionRow>> {
  const rMax = aRValueSeguro(input.r_max);
  if (!rMax.ok) return rMax;

  let cierreManual: ReturnType<typeof rvalue> | undefined;
  if (input.cierre_manual_rr !== undefined && input.cierre_manual_rr.trim() !== "") {
    const parsed = aRValueSeguro(input.cierre_manual_rr);
    if (!parsed.ok) {
      return { ok: false, error: { code: "VALIDATION_ERROR", campo: "cierre_manual_rr", detail: "No es un valor de R válido." } };
    }
    cierreManual = parsed.value;
  }

  const supabase = await createClient();
  const engine = crearOperationsEngine(supabase);
  const result = await engine.cerrarOperacion({
    trade_id: input.trade_id,
    closed_at: new Date().toISOString(),
    closure_reason: input.closure_reason,
    r_max: rMax.value,
    ...(cierreManual ? { cierre_manual_rr: cierreManual } : {}),
    ...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
    ...(input.evidencia_previsualizada !== undefined
      ? { evidencia_previsualizada: input.evidencia_previsualizada }
      : {}),
  });

  if (!result.ok) return { ok: false, error: result.error };
  revalidarOperacion(input.account_id, input.trade_id);

  // El acumulador de riesgo es asíncrono por diseño (BUILD 003: idempotente y
  // reintentable). Un fallo suyo no convierte en fallo un cierre que ya movió
  // capital — pero tampoco se descarta en silencio: viaja dentro del resultado.
  const supabaseRead = await createClient();
  const { data } = await supabaseRead.rpc("obtener_operacion", { p_id: input.trade_id });
  return { ok: true, value: data as OperacionRow };
}

export interface CorreccionFormInput {
  readonly trade_id: string;
  readonly account_id: string;
  readonly closure_reason?: ClosureReason;
  readonly r_max?: string;
  readonly cierre_manual_rr?: string;
  /**
   * D1 — acto explícito del usuario, nunca deducido de `closure_reason`.
   * Deducirlo volvería a hacer implícito el borrado y obligaría a esta capa a
   * conocer las cuatro reglas de BUILD 018.
   */
  readonly borrar_cierre_manual_rr?: boolean;
  readonly notes?: string;
  readonly comments?: string;
}

export async function corregirDesenlaceAction(
  input: CorreccionFormInput,
): Promise<OperationsResult<OperacionRow>> {
  let rMaxValue: ReturnType<typeof rvalue> | undefined;
  if (input.r_max !== undefined && input.r_max.trim() !== "") {
    const parsed = aRValueSeguro(input.r_max);
    if (!parsed.ok) return parsed;
    rMaxValue = parsed.value;
  }

  let cierreManual: ReturnType<typeof rvalue> | undefined;
  if (input.cierre_manual_rr !== undefined && input.cierre_manual_rr.trim() !== "") {
    const parsed = aRValueSeguro(input.cierre_manual_rr);
    if (!parsed.ok) {
      return { ok: false, error: { code: "VALIDATION_ERROR", campo: "cierre_manual_rr", detail: "No es un valor de R válido." } };
    }
    cierreManual = parsed.value;
  }

  const supabase = await createClient();
  const engine = crearOperationsEngine(supabase);
  const result = await engine.editarOperacion({
    trade_id: input.trade_id,
    ...(rMaxValue ? { r_max: rMaxValue } : {}),
    ...(input.closure_reason ? { closure_reason: input.closure_reason } : {}),
    ...(cierreManual ? { cierre_manual_rr: cierreManual } : {}),
    ...(input.borrar_cierre_manual_rr ? { borrar_cierre_manual_rr: true } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.comments !== undefined ? { comments: input.comments } : {}),
  });

  if (!result.ok) return { ok: false, error: result.error };
  revalidarOperacion(input.account_id, input.trade_id);

  const supabaseRead = await createClient();
  const { data } = await supabaseRead.rpc("obtener_operacion", { p_id: input.trade_id });
  return { ok: true, value: data as OperacionRow };
}
