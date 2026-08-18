// El historial de cambios de una Operación, en lenguaje de producto.
//
// Lo escribe un trigger SECURITY DEFINER desde BUILD 004 y es de sólo lectura:
// aquí se muestra, nunca se produce. Es la prueba visible de que el desenlace
// se corrige **con evidencia**: cada corrección deja su `before`/`after`, así
// que el diario nunca reescribe la historia en silencio.
//
// BUILD 022 cambia únicamente la presentación: el trader lee «Desenlace
// corregido · R final +1.0000 R → +1.7500 R» en lugar de un volcado de
// columnas. Nada se pierde — el volcado exacto sigue a un clic, en el
// desplegable de detalle técnico.
import { formatFecha } from "@/lib/format/operacion";
import { aEntradaLegible } from "@/lib/format/auditoria";
import type { AuditEntryRow } from "@/types/operations";
import styles from "./operaciones.module.css";

export function AuditoriaList({
  entradas,
  currency,
}: {
  entradas: readonly AuditEntryRow[];
  currency: string;
}) {
  if (entradas.length === 0) {
    return <p className={styles.hechoLabel}>Todavía no hay cambios registrados.</p>;
  }

  return (
    <div>
      {entradas.map((e) => {
        const legible = aEntradaLegible(e, currency, formatFecha(e.occurred_at));
        return (
          <div key={legible.id} className={styles.auditEntry}>
            <p className={styles.auditMeta}>
              <strong>{legible.titulo}</strong> · {legible.fecha}
            </p>
            {legible.cambios.length === 0 ? (
              <p className={styles.auditDiff}>Sin cambios en el resultado.</p>
            ) : (
              <table className={styles.tablaAudit}>
                <tbody>
                  {legible.cambios.map((c) => (
                    <tr key={c.etiqueta}>
                      <td className={styles.auditCampo}>{c.etiqueta}</td>
                      <td className={styles.auditAntes}>{c.antes}</td>
                      <td className={styles.auditFlecha}>→</td>
                      <td className={styles.auditDespues}>{c.despues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {legible.tecnico.length > 0 ? (
              <details className={styles.auditTecnico}>
                <summary>Detalle técnico</summary>
                <p className={styles.auditDiff}>{legible.tecnico.join("\n")}</p>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
