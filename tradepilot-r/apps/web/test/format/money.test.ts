import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyExacto } from "@/lib/format/money";

// BUILD 022 (decisión E-3) — el dinero se MUESTRA con 2 decimales. El dato
// interno conserva los 4 de `numeric(18,4)`: lo que cambia es la lectura, no
// la precisión. El redondeo lo hace el kernel decimal, no esta capa.
describe("formatMoney", () => {
  it("agrupa millares y muestra 2 decimales", () => {
    expect(formatMoney("10350.0000", "USD")).toBe("10,350.00 USD");
  });

  it("no agrupa números por debajo de mil", () => {
    expect(formatMoney("500.0000", "EUR")).toBe("500.00 EUR");
  });

  it("conserva el signo negativo fuera del separador de millares", () => {
    expect(formatMoney("-1250.5000", "USD")).toBe("-1,250.50 USD");
  });

  it("redondea con el modo del kernel (HALF_EVEN), no con toFixed de JS", () => {
    expect(formatMoney("176.7150", "USD")).toBe("176.72 USD");
    expect(formatMoney("176.7250", "USD")).toBe("176.72 USD");
  });

  it("nunca convierte a number — un valor mayor que la precisión de un float sigue exacto", () => {
    // El entero se conserva dígito a dígito; sólo la parte decimal se recorta
    // para mostrar. Un `Number()` habría corrompido ya la parte entera.
    expect(formatMoney("123456789012345.6789", "USD")).toBe("123,456,789,012,345.68 USD");
  });

  it("un importe minúsculo no desaparece en silencio: se muestra redondeado", () => {
    expect(formatMoney("0.0001", "EUR")).toBe("0.00 EUR");
  });
});

describe("formatMoneyExacto — para evidencia, no para leer de un vistazo", () => {
  it("conserva las 4 decimales del dominio", () => {
    expect(formatMoneyExacto("176.7150", "USD")).toBe("176.7150 USD");
    expect(formatMoneyExacto("123456789012345.6789", "USD")).toBe("123,456,789,012,345.6789 USD");
  });
});
