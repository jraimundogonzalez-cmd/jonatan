"use server";

// Server Actions de la importación de ficheros. Solo leen el FormData y
// delegan en lib/imports/servicio.ts. Previsualizar no escribe nada; solo
// `confirmarImportacionAction` llega a la base de datos, en una transacción.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { confirmarImportacionDeFichero, previsualizarImportacion, type EntradaImportacion } from "@/lib/imports/servicio";
import type { ImportBatch, ImportResult, VistaPrevia } from "@/types/imports";

const texto = (fd: FormData, campo: string): string => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
};

async function leerEntrada(fd: FormData): Promise<ImportResult<EntradaImportacion>> {
  const fichero = fd.get("fichero");
  if (!(fichero instanceof File) || fichero.size === 0) {
    return { ok: false, error: { code: "FICHERO", error: { codigo: "FICHERO_VACIO" } } };
  }
  const accountId = texto(fd, "accountId");
  if (accountId === "") return { ok: false, error: { code: "VALIDATION_ERROR", field: "accountId", detail: "Elige la Cuenta de destino." } };
  const zonaHoraria = texto(fd, "zonaHoraria");
  if (zonaHoraria === "") {
    return { ok: false, error: { code: "VALIDATION_ERROR", field: "zonaHoraria", detail: "Elige la zona horaria en la que están escritas las horas del archivo." } };
  }
  const cuentaExterna = texto(fd, "cuentaExterna");
  return {
    ok: true,
    value: {
      accountId,
      ficheroNombre: fichero.name,
      bytes: new Uint8Array(await fichero.arrayBuffer()),
      zonaHoraria,
      cuentaExterna: cuentaExterna === "" ? null : cuentaExterna,
    },
  };
}

export async function previsualizarImportacionAction(fd: FormData): Promise<ImportResult<VistaPrevia>> {
  const entrada = await leerEntrada(fd);
  if (!entrada.ok) return entrada;
  const supabase = await createClient();
  return previsualizarImportacion(supabase, entrada.value);
}

export async function confirmarImportacionAction(fd: FormData): Promise<ImportResult<ImportBatch>> {
  const entrada = await leerEntrada(fd);
  if (!entrada.ok) return entrada;
  const aceptadas = texto(fd, "aceptadas")
    .split(",")
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
  const supabase = await createClient();
  const result = await confirmarImportacionDeFichero(supabase, {
    ...entrada.value,
    sha256Previsualizado: texto(fd, "sha256"),
    aceptadas,
    confirmarVinculo: texto(fd, "confirmarVinculo") === "si",
  });
  if (result.ok) {
    revalidatePath(`/cuentas/${entrada.value.accountId}`);
    revalidatePath(`/cuentas/${entrada.value.accountId}/importaciones`);
  }
  return result;
}
