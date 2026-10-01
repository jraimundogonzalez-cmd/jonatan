import Link from "next/link";
import { CapitalEventForm } from "@/components/cuentas/CapitalEventForm";
import { Button, EmptyState } from "@/components/ui";
import { obtenerCuenta } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

export default async function NuevoEventoCapitalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const cuentaResult = await obtenerCuenta(supabase, id);

  if (!cuentaResult.ok) {
    return (
      <EmptyState
        title="No se encuentra esta Cuenta"
        description={fundingErrorMessage(cuentaResult.error)}
        action={
          <Link href="/cuentas">
            <Button variant="secondary">Volver a Cuentas</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: "420px" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "var(--space-2)" }}>Registrar evento de capital</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0, marginBottom: "var(--space-6)" }}>
        {cuentaResult.value.name}
      </p>
      <CapitalEventForm accountId={cuentaResult.value.id} redirectTo={`/cuentas/${cuentaResult.value.id}`} />
    </div>
  );
}
