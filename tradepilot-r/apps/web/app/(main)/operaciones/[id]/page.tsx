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
import { leerEvidencia } from "@/lib/operations/lecturas";
import { Button, Card } from "@/components/ui";
import { OperacionHeader } from "@/components/operaciones/OperacionHeader";
import { ParcialesTable } from "@/components/operaciones/ParcialesTable";
import { DesenlacePanel } from "@/components/operaciones/DesenlacePanel";
import { EvidenciaPanel } from "@/components/operaciones/EvidenciaPanel";
import { ParcialForm } from "@/components/operaciones/ParcialForm";
import { NotasForm } from "@/components/operaciones/NotasForm";
import { AuditoriaList } from "@/components/operaciones/AuditoriaList";
import styles from "@/components/operaciones/operaciones.module.css";

export default async function OperacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const operacionResult = await obtenerOperacion(supabase, id);
  if (!operacionResult.ok) notFound();
  const operacion = operacionResult.value;

  const [cuentaResult, planificadosResult, ejecutadosResult, auditoriaResult, evidenciaResult] =
    await Promise.all([
      obtenerCuenta(supabase, operacion.account_id),
      listarParcialesPlanificados(supabase, id),
      listarParcialesEjecutados(supabase, id),
      listarAuditoriaOperacion(supabase, id),
      // BUILD 022 — «R realizado» y el reparto de la posición los calcula el
      // motor, no esta pantalla.
      leerEvidencia(supabase, id),
    ]);

  const currency = cuentaResult.ok ? cuentaResult.value.currency : "EUR";
  const planificados = planificadosResult.ok ? planificadosResult.value : [];
  const ejecutados = ejecutadosResult.ok ? ejecutadosResult.value : [];
  const auditoria = auditoriaResult.ok ? auditoriaResult.value : [];
  const evidencia = evidenciaResult.ok ? evidenciaResult.value : null;

  // Siguiente hueco libre. Es UX: la unicidad la garantiza la base.
  const siguienteSequence = ejecutados.reduce((max, p) => Math.max(max, p.sequence), 0) + 1;
  const abierta = operacion.status === "open";
  const hayParciales = ejecutados.length > 0;

  return (
    <main>
      <p>
        <Link href={`/cuentas/${operacion.account_id}/operaciones`}>← Operaciones</Link>
      </p>

      <Card>
        <OperacionHeader operacion={operacion} currency={currency} />
        {abierta && hayParciales && evidencia ? <EvidenciaPanel evidencia={evidencia} /> : null}
        <DesenlacePanel operacion={operacion} currency={currency} />
      </Card>

      {/* BUILD 022 — la jerarquía, corregida: cerrar es la acción principal de
          una Operación abierta; registrar un parcial la continúa. Cancelar es
          destructiva y va aparte, nunca al mismo nivel visual que cerrar. */}
      {abierta ? (
        <div className={styles.accionesPrincipales}>
          <Link href={`/operaciones/${operacion.id}/cerrar`}>
            <Button variant="primary">Cerrar Operación</Button>
          </Link>
          <Link href={`/operaciones/${operacion.id}/cancelar`}>
            <Button variant="text">Cancelar Operación</Button>
          </Link>
        </div>
      ) : null}

      {operacion.status === "closed" ? (
        <div className={styles.accionesPrincipales}>
          <Link href={`/operaciones/${operacion.id}/corregir`}>
            <Button variant="secondary">Corregir desenlace</Button>
          </Link>
        </div>
      ) : null}

      <Card>
        <h2 className={styles.seccionTitulo}>Evidencia · plan vs realidad</h2>
        <ParcialesTable
          planificados={planificados}
          ejecutados={ejecutados}
          pctAbierto={abierta && evidencia ? evidencia.pct_abierto : null}
        />
      </Card>

      {abierta ? (
        <Card>
          <h2 className={styles.seccionTitulo}>Registrar parcial ejecutado</h2>
          <ParcialForm
            tradeId={operacion.id}
            accountId={operacion.account_id}
            siguienteSequence={siguienteSequence}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className={styles.seccionTitulo}>Notas</h2>
        <NotasForm tradeId={operacion.id} accountId={operacion.account_id} notas={operacion.notes} />
      </Card>

      {/* BUILD 021 observó que una tarjeta de auditoría vacía ocupaba el mismo
          espacio que la evidencia para decir que no había nada. Sólo aparece
          cuando hay algo que contar. */}
      {auditoria.length > 0 ? (
        <Card>
          <h2 className={styles.seccionTitulo}>Historial de cambios</h2>
          <AuditoriaList entradas={auditoria} currency={currency} />
        </Card>
      ) : null}
    </main>
  );
}
