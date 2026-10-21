// Traducción de la auditoría al lenguaje del producto.
//
// BUILD 021 observó lo que un trader lee hoy en el panel de Auditoría:
//
//   Invalid Date · update
//   r_max: ø → 2.5
//   pnl_amount: ø → 100.98
//   closure_idempotency_key: ø → 8354c670-d35f-48f1-a9a4-2d999d61fdef
//
// Es exacto y es ilegible: nombres de columna, un símbolo críptico para el
// nulo y una clave de idempotencia que no significa nada para quien opera.
//
// Aquí NO se decide nada ni se calcula nada: el `diff` lo escribe un trigger
// `SECURITY DEFINER` (BUILD 004) y sigue guardándose entero. Esto sólo elige
// **qué** se muestra primero y **cómo** se nombra. Todo lo que se aparta sigue
// disponible en el detalle técnico de la propia pantalla — separar
// presentación de evidencia, nunca eliminar evidencia.
import type { AuditEntryRow } from "@/types/operations";
import { formatMoney } from "./money";
import { formatMotivoCierre, formatR } from "./operacion";
import { rvalue, toDisplayString } from "@tradepilot/risk-engine";
import type { ClosureReason } from "@/types/operations";

/** Campos que el trader entiende, en el orden en que le importan. */
const CAMPOS_DE_PRODUCTO: ReadonlyArray<{ campo: string; etiqueta: string; tipo: "r" | "dinero" | "motivo" | "texto" }> = [
  { campo: "r_final", etiqueta: "R final", tipo: "r" },
  { campo: "pnl_amount", etiqueta: "P&L", tipo: "dinero" },
  { campo: "closure_reason", etiqueta: "Motivo de cierre", tipo: "motivo" },
  { campo: "r_max", etiqueta: "R máximo alcanzado", tipo: "r" },
  { campo: "cierre_manual_rr", etiqueta: "Cierre manual en", tipo: "r" },
  { campo: "cancellation_reason", etiqueta: "Motivo de cancelación", tipo: "texto" },
  { campo: "notes", etiqueta: "Notas", tipo: "texto" },
];

/**
 * Infraestructura, no trading. Se aparta de la vista principal por decisión
 * explícita del usuario en BUILD 022 §13; sigue en la base y en el detalle.
 */
const CAMPOS_TECNICOS = new Set([
  "closure_idempotency_key",
  "time_in_market_sec",
  "closed_at",
  "status",
  "comments",
]);

export interface CambioLegible {
  readonly etiqueta: string;
  readonly antes: string;
  readonly despues: string;
}

export interface EntradaLegible {
  readonly id: number;
  readonly titulo: string;
  readonly fecha: string;
  readonly cambios: readonly CambioLegible[];
  /** `campo: antes → después` en crudo, para el desplegable de detalle técnico. */
  readonly tecnico: readonly string[];
}

function valorCrudo(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function formatearValor(v: unknown, tipo: "r" | "dinero" | "motivo" | "texto", currency: string): string {
  const crudo = valorCrudo(v);
  if (crudo === null) return "—";
  switch (tipo) {
    case "r":
      // El `diff` viene de `to_jsonb(trades)`, y ahí un `numeric` es un número
      // JSON: `1.0000` llega como `1`. Se normaliza con el kernel decimal —el
      // mismo que fija la escala en todo el proyecto— y no rellenando ceros a
      // mano en la capa de presentación.
      return formatR(toDisplayString(rvalue(crudo)));
    case "dinero":
      return formatMoney(crudo, currency);
    case "motivo":
      return formatMotivoCierre(crudo as ClosureReason);
    case "texto":
      return crudo;
  }
}

/**
 * Titula la entrada por lo que le ocurrió a la Operación. Se lee del propio
 * `diff` —de la transición de `status`— y no de ninguna regla nueva.
 */
function titular(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const antes = before["status"];
  const despues = after["status"];
  if (antes !== despues) {
    if (despues === "closed") return "Operación cerrada";
    if (despues === "cancelled") return "Operación cancelada";
  }
  const soloNotas =
    Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).every((k) => k === "notes");
  return soloNotas ? "Notas actualizadas" : "Desenlace corregido";
}

export function aEntradaLegible(entry: AuditEntryRow, currency: string, fecha: string): EntradaLegible {
  const before = entry.diff?.before ?? {};
  const after = entry.diff?.after ?? {};
  const cambiados = new Set(
    [...Object.keys(before), ...Object.keys(after)].filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    ),
  );

  const cambios: CambioLegible[] = [];
  for (const { campo, etiqueta, tipo } of CAMPOS_DE_PRODUCTO) {
    if (!cambiados.has(campo)) continue;
    cambios.push({
      etiqueta,
      antes: formatearValor(before[campo], tipo, currency),
      despues: formatearValor(after[campo], tipo, currency),
    });
  }

  const tecnico = [...cambiados]
    .filter((k) => CAMPOS_TECNICOS.has(k) || !CAMPOS_DE_PRODUCTO.some((c) => c.campo === k))
    .sort()
    .map((k) => `${k}: ${valorCrudo(before[k]) ?? "∅"} → ${valorCrudo(after[k]) ?? "∅"}`);

  return { id: entry.id, titulo: titular(before, after), fecha, cambios, tecnico };
}
