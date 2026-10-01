import { CuentaForm } from "@/components/cuentas/CuentaForm";
import { EmpresaChoice } from "@/components/onboarding/EmpresaChoice";
import { EmptyState } from "@/components/ui";
import { listarEmpresas } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

export default async function NuevaCuentaPage() {
  const supabase = await createClient();
  const empresasResult = await listarEmpresas(supabase);

  if (!empresasResult.ok) {
    return (
      <EmptyState title="No se ha podido cargar tu información" description={fundingErrorMessage(empresasResult.error)} />
    );
  }

  return (
    <div style={{ maxWidth: "420px" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "var(--space-6)" }}>Nueva Cuenta</h1>
      {empresasResult.value.length === 0 ? (
        // Caso defensivo (mvp-0.1.md no elimina Empresas todavía, §3.3) — se
        // cubre por completitud del flujo pedido: "crear Empresa si no existe".
        <EmpresaChoice redirectTo="/cuentas/nueva" />
      ) : (
        <CuentaForm propFirms={empresasResult.value} redirectTo="/cuentas" />
      )}
    </div>
  );
}
