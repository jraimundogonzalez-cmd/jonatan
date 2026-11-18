// @vitest-environment node
//
// Cabeceras HTTP de seguridad (next.config.mjs, DEC-015 pendiente de aprobar).
//
// No repite las cadenas de la configuración: carga el next.config.mjs real,
// ejecuta su headers() en producción y en desarrollo, resuelve qué cabeceras
// recibe cada ruta con el MISMO comparador que usa Next.js para las cabeceras
// personalizadas (getPathMatch + modifyRouteRegex, como en
// next/dist/server/lib/router-utils/filesystem.js) y comprueba propiedades de
// seguridad sobre la CSP analizada por directivas. Las rutas salen del
// directorio app/ (los page.tsx y route.ts que existen), no de una lista
// escrita a mano: una página nueva queda cubierta sin tocar este test.
//
// Lo que este test NO cubre: que el servidor (`next start`) o la plataforma
// de alojamiento envíen de verdad estas cabeceras. Eso se comprobó a mano el
// 2026-11-17 con `next start` + `curl -I` (12_BUILD024_RESCUE_HANDOFF.md §24.5)
// y queda pendiente en Netlify/Vercel.
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { afterEach, describe, expect, it, vi } from "vitest";

type Cabecera = { key: string; value: string };
type Regla = { source: string; headers: Cabecera[] };

async function reglasEn(nodeEnv: "production" | "development"): Promise<Regla[]> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const config = (await import("../../next.config.mjs")).default;
  if (typeof config.headers !== "function") throw new Error("next.config.mjs no define headers()");
  return (await config.headers()) as Regla[];
}

// Las cabeceras que recibe una ruta: todas las reglas cuyo `source` la captura,
// con las mismas opciones con que Next.js construye las cabeceras personalizadas.
function cabecerasDe(reglas: Regla[], ruta: string): Map<string, string[]> {
  const resultado = new Map<string, string[]>();
  for (const regla of reglas) {
    const coincide = getPathMatch(regla.source, {
      strict: true,
      removeUnnamedParams: true,
      regexModifier: (regex: string) => modifyRouteRegex(regex),
    });
    if (coincide(ruta) === false) continue;
    for (const { key, value } of regla.headers) {
      const k = key.toLowerCase();
      resultado.set(k, [...(resultado.get(k) ?? []), value]);
    }
  }
  return resultado;
}

// Rutas reales a partir de app/: grupos `(x)` fuera, segmentos `[x]` con un UUID.
function rutasDeLaApp(): string[] {
  const raiz = fileURLToPath(new URL("../../app", import.meta.url));
  const rutas: string[] = [];
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/^(page|route)\.tsx?$/.test(nombre)) {
        const segmentos = relative(raiz, dir)
          .split(sep)
          .filter((s) => s !== "" && !/^\(.*\)$/.test(s))
          .map((s) => (/^\[.*\]$/.test(s) ? "1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516" : s));
        rutas.push("/" + segmentos.join("/"));
      }
    }
  };
  recorrer(raiz);
  return rutas;
}

// "a b; c d e" → { a: ["b"], c: ["d", "e"] }
function analizarCsp(valor: string): Map<string, string[]> {
  const directivas = new Map<string, string[]>();
  for (const parte of valor.split(";")) {
    const [nombre, ...fuentes] = parte.trim().split(/\s+/);
    if (!nombre) continue;
    expect(directivas.has(nombre), `directiva repetida: ${nombre}`).toBe(false);
    directivas.set(nombre.toLowerCase(), fuentes);
  }
  return directivas;
}

const unica = (cabeceras: Map<string, string[]>, nombre: string): string => {
  const valores = cabeceras.get(nombre) ?? [];
  expect(valores, `${nombre}: debe enviarse exactamente una vez`).toHaveLength(1);
  return valores[0] as string;
};

