// Tests de FRONTERA, no de implementación. No comprueban que un botón llame a
// una función: comprueban que la aplicación no tenga vías que salten el
// dominio. Son grep sobre el árbol real, así que detectan también el código
// que alguien añada mañana sin leer esta cabecera.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const IGNORADOS = new Set(["node_modules", ".next", "test", ".turbo"]);

function ficherosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (IGNORADOS.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) ficherosFuente(ruta, acc);
    else if (/\.(ts|tsx)$/.test(entrada)) acc.push(ruta);
  }
  return acc;
}

/**
 * Los comentarios se eliminan antes de buscar, y no es un detalle: la primera
 * versión de estos tests falló porque la cabecera de `lib/api/operations.ts`
 * dice literalmente «si `aplicar_cierre_operacion` aparece alguna vez en este
 * fichero, la frontera se ha roto», y el propio aviso disparaba la alarma.
 * Igual con «nunca la service_role key» en los clientes de Supabase.
 *
 * Un test que no distingue una advertencia escrita de una llamada real no está
 * comprobando la frontera: está comprobando el vocabulario. Lo que importa es
 * el código ejecutable.
 */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
}

const FUENTES = ficherosFuente(RAIZ).map((ruta) => {
  const texto = readFileSync(ruta, "utf8");
  return { ruta, texto, codigo: sinComentarios(texto) };
});

function conteneidosEn(patron: RegExp): string[] {
  return FUENTES.filter((f) => patron.test(f.codigo)).map((f) => f.ruta.slice(RAIZ.length + 1));
}

describe("apps/web no puede saltarse el dominio", () => {
  it("no accede directamente a ninguna tabla: cero usos de .from(", () => {
    // Toda lectura y toda escritura pasan por una RPC. Un `.from("trades")`
    // devolvería filas saltándose el catálogo de lectura, y un `.insert()`
    // chocaría con los GRANT — pero el problema es antes: sería una segunda
    // vía de acceso que nadie está auditando.
    expect(conteneidosEn(/\.from\(/)).toEqual([]);
  });

  it("no usa nunca la service_role key", () => {
    // La service_role salta RLS por completo. El navegador y el servidor usan
    // ambos la anon key, y el aislamiento lo hace Postgres.
    expect(conteneidosEn(/service_role|SERVICE_ROLE/)).toEqual([]);
  });

  it("no invoca aplicar_cierre_operacion desde la aplicación", () => {
    // El cierre calcula R_final vía Quant Engine. Llamar a la RPC directamente
    // desde apps/web significaría que alguien está enviando un r_final que no
    // salió del motor — exactamente lo que BUILD 018 dejó documentado que
    // PostgreSQL no puede detectar.
    expect(conteneidosEn(/aplicar_cierre_operacion/)).toEqual([]);
  });

  it("no invoca aplicar_edicion_operacion desde la aplicación", () => {
    expect(conteneidosEn(/aplicar_edicion_operacion/)).toEqual([]);
  });

  it("no invoca crear_operacion_nucleo (tercera vía de nacimiento, revocada en 016B)", () => {
    expect(conteneidosEn(/crear_operacion_nucleo/)).toEqual([]);
  });
});

describe("apps/web no reimplementa el dominio", () => {
  it("no calcula R_final ni P&L en ningún sitio", () => {
    // La fórmula multiplica necesariamente un porcentaje de cierre por un nivel
    // de RR. Si ese producto no aparece, no hay una segunda implementación.
    // Misma comprobación estructural que la suite 14 hace sobre PostgreSQL.
    expect(conteneidosEn(/pct_close[^;\n]*\*[^;\n]*rr_level|rr_level[^;\n]*\*[^;\n]*pct_close/)).toEqual([]);
    expect(conteneidosEn(/risk_amount[^;\n]*\*[^;\n]*r_final|r_final[^;\n]*\*[^;\n]*risk_amount/)).toEqual([]);
  });

  it("el formulario de cierre no ofrece r_final, pnl_amount ni time_in_market_sec como campo", () => {
    const cierre = FUENTES.find((f) => f.ruta.endsWith("CierreForm.tsx"));
    expect(cierre).toBeDefined();
    // `name=` es lo que convierte algo en un campo enviado. Que aparezcan en
    // un `formatR(preview.r_final)` es lectura, no captura.
    expect(cierre!.codigo).not.toMatch(/name="r_final"/);
    expect(cierre!.codigo).not.toMatch(/name="pnl_amount"/);
    expect(cierre!.codigo).not.toMatch(/name="time_in_market_sec"/);
  });

  it("la cabecera de identidad no renderiza ningún campo editable", () => {
    // La identidad se muestra como texto, nunca como <input> deshabilitado:
    // un campo apagado sugiere que en otro contexto podría encenderse.
    const header = FUENTES.find((f) => f.ruta.endsWith("OperacionHeader.tsx"));
    expect(header).toBeDefined();
    expect(header!.codigo).not.toMatch(/<input|<Input|<select|<textarea/);
  });

  it("la corrección no marca el borrado de cierre_manual_rr por su cuenta", () => {
    // D1: el borrado es un acto declarado. Si el componente lo dedujera de
    // `closure_reason`, volvería a ser implícito y además tendría que conocer
    // las cuatro reglas de BUILD 018.
    const correccion = FUENTES.find((f) => f.ruta.endsWith("CorreccionForm.tsx"));
    expect(correccion).toBeDefined();
    expect(correccion!.codigo).not.toMatch(/setBorrarCierreManual\(true\)/);
  });
});
