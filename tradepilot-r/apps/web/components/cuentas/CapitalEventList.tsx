import { Card, EmptyState } from "@/components/ui";
import { formatCapitalEventType, formatDate } from "@/lib/format/capitalEvent";
import { formatMoney } from "@/lib/format/money";
import type { CapitalEvent } from "@/types/funding";
import styles from "./CapitalEventList.module.css";

export interface CapitalEventListProps {
  events: readonly CapitalEvent[];
  currency: string;
}

export function CapitalEventList({ events, currency }: CapitalEventListProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay eventos de capital"
        description="El evento de capital inicial aparece aquí en cuanto se registre."
      />
    );
  }

  return (
    <Card>
      <div className={styles.list}>
        {events.map((event) => (
          <div key={event.id} className={styles.row}>
            <div className={styles.left}>
              <span className={styles.type}>{formatCapitalEventType(event.event_type)}</span>
              <span className={styles.date}>{formatDate(event.occurred_at)}</span>
              {event.note ? <span className={styles.note}>{event.note}</span> : null}
            </div>
            <span className={`${styles.amount} font-mono-num`}>{formatMoney(event.amount, currency)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
