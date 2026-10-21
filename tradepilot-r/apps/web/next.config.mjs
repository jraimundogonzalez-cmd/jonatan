/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // El importador recibe el .xlsx por una Server Action. El límite por
    // defecto (1 MB) es menor que el máximo que admite el conector (2 MB,
    // packages/connectors/src/fichero.ts); se deja margen para el multipart.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // exceljs es una librería de Node: se carga tal cual en el servidor en vez de
  // empaquetarse. En Next 15 esta opción sale de `experimental`.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
