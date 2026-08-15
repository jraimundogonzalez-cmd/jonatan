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
import { rvalue, toDisplayString } from "@tradepilot/risk-engine";
import type {
  ClosureReason,
  EditarOperacionInput,
  ImpactoPorParcialItem,
  OperationsError,
} from "@tradepilot/operations-engine";

/**
 * BUILD 020 — la previsualización cruza a un Client Component, y una Server
 * Action es una **frontera de serialización**: lo que viaja se convierte en
 * JSON y al otro lado ya no hay kernel decimal. Devolver los objetos `RValue`
 * y `Money` de Quant Engine parecía natural y era un error: llegaban al
 * navegador convertidos en objetos planos, y la primera llamada a
 * `toDisplayString` reventaba con `fd.raw.toFixed is not a function`, dejando
 * el formulario de cierre inutilizable.
 *
 * Aquí se aplica la misma regla que en cualquier otra frontera del proyecto
 * (I5): los decimales cruzan como **cadenas**. La conversión se hace en el
 * servidor, donde el kernel sí existe.
 */
export interface PrevisualizacionUI {
  readonly r_final: string;
  readonly pnl_amount: string;
  readonly evidencia_leida: number;
  /** BUILD 022 — de dónde sale ese R, término a término. Lo calcula el motor. */
  readonly impacto: readonly ImpactoUI[];
}

/**
 * Una línea del desglose de R. `sequence` identifica el parcial; `null` es el
 * término del resto de la posición.
 */
export interface ImpactoUI {
  readonly sequence: number | null;
  readonly contribucion: string;
}

/**
 * BUILD 022 — lo que una corrección va a cambiar, antes de confirmarla.
 * Todo viene calculado del servicio; aquí sólo se convierte a cadenas.
 */
export interface PrevisualizacionCorreccionUI {
  readonly r_actual: string | null;
  readonly r_nuevo: string;
  readonly delta_r: string;
  readonly pnl_actual: string | null;
  readonly pnl_nuevo: string;
  readonly delta_pnl: string;
  readonly motivo_actual: ClosureReason | null;
  readonly motivo_nuevo: ClosureReason | null;
  readonly r_max_actual: string | null;
  readonly r_max_nuevo: string;
  readonly cierre_manual_actual: string | null;
  readonly cierre_manual_nuevo: string | null;
  readonly impacto: readonly ImpactoUI[];
  readonly evidencia_leida: number;
}

function aImpactoUI(items: readonly ImpactoPorParcialItem[]): ImpactoUI[] {
  return items.map((i) => ({
    sequence: i.kind === "parcial" ? i.sequence : null,
    contribucion: toDisplayString(i.contribution),
  }));
}
import { createClient } from "@/lib/supabase/server";
import { crearOperationsEngine } from "@/lib/operations/engine";
import {
  cancelarOperacion,
  obtenerOperacion,
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
): Promise<OperationsResult<PrevisualizacionUI>> {
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
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    value: {
      r_final: toDisplayString(result.value.r_final),
      pnl_amount: toDisplayString(result.value.pnl_amount),
      evidencia_leida: result.value.evidencia_leida,
      impacto: aImpactoUI(result.value.impacto_por_parcial),
    },
  };
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
  // Relectura por `lib/api` y no por `.rpc()` directo: es ahí donde vive la
  // normalización de decimales de la frontera (ver `lib/api/decimales.ts`).
  // Saltársela devolvía `number` donde el resto del código espera cadenas.
  const supabaseRead = await createClient();
  return obtenerOperacion(supabaseRead, input.trade_id);
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

/**
 * BUILD 022 — enseña lo que la corrección va a hacer ANTES de hacerlo.
 *
 * No escribe. Llama a `previsualizarCorreccion`, que arma el mismo
 * `RFinalInput` que la corrección real y llama al mismo Quant Engine: lo que
 * el usuario ve aquí es exactamente lo que se persistirá si confirma.
 */
