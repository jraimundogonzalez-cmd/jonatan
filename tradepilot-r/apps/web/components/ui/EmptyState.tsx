// Empty State — SPEC-012 §6.3: "explicar por qué una vista está vacía y qué
// hacer al respecto". Caso prohibido: nunca un espacio en blanco sin
// explicación (SPEC-006 §12.1, mismo principio aplicado al backlog vacío de
// un trader nuevo).
import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
      {action}
    </div>
  );
}
