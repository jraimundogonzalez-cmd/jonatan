"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearCuenta, registrarEventoCapital } from "@/lib/api/funding";
import type { Account, CrearCuentaInput, FundingResult, UserCapitalEventType } from "@/types/funding";

export async function crearCuentaAction(input: CrearCuentaInput): Promise<FundingResult<Account>> {
  const supabase = await createClient();
  const result = await crearCuenta(supabase, input);
  if (result.ok) {
    revalidatePath("/cuentas");
  }
  return result;
}

export async function registrarEventoCapitalAction(
  accountId: string,
  eventType: UserCapitalEventType,
  amount: string,
  note?: string,
): Promise<FundingResult<void>> {
  const supabase = await createClient();
  const result = await registrarEventoCapital(supabase, accountId, eventType, amount, note);
  if (result.ok) {
    // Ambas rutas cachean current_capital de esta Cuenta — el Dashboard
    // (lista) y el Detalle. Revalidar solo una de las dos dejaría la otra
    // con el capital desactualizado hasta la próxima invalidación.
    revalidatePath(`/cuentas/${accountId}`);
    revalidatePath("/cuentas");
  }
  return result;
}
