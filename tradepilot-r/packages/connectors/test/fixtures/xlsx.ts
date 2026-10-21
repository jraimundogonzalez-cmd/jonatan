// Generador de ficheros `.xlsx` de prueba. Son FIXTURES sintéticos: imitan el
// esquema conocido de «Lista de comercio», no son una exportación real. Las
// cuentas son ficticias (DEC-010: nunca un identificador real en el repo).
import ExcelJS from "exceljs";

export const CABECERA = [
  "Account",
  "Symbol",
  "Contract",
  "Entry Date",
  "Entry Price",
  "Exit Date",
  "Exit Price",
  "Side",
  "Quantity",
  "Gross P/L",
  "Net P/L",
];

export const CUENTA_A = "NYS00000-000001";
export const CUENTA_B = "NYS00000-000002";

/** La fila de ejemplo del esquema conocido, con la cuenta sustituida. */
export const FILA_EJEMPLO = [
  CUENTA_A,
  "MNQ",
  "/MNQZ26:XCME",
  "2026-10-06 14:03:56",
  31532,
  "2026-10-06 14:07:51",
  31567.75,
  "BUY",
  1,
  71.5,
  69.9,
];

/** Una pérdida en corto: SELL de 2 MNQ, el precio sube 10 puntos → −40 USD. */
export const FILA_PERDIDA_CORTO = [
  CUENTA_A,
  "MNQ",
  "/MNQZ26:XCME",
  "2026-10-07 15:30:00",
  31600,
  "2026-10-07 15:41:12",
  31610,
  "SELL",
  2,
  -40,
  -43.2,
];

export async function crearXlsx(filas: unknown[][], hojas: { nombre: string; filas: unknown[][] }[] = []): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  // Fecha fija: exceljs escribe la hora actual en los metadatos del libro, y
  // dos ficheros "iguales" generados en segundos distintos tendrían huellas
  // distintas. Sin esto, un test de reimportación fallaba de forma intermitente.
  libro.created = libro.modified = new Date(Date.UTC(2026, 0, 1));
  const todas = hojas.length > 0 ? hojas : [{ nombre: "Lista de comercio", filas }];
  for (const h of todas) {
    const hoja = libro.addWorksheet(h.nombre);
    for (const f of h.filas) hoja.addRow(f);
  }
  const buffer = await libro.xlsx.writeBuffer();
  return fijarFechasZip(new Uint8Array(buffer as ArrayBuffer));
}

/**
 * El ZIP guarda la hora de cada entrada (cabecera local y directorio central).
 * Se fija a un valor constante para que el mismo contenido produzca siempre
 * los mismos bytes. Esas fechas no entran en el CRC: el fichero sigue siendo
 * válido.
 */
function fijarFechasZip(b: Uint8Array): Uint8Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const HORA = 0x0000;
  const FECHA = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 en formato DOS
  for (let i = 0; i + 16 <= b.length; i++) {
    const firma = v.getUint32(i, true);
    if (firma === 0x04034b50) {
      v.setUint16(i + 10, HORA, true);
      v.setUint16(i + 12, FECHA, true);
    } else if (firma === 0x02014b50) {
      v.setUint16(i + 12, HORA, true);
      v.setUint16(i + 14, FECHA, true);
    }
  }
  return b;
}
