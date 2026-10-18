// Los lanzadores y scripts de Windows nunca ejecutan ni proponen un borrado de
// la base. Es un grep sobre los ficheros reales, igual que fronteras.test.ts:
// detecta también el que alguien añada mañana.
//
// Una mención solo se admite como comentario (REM, #) o dentro de un aviso que
// diga explícitamente que NO se haga. Cualquier otra línea con uno de estos
// comandos —una ejecución, o un `echo` que lo sugiera— hace fallar el test.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROYECTO = join(__dirname, "..", "..", "..", "..");
const PELIGROSOS = /db\s+reset|--no-backup|docker\s+volume\s+(rm|prune)|volume\s+prune|dropdb|drop\s+database/i;

function ficheros(): { ruta: string; lineas: string[] }[] {
  const bats = readdirSync(PROYECTO).filter((f) => f.toLowerCase().endsWith(".bat")).map((f) => join(PROYECTO, f));
  const dirPs = join(PROYECTO, "scripts", "windows");
  const ps1 = readdirSync(dirPs).filter((f) => f.endsWith(".ps1")).map((f) => join(dirPs, f));
  const sh = [join(PROYECTO, "scripts", "respaldo", "verificar-respaldo.sh")];
  return [...bats, ...ps1, ...sh].map((ruta) => ({ ruta, lineas: readFileSync(ruta, "utf8").split(/\r?\n/) }));
}

function esComentario(linea: string): boolean {
  return /^\s*(rem\b|::|#)/i.test(linea);
}

function esAvisoDeNoHacerlo(linea: string): boolean {
  return /\b(no uses|no intentes|nunca|jamas|borraria|no se usa|no lo hagas)\b/i.test(linea);
}

describe("los lanzadores no borran la base de datos", () => {
  it("hay lanzadores y scripts que comprobar", () => {
    const nombres = ficheros().map((f) => f.ruta);
    expect(nombres.some((n) => n.endsWith("Abrir_TradePilot.bat"))).toBe(true);
    expect(nombres.some((n) => n.endsWith("actualizar.ps1"))).toBe(true);
  });

  it("ninguna línea ejecuta ni sugiere db reset, --no-backup, borrar volúmenes ni dropdb", () => {
    const infractoras: string[] = [];
    for (const { ruta, lineas } of ficheros()) {
      lineas.forEach((linea, i) => {
        if (PELIGROSOS.test(linea) && !esComentario(linea) && !esAvisoDeNoHacerlo(linea)) {
          infractoras.push(`${ruta.slice(PROYECTO.length + 1)}:${i + 1}: ${linea.trim()}`);
        }
      });
    }
    expect(infractoras).toEqual([]);
  });

  it("los .bat son solo ASCII (cmd.exe y PowerShell 5.1 estropean las tildes)", () => {
    for (const { ruta, lineas } of ficheros()) {
      if (!ruta.endsWith(".bat") && !ruta.endsWith(".ps1")) continue;
      // eslint-disable-next-line no-control-regex
      expect(lineas.filter((l) => /[^\x00-\x7F]/.test(l)), ruta).toEqual([]);
    }
  });
});
