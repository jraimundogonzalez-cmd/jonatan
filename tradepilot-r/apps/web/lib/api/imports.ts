// API de importación de ficheros. Cada función envuelve una RPC de
// supabase/functions/sql/imports.sql — nunca un acceso directo a tabla
// (test/security/fronteras.test.ts lo hace cumplir).
import type { SupabaseClient } from "@supabase/supabase-js";
import { KNOWN_IMPORT_ERROR_CODES, type ImportBatch, type ImportError, type ImportResult, type ImportedRow } from "@/types/imports";

const ok = <T>(value: T): ImportResult<T> => ({ ok: true, value });
const err = (error: ImportError): ImportResult<never> => ({ ok: false, error });

/** "IMPORT_ERROR:<CODE>:<detalle>" → error tipado. Lo demás, UNKNOWN (nunca se descarta). */
export function parseImportError(message: string): ImportError {
  if (message.toLowerCase().includes("row-level security")) return { code: "UNAUTHORIZED" };
  const match = /^IMPORT_ERROR:([A-Z_]+):(.*)$/s.exec(message);
  if (match && KNOWN_IMPORT_ERROR_CODES.has(match[1] as string)) {
    const code = match[1] as string;
    const detail = match[2] as string;
    switch (code) {
      case "ACCOUNT_NOT_FOUND":
        return { code: "ACCOUNT_NOT_FOUND" };
      case "BATCH_NOT_FOUND":
        return { code: "BATCH_NOT_FOUND" };
      case "UNAUTHORIZED":
        return { code: "UNAUTHORIZED" };
      case "VALIDATION_ERROR": {
        const [field, ...rest] = detail.split(":");
        return { code: "VALIDATION_ERROR", field: field ?? "unknown", detail: rest.join(":") || detail };
      }
      case "ACCOUNT_MISMATCH":
      case "TIMEZONE_MISMATCH":
      case "TIMEZONE_CONVERSION_MISMATCH":
      case "LINK_CONFIRMATION_REQUIRED":
      case "EXTERNAL_ACCOUNT_LINKED_ELSEWHERE":
        return { code, detail };
    }
  }
  return { code: "UNKNOWN", detail: message };
}

export interface ConsultaPrevia {
  claves_existentes: string[];
  coincidencias_existentes: string[];
  cuenta_externa_vinculada: string | null;
  zona_horaria_vinculada: string | null;
  cuenta_externa_en_otra_cuenta: { account_id: string; account_name: string } | null;
}

export async function consultarImportacionPrevia(
  client: SupabaseClient,
  input: { accountId: string; source: string; cuentaExterna: string; claves: string[]; coincidencias: string[] },
): Promise<ImportResult<ConsultaPrevia>> {
  const { data, error } = await client.rpc("consultar_importacion_previa", {
    p_account_id: input.accountId,
    p_source: input.source,
    p_external_account_ref: input.cuentaExterna,
    p_dedup_keys: input.claves,
    p_match_keys: input.coincidencias,
  });
  if (error) return err(parseImportError(error.message));
  return ok(data as ConsultaPrevia);
}

/** Fila tal como la recibe `confirmar_importacion`. Decimales como texto (I5). */
export interface FilaParaGuardar {
  row_number: number;
  occurrence: number;
  dedup_key: string;
  match_key: string;
  external_account_ref: string;
  symbol: string;
  contract: string;
  entry_local: string;
  exit_local: string;
  entry_utc: string;
  exit_utc: string;
  entry_price: string;
  exit_price: string;
  side: "BUY" | "SELL";
  quantity: string;
  gross_pnl: string;
  net_pnl: string;
  review_reasons: string[];
  raw: Record<string, string>;
}

export async function confirmarImportacion(
  client: SupabaseClient,
  input: {
    accountId: string;
    source: string;
    ficheroNombre: string;
    ficheroSha256: string;
    zonaHoraria: string;
    cuentaExterna: string;
    confirmarVinculo: boolean;
    filas: FilaParaGuardar[];
    resumen: Record<string, unknown>;
  },
): Promise<ImportResult<ImportBatch>> {
  const { data, error } = await client.rpc("confirmar_importacion", {
    p_account_id: input.accountId,
    p_source: input.source,
    p_file_name: input.ficheroNombre,
    p_file_sha256: input.ficheroSha256,
    p_source_timezone: input.zonaHoraria,
    p_external_account_ref: input.cuentaExterna,
    p_confirmar_vinculo: input.confirmarVinculo,
    p_rows: input.filas,
    p_resumen: input.resumen,
  });
  if (error) return err(parseImportError(error.message));
  return ok(data as ImportBatch);
}

export async function listarLotesImportacion(client: SupabaseClient, accountId: string): Promise<ImportResult<ImportBatch[]>> {
  const { data, error } = await client.rpc("listar_lotes_importacion", { p_account_id: accountId });
  if (error) return err(parseImportError(error.message));
  return ok((data ?? []) as ImportBatch[]);
}

export async function obtenerLoteImportacion(
  client: SupabaseClient,
  batchId: string,
): Promise<ImportResult<{ lote: ImportBatch; filas: ImportedRow[] }>> {
  const { data, error } = await client.rpc("obtener_lote_importacion", { p_batch_id: batchId });
  if (error) return err(parseImportError(error.message));
  return ok(data as { lote: ImportBatch; filas: ImportedRow[] });
}
