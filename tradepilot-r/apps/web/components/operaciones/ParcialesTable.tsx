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
}: {
  planificados: readonly ParcialPlanificadoRow[];
  ejecutados: readonly ParcialEjecutadoRow[];
}) {
  const ejecutadosPorSeq = new Map(ejecutados.map((e) => [e.sequence, e]));
  const secuencias = [
    ...new Set([...planificados.map((p) => p.sequence), ...ejecutados.map((e) => e.sequence)]),
  ].sort((a, b) => a - b);

  if (secuencias.length === 0) {
    return <p className={styles.hechoLabel}>Sin parciales planificados ni ejecutados.</p>;
  }

  return (
    <table className={styles.tabla}>
      <thead>
        <tr>
          <th>#</th>
          <th>Plan RR</th>
          <th>Plan %</th>
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
              <td>{plan ? formatR(plan.rr_level) : "—"}</td>
              <td>{plan ? `${plan.pct_close} %` : "—"}</td>
              <td>{eje ? formatR(eje.rr_level) : "—"}</td>
              <td>{eje ? `${eje.pct_close} %` : "—"}</td>
              <td>{eje ? formatFecha(eje.executed_at) : "—"}</td>
            </tr>
          );
        })}
        <tr className={styles.tablaTotal}>
          <td colSpan={4}>Cerrado por parciales</td>
          <td colSpan={2}>{sumaPctCerrado(ejecutados)} %</td>
        </tr>
      </tbody>
    </table>
  );
}
