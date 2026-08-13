// La auditoría de una Operación. La escribe un trigger SECURITY DEFINER desde
// BUILD 004 y es de sólo lectura: aquí se muestra, nunca se produce.
//
// Es la prueba visible de que el desenlace se corrige **con evidencia**: cada
// corrección deja su `before`/`after`, así que el diario nunca reescribe la
// historia en silencio.
import { formatFecha } from "@/lib/format/operacion";
import type { AuditEntryRow } from "@/types/operations";
import styles from "./operaciones.module.css";

/** Sólo los campos que realmente cambiaron, para que el diff se pueda leer. */
function camposCambiados(entry: AuditEntryRow): Array<[string, unknown, unknown]> {
  const before = entry.diff?.before ?? {};
  const after = entry.diff?.after ?? {};
  const claves = new Set([...Object.keys(before), ...Object.keys(after)]);
  const salida: Array<[string, unknown, unknown]> = [];
  for (const k of claves) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      salida.push([k, before[k], after[k]]);
    }
  }
  return salida;
}

export function AuditoriaList({ entradas }: { entradas: readonly AuditEntryRow[] }) {
  if (entradas.length === 0) {
    return <p className={styles.hechoLabel}>Todavía no hay correcciones registradas.</p>;
  }

  return (
    <div>
      {entradas.map((e) => {
        const cambios = camposCambiados(e);
        return (
          <div key={e.id} className={styles.auditEntry}>
            <p className={styles.auditMeta}>
              {formatFecha(e.created_at)} · {e.action}
            </p>
            {cambios.length === 0 ? (
              <p className={styles.auditDiff}>(sin cambios de valor)</p>
            ) : (
              <p className={styles.auditDiff}>
                {cambios
                  .map(([campo, antes, despues]) => `${campo}: ${String(antes ?? "∅")} → ${String(despues ?? "∅")}`)
                  .join("\n")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
