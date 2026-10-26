// Verifica el magic link (Supabase Auth, mvp-0.1.md §5, paso 3) y crea la
// sesión. El trigger on_auth_user_created ya insertó la fila en profiles en
// el momento del signInWithOtp — aquí solo se intercambia el token por sesión.
//
// Dos formas de enlace, según la plantilla de correo del proyecto:
//   - token_hash + type: plantilla propia (supabase/templates/magic-link.html),
//     la de la base local.
//   - code: plantilla predeterminada de Supabase con el flujo PKCE de
//     @supabase/ssr (los proyectos Free nuevos con el correo predeterminado no
//     pueden cambiarla). El verificador PKCE lo guardó signInWithMagicLink en
//     una cookie, así que el enlace solo sirve en el mismo navegador.
// Cualquier fallo (parámetros ausentes, código caducado o ya usado, falta la
// cookie del verificador) acaba en /auth/auth-code-error, sin mostrar el
// motivo ni registrar el token.
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectTarget } from "@/lib/validation/redirect";

export async function GET(request: NextRequest): Promise<never> {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = sanitizeRedirectTarget(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  redirect("/auth/auth-code-error");
}
