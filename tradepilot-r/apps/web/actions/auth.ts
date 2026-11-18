"use server";

// Autenticación passwordless (Supabase magic link, 01 §3.6, mvp-0.1.md §5).
// Login y Registro son el mismo flujo: signInWithOtp crea la cuenta en el
// primer envío si no existe (comportamiento de Supabase Auth por defecto) —
// es una decisión ya aprobada del blueprint (Zero Friction, I16: nunca dos
// formularios distintos para "entrar" y "darse de alta"), no una omisión de
// esta entrega.
import { obtenerOrigenCanonico, VARIABLE_ORIGEN } from "@/lib/config/origen";
import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "@/lib/validation/email";
import { sanitizeRedirectTarget } from "@/lib/validation/redirect";

export type SignInResult = { ok: true } | { ok: false; message: string };

export async function signInWithMagicLink(rawEmail: string, redirectTo?: string): Promise<SignInResult> {
  const validation = validateEmail(rawEmail);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  // El origen del enlace es configuración del servidor (lib/config/origen.ts),
  // nunca las cabeceras Host / x-forwarded-host, que las escribe el cliente.
  const origen = obtenerOrigenCanonico();
  if (!origen.ok) {
    console.error(`[auth] ${origen.error}: ${VARIABLE_ORIGEN} ${origen.motivo}. No se envía el enlace de acceso.`);
    return { ok: false, message: "El acceso no está disponible: falta configurar la dirección del sitio." };
  }
  const origin = origen.origen;
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
