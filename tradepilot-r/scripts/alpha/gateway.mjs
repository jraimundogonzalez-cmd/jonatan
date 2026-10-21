// Gateway del entorno Alpha — el papel que Kong cumple en el stack de Supabase:
// una sola URL que enruta `/rest/v1/*` a PostgREST y `/auth/v1/*` a Auth.
//
// Es enrutado puro. No inspecciona cuerpos, no toca los JWT, no añade ni
// quita cabeceras de autorización, y no conoce ni una regla del dominio.
// Existe porque `@supabase/supabase-js` construye sus URLs con esos prefijos
// y los dos servicios escuchan en puertos distintos.
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

const DESTINOS = [
  { prefijo: "/rest/v1", puerto: 54320 },
  { prefijo: "/auth/v1", puerto: 54322 },
];

/**
 * BUILD 023 — las plantillas de correo, servidas por HTTP.
 *
 * GoTrue descarga sus plantillas con `http.DefaultClient` (ver
 * internal/mailer/templatemailer/template.go en su fuente): una URL `file://`
 * se ignora **en silencio** y se usa la plantilla por defecto. Se descubrió
 * intentando entrar por primera vez: el enlace del correo llevaba a
 * `/auth/auth-code-error` sin ningún error visible en los registros.
 *
 * Esto no es enrutado, pero es el único proceso del entorno que ya habla HTTP
 * y que GoTrue puede alcanzar. Sirve ficheros estáticos de `plantillas/` y
 * nada más: no lee la base, no toca sesiones y no conoce el dominio.
 */
const PLANTILLAS = "/plantillas/";

http
  .createServer((req, res) => {
    if (req.url.startsWith(PLANTILLAS)) {
      const nombre = req.url.slice(PLANTILLAS.length).replace(/[^a-z0-9.-]/gi, "");
      try {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(readFileSync(join(AQUI, "plantillas", nombre)));
      } catch {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("plantilla no encontrada");
      }
      return;
    }
    const destino = DESTINOS.find((d) => req.url.startsWith(d.prefijo));
    if (!destino) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "ruta no enrutada por el gateway Alpha" }));
      return;
    }
    const camino = req.url.slice(destino.prefijo.length) || "/";
    const proxy = http.request(
      { host: "127.0.0.1", port: destino.puerto, path: camino, method: req.method, headers: req.headers },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    proxy.on("error", (e) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: `servicio Alpha no disponible: ${e.message}` }));
    });
    req.pipe(proxy);
  })
  .listen(54321, "127.0.0.1", () => console.log("Gateway Alpha en http://127.0.0.1:54321"));
