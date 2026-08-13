import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerCuenta } from "@/lib/api/funding";
import {
  listarAuditoriaOperacion,
  listarParcialesEjecutados,
  listarParcialesPlanificados,
  obtenerOperacion,
} from "@/lib/api/operations";
import { Card } from "@/components/ui";
import { OperacionHeader } from "@/components/operaciones/OperacionHeader";
import { ParcialesTable } from "@/components/operaciones/ParcialesTable";
import { DesenlacePanel } from "@/components/operaciones/DesenlacePanel";
import { ParcialForm } from "@/components/operaciones/ParcialForm";
import { AuditoriaList } from "@/components/operaciones/AuditoriaList";
import styles from "@/components/operaciones/operaciones.module.css";

export default async function OperacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const operacionResult = await obtenerOperacion(supabase, id);
  if (!operacionResult.ok) notFound();
  const operacion = operacionResult.value;

  const [cuentaResult, planificadosResult, ejecutadosResult, auditoriaResult] = await Promise.all([
    obtenerCuenta(supabase, operacion.account_id),
    listarParcialesPlanificados(supabase, id),
    listarParcialesEjecutados(supabase, id),
    listarAuditoriaOperacion(supabase, id),
  ]);

  const currency = cuentaResult.ok ? cuentaResult.value.currency : "EUR";
  const planificados = planificadosResult.ok ? planificadosResult.value : [];
  const ejecutados = ejecutadosResult.ok ? ejecutadosResult.value : [];
  const auditoria = auditoriaResult.ok ? auditoriaResult.value : [];

  // Siguiente hueco libre. Es UX: la unicidad la garantiza la base.
  const siguienteSequence = ejecutados.reduce((max, p) => Math.max(max, p.sequence), 0) + 1;

  return (
    <main>
      <p>
        <Link href={`/cuentas/${operacion.account_id}/operaciones`}>← Operaciones</Link>
      </p>

      <Card>
        <OperacionHeader operacion={operacion} currency={currency} />
        <DesenlacePanel operacion={operacion} currency={currency} />
      </Card>

      <Card>
        <h2 className={styles.seccionTitulo}>Evidencia · plan vs realidad</h2>
        <ParcialesTable planificados={planificados} ejecutados={ejecutados} />
      </Card>

      {operacion.status === "open" ? (
        <>
          <Card>
            <h2 className={styles.seccionTitulo}>Registrar parcial ejecutado</h2>
            <ParcialForm
              tradeId={operacion.id}
              accountId={operacion.account_id}
              siguienteSequence={siguienteSequence}
            />
          </Card>
          <div className={styles.acciones}>
            <Link href={`/operaciones/${operacion.id}/cerrar`}>Cerrar Operación</Link>
          </div>
        </>
      ) : null}

      {operacion.status === "closed" ? (
        <div className={styles.acciones}>
          <Link href={`/operaciones/${operacion.id}/corregir`}>Corregir desenlace</Link>
        </div>
      ) : null}

      <Card>
        <h2 className={styles.seccionTitulo}>Auditoría</h2>
        <AuditoriaList entradas={auditoria} />
      </Card>
    </main>
  );
}
