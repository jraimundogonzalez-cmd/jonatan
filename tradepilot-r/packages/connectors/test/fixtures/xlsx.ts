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
  const todas = hojas.length > 0 ? hojas : [{ nombre: "Lista de comercio", filas }];
  for (const h of todas) {
    const hoja = libro.addWorksheet(h.nombre);
    for (const f of h.filas) hoja.addRow(f);
  }
  const buffer = await libro.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
