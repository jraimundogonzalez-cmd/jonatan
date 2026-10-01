import { describe, expect, it } from "vitest";
import { sanitizeRedirectTarget } from "@/lib/validation/redirect";

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
});
