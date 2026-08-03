"use server";

import { createClient } from "@/lib/supabase/server";
import { crearEmpresa } from "@/lib/api/funding";
import type { FundingResult, PropFirm } from "@/types/funding";

/**
 * Onboarding, opción "Capital propio" (mvp-0.1.md §5, paso 4): crea la
 * Empresa personal automáticamente, sin pedir nombre (I18 Automation Before
 * Interaction) — "Personal" es editable después, no fijo para siempre.
 */
export async function crearEmpresaPersonalAction(): Promise<FundingResult<PropFirm>> {
  const supabase = await createClient();
  return crearEmpresa(supabase, { name: "Personal", is_personal: true });
}

/** Onboarding, opción "Prop firm": el usuario aporta el nombre. */
export async function crearEmpresaPropFirmAction(name: string): Promise<FundingResult<PropFirm>> {
  const supabase = await createClient();
  return crearEmpresa(supabase, { name, is_personal: false });
}
