// Presentación de la importación. Solo texto: no calcula nada.
import type { EstadoFila } from "@tradepilot/connectors";

export const ETIQUETA_ESTADO: Record<EstadoFila, string> = {
  nueva: "Nueva",
  revision: "Requiere revisión",
  duplicada: "Ya importada",
  otra_cuenta: "Otra cuenta",
  invalida: "Inválida",
};

/** Motivos de revisión guardados con la fila (códigos) → texto legible. */
const MOTIVO_REVISION: Record<string, string> = {
  FILA_IDENTICA_EN_FICHERO: "Copia idéntica de otra fila del mismo archivo",
  POSIBLE_DUPLICADO_DE_IMPORTADA: "Coincide con una fila ya importada salvo en precios o P&L",
  CANTIDAD_NEGATIVA: "Cantidad negativa (convención de signo sin verificar)",
  CANTIDAD_NO_ENTERA: "Cantidad no entera",
  PNL_BRUTO_NO_CUADRA: "El P&L bruto no cuadra con los precios",
};

export function formatMotivoRevision(codigo: string): string {
  return MOTIVO_REVISION[codigo] ?? codigo;
}

export function formatFechaLote(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}
