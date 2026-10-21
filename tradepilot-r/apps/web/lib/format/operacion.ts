// Formateo de Operaciones para pantalla. Igual que `format/money.ts`: nunca
// convierte a `number` de JS (I5, precisión decimal) — opera sobre la cadena
// exacta que devuelve `numeric(8,4)`/`numeric(18,4)`.
//
// Aquí no hay ni una regla de dominio: no se decide si un cierre es válido, no
// se calcula nada y no se infiere ningún motivo. Sólo se traduce a castellano
// lo que el dominio ya ha decidido.
import type { ClosureReason, TradeSide, TradeStatus } from "@/types/operations";

const ESTADOS: Record<TradeStatus, string> = {
  open: "Abierta",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

const MOTIVOS: Record<ClosureReason, string> = {
  STOP_LOSS: "Stop loss",
  BREAK_EVEN: "Break-even",
  TAKE_PROFIT_FULL: "Take profit completo",
  MANUAL_CLOSE: "Cierre manual",
};

const LADOS: Record<TradeSide, string> = { long: "Largo", short: "Corto" };

export function formatEstado(status: TradeStatus): string {
  return ESTADOS[status];
}

export function formatMotivoCierre(reason: ClosureReason | null): string {
  return reason ? MOTIVOS[reason] : "—";
}

export function formatLado(side: TradeSide): string {
  return LADOS[side];
}

/** Los cuatro motivos, para poblar el selector. La legalidad la juzga el dominio. */
export const MOTIVOS_DE_CIERRE: ReadonlyArray<{ value: ClosureReason; label: string }> = [
  { value: "STOP_LOSS", label: MOTIVOS.STOP_LOSS },
  { value: "BREAK_EVEN", label: MOTIVOS.BREAK_EVEN },
  { value: "TAKE_PROFIT_FULL", label: MOTIVOS.TAKE_PROFIT_FULL },
  { value: "MANUAL_CLOSE", label: MOTIVOS.MANUAL_CLOSE },
];

/** "1.5000" → "+1.5000 R" · "-1.0000" → "-1.0000 R". Sin redondear. */
export function formatR(value: string | null): string {
  if (value === null) return "—";
  const signo = value.startsWith("-") ? "" : "+";
  return `${signo}${value} R`;
}

export function formatPct(value: string | null): string {
  return value === null ? "—" : `${value} %`;
}

/** Segundos → "2 h 15 min" / "45 min" / "30 s". Derivado por trigger, nunca input. */
export function formatTiempoEnMercado(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const restoMin = min % 60;
  return restoMin === 0 ? `${h} h` : `${h} h ${restoMin} min`;
}

export function formatFecha(iso: string | null): string {
  if (iso === null) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Suma de porcentajes cerrados, sobre cadenas — nunca con `number`. */
export function sumaPctCerrado(parciales: ReadonlyArray<{ pct_close: string }>): string {
  let centesimas = 0n;
  for (const p of parciales) {
    const [entera = "0", decimal = "00"] = p.pct_close.split(".");
    centesimas += BigInt(entera) * 100n + BigInt(decimal.padEnd(2, "0").slice(0, 2));
  }
  const entera = centesimas / 100n;
  const resto = (centesimas % 100n).toString().padStart(2, "0");
  return `${entera}.${resto}`;
}
