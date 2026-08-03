import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format/money";

describe("formatMoney", () => {
  it("agrupa millares en la parte entera y conserva las 4 decimales exactas", () => {
    expect(formatMoney("10350.0000", "USD")).toBe("10,350.0000 USD");
  });

  it("no agrupa números por debajo de mil", () => {
    expect(formatMoney("500.0000", "EUR")).toBe("500.0000 EUR");
  });

  it("conserva el signo negativo fuera del separador de millares", () => {
    expect(formatMoney("-1250.5000", "USD")).toBe("-1,250.5000 USD");
  });

  it("nunca convierte a number — preserva dígitos que un float redondearía", () => {
    // Un valor con más precisión de la que un float de 64 bits podría
    // representar exactamente sigue mostrándose dígito a dígito.
    expect(formatMoney("123456789012345.6789", "USD")).toBe("123,456,789,012,345.6789 USD");
  });
});
