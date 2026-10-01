// Validación de email — defensa en profundidad (mvp-0.1.md §10.2: el
// formulario nunca envía el request sin validar antes, la API también lo
// verifica). No pretende cubrir RFC 5322 completo — solo rechazar entradas
// obviamente inválidas antes de gastar un round-trip contra Supabase Auth.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "Introduce tu email" };
  }
  if (!EMAIL_RE.test(value)) {
    return { ok: false, message: "Ese email no parece válido" };
  }
  return { ok: true, value };
}
