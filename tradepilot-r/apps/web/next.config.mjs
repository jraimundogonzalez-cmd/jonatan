import { fileURLToPath } from "node:url";

// Cabeceras de seguridad HTTP, en todas las respuestas.
//
// La CSP va en dos niveles, a propósito:
//   - APLICADA: solo directivas que no pueden romper la aplicación (nadie puede
//     incrustarla en un marco, ni cambiar la base de las URL, ni enviar sus
//     formularios a otro sitio, ni cargar plugins).
//   - SOLO INFORME (Report-Only), y solo en producción: la política completa.
//     El navegador avisa en la consola de lo que bloquearía, sin bloquearlo.
//     Next.js App Router inyecta scripts en línea para hidratar y varias
//     páginas usan `style={{…}}`, así que scripts y estilos necesitan
//     'unsafe-inline' hasta que haya nonces (exigiría generarlos en el
//     middleware y renderizar todo de forma dinámica). El navegador no habla
//     con Supabase (todo pasa por Server Actions), por eso connect-src 'self'.
//     En `next dev` no se envía: el servidor de desarrollo usa eval y un
//     websocket que la política marcaría sin motivo.
//
// Strict-Transport-Security NO se fija aquí: solo tiene sentido con el dominio
// HTTPS definitivo, que aún no está elegido (ver docs/context/07_SECURITY.md).
const cspAplicada = ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"];

const cspInforme = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  ...cspAplicada,
];

const cabecerasDeSeguridad = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: cspAplicada.join("; ") },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy-Report-Only", value: cspInforme.join("; ") }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabecerasDeSeguridad }];
  },
  experimental: {
    // El importador recibe el .xlsx por una Server Action. El límite por
    // defecto (1 MB) es menor que el máximo que admite el conector (2 MB,
    // packages/connectors/src/fichero.ts); se deja margen para el multipart.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // exceljs es una librería de Node: se carga tal cual en el servidor en vez de
  // empaquetarse. En Next 15 esta opción sale de `experimental`.
  serverExternalPackages: ["exceljs"],
  // Raíz del monorepo de TradePilot R (la carpeta con apps/ y packages/), no
  // la raíz de git: allí hay otra aplicación con su propio package-lock.json, y
  // Next.js, sin esta opción, toma el lockfile más alto como raíz y avisa.
  // Se calcula desde este fichero, no desde el directorio de trabajo.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
};

export default nextConfig;
