import { redirect } from "next/navigation";
import { listarCuentas, listarEmpresas } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";

/**
 * Enrutado raíz (mvp-0.1.md §5): decide entre onboarding y dashboard según el
 * estado real del usuario — nunca renderiza nada por sí misma. El middleware
 * ya garantiza que solo se llega aquí con sesión activa.
 */
export default async function RootPage(): Promise<never> {
  const supabase = await createClient();

  const empresasResult = await listarEmpresas(supabase);
  if (!empresasResult.ok || empresasResult.value.length === 0) {
    redirect("/onboarding/empresa");
  }

  const cuentasResult = await listarCuentas(supabase);
  if (!cuentasResult.ok || cuentasResult.value.length === 0) {
    redirect("/onboarding/cuenta");
  }

  redirect("/cuentas");
}
