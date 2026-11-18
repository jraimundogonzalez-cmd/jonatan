// Origen canónico de la web (esquema + dominio + puerto), para construir los
// enlaces que salen de TradePilot hacia el correo del usuario: hoy, el enlace
// mágico de acceso.
//
// Antes salía de las cabeceras `Host` / `x-forwarded-host` de la petición, que
// las escribe el cliente. Si la lista de redirecciones de Supabase Auth
// aceptaba ese dominio (un comodín como `*.netlify.app` basta), un atacante
// podía pedir un enlace para el correo de otra persona con un `Host` suyo: el
// código PKCE llegaba a su servidor y, con el verificador en su propio
// navegador, abría la sesión de la víctima. Ahora el origen es configuración
// del servidor, nunca un dato del visitante.
//
// TP_SITE_URL es una variable de SERVIDOR: sin prefijo NEXT_PUBLIC_, no llega
// al navegador porque el navegador no la necesita.
//   - Producción (`next build` / `next start`, Netlify, Vercel): obligatoria.
//     Sin ella no se envía ningún enlace.
//   - Desarrollo (`next dev`, el que arranca Abrir_TradePilot.bat): si falta,
//     se usa http://localhost:3000, el origen local único que ya fija el
//     lanzador y que acepta el Supabase local (GOTRUE_URI_ALLOW_LIST). Es un
//     valor fijo, no algo que aporte el visitante.
import "server-only";

export const VARIABLE_ORIGEN = "TP_SITE_URL";
export const ORIGEN_DESARROLLO = "http://localhost:3000";

export type ErrorOrigen = "ORIGEN_NO_CONFIGURADO" | "ORIGEN_NO_VALIDO";
export type ResultadoOrigen = { ok: true; origen: string } | { ok: false; error: ErrorOrigen; motivo: string };

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Valida el valor configurado y lo reduce a su origen (`https://dominio`).
 * Solo se admite un origen limpio: https (o http en una máquina local), sin
 * usuario ni contraseña, sin ruta, sin consulta y sin fragmento. Cualquier otra
 * cosa es un error de configuración, no algo que corregir en silencio.
 */
export function validarOrigen(valor: string): ResultadoOrigen {
  const texto = valor.trim();
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, error: "ORIGEN_NO_VALIDO", motivo: "no es una URL absoluta" };
  }
  const local = HOSTS_LOCALES.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return { ok: false, error: "ORIGEN_NO_VALIDO", motivo: "debe usar https (http solo en localhost)" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, error: "ORIGEN_NO_VALIDO", motivo: "no puede llevar usuario ni contraseña" };
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return { ok: false, error: "ORIGEN_NO_VALIDO", motivo: "debe ser solo el origen, sin ruta, consulta ni fragmento" };
  }
  return { ok: true, origen: url.origin };
}

/** El origen canónico según el entorno del servidor. No lee ninguna cabecera. */
export function obtenerOrigenCanonico(env: NodeJS.ProcessEnv = process.env): ResultadoOrigen {
  const valor = env[VARIABLE_ORIGEN];
  if (valor !== undefined && valor.trim() !== "") return validarOrigen(valor);
  if (env.NODE_ENV === "development") return { ok: true, origen: ORIGEN_DESARROLLO };
  return { ok: false, error: "ORIGEN_NO_CONFIGURADO", motivo: "no está definida" };
}
