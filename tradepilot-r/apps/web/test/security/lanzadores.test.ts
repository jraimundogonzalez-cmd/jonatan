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

  /**
   * Única excepción: la prueba de restauración borra la base TEMPORAL que ella
   * misma creó. Se admite solo esa línea, en ese fichero, y solo mientras el
   * borrado siga dentro de la comprobación del patrón de nombre.
   */
  function esBorradoDeBaseTemporal(ruta: string, linea: string, texto: string): boolean {
    return (
      ruta.endsWith("probar-restauracion.ps1") &&
      /drop database if exists \$temporal"/.test(linea) &&
      texto.includes("$PatronTemporal = '^tp_prueba_restauracion_\\d{8}_\\d{6}$'") &&
      /if \(\$temporal -and \$temporal -match \$PatronTemporal\)/.test(texto)
    );
  }

  it("ninguna línea ejecuta ni sugiere db reset, --no-backup, borrar volúmenes ni dropdb", () => {
    const infractoras: string[] = [];
    for (const { ruta, lineas } of ficheros()) {
      const texto = lineas.join("\n");
      lineas.forEach((linea, i) => {
        if (PELIGROSOS.test(linea) && !esComentario(linea) && !esAvisoDeNoHacerlo(linea) && !esBorradoDeBaseTemporal(ruta, linea, texto)) {
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

describe("el servidor web solo escucha en este ordenador", () => {
  it("dev y start se atan a 127.0.0.1, no a todas las interfaces", () => {
    // Next.js 14 escucha por defecto en todas las interfaces: cualquiera en tu
    // red local llega al servidor. Atado a 127.0.0.1 solo llega este PC. Es la
    // mitigación disponible para CVE-2026-75604 (RCE en servidores Windows)
    // mientras no se suba de versión (ver docs/context/10_CURRENT_STATUS.md).
    const pkg = JSON.parse(readFileSync(join(PROYECTO, "apps", "web", "package.json"), "utf8"));
    expect(pkg.scripts.dev).toMatch(/-H 127\.0\.0\.1\b/);
    expect(pkg.scripts.start).toMatch(/-H 127\.0\.0\.1\b/);
  });
});

describe("la referencia de esquema del diagnóstico está al día", () => {
  const esperado = readFileSync(join(PROYECTO, "supabase", "esquema-esperado.txt"), "utf8");

  it("lista exactamente las migraciones del repositorio (si no, hay que regenerarla)", () => {
    // scripts/esquema/generar-esquema-esperado.sh la regenera. Si se añade una
    // migración y no se regenera, el diagnóstico bloquearía con razón.
    const enReferencia = [...esperado.matchAll(/^# migracion (\S+)$/gm)].map((m) => m[1]);
    const enRepo = readdirSync(join(PROYECTO, "supabase", "migrations"))
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .map((f) => f.replace(/\.sql$/, ""))
      .sort();
    expect(enReferencia).toEqual(enRepo);
  });

  it("cada objeto esperado dice de qué migración o fichero de funciones sale", () => {
    const lineas = esperado.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    expect(lineas.length).toBeGreaterThan(100);
    for (const l of lineas) expect(l).toMatch(/^(migracion:\d+_[\w]+|funciones:[\w]+\.sql)\|(tabla|vista|columna|funcion|trigger|politica|indice|tipo)\|.+/);
  });

  it("la consulta de objetos no lleva comillas dobles (PowerShell 5.1 las pasa mal a docker)", () => {
    const sql = readFileSync(join(PROYECTO, "scripts", "esquema", "objetos.sql"), "utf8")
      .split(/\r?\n/)
      .filter((l) => !/^\s*--/.test(l));
    expect(sql.join("\n")).not.toContain('"');
    expect(sql.join("\n")).not.toMatch(/--/);
  });

  it("los informes de diagnóstico y las copias no van al repositorio", () => {
    const gi = readFileSync(join(PROYECTO, ".gitignore"), "utf8");
    expect(gi).toMatch(/^diagnosticos\/$/m);
    expect(gi).toMatch(/^respaldos\/$/m);
    expect(gi).toMatch(/^\*\.dump$/m);
  });
});
