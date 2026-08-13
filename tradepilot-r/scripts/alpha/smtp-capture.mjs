// Servidor SMTP de captura para el entorno Alpha — el equivalente de Inbucket
// en el stack de Supabase, reducido a lo único que hace falta: recibir el
// correo del magic link y dejar su enlace a mano.
//
// No falsifica nada del flujo de autenticación: GoTrue envía un correo real
// por SMTP y este proceso lo recibe. El enlace que imprime es el que GoTrue
// generó, con su token real.
import net from "node:net";
import { writeFileSync, appendFileSync } from "node:fs";

const PORT = 2500;
const BUZON = "/tmp/tpalpha/buzon.txt";
writeFileSync(BUZON, "");

net
  .createServer((socket) => {
    let buffer = "";
    let enDatos = false;
    let mensaje = "";
    socket.write("220 tpalpha SMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let i;
      while ((i = buffer.indexOf("\r\n")) !== -1) {
        const linea = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (enDatos) {
          if (linea === ".") {
            enDatos = false;
            const decodificado = mensaje
              .replace(/=\r?\n/g, "")
              .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
              .replace(/&amp;/g, "&");
            const enlaces = decodificado.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
            appendFileSync(BUZON, `\n--- correo ---\n${enlaces.join("\n")}\n`);
            for (const e of enlaces) console.log("MAGIC LINK:", e);
            mensaje = "";
            socket.write("250 OK\r\n");
          } else {
            mensaje += linea + "\n";
          }
          continue;
        }
        const cmd = linea.split(" ")[0]?.toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") socket.write("250-tpalpha\r\n250 AUTH LOGIN PLAIN\r\n");
        else if (cmd === "AUTH") socket.write("235 OK\r\n");
        else if (cmd === "MAIL" || cmd === "RCPT") socket.write("250 OK\r\n");
        else if (cmd === "DATA") { enDatos = true; socket.write("354 End with .\r\n"); }
        else if (cmd === "QUIT") { socket.write("221 Bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
    });
    socket.on("error", () => {});
  })
  .listen(PORT, "127.0.0.1", () => console.log(`SMTP de captura escuchando en 127.0.0.1:${PORT} · buzón: ${BUZON}`));
