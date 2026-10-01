// Lecturas de dominio que la interfaz necesita **calculadas por el motor**.
//
// BUILD 022. La regla del proyecto es que la interfaz no calcula resultados, y
// eso incluye los agregados: ni «R realizado» ni «R agregado» pueden salir de
// un `reduce` en un componente. Salen de `OperationsEngineService`, que a su
// vez los pide a Quant Engine.
//
// Este módulo es sólo la frontera de serialización: convierte los valores del
// kernel decimal en **cadenas** (I5) antes de que crucen a la capa de
// presentación. Es la misma lección de BUILD 020 —los objetos del kernel no
// sobreviven a una Server Action— aplicada aquí por adelantado.
import "server-only";

import { toDisplayString } from "@tradepilot/risk-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearOperationsEngine } from "./engine";
import type { OperationsResult } from "@/types/operations";

/** «R realizado» y el reparto de la posición, listos para pintar. */
export interface EvidenciaUI {
  readonly r_realizado: string;
  readonly pct_cerrado: string;
  readonly pct_abierto: string;
  readonly r_maximo_evidenciado: string | null;
}

export async function leerEvidencia(
  client: SupabaseClient,
  tradeId: string,
): Promise<OperationsResult<EvidenciaUI>> {
  const engine = crearOperationsEngine(client);
  const result = await engine.resumenEvidencia(tradeId);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    value: {
      r_realizado: toDisplayString(result.value.r_realizado),
      pct_cerrado: toDisplayString(result.value.pct_cerrado),
      pct_abierto: toDisplayString(result.value.pct_abierto),
      r_maximo_evidenciado:
        result.value.r_maximo_evidenciado === null ? null : toDisplayString(result.value.r_maximo_evidenciado),
    },
  };
}

/** Resultado agregado de una Cuenta, en R. */
export interface ResumenCuentaUI {
  readonly r_agregado: string;
  readonly operaciones_en_la_muestra: number;
  readonly cerradas: number;
  readonly abiertas: number;
  readonly canceladas: number;
}

export async function leerResumenDeCuenta(
  client: SupabaseClient,
  accountId: string,
): Promise<OperationsResult<ResumenCuentaUI>> {
  const engine = crearOperationsEngine(client);
  const result = await engine.resumenDeCuenta(accountId);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    value: {
      r_agregado: toDisplayString(result.value.r_agregado),
      operaciones_en_la_muestra: result.value.operaciones_en_la_muestra,
      cerradas: result.value.cerradas,
      abiertas: result.value.abiertas,
      canceladas: result.value.canceladas,
    },
  };
}
