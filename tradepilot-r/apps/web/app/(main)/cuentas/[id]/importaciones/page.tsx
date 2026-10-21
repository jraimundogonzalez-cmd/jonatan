import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { obtenerCuenta } from "@/lib/api/funding";
import { listarLotesImportacion } from "@/lib/api/imports";
import { formatFechaLote } from "@/lib/format/importacion";
import { createClient } from "@/lib/supabase/server";
import { detalleTecnicoImport, importErrorMessage } from "@/types/imports";
import opStyles from "@/components/operaciones/operaciones.module.css";
import styles from "@/components/importaciones/importaciones.module.css";

export default async function ImportacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [cuentaResult, lotesResult] = await Promise.all([obtenerCuenta(supabase, id), listarLotesImportacion(supabase, id)]);
  if (!cuentaResult.ok) notFound();
  const cuenta = cuentaResult.value;

  if (!lotesResult.ok) {
    const detalle = detalleTecnicoImport(lotesResult.error);
    if (detalle) console.error("[cuentas/:id/importaciones] error no catalogado:", detalle);
  }
  const lotes = lotesResult.ok ? lotesResult.value : [];

  return (
    <main>
      <p>
        <Link href={`/cuentas/${id}`}>← {cuenta.name}</Link>
      </p>
      <h1>Importaciones</h1>
      <div className={opStyles.acciones}>
        <Link href={`/importar?cuenta=${id}`}>Importar Excel</Link>
      </div>

      {!lotesResult.ok ? <p className={styles.error}>{importErrorMessage(lotesResult.error)}</p> : null}

      {lotes.length === 0 ? (
        <EmptyState title="Todavía no hay importaciones" description="Importa la Lista de comercio para registrar tus operaciones cerradas." />
      ) : (
        <div>
          {lotes.map((l) => (
            <Link key={l.id} href={`/cuentas/${id}/importaciones/${l.id}`} className={styles.lineaLote}>
              <span>
                <strong>{l.file_name}</strong>
                <br />
                <span className={opStyles.hechoLabel}>
                  {formatFechaLote(l.created_at)} · {l.external_account_ref} · {l.source_timezone}
                </span>
              </span>
              <span className={styles.numero}>
                {l.rows_imported} importadas
                <br />
                <span className={opStyles.hechoLabel}>
                  {l.rows_duplicate} ya importadas · {l.rows_invalid} inválidas
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
