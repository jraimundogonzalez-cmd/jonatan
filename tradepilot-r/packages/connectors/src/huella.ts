// Huella de deduplicación de una fila importada.
//
// La plataforma no exporta ningún identificador de operación, así que no hay
// `external_ref` que usar (06_CONNECTORS.md §6 lo da por requisito; aquí
// falta). No se inventa uno: la identidad de una fila son sus propios datos.
//
//   base       = sha256(conector, cuenta externa, símbolo, contrato,
//                       reloj de entrada, precio de entrada,
//                       reloj de salida, precio de salida,
//                       lado, cantidad, P&L bruto, P&L neto)
//   clave      = sha256(base, ocurrencia)
//   coincidencia = sha256(conector, cuenta externa, símbolo, contrato,
//                         reloj de entrada, reloj de salida, lado, cantidad)
//
// Decisiones, y por qué:
//   · Los decimales entran canonizados ("31532.00" = "31532").
//   · Las horas entran como RELOJ, no como UTC: si alguien reimporta el mismo
//     fichero declarando otra zona, la huella no cambia y no se duplica nada
//     (además el lote se rechaza por zona distinta, ver imports.sql).
//   · `ocurrencia` numera las filas IDÉNTICAS dentro del mismo fichero (1, 2…).
//     Dos filas legítimas con los mismos campos producen dos claves distintas
//     y ninguna se descarta; la segunda va a revisión. Reimportar el fichero
//     reproduce las mismas ocurrencias y por tanto las mismas claves.
//   · `coincidencia` omite precios y P&L: detecta una fila que ya se importó
//     con otros importes (p. ej. comisiones corregidas en una exportación
//     posterior). No se fusiona: va a revisión.
import { createHash } from "node:crypto";
import type { FilaOperacionCerrada } from "./tipos.js";

const SEPARADOR = "\u001f";

const sha256 = (partes: string[]) => createHash("sha256").update(partes.join(SEPARADOR), "utf8").digest("hex");

export function huellaBase(conector: string, f: FilaOperacionCerrada): string {
  return sha256([
    conector,
    f.cuentaExterna,
    f.simbolo,
    f.contrato,
    f.entradaLocal,
    f.precioEntrada,
    f.salidaLocal,
    f.precioSalida,
    f.lado,
    f.cantidad,
    f.pnlBruto,
    f.pnlNeto,
  ]);
}

export function claveDeduplicacion(base: string, ocurrencia: number): string {
  return sha256([base, String(ocurrencia)]);
}

export function claveCoincidencia(conector: string, f: FilaOperacionCerrada): string {
  return sha256([conector, f.cuentaExterna, f.simbolo, f.contrato, f.entradaLocal, f.salidaLocal, f.lado, f.cantidad]);
}

/** Huella del fichero completo, para el registro del lote. */
export function huellaFichero(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