export async function previsualizarCorreccionAction(
  input: CorreccionFormInput,
): Promise<OperationsResult<PrevisualizacionCorreccionUI>> {
  const entrada = await construirEntradaDeCorreccion(input);
  if (!entrada.ok) return entrada;

  const supabase = await createClient();
  const engine = crearOperationsEngine(supabase);
  const result = await engine.previsualizarCorreccion(entrada.value);
  if (!result.ok) return { ok: false, error: result.error };

  const v = result.value;
  return {
    ok: true,
    value: {
      r_actual: v.r_actual === null ? null : toDisplayString(v.r_actual),
      r_nuevo: toDisplayString(v.r_nuevo),
      delta_r: toDisplayString(v.delta_r),
      pnl_actual: v.pnl_actual === null ? null : toDisplayString(v.pnl_actual),
      pnl_nuevo: toDisplayString(v.pnl_nuevo),
      delta_pnl: toDisplayString(v.delta_pnl),
      motivo_actual: v.motivo_actual,
      motivo_nuevo: v.motivo_nuevo,
      r_max_actual: v.r_max_actual === null ? null : toDisplayString(v.r_max_actual),
      r_max_nuevo: toDisplayString(v.r_max_nuevo),
      cierre_manual_actual: v.cierre_manual_actual === null ? null : toDisplayString(v.cierre_manual_actual),
      cierre_manual_nuevo: v.cierre_manual_nuevo === null ? null : toDisplayString(v.cierre_manual_nuevo),
      impacto: aImpactoUI(v.impacto_por_parcial),
      evidencia_leida: v.evidencia_leida,
    },
  };
}

/**
 * Traduce el formulario a la entrada del servicio. **Un solo sitio** para las
 * dos vías —previsualizar y guardar—: si divergieran, la previsualización
 * mostraría una corrección distinta de la que se aplica.
 */
function construirEntradaDeCorreccion(
  input: CorreccionFormInput,
): OperationsResult<EditarOperacionInput> {
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

  return {
    ok: true,
    value: {
      trade_id: input.trade_id,
      ...(rMaxValue ? { r_max: rMaxValue } : {}),
      ...(input.closure_reason ? { closure_reason: input.closure_reason } : {}),
      ...(cierreManual ? { cierre_manual_rr: cierreManual } : {}),
      ...(input.borrar_cierre_manual_rr ? { borrar_cierre_manual_rr: true } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.comments !== undefined ? { comments: input.comments } : {}),
    },
  };
}

export async function corregirDesenlaceAction(
  input: CorreccionFormInput,
): Promise<OperationsResult<OperacionRow>> {
  const entrada = construirEntradaDeCorreccion(input);
  if (!entrada.ok) return entrada;

  const supabase = await createClient();
  const engine = crearOperationsEngine(supabase);
  const result = await engine.editarOperacion(entrada.value);

  if (!result.ok) return { ok: false, error: result.error };
  revalidarOperacion(input.account_id, input.trade_id);

  // Relectura por `lib/api` y no por `.rpc()` directo: es ahí donde vive la
  // normalización de decimales de la frontera (ver `lib/api/decimales.ts`).
  // Saltársela devolvía `number` donde el resto del código espera cadenas.
  const supabaseRead = await createClient();
  return obtenerOperacion(supabaseRead, input.trade_id);
}

/**
 * BUILD 022 — anotar una Operación SIN pasar por «Corregir desenlace».
 *
 * BUILD 021 observó que el único acceso a las notas estaba dentro de la
 * pantalla de corrección: para escribir «entré tarde, la señal ya se había
 * ido» había que entrar por una puerta que se llama «corregir un error».
 *
 * No hay capacidad nueva: `editarOperacion` ya distingue una edición que toca
 * el desenlace de una que no (`touchesRFinal`). Una edición sólo-notas no
 * invoca a Risk Engine, no recalcula nada, no mueve capital — y queda
 * auditada, como cualquier otro cambio. Funciona con la Operación abierta,
 * cerrada o cancelada.
 */
export async function guardarNotasAction(
  tradeId: string,
  accountId: string,
  notes: string,
): Promise<OperationsResult<OperacionRow>> {
  const supabase = await createClient();
  const engine = crearOperationsEngine(supabase);
  const result = await engine.editarOperacion({ trade_id: tradeId, notes });
  if (!result.ok) return { ok: false, error: result.error };

  revalidarOperacion(accountId, tradeId);
  const supabaseRead = await createClient();
  return obtenerOperacion(supabaseRead, tradeId);
}
