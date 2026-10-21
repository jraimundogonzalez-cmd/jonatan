// Comprobaciones previas a leer un fichero importado. Independientes de la
// plataforma: solo miran el nombre, el tamaño y la firma del contenido.
import { pareceZip } from "./xlsx.js";
import { inspeccionarZip, MAXIMO_DESCOMPRIMIDO_BYTES } from "./zip.js";
import type { ErrorDeFichero } from "./tipos.js";

/** 2 MB: una exportación de miles de operaciones ocupa decenas de KB. */
export const TAMANO_MAXIMO_BYTES = 2 * 1024 * 1024;

export function comprobarFichero(
  nombre: string,
  bytes: Uint8Array,
  extensiones: readonly string[],
): ErrorDeFichero | null {
  const minusculas = nombre.trim().toLowerCase();
  if (!extensiones.some((ext) => minusculas.endsWith(ext))) {
    return { codigo: "EXTENSION_NO_ADMITIDA", nombre };
  }
  if (bytes.byteLength === 0) return { codigo: "FICHERO_VACIO" };
  if (bytes.byteLength > TAMANO_MAXIMO_BYTES) {
    return { codigo: "FICHERO_DEMASIADO_GRANDE", bytes: bytes.byteLength, maximo: TAMANO_MAXIMO_BYTES };
  }
  // Un `.csv` o un `.xls` antiguo renombrado a `.xlsx` no es un ZIP.
  if (!pareceZip(bytes)) return { codigo: "NO_ES_XLSX" };
  // Antes de descomprimir nada: que el ZIP no declare más de lo razonable.
  const zip = inspeccionarZip(bytes);
  if (!zip.ok) {
    return zip.motivo === "DEMASIADO_GRANDE"
      ? { codigo: "CONTENIDO_DEMASIADO_GRANDE", maximo: MAXIMO_DESCOMPRIMIDO_BYTES }
      : { codigo: "ZIP_NO_ADMITIDO", motivo: zip.motivo };
  }
  return null;
}
