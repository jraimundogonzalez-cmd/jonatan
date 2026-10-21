import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { obtenerLoteImportacion } from "@/lib/api/imports";
import { ETIQUETA_ESTADO, formatFechaLote, formatMotivoRevision } from "@/lib/format/importacion";
import { createClient } from "@/lib/supabase/server";
import { detalleTecnicoImport, importErrorMessage } from "@/types/imports";
import opStyles from "@/components/operaciones/operaciones.module.css";
import styles from "@/components/importaciones/importaciones.module.css";

// Resumen de un lote de importación: qué se guardó y qué no, y por qué.
export default async function LoteImportacionPage({ params }: { params: Promise<{ id: string; loteId: string }> }) {
  const { id, loteId } = await params;
  const supabase = await createClient();
  const result = await obtenerLoteImportacion(supabase, loteId);

  if (!result.ok || result.value.lote.account_id !== id) {
    if (!result.ok) {
      const detalle = detalleTecnicoImport(result.error);
      if (detalle) console.error("[importaciones/:loteId] error no catalogado:", detalle);
    }
    return (
      <EmptyState
        title="No se encuentra este lote"
        description={result.ok ? "El lote no pertenece a esta Cuenta." : importErrorMessage(result.error)}
        action={<Link href={`/cuentas/${id}/importaciones`}>Volver a Importaciones</Link>}
      />
    );
  }

  const { lote, filas } = result.value;
  const detalle = lote.summary.detalle ?? [];

  return (
    <main>
      <p>
        <Link href={`/cuentas/${id}/importaciones`}>← Importaciones</Link>
      </p>
      <h1>Lote importado</h1>
      <p className={opStyles.hechoLabel}>
        {lote.file_name} · {formatFechaLote(lote.created_at)} · cuenta del archivo {lote.external_account_ref} · zona{" "}
        {lote.source_timezone}
      </p>

      <dl className={styles.resumen}>
        {(
          [
            ["Filas del archivo", lote.rows_total],
            ["Importadas", lote.rows_imported],
            ["…de ellas, aceptadas tras revisión", lote.rows_review_accepted],
            ["Ya importadas", lote.rows_duplicate],
            ["Revisión no aceptada", lote.rows_review_skipped],
            ["De otra cuenta", lote.rows_other_account],
            ["Inválidas", lote.rows_invalid],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className={styles.resumenItem}>
            <dt className={opStyles.hechoLabel}>{etiqueta}</dt>
            <dd className={styles.resumenValor} style={{ margin: 0 }}>
              {valor}
            </dd>
          </div>
        ))}
      </dl>

      <section className={opStyles.seccion}>
        <h2 className={opStyles.seccionTitulo}>Filas guardadas en este lote</h2>
        {filas.length === 0 ? (
          <p>Este lote no añadió ninguna fila nueva.</p>
        ) : (
          <div className={styles.tablaContenedor}>
            <table className={styles.tablaImport}>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Contrato</th>
                  <th>Lado</th>
                  <th className={styles.numero}>Cant.</th>
                  <th>Entrada (hora del archivo)</th>
                  <th>Salida (hora del archivo)</th>
                  <th className={styles.numero}>P. entrada</th>
                  <th className={styles.numero}>P. salida</th>
                  <th className={styles.numero}>Bruto</th>
                  <th className={styles.numero}>Neto</th>
                  <th>Revisión</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>{f.row_number}</td>
                    <td>{f.contract}</td>
                    <td>{f.side}</td>
                    <td className={styles.numero}>{f.quantity}</td>
                    <td>{f.entry_local}</td>
                    <td>{f.exit_local}</td>
                    <td className={styles.numero}>{f.entry_price}</td>
                    <td className={styles.numero}>{f.exit_price}</td>
                    <td className={styles.numero}>{f.gross_pnl}</td>
                    <td className={styles.numero}>{f.net_pnl}</td>
                    <td>{f.review_reasons.map(formatMotivoRevision).join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalle.length > 0 ? (
        <section className={opStyles.seccion}>
          <h2 className={opStyles.seccionTitulo}>Filas no guardadas</h2>
          <table className={styles.tablaImport}>
            <thead>
              <tr>
                <th>Fila</th>
                <th>Estado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((d) => (
                <tr key={d.fila}>
                  <td>{d.fila}</td>
                  <td>{ETIQUETA_ESTADO[d.estado] ?? d.estado}</td>
                  <td>{d.motivos.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <p className={opStyles.previsualizacionNota}>
        Son los datos originales del archivo. No son Operaciones de TradePilot todavía: no tienen R, riesgo, stop ni
        estrategia, porque el archivo no los trae.
      </p>
    </main>
  );
}
