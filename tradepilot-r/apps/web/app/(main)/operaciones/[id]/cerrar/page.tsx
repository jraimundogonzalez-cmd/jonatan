import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerCuenta } from "@/lib/api/funding";
import { listarParcialesEjecutados, obtenerOperacion } from "@/lib/api/operations";
import { Card } from "@/components/ui";
import { CierreForm } from "@/components/operaciones/CierreForm";
import { ParcialesTable } from "@/components/operaciones/ParcialesTable";
import styles from "@/components/operaciones/operaciones.module.css";

export default async function CerrarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const operacionResult = await obtenerOperacion(supabase, id);
  if (!operacionResult.ok) notFound();
  const operacion = operacionResult.value;

  // Sólo una Operación Abierta se cierra. Si ya no lo está, la pantalla de
  // cierre no aplica: se devuelve al detalle, que muestra el desenlace real.
  if (operacion.status !== "open") redirect(`/operaciones/${id}`);

  const [cuentaResult, ejecutadosResult] = await Promise.all([
    obtenerCuenta(supabase, operacion.account_id),
    listarParcialesEjecutados(supabase, id),
  ]);
  const currency = cuentaResult.ok ? cuentaResult.value.currency : "EUR";
  const ejecutados = ejecutadosResult.ok ? ejecutadosResult.value : [];

  return (
    <main>
      <p>
        <Link href={`/operaciones/${id}`}>← {operacion.symbol}</Link>
      </p>
      <h1>Cerrar Operación</h1>

      <Card>
        <h2 className={styles.seccionTitulo}>Evidencia registrada</h2>
        <ParcialesTable planificados={[]} ejecutados={ejecutados} />
      </Card>

      <Card>
        <CierreForm tradeId={id} accountId={operacion.account_id} currency={currency} />
      </Card>
    </main>
  );
}
