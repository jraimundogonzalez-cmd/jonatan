// Tipos de la importación de ficheros de operaciones cerradas.
// Separados de lib/api/imports.ts (llamadas RPC) y de lib/imports/servicio.ts
// (orquestación) para que los componentes importen tipos sin arrastrar código
// de servidor.
import type { ErrorDeFichero, EstadoFila, ProblemaDeFila, ResumenClasificacion } from "@tradepilot/connectors";

/** Zonas que se ofrecen en la pantalla. La zona de la plataforma está PENDIENTE de verificar con un fichero real. */
export const ZONAS_HORARIAS_OFRECIDAS = [
  { valor: "America/New_York", etiqueta: "Nueva York (ET)" },
  { valor: "America/Chicago", etiqueta: "Chicago (CT, hora de CME)" },
  { valor: "Europe/Madrid", etiqueta: "Madrid (CET/CEST)" },
  { valor: "Europe/London", etiqueta: "Londres (GMT/BST)" },
  { valor: "UTC", etiqueta: "UTC" },
] as const;

export type ImportError =
  | { code: "FICHERO"; error: ErrorDeFichero }
  | { code: "ACCOUNT_NOT_FOUND" }
  | { code: "BATCH_NOT_FOUND" }
  | { code: "ACCOUNT_MISMATCH"; detail: string }
  | { code: "TIMEZONE_MISMATCH"; detail: string }
  | { code: "TIMEZONE_CONVERSION_MISMATCH"; detail: string }
  | { code: "LINK_CONFIRMATION_REQUIRED"; detail: string }
  | { code: "EXTERNAL_ACCOUNT_LINKED_ELSEWHERE"; detail: string }
  | { code: "FICHERO_CAMBIADO" }
  | { code: "CUENTA_EXTERNA_REQUERIDA" }
  | { code: "IMPORTACION_BLOQUEADA"; motivos: string[] }
  | { code: "VALIDATION_ERROR"; field: string; detail: string }
  | { code: "UNAUTHORIZED" }
  | { code: "UNKNOWN"; detail: string };

export const KNOWN_IMPORT_ERROR_CODES = new Set([
  "ACCOUNT_NOT_FOUND",
  "BATCH_NOT_FOUND",
  "ACCOUNT_MISMATCH",
  "TIMEZONE_MISMATCH",
  "TIMEZONE_CONVERSION_MISMATCH",
  "LINK_CONFIRMATION_REQUIRED",
  "EXTERNAL_ACCOUNT_LINKED_ELSEWHERE",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
]);

export type ImportResult<T> = { ok: true; value: T } | { ok: false; error: ImportError };

function mensajeDeFichero(e: ErrorDeFichero): string {
  switch (e.codigo) {
    case "FICHERO_VACIO":
      return "El archivo está vacío.";
    case "EXTENSION_NO_ADMITIDA":
      return `«${e.nombre}» no es un archivo .xlsx. Exporta la Lista de comercio en formato Excel (.xlsx).`;
    case "FICHERO_DEMASIADO_GRANDE":
      return `El archivo ocupa ${Math.ceil(e.bytes / 1024)} KB; el máximo es ${Math.floor(e.maximo / 1024)} KB.`;
    case "NO_ES_XLSX":
      return "El archivo tiene extensión .xlsx pero su contenido no es un libro de Excel (¿un CSV renombrado?).";
    case "XLSX_ILEGIBLE":
      return "No se ha podido leer el libro de Excel: el archivo está dañado o incompleto.";
    case "CABECERA_NO_ENCONTRADA":
      return `No se encuentra la fila de cabecera. Se esperaban las columnas: ${e.faltan.join(", ")}.`;
    case "COLUMNAS_AUSENTES":
      return `Faltan columnas: ${e.faltan.join(", ")}. Columnas encontradas: ${e.encontradas.join(", ")}.`;
    case "COLUMNAS_DUPLICADAS":
      return `Hay columnas repetidas: ${e.duplicadas.join(", ")}.`;
    case "SIN_FILAS_DE_DATOS":
      return "El archivo tiene cabecera pero ninguna operación.";
    case "DEMASIADAS_FILAS":
      return `El archivo tiene ${e.filas} filas; el máximo por importación es ${e.maximo}. Exporta un periodo más corto.`;
    case "ZONA_HORARIA_NO_VALIDA":
      return `«${e.zona}» no es una zona horaria reconocida.`;
  }
}

