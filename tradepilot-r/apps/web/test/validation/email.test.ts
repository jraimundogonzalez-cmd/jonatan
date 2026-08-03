import { describe, expect, it } from "vitest";
import { validateEmail } from "@/lib/validation/email";

describe("validateEmail", () => {
  it("acepta un email con forma válida", () => {
    const result = validateEmail("trader@tradepilot.app");
    expect(result).toEqual({ ok: true, value: "trader@tradepilot.app" });
  });

  it("recorta espacios antes de validar", () => {
    const result = validateEmail("  trader@tradepilot.app  ");
    expect(result).toEqual({ ok: true, value: "trader@tradepilot.app" });
  });

  it("rechaza una cadena vacía con mensaje específico", () => {
    const result = validateEmail("   ");
    expect(result).toEqual({ ok: false, message: "Introduce tu email" });
  });

  it("rechaza un email sin @", () => {
    const result = validateEmail("tradepilot.app");
    expect(result.ok).toBe(false);
  });

  it("rechaza un email sin dominio", () => {
    const result = validateEmail("trader@");
    expect(result.ok).toBe(false);
  });

  it("rechaza un email con espacios internos", () => {
    const result = validateEmail("trader @tradepilot.app");
    expect(result.ok).toBe(false);
  });
});
