// Saneamiento de un destino de redirección controlado por el usuario
// (query param `redirectTo`/`next`) — sin esto, un enlace manipulado podría
// usar TradePilot como salto abierto (open redirect) hacia un dominio externo
// (p.ej. `redirectTo=https://phishing.example`). Solo se acepta una ruta
// relativa dentro de la propia app.
//
// Comprobar el texto a mano no basta: el navegador normaliza la URL antes de
// seguirla. `/\evil.example` y `/<TAB>/evil.example` pasaban el filtro
// anterior (empiezan por una sola `/`) y el navegador los resuelve a
// `https://evil.example/` (la barra invertida cuenta como `/` y el tabulador
// se descarta). Por eso el destino se resuelve con el mismo analizador de URL
// que usan los navegadores (WHATWG) y se exige que siga en el mismo origen.

// Origen ficticio contra el que se resuelve el destino. `.invalid` está
// reservado (RFC 2606): nunca coincide con un dominio real.
const BASE = "https://tradepilot.invalid";

// Barra invertida y caracteres de control (tabulador y saltos de línea
// incluidos): el analizador de URL los normaliza o descarta en silencio.
function tieneCaracterProhibido(texto: string): boolean {
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c === 0x5c || c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

function escapaDelOrigen(texto: string): boolean {
  return tieneCaracterProhibido(texto) || texto.startsWith("//");
}

export function sanitizeRedirectTarget(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw === "") return "/";
  if (!raw.startsWith("/") || escapaDelOrigen(raw)) return "/";

  // Variantes codificadas (`/%5Cevil.example`, `/%2F%2Fevil.example`): hoy el
  // navegador las deja dentro del mismo origen, pero un proxy o una capa que
  // decodifique una vez más las convertiría en un salto. Ninguna ruta de
  // TradePilot las necesita, así que se rechazan.
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (escapaDelOrigen(decodificado)) return "/";

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";

  // La forma normalizada (`/a/../b` → `/b`) es la que se devuelve, para que
  // lo que se valida sea exactamente lo que se sigue. `/..//evil.example`
  // normaliza a `//evil.example` y se rechaza aquí.
  const destino = url.pathname + url.search + url.hash;
  if (!destino.startsWith("/") || destino.startsWith("//")) return "/";
  return destino;
}
