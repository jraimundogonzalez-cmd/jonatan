// Tipos de la frontera de importación de ficheros.
//
// Por qué no es `RawCaptureEvent` (06_CONNECTORS.md §2): ese contrato describe
// EVENTOS sueltos (open, partial_close, full_close, commission…). Un fichero
// de operaciones cerradas trae otra cosa: un viaje completo ya emparejado por
// la plataforma, con su P&L bruto y neto. Partirlo en dos eventos obligaría a
// inventar un evento `commission` con la diferencia bruto−neto, que es
// exactamente lo que no sabemos (la diferencia puede no ser solo comisión).
// Por eso esta fase conserva la fila tal cual llega. La reconstrucción en
// Operaciones es una etapa posterior que todavía no tiene regla validada.

/** Celda tal como sale del lector de `.xlsx`, antes de interpretar nada. */
export type Celda =
  | { tipo: "vacia" }
  | { tipo: "texto"; valor: string }
  | { tipo: "numero"; valor: number }
  /** Celda con formato de fecha en Excel. Ver `xlsx.ts` sobre la zona. */
  | { tipo: "fecha"; valor: Date }
  | { tipo: "booleano"; valor: boolean };

export interface HojaLeida {
  nombre: string;
  /** Filas en orden; `filas[i]` es la fila `i + 1` de la hoja. */
  filas: Celda[][];
}

/** Error que invalida el fichero entero (no una fila). */
export type ErrorDeFichero =
  | { codigo: "FICHERO_VACIO" }
  | { codigo: "EXTENSION_NO_ADMITIDA"; nombre: string }
  | { codigo: "FICHERO_DEMASIADO_GRANDE"; bytes: number; maximo: number }
  | { codigo: "NO_ES_XLSX" }
  | { codigo: "XLSX_ILEGIBLE"; detalle: string }
  | { codigo: "CABECERA_NO_ENCONTRADA"; faltan: string[] }
  | { codigo: "COLUMNAS_AUSENTES"; faltan: string[]; encontradas: string[] }
  | { codigo: "COLUMNAS_DUPLICADAS"; duplicadas: string[] }
  | { codigo: "SIN_FILAS_DE_DATOS" }
  | { codigo: "DEMASIADAS_FILAS"; filas: number; maximo: number }
  | { codigo: "ZONA_HORARIA_NO_VALIDA"; zona: string };

/** Problema de una fila concreta, con el campo afectado. */
export interface ProblemaDeFila {
  campo: string;
  codigo: string;
  mensaje: string;
}

/**
 * Una operación cerrada tal como la exporta el fichero, ya validada.
 *
 * Todo decimal viaja como cadena (I5). Los instantes se guardan DOS veces: el
 * texto de reloj tal como venía (`*_local`) y su conversión a UTC con la zona
 * declarada por el usuario (`*_utc`). Si la zona estuviera mal, el texto
 * original sigue permitiendo reconstruir el dato correcto.
 */
export interface FilaOperacionCerrada {
  /** Número de fila en la hoja (1 = primera fila de la hoja, cabecera incluida). */
  fila: number;
  cuentaExterna: string;
  simbolo: string;
  contrato: string;
  entradaLocal: string;
  entradaUtc: string;
  precioEntrada: string;
  salidaLocal: string;
  salidaUtc: string;
  precioSalida: string;
  /** Tal como viene: `BUY` o `SELL`. No se traduce a long/short aquí. */
  lado: "BUY" | "SELL";
  cantidad: string;
  pnlBruto: string;
  pnlNeto: string;
  /** Valores originales de TODAS las columnas, como texto, para auditoría. */
  original: Record<string, string>;
  /** Motivos que exigen que el usuario acepte la fila expresamente. */
  revision: ProblemaDeFila[];
  /** Información que no bloquea (p. ej. instrumento sin validación de P&L). */
  notas: ProblemaDeFila[];
}

export interface FilaInvalida {
  fila: number;
  errores: ProblemaDeFila[];
  original: Record<string, string>;
}

/** Resultado de traducir un fichero completo. */
export type ResultadoTraduccion =
  | { ok: false; error: ErrorDeFichero }
  | {
      ok: true;
      hoja: string;
      columnasExtra: string[];
      validas: FilaOperacionCerrada[];
      invalidas: FilaInvalida[];
    };

/**
 * Contrato de un conector de fichero. Mismo espíritu que `Connector` de
 * 06_CONNECTORS.md: un `id`, sus modos de ingesta y UNA traducción. No
 * escribe, no calcula R, no decide.
 */
export interface ConectorDeFichero {
  id: string;
  ingestion_modes: readonly ["file_import"];
  extensiones: readonly string[];
  traducir(bytes: Uint8Array, opciones: { zonaHoraria: string }): Promise<ResultadoTraduccion>;
}
