import { redirect } from "next/navigation";
import { EmpresaChoice } from "@/components/onboarding/EmpresaChoice";
import { EmptyState } from "@/components/ui";
import { listarEmpresas } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

export default async function OnboardingEmpresaPage() {
  const supabase = await createClient();
  const result = await listarEmpresas(supabase);

  if (!result.ok) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EmptyState title="No se ha podido cargar tu información" description={fundingErrorMessage(result.error)} />
      </main>
    );
  }

  // Defensa contra re-visitar el onboarding con retroceso del navegador —
  // si ya tiene una Empresa, este paso ya está hecho.
  if (result.value.length > 0) {
    redirect("/onboarding/cuenta");
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
        <h1 style={{ fontSize: "1.125rem", marginBottom: "var(--space-6)" }}>
          ¿Vas a gestionar capital propio o el de una prop firm?
        </h1>
        <EmpresaChoice redirectTo="/onboarding/cuenta" />
      </div>
    </main>
  );
}
