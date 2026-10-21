import { redirect } from "next/navigation";
import { CuentaForm } from "@/components/cuentas/CuentaForm";
import { EmptyState } from "@/components/ui";
import { listarCuentas, listarEmpresas } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

export default async function OnboardingCuentaPage() {
  const supabase = await createClient();

  const empresasResult = await listarEmpresas(supabase);
  if (!empresasResult.ok) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EmptyState title="No se ha podido cargar tu información" description={fundingErrorMessage(empresasResult.error)} />
      </main>
    );
  }

  if (empresasResult.value.length === 0) {
    redirect("/onboarding/empresa");
  }

  const cuentasResult = await listarCuentas(supabase);
  if (cuentasResult.ok && cuentasResult.value.length > 0) {
    // Defensa contra re-visitar el onboarding con retroceso del navegador.
    redirect("/cuentas");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <h1 style={{ fontSize: "1.125rem", marginBottom: "var(--space-6)" }}>Crea tu primera Cuenta</h1>
        <CuentaForm propFirms={empresasResult.value} redirectTo="/cuentas" />
      </div>
    </main>
  );
}
