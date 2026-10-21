// Lector de `.xlsx`. Único fichero que conoce la librería (exceljs): si mañana
// se cambia de librería, solo cambia esto.
//
// Fechas: Excel guarda una fecha como número de serie SIN zona horaria — es un
// reloj de pared. exceljs lo convierte en un `Date` cuyos componentes UTC son
// exactamente ese reloj de pared. Por eso, quien consuma una celda `fecha`
// debe leer `getUTC*()` y tratar el resultado como hora LOCAL de la zona que
// declare el usuario. Nunca `getHours()`, que aplicaría la zona del servidor.
import ExcelJS from "exceljs";
import type { Celda, HojaLeida } from "./tipos.js";

/** Cabecera de todo fichero ZIP (y un `.xlsx` es un ZIP): `PK\x03\x04`. */
export function pareceZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function celdaDesdeValor(valor: unknown): Celda {
  if (valor === null || valor === undefined) return { tipo: "vacia" };
  if (typeof valor === "string") return valor.trim() === "" ? { tipo: "vacia" } : { tipo: "texto", valor };
  if (typeof valor === "number") return { tipo: "numero", valor };
  if (typeof valor === "boolean") return { tipo: "booleano", valor };
  if (valor instanceof Date) return { tipo: "fecha", valor };
  if (typeof valor === "object") {
    const v = valor as Record<string, unknown>;
    // Fórmula: interesa el resultado calculado que guardó Excel, no la fórmula.
    if ("result" in v) return celdaDesdeValor(v.result);
    if ("formula" in v || "sharedFormula" in v) return { tipo: "vacia" };
    // Texto enriquecido: se concatena el texto plano.
    if (Array.isArray(v.richText)) {
      const texto = (v.richText as { text?: unknown }[]).map((t) => (typeof t.text === "string" ? t.text : "")).join("");
      return celdaDesdeValor(texto);
    }
    if (typeof v.text === "string") return celdaDesdeValor(v.text);
    // Celda de error de Excel (#N/A, #VALUE!…): se conserva como texto para que
    // la validación la rechace con un mensaje legible.
    if (typeof v.error === "string") return { tipo: "texto", valor: v.error };
  }
  return { tipo: "texto", valor: String(valor) };
}

/** Lee todas las hojas. Lanza si el contenido no es un `.xlsx` legible. */
export async function leerXlsx(bytes: Uint8Array): Promise<HojaLeida[]> {
  const libro = new ExcelJS.Workbook();
  // exceljs acepta un Buffer de Node; se envuelve sin copiar.
  await libro.xlsx.load(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) as unknown as ArrayBuffer);
  const hojas: HojaLeida[] = [];
  libro.eachSheet((hoja) => {
    const filas: Celda[][] = [];
    const total = hoja.rowCount;
    for (let r = 1; r <= total; r++) {
      const fila = hoja.getRow(r);
      const celdas: Celda[] = [];
      const ancho = Math.max(fila.cellCount, hoja.columnCount);
      for (let c = 1; c <= ancho; c++) {
        celdas.push(celdaDesdeValor(fila.getCell(c).value));
      }
      filas.push(celdas);
    }
    hojas.push({ nombre: hoja.name, filas });
  });
  return hojas;
}
