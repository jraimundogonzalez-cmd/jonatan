import Link from "next/link";
import { AccountCard } from "@/components/cuentas/AccountCard";
import { Button, EmptyState } from "@/components/ui";
import { listarCuentas, listarEmpresas } from "@/lib/api/funding";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

export default async function CuentasPage() {
  const supabase = await createClient();

  const [cuentasResult, empresasResult] = await Promise.all([listarCuentas(supabase), listarEmpresas(supabase)]);

  if (!cuentasResult.ok) {
    return <EmptyState title="No se han podido cargar tus Cuentas" description={fundingErrorMessage(cuentasResult.error)} />;
  }

  const propFirmNames = new Map<string, string>();
  if (empresasResult.ok) {
    for (const propFirm of empresasResult.value) {
      propFirmNames.set(propFirm.id, propFirm.name);
    }
  }

  const cuentas = cuentasResult.value;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Cuentas</h1>
        <Link href="/cuentas/nueva">
          <Button variant="primary">Nueva Cuenta</Button>
        </Link>
      </div>

      {cuentas.length === 0 ? (
        <EmptyState
          title="Todavía no tienes ninguna Cuenta"
          description="Crea tu primera Cuenta para empezar a llevar el registro de tu capital."
          action={
            <Link href="/cuentas/nueva">
              <Button variant="primary">Nueva Cuenta</Button>
            </Link>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {cuentas.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              propFirmName={propFirmNames.get(account.prop_firm_id) ?? "Empresa"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
