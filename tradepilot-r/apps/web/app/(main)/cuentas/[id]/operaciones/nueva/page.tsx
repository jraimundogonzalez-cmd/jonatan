import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerCuenta } from "@/lib/api/funding";
import { listarPlanesGestion } from "@/lib/api/operations";
import { Card } from "@/components/ui";
import { NuevaOperacionForm } from "@/components/operaciones/NuevaOperacionForm";
import { formatMoney } from "@/lib/format/money";
import styles from "@/components/operaciones/operaciones.module.css";

export default async function NuevaOperacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [cuentaResult, planesResult] = await Promise.all([
    obtenerCuenta(supabase, id),
    listarPlanesGestion(supabase),
  ]);
  if (!cuentaResult.ok) notFound();
  const cuenta = cuentaResult.value;
  const planes = (planesResult.ok ? planesResult.value : []).filter((p) => p.archived_at === null);

  return (
    <main>
      <p>
        <Link href={`/cuentas/${id}/operaciones`}>← Operaciones</Link>
      </p>
      <h1>Nueva Operación</h1>
      <p className={styles.hechoLabel}>
        {cuenta.name} · capital vigente {formatMoney(cuenta.current_capital, cuenta.currency)}
      </p>
      <Card>
        <NuevaOperacionForm accountId={id} planes={planes} />
      </Card>
    </main>
  );
}
