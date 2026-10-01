import type { Money, Percent } from "../core/types.js";

/**
 * SPEC-001 §3.7 tipaba `drawdown_type` como `"static" | "trailing" | "eod"`
 * pero `DrawdownStateInput` solo tenía un único campo `peak_capital` — una
 * ambigüedad real: "eod" (End Of Day Trailing, 22 §151) necesita el máximo
 * de los cierres de día, un valor **distinto** del pico histórico continuo
 * que usa "trailing". Corrección aplicada aquí: `peak_capital_basis` deja
 * explícito que quien llama debe aportar el pico ya calculado según el tipo
 * — Quant Engine nunca decide cuál usar, solo aplica la fórmula (§1.2 punto
 * 3, "nunca lee contexto implícito").
 */
export type DrawdownType = "static" | "trailing" | "eod";

/**
 * **`max_daily_drawdown_pct` eliminado del input original de SPEC-001 §3.7**:
 * estaba declarado pero ningún campo de `DrawdownState` lo consumía —
 * parámetro muerto. Calcular un "drawdown diario restante" real exigiría un
 * quinto hecho de capital que no existe en ningún esquema del proyecto
 * todavía ("capital al inicio del día de trading") — no es responsabilidad
 * de esta función inventarlo; se retira en vez de aceptarlo en silencio sin
 * usarlo nunca. Se revisita cuando Rule Engine defina ese concepto.
 */
export interface DrawdownStateInput {
  readonly current_capital: Money;
  readonly initial_capital: Money;
  readonly drawdown_type: DrawdownType;
  /** Requerido si `drawdown_type !== "static"` — ver nota de `DrawdownType`. */
  readonly peak_capital_basis?: Money;
  readonly max_total_drawdown_pct: Percent;
}

export interface DrawdownState {
  readonly piso_vigente: Money;
  readonly drawdown_restante_eur: Money;
  readonly drawdown_restante_pct: Percent;
}
