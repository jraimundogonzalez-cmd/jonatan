import { describe, expect, it } from "vitest";
import { sanitizeRedirectTarget } from "@/lib/validation/redirect";

// Lo que haría el navegador con el destino devuelto: resolverlo contra la
// página actual con el analizador de URL WHATWG. Si sale de este origen, el
// saneador ha fallado, diga lo que diga la cadena.
const APP = "https://app.tradepilot.example";
function seguido(destino: string): URL {
  return new URL(destino, `${APP}/auth/confirm`);
}

describe("sanitizeRedirectTarget", () => {
  it("acepta una ruta relativa normal", () => {
    expect(sanitizeRedirectTarget("/cuentas/abc-123")).toBe("/cuentas/abc-123");
  });

  it("usa '/' cuando no se aporta ningún valor", () => {
    expect(sanitizeRedirectTarget(undefined)).toBe("/");
    expect(sanitizeRedirectTarget(null)).toBe("/");
    expect(sanitizeRedirectTarget("")).toBe("/");
  });

  it("rechaza un salto abierto protocol-relative (//host)", () => {
    expect(sanitizeRedirectTarget("//evil.example/phishing")).toBe("/");
  });

  it("rechaza una URL absoluta a otro dominio", () => {
    expect(sanitizeRedirectTarget("https://evil.example/phishing")).toBe("/");
  });

  it("rechaza una cadena que no empieza por /", () => {
    expect(sanitizeRedirectTarget("cuentas")).toBe("/");
  });

  describe("variantes que el navegador normaliza fuera del origen", () => {
    it.each([
      ["barra invertida", "/\\evil.example"],
      ["barra invertida doble", "/\\\\evil.example"],
      ["barra y barra invertida", "//\\evil.example"],
      ["barra invertida tras ruta", "/\\/evil.example/phishing"],
      ["tabulador", "/\t/evil.example"],
      ["salto de línea", "/\n/evil.example"],
      ["retorno de carro", "/\r/evil.example"],
      ["carácter nulo", "/\u0000/evil.example"],
      ["DEL", "/\u007f/evil.example"],
      ["triple barra", "///evil.example"],
      ["subida que normaliza a //", "/..//evil.example"],
      ["punto y barra", "/.//evil.example"],
      ["esquema con mayúsculas", "HTTPS://evil.example"],
      ["javascript:", "javascript:alert(1)"],
      ["data:", "data:text/html,<script>alert(1)</script>"],
      ["espacio inicial", " /cuentas"],
    ])("rechaza %s", (_caso, destino) => {
      expect(sanitizeRedirectTarget(destino)).toBe("/");
    });

    it.each([
      ["barra invertida codificada", "/%5Cevil.example"],
      ["barra invertida codificada en minúscula", "/%5cevil.example"],
      ["doble barra codificada", "/%2F%2Fevil.example"],
      ["doble barra codificada mixta", "/%2f/evil.example"],
      ["tabulador codificado", "/%09/evil.example"],
      ["salto de línea codificado", "/%0A/evil.example"],
      ["codificación inválida", "/%E0%A4%A"],
    ])("rechaza %s", (_caso, destino) => {
      expect(sanitizeRedirectTarget(destino)).toBe("/");
    });
  });

  describe("rutas internas legítimas de TradePilot R", () => {
    it.each([
      "/",
      "/cuentas",
      "/cuentas/nueva",
      "/cuentas/1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516",
      "/cuentas/1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516/operaciones/nueva",
      "/cuentas/1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516/importaciones/9a8b7c6d-5e4f-4321-8765-0a1b2c3d4e5f",
      "/operaciones/1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516/cerrar",
      "/onboarding/empresa",
      "/importar",
      "/cuentas?orden=fecha",
      "/operaciones/abc#parciales",
    ])("conserva %s", (destino) => {
      expect(sanitizeRedirectTarget(destino)).toBe(destino);
    });

    it("normaliza segmentos . y .. dentro del propio origen", () => {
      expect(sanitizeRedirectTarget("/cuentas/../importar")).toBe("/importar");
      expect(sanitizeRedirectTarget("/cuentas/./nueva")).toBe("/cuentas/nueva");
    });
  });

  it("ningún destino devuelto sale del origen al seguirlo como un navegador", () => {
    const entradas = [
      "/\\evil.example", "/\t/evil.example", "/%5Cevil.example", "//evil.example", "/..//evil.example",
      "https://evil.example", "/cuentas", "/cuentas?x=1", "/%2F%2Fevil.example", "///evil.example",
    ];
    for (const entrada of entradas) {
      expect(seguido(sanitizeRedirectTarget(entrada)).origin).toBe(APP);
    }
  });
});
