import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerCuenta } from "@/lib/api/funding";
import { listarParcialesEjecutados, obtenerOperacion } from "@/lib/api/operations";
import { leerEvidencia } from "@/lib/operations/lecturas";
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

  const [cuentaResult, ejecutadosResult, evidenciaResult] = await Promise.all([
    obtenerCuenta(supabase, operacion.account_id),
    listarParcialesEjecutados(supabase, id),
    leerEvidencia(supabase, id),
  ]);
  const currency = cuentaResult.ok ? cuentaResult.value.currency : "EUR";
  const ejecutados = ejecutadosResult.ok ? ejecutadosResult.value : [];
  const evidencia = evidenciaResult.ok ? evidenciaResult.value : null;

  return (
    <main>
      <p>
        <Link href={`/operaciones/${id}`}>← {operacion.symbol}</Link>
      </p>
      <h1>Cerrar Operación</h1>

      <Card>
        <h2 className={styles.seccionTitulo}>Evidencia registrada</h2>
        <ParcialesTable
          planificados={[]}
          ejecutados={ejecutados}
          pctAbierto={evidencia?.pct_abierto ?? null}
        />
      </Card>

      <Card>
        <CierreForm
          tradeId={id}
          accountId={operacion.account_id}
          currency={currency}
          hayParciales={ejecutados.length > 0}
          rMaximoEvidenciado={evidencia?.r_maximo_evidenciado ?? null}
        />
      </Card>
    </main>
  );
}
