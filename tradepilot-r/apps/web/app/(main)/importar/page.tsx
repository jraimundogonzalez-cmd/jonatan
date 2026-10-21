import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import { ImportadorForm } from "@/components/importaciones/ImportadorForm";
import { listarCuentas } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

// Importar operaciones cerradas desde la «Lista de comercio» (.xlsx).
// La Cuenta de destino se elige en el propio formulario; `?cuenta=` la
// preselecciona cuando se llega desde el detalle de una Cuenta.
export default async function ImportarPage({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const { cuenta } = await searchParams;
  const supabase = await createClient();
  const cuentasResult = await listarCuentas(supabase);

  if (!cuentasResult.ok) {
    return <EmptyState title="No se han podido cargar tus Cuentas" description={fundingErrorMessage(cuentasResult.error)} />;
  }
  const cuentas = cuentasResult.value.map((c) => ({ id: c.id, name: c.name }));
  if (cuentas.length === 0) {
    return (
      <EmptyState
        title="Primero necesitas una Cuenta"
        description="Las operaciones importadas se guardan en una Cuenta de TradePilot."
        action={
          <Link href="/cuentas/nueva">
            <Button variant="primary">Nueva Cuenta</Button>
          </Link>
        }
      />
    );
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Importar operaciones cerradas</h1>
      <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "640px" }}>
        Sube el Excel de la «Lista de comercio» de tu plataforma. Verás una vista previa antes de guardar nada; puedes
        cancelar en cualquier momento. Importar dos veces el mismo archivo no duplica operaciones.
      </p>
      <ImportadorForm cuentas={cuentas} cuentaInicial={cuentas.some((c) => c.id === cuenta) ? (cuenta as string) : null} />
    </main>
  );
}