export function importErrorMessage(error: ImportError): string {
  switch (error.code) {
    case "FICHERO":
      return mensajeDeFichero(error.error);
    case "ACCOUNT_NOT_FOUND":
      return "No se encuentra la Cuenta indicada.";
    case "BATCH_NOT_FOUND":
      return "No se encuentra ese lote de importación.";
    case "ACCOUNT_MISMATCH":
      return `La cuenta del archivo no coincide con la vinculada a esta Cuenta: ${error.detail}`;
    case "TIMEZONE_MISMATCH":
      return `Zona horaria distinta de la de importaciones anteriores: ${error.detail}`;
    case "TIMEZONE_CONVERSION_MISMATCH":
      return "La conversión horaria no coincide con la de la vista previa. No se ha guardado nada; vuelve a previsualizar.";
    case "LINK_CONFIRMATION_REQUIRED":
      return "Es la primera importación de esta Cuenta: confirma que la cuenta del archivo le corresponde.";
    case "EXTERNAL_ACCOUNT_LINKED_ELSEWHERE":
      return `Esa cuenta del archivo ya está vinculada a otra Cuenta de TradePilot: ${error.detail}`;
    case "FICHERO_CAMBIADO":
      return "El archivo no es el mismo que se previsualizó. No se ha guardado nada; vuelve a previsualizar.";
    case "CUENTA_EXTERNA_REQUERIDA":
      return "El archivo contiene varias cuentas: elige cuál corresponde a esta Cuenta.";
    case "IMPORTACION_BLOQUEADA":
      return `No se puede confirmar: ${error.motivos.join(" ")}`;
    case "VALIDATION_ERROR":
      return error.detail;
    case "UNAUTHORIZED":
      return "No tienes acceso a este recurso.";
    case "UNKNOWN":
      return "Ha ocurrido un error inesperado y no se ha guardado nada. El detalle técnico queda registrado.";
  }
}

/** Mismo criterio que types/funding.ts (BUG-021-2): el detalle técnico se registra, nunca se pinta. */
export function detalleTecnicoImport(error: ImportError): string | null {
  return error.code === "UNKNOWN" ? error.detail : null;
}

/** Fila de la vista previa, ya serializable para cruzar la frontera de la Server Action. */
export interface FilaVistaPrevia {
  fila: number;
  estado: EstadoFila;
  cuentaExterna: string | null;
  simbolo: string | null;
  contrato: string | null;
  lado: string | null;
  cantidad: string | null;
  entradaLocal: string | null;
  salidaLocal: string | null;
  precioEntrada: string | null;
  precioSalida: string | null;
  pnlBruto: string | null;
  pnlNeto: string | null;
  errores: ProblemaDeFila[];
  revision: ProblemaDeFila[];
  notas: ProblemaDeFila[];
  original: Record<string, string>;
}

export type EstadoVinculo =
  /** Primera importación de la Cuenta: hace falta confirmar el vínculo. */
  | { tipo: "nuevo" }
  /** La cuenta del archivo es la ya vinculada. */
  | { tipo: "coincide" }
  /** La Cuenta está vinculada a otra cuenta externa. */
  | { tipo: "no_coincide"; vinculada: string }
  /** Esa cuenta externa ya pertenece a otra Cuenta de TradePilot. */
  | { tipo: "en_otra_cuenta"; nombreOtraCuenta: string };

export interface VistaPrevia {
  accountId: string;
  ficheroNombre: string;
  ficheroSha256: string;
  hoja: string;
  columnasExtra: string[];
  zonaHoraria: string;
  zonaVinculada: string | null;
  cuentasExternas: string[];
  /** `null` si el archivo trae varias cuentas y todavía no se ha elegido. */
  cuentaExterna: string | null;
  vinculo: EstadoVinculo | null;
  resumen: ResumenClasificacion;
  filas: FilaVistaPrevia[];
  /** Motivos por los que no se puede confirmar todavía. Vacío = se puede. */
  bloqueos: string[];
}

export interface ImportBatch {
  id: string;
  account_id: string;
  source: string;
  file_name: string;
  file_sha256: string;
  source_timezone: string;
  external_account_ref: string;
  rows_total: number;
  rows_imported: number;
  rows_review_accepted: number;
  rows_duplicate: number;
  rows_review_skipped: number;
  rows_other_account: number;
  rows_invalid: number;
  summary: { detalle?: { fila: number; estado: EstadoFila; motivos: string[] }[] } & Record<string, unknown>;
  created_at: string;
}

export interface ImportedRow {
  id: string;
  row_number: number;
  occurrence: number;
  symbol: string;
  contract: string;
  entry_local: string;
  exit_local: string;
  entry_at: string;
  exit_at: string;
  entry_price: string;
  exit_price: string;
  side: "BUY" | "SELL";
  quantity: string;
  gross_pnl: string;
  net_pnl: string;
  review_reasons: string[];
}
