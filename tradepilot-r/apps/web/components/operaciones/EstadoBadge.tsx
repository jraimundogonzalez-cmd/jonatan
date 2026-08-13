import { formatEstado } from "@/lib/format/operacion";
import type { TradeStatus } from "@/types/operations";
import styles from "./operaciones.module.css";

const CLASE: Record<TradeStatus, string> = {
  open: styles.badgeOpen ?? "",
  closed: styles.badgeClosed ?? "",
  cancelled: styles.badgeCancelled ?? "",
};

export function EstadoBadge({ status }: { status: TradeStatus }) {
  return <span className={`${styles.badge} ${CLASE[status]}`}>{formatEstado(status)}</span>;
}
