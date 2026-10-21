import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerOperacion } from "@/lib/api/operations";
import { Card } from "@/components/ui";
import { CancelacionForm } from "@/components/operaciones/CancelacionForm";

export default async function CancelarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const operacionResult = await obtenerOperacion(supabase, id);
  if (!operacionResult.ok) notFound();
  const operacion = operacionResult.value;

  // Sólo una Operación Abierta se cancela por esta vía. Una Cerrada exige la
  // cancelación "fantasma", que revierte capital y no se expone en el producto.
  if (operacion.status !== "open") redirect(`/operaciones/${id}`);

  return (
    <main>
      <p>
        <Link href={`/operaciones/${id}`}>← {operacion.symbol}</Link>
      </p>
      <h1>Cancelar Operación</h1>

      <Card>
        <CancelacionForm tradeId={id} accountId={operacion.account_id} symbol={operacion.symbol} />
      </Card>
    </main>
  );
}
