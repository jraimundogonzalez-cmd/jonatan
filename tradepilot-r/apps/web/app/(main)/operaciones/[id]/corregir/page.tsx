import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerCuenta } from "@/lib/api/funding";
import { obtenerOperacion } from "@/lib/api/operations";
import { Card } from "@/components/ui";
import { CorreccionForm } from "@/components/operaciones/CorreccionForm";
import { DesenlacePanel } from "@/components/operaciones/DesenlacePanel";

export default async function CorregirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const operacionResult = await obtenerOperacion(supabase, id);
  if (!operacionResult.ok) notFound();
  const operacion = operacionResult.value;

  // Sólo se corrige el desenlace de una Operación Cerrada: si está Abierta no
  // hay desenlace todavía, y si está Cancelada su desenlace es terminal.
  if (operacion.status !== "closed") redirect(`/operaciones/${id}`);

  const cuentaResult = await obtenerCuenta(supabase, operacion.account_id);
  const currency = cuentaResult.ok ? cuentaResult.value.currency : "EUR";

  return (
    <main>
      <p>
        <Link href={`/operaciones/${id}`}>← {operacion.symbol}</Link>
      </p>
      <h1>Corregir desenlace</h1>

      <Card>
        <DesenlacePanel operacion={operacion} currency={currency} />
      </Card>

      <Card>
        <CorreccionForm operacion={operacion} />
      </Card>
    </main>
  );
}
