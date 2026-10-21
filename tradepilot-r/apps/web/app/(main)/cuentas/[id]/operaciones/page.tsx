import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerCuenta } from "@/lib/api/funding";
import { listarOperaciones } from "@/lib/api/operations";
import { EmptyState } from "@/components/ui";
import { EstadoBadge } from "@/components/operaciones/EstadoBadge";
import { formatMoney } from "@/lib/format/money";
import { formatFecha, formatLado, formatR } from "@/lib/format/operacion";
import styles from "@/components/operaciones/operaciones.module.css";

export default async function OperacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [cuentaResult, operacionesResult] = await Promise.all([
    obtenerCuenta(supabase, id),
    listarOperaciones(supabase, id),
  ]);

  if (!cuentaResult.ok) notFound();
  const cuenta = cuentaResult.value;
  const operaciones = operacionesResult.ok ? operacionesResult.value : [];

  return (
    <main>
      <p>
        <Link href={`/cuentas/${id}`}>← {cuenta.name}</Link>
      </p>
      <h1>Operaciones</h1>
      <p className={styles.hechoLabel}>
        Capital vigente: {formatMoney(cuenta.current_capital, cuenta.currency)}
      </p>

      <div className={styles.acciones}>
        <Link href={`/cuentas/${id}/operaciones/nueva`}>Nueva Operación</Link>
      </div>

      {operaciones.length === 0 ? (
        <EmptyState
          title="Todavía no hay Operaciones"
          description="Abre la primera para empezar a medir tus resultados en R."
        />
      ) : (
        <div className={styles.listaOperaciones}>
          {operaciones.map((op) => (
            <Link key={op.id} href={`/operaciones/${op.id}`} className={styles.filaOperacion}>
              <span className={styles.filaIzquierda}>
                <span className={styles.filaSimbolo}>
                  {op.symbol} · {formatLado(op.side)}
                </span>
                <span className={styles.filaMeta}>{formatFecha(op.opened_at)}</span>
              </span>
              <span className={styles.filaDerecha}>
                <EstadoBadge status={op.status} />
                {op.status === "closed" ? (
                  <>
                    <br />
                    <span className={op.r_final?.startsWith("-") ? styles.negativo : styles.positivo}>
                      {formatR(op.r_final)}
                    </span>{" "}
                    <span className={styles.filaMeta}>
                      {op.pnl_amount !== null ? formatMoney(op.pnl_amount, cuenta.currency) : ""}
                    </span>
                  </>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
