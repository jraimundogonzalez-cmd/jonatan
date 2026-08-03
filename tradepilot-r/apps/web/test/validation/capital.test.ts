import { describe, expect, it } from "vitest";
import { validateCapitalEventAmount, validateInitialCapital } from "@/lib/validation/capital";

describe("validateInitialCapital", () => {
  it("acepta un importe positivo válido", () => {
    expect(validateInitialCapital("10000.0000")).toEqual({ ok: true, value: "10000.0000" });
  });

  it("rechaza una cadena vacía", () => {
    expect(validateInitialCapital("")).toEqual({ ok: false, message: "Introduce el capital inicial" });
  });

  it("rechaza cero", () => {
    const result = validateInitialCapital("0");
    expect(result).toEqual({ ok: false, message: "El capital inicial debe ser mayor que 0" });
  });

  it("rechaza un valor negativo", () => {
    const result = validateInitialCapital("-500");
    expect(result).toEqual({ ok: false, message: "El capital inicial debe ser mayor que 0" });
  });

  it("rechaza un valor no numérico", () => {
    const result = validateInitialCapital("abc");
    expect(result).toEqual({ ok: false, message: "Ese importe no es un número válido" });
  });
});

describe("validateCapitalEventAmount", () => {
  it("acepta un importe positivo (depósito)", () => {
    expect(validateCapitalEventAmount("500")).toEqual({ ok: true, value: "500" });
  });

  it("acepta un importe negativo (retirada) — a diferencia de initial_capital", () => {
    expect(validateCapitalEventAmount("-200.50")).toEqual({ ok: true, value: "-200.50" });
  });

  it("rechaza una cadena vacía", () => {
    expect(validateCapitalEventAmount("   ")).toEqual({ ok: false, message: "Introduce un importe" });
  });

  it("rechaza un valor no numérico", () => {
    expect(validateCapitalEventAmount("cien euros")).toEqual({ ok: false, message: "Ese importe no es un número válido" });
  });
});
