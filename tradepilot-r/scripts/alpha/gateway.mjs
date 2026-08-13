// Gateway del entorno Alpha — el papel que Kong cumple en el stack de Supabase:
// una sola URL que enruta `/rest/v1/*` a PostgREST y `/auth/v1/*` a Auth.
//
// Es enrutado puro. No inspecciona cuerpos, no toca los JWT, no añade ni
// quita cabeceras de autorización, y no conoce ni una regla del dominio.
// Existe porque `@supabase/supabase-js` construye sus URLs con esos prefijos
// y los dos servicios escuchan en puertos distintos.
import http from "node:http";

const DESTINOS = [
  { prefijo: "/rest/v1", puerto: 54320 },
  { prefijo: "/auth/v1", puerto: 54322 },
];

http
  .createServer((req, res) => {
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
