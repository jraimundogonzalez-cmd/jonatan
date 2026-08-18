import type { CapitalEventType } from "@/types/funding";

const LABELS: Record<CapitalEventType, string> = {
  initial: "Capital inicial",
  deposit: "Depósito",
  withdrawal: "Retirada",
  payout: "Payout",
  reset: "Reinicio",
  adjustment: "Ajuste",
};

export function formatCapitalEventType(type: CapitalEventType): string {
  return LABELS[type];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" });
}
