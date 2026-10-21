// Plan vs realidad. Los parciales planificados salen del snapshot congelado al
// nacer la Operación (Regla 13) y los ejecutados son evidencia inmutable
// (BUILD 016B). Ninguno de los dos se edita desde aquí, ni existe vía para
// hacerlo: la tabla sólo muestra.
//
// Los planificados se muestran **tal como estén**, sin validarlos: una Cuenta
// puede tener un Plan cuyos parciales sumen más de 100 (deuda conocida de
// Management Plans, ajena a Operations). Registrar la realidad nunca se
// bloquea por eso (I14).
import { formatFecha, formatR, sumaPctCerrado } from "@/lib/format/operacion";
import type { ParcialEjecutadoRow, ParcialPlanificadoRow } from "@/types/operations";
import styles from "./operaciones.module.css";

export function ParcialesTable({
  planificados,
  ejecutados,
  pctAbierto = null,
}: {
  planificados: readonly ParcialPlanificadoRow[];
  ejecutados: readonly ParcialEjecutadoRow[];
  /**
   * BUILD 022 — el porcentaje que sigue abierto, calculado por Quant Engine.
   * `null` cuando no aplica (Operación ya cerrada, o sin evidencia).
   * Nunca se deriva aquí restando de 100.
   */
  pctAbierto?: string | null;
}) {
  const ejecutadosPorSeq = new Map(ejecutados.map((e) => [e.sequence, e]));
  const secuencias = [
    ...new Set([...planificados.map((p) => p.sequence), ...ejecutados.map((e) => e.sequence)]),
  ].sort((a, b) => a - b);

  if (secuencias.length === 0) {
    return <p className={styles.hechoLabel}>Sin parciales planificados ni ejecutados.</p>;
  }

  // BUILD 021 observó dos columnas de guiones cuando la Operación no nació de
  // un Plan de Gestión. Si no hay plan que comparar, no hay nada que mostrar.
  const hayPlan = planificados.length > 0;

  return (
    <table className={styles.tabla}>
      <thead>
        <tr>
          <th>#</th>
          {hayPlan ? <th>Plan RR</th> : null}
          {hayPlan ? <th>Plan %</th> : null}
          <th>Ejecutado RR</th>
          <th>Ejecutado %</th>
          <th>Hora</th>
        </tr>
      </thead>
      <tbody>
        {secuencias.map((seq) => {
          const plan = planificados.find((p) => p.sequence === seq);
          const eje = ejecutadosPorSeq.get(seq);
          return (
            <tr key={seq} className={eje ? undefined : styles.filaPlanificada}>
              <td>{seq}</td>
              {hayPlan ? <td>{plan ? formatR(plan.rr_level) : "—"}</td> : null}
              {hayPlan ? <td>{plan ? `${plan.pct_close} %` : "—"}</td> : null}
              <td>{eje ? formatR(eje.rr_level) : "—"}</td>
              <td>{eje ? `${eje.pct_close} %` : "—"}</td>
              <td>{eje ? formatFecha(eje.executed_at) : "—"}</td>
            </tr>
          );
        })}
        <tr className={styles.tablaTotal}>
          <td colSpan={hayPlan ? 4 : 2}>Cerrado por parciales</td>
          <td colSpan={2}>{sumaPctCerrado(ejecutados)} %</td>
        </tr>
        {/* BUILD 021: el trader tenía que calcular 100 − 75 de cabeza. */}
        {pctAbierto !== null ? (
          <tr className={styles.tablaTotal}>
            <td colSpan={hayPlan ? 4 : 2}>Sigue abierto</td>
            <td colSpan={2}>{pctAbierto} %</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
