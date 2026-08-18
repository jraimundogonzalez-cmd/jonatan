"use server";

// Autenticación passwordless (Supabase magic link, 01 §3.6, mvp-0.1.md §5).
// Login y Registro son el mismo flujo: signInWithOtp crea la cuenta en el
// primer envío si no existe (comportamiento de Supabase Auth por defecto) —
// es una decisión ya aprobada del blueprint (Zero Friction, I16: nunca dos
// formularios distintos para "entrar" y "darse de alta"), no una omisión de
// esta entrega.
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "@/lib/validation/email";
import { sanitizeRedirectTarget } from "@/lib/validation/redirect";

export type SignInResult = { ok: true } | { ok: false; message: string };

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export async function signInWithMagicLink(rawEmail: string, redirectTo?: string): Promise<SignInResult> {
  const validation = validateEmail(rawEmail);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const origin = await getOrigin();
  const next = sanitizeRedirectTarget(redirectTo);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: validation.value,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    return { ok: false, message: "No se ha podido enviar el enlace de acceso. Inténtalo de nuevo." };
  }

  return { ok: true };
}

/**
 * No llama a `redirect()` aquí a propósito: esta acción se invoca de forma
 * imperativa desde un Client Component (LogoutButton), no desde un <form
 * action={...}> — `redirect()` funciona lanzando una excepción de control de
 * flujo especial que un `try/catch` del lado cliente capturaría por error
 * como un fallo real. El cliente hace `router.push("/login")` tras esperar
 * a que esta acción termine; el middleware es además una red de seguridad
 * independiente que ya redirige cualquier ruta protegida sin sesión.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
