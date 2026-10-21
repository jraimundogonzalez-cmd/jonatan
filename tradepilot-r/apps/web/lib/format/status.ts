import type { AccountStatus } from "@/types/funding";

const LABELS: Record<AccountStatus, string> = {
  challenge: "Challenge",
  funded: "Funded",
  live: "Live",
  paused: "Pausada",
  terminated: "Terminada",
  merged: "Fusionada",
};

export function formatAccountStatus(status: AccountStatus): string {
  return LABELS[status];
}
