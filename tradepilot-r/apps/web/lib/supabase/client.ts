// Cliente de Supabase para Client Components (navegador).
// Nunca debe recibir la service_role key — solo la anon key pública
// (implementation/mvp-0.1.md §13.3).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
