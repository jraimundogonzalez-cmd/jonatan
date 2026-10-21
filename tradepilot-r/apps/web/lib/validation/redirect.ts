// Saneamiento de un destino de redirección controlado por el usuario
// (query param `redirectTo`/`next`) — sin esto, un enlace manipulado podría
// usar TradePilot como salto abierto (open redirect) hacia un dominio externo
// (p.ej. `redirectTo=https://phishing.example`). Solo se acepta una ruta
// relativa dentro de la propia app.
export function sanitizeRedirectTarget(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}
