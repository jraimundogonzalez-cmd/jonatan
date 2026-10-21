// El desenlace, tal como el dominio lo dejó. Ni una sola cifra de esta
// pantalla se calcula aquí: `r_final` y `pnl_amount` los produjo Quant Engine
// y `time_in_market_sec` lo derivó un trigger.
import { formatMoney } from "@/lib/format/money";
import { formatFecha, formatMotivoCierre, formatR } from "@/lib/format/operacion";
import type { OperacionRow } from "@/types/operations";
import styles from "./operaciones.module.css";

export function DesenlacePanel({ operacion, currency }: { operacion: OperacionRow; currency: string }) {
  if (operacion.status === "cancelled") {
    return (
      <div className={styles.seccion}>
        <h2 className={styles.seccionTitulo}>Desenlace</h2>
        <div className={styles.hechos}>
          <div className={styles.hecho}>
            <span className={styles.hechoLabel}>Motivo de cancelación</span>
            <span className={styles.hechoValor}>{operacion.cancellation_reason ?? "—"}</span>
          </div>
        </div>
      </div>
    );
  }

  if (operacion.status !== "closed") return null;

  const pnl = operacion.pnl_amount;
  const esPositivo = pnl !== null && !pnl.startsWith("-");

  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Resultado</h2>
      <div className={styles.hechos}>
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>R final</span>
          <span className={`${styles.hechoValorGrande} ${esPositivo ? styles.positivo : styles.negativo}`}>
            {formatR(operacion.r_final)}
          </span>
        </div>
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>P&amp;L</span>
          <span className={`${styles.hechoValorGrande} ${esPositivo ? styles.positivo : styles.negativo}`}>
            {pnl !== null ? formatMoney(pnl, currency) : "—"}
          </span>
        </div>
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>Motivo de cierre</span>
          <span className={styles.hechoValor}>{formatMotivoCierre(operacion.closure_reason)}</span>
        </div>
        {operacion.cierre_manual_rr !== null ? (
          <div className={styles.hecho}>
            <span className={styles.hechoLabel}>Cierre manual en</span>
            <span className={styles.hechoValor}>{formatR(operacion.cierre_manual_rr)}</span>
          </div>
        ) : null}
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>Cierre</span>
          <span className={styles.hechoValor}>{formatFecha(operacion.closed_at)}</span>
        </div>
        {/* BUILD 022 — `time_in_market_sec` sale de la vista principal (§13):
            es un derivado correcto que no interviene en ninguna decisión de
            trading. Sigue calculado por su trigger y sigue en la fila. */}
      </div>
    </div>
  );
}
