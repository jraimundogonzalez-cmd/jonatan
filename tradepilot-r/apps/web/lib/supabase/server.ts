// Cliente de Supabase para Server Components / Route Handlers.
// Usa la anon key + cookies de sesión — nunca la service_role key
// (implementation/mvp-0.1.md §13.3, riesgo técnico #3).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Se llama desde un Server Component sin permiso de escritura de cookies —
            // seguro de ignorar si hay middleware refrescando la sesión.
          }
        },
      },
    },
  );
}
