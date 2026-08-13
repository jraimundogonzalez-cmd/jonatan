import Link from "next/link";
import { CapitalEventList } from "@/components/cuentas/CapitalEventList";
import { Button, Card, EmptyState } from "@/components/ui";
import { listarEmpresas, listarEventosCapital, obtenerCuenta } from "@/lib/api/funding";
import { formatMoney } from "@/lib/format/money";
import { formatAccountStatus } from "@/lib/format/status";
import { createClient } from "@/lib/supabase/server";
import { fundingErrorMessage } from "@/types/funding";

export default async function CuentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [cuentaResult, empresasResult, eventosResult] = await Promise.all([
    obtenerCuenta(supabase, id),
    listarEmpresas(supabase),
    listarEventosCapital(supabase, id),
  ]);

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

  const account = cuentaResult.value;
  const propFirmName = empresasResult.ok
    ? (empresasResult.value.find((propFirm) => propFirm.id === account.prop_firm_id)?.name ?? "Empresa")
    : "Empresa";
  const events = eventosResult.ok ? eventosResult.value : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "560px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>{account.name}</h1>
        {/* Una sola acción primaria por vista (SPEC-012): operar es la acción
            principal de una Cuenta; registrar un movimiento de capital es
            secundaria. */}
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Link href={`/cuentas/${account.id}/eventos/nuevo`}>
            <Button variant="secondary">Registrar evento</Button>
          </Link>
          <Link href={`/cuentas/${account.id}/operaciones`}>
            <Button variant="primary">Operaciones</Button>
          </Link>
        </div>
      </div>

      <Card>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", margin: 0 }}>
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Empresa</dt>
            <dd style={{ margin: 0, marginTop: "4px" }}>{propFirmName}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Estado</dt>
            <dd style={{ margin: 0, marginTop: "4px" }}>{formatAccountStatus(account.status)}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Capital inicial</dt>
            <dd className="font-mono-num" style={{ margin: 0, marginTop: "4px" }}>
              {formatMoney(account.initial_capital, account.currency)}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Capital actual</dt>
            <dd className="font-mono-num" style={{ margin: 0, marginTop: "4px", fontWeight: 600 }}>
              {formatMoney(account.current_capital, account.currency)}
            </dd>
          </div>
          {account.profit_split_pct ? (
            <div>
              <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Profit Split</dt>
              <dd className="font-mono-num" style={{ margin: 0, marginTop: "4px" }}>
                {account.profit_split_pct}%
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div>
        <h2 style={{ fontSize: "1rem", marginBottom: "var(--space-3)" }}>Historial de eventos</h2>
        <CapitalEventList events={events} currency={account.currency} />
      </div>
    </div>
  );
}
