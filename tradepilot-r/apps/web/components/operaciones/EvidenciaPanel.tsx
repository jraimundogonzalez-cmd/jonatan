// BUILD 022 — lo que el trader ya se ha llevado, con la Operación aún abierta.
//
// BUILD 021 encontró el hueco: tras cerrar el 50 % a +1R y el 25 % a +2R, el
// trader lleva +1,00R en el bolsillo y ninguna pantalla se lo decía. Sólo
// aparecía un R al cerrar, entero, como si naciera en ese instante.
//
// Ni una sola de estas cifras se calcula aquí. Vienen de
// `calcularEvidenciaParciales` (Quant Engine), que comparte descomposición con
// `R_final`: el sumatorio Σ p_i·RR_i está escrito una sola vez en el proyecto.
//
// «R realizado» NO es «R final» y no lo anticipa: le falta el término del
// resto, que depende de un desenlace que todavía no ha ocurrido.
import type { EvidenciaUI } from "@/lib/operations/lecturas";
import { formatPct, formatR } from "@/lib/format/operacion";
import styles from "./operaciones.module.css";

export function EvidenciaPanel({ evidencia }: { evidencia: EvidenciaUI }) {
  const negativo = evidencia.r_realizado.startsWith("-");

  return (
    <div className={styles.seccion}>
      <h2 className={styles.seccionTitulo}>Realizado hasta ahora</h2>
      <div className={styles.hechos}>
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>R realizado</span>
          <span className={`${styles.hechoValorGrande} ${negativo ? styles.negativo : styles.positivo}`}>
            {formatR(evidencia.r_realizado)}
          </span>
        </div>
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>Posición cerrada</span>
          <span className={styles.hechoValor}>{formatPct(evidencia.pct_cerrado)}</span>
        </div>
        <div className={styles.hecho}>
          <span className={styles.hechoLabel}>Posición abierta</span>
          <span className={styles.hechoValor}>{formatPct(evidencia.pct_abierto)}</span>
        </div>
      </div>
      <p className={styles.previsualizacionNota}>
        R realizado es lo que ya han materializado tus parciales. No es el R final: falta por decidir el
        desenlace del {formatPct(evidencia.pct_abierto)} que sigue abierto.
      </p>
    </div>
  );
}