const RUTAS_ESTATICAS = ["/_next/static/chunks/webpack-0123456789abcdef.js", "/_next/static/css/app.css", "/favicon.ico"];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cabeceras de seguridad de next.config.mjs", () => {
  it("se encuentran rutas reales en app/ (si no, el resto del test no probaría nada)", () => {
    const rutas = rutasDeLaApp();
    expect(rutas).toEqual(expect.arrayContaining(["/login", "/auth/confirm", "/cuentas", "/importar"]));
    expect(rutas.length).toBeGreaterThanOrEqual(18);
  });

  it("en producción, todas las rutas y los estáticos reciben las cabeceras, una vez cada una", async () => {
    const reglas = await reglasEn("production");
    for (const ruta of [...rutasDeLaApp(), ...RUTAS_ESTATICAS]) {
      const c = cabecerasDe(reglas, ruta);
      expect(unica(c, "x-content-type-options"), ruta).toBe("nosniff");
      expect(unica(c, "x-frame-options"), ruta).toBe("DENY");
      expect(unica(c, "referrer-policy"), ruta).toBe("strict-origin-when-cross-origin");
      unica(c, "permissions-policy");
      unica(c, "content-security-policy");
      unica(c, "content-security-policy-report-only");
      expect(c.has("strict-transport-security"), `${ruta}: HSTS no debe fijarse hasta el dominio definitivo`).toBe(false);
    }
  });

  it("la CSP aplicada solo contiene directivas que no pueden romper la app, y las contiene todas", async () => {
    const reglas = await reglasEn("production");
    const csp = analizarCsp(unica(cabecerasDe(reglas, "/login"), "content-security-policy"));

    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    // Nada que pueda bloquear scripts, estilos o conexiones mientras la
    // política completa no se haya recorrido con sesión (DEC-015).
    expect([...csp.keys()].sort()).toEqual(["base-uri", "form-action", "frame-ancestors", "object-src"]);
  });

  it("la política en informe incluye todo lo aplicado y no abre orígenes externos ni eval", async () => {
    const reglas = await reglasEn("production");
    const c = cabecerasDe(reglas, "/cuentas");
    const aplicada = analizarCsp(unica(c, "content-security-policy"));
    const informe = analizarCsp(unica(c, "content-security-policy-report-only"));

    for (const [directiva, fuentes] of aplicada) {
      expect(informe.get(directiva), `informe sin ${directiva}`).toEqual(fuentes);
    }
    expect(informe.get("default-src")).toEqual(["'self'"]);
    // El navegador no habla con Supabase: todo pasa por Server Actions.
    expect(informe.get("connect-src")).toEqual(["'self'"]);
    const permitidas = new Set(["'self'", "'none'", "'unsafe-inline'", "data:", "blob:"]);
    for (const [directiva, fuentes] of informe) {
      for (const fuente of fuentes) {
        expect(permitidas.has(fuente), `${directiva} admite una fuente no prevista: ${fuente}`).toBe(true);
      }
    }
    expect([...informe.values()].flat()).not.toContain("'unsafe-eval'");
  });

  it("Permissions-Policy desactiva cada función que nombra", async () => {
    const reglas = await reglasEn("production");
    const valor = unica(cabecerasDe(reglas, "/login"), "permissions-policy");
    const funciones = valor.split(",").map((f) => f.trim());
    expect(funciones.length).toBeGreaterThan(0);
    for (const f of funciones) expect(f, f).toMatch(/^[a-z-]+=\(\)$/);
  });

  it("en desarrollo se mantiene la CSP aplicada pero no se envía la de informe", async () => {
    const reglas = await reglasEn("development");
    for (const ruta of ["/login", "/cuentas", ...RUTAS_ESTATICAS]) {
      const c = cabecerasDe(reglas, ruta);
      expect(c.has("content-security-policy-report-only"), ruta).toBe(false);
      expect(analizarCsp(unica(c, "content-security-policy")).get("frame-ancestors"), ruta).toEqual(["'none'"]);
      expect(unica(c, "x-frame-options"), ruta).toBe("DENY");
    }
  });
});
