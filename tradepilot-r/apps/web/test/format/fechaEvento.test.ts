import { describe, expect, it } from "vitest";
import {
  TOLERANCIA_FUTURO_MS,
  aValorLocal,
  esRegistroAPosteriori,
  isoDesdeValorLocal,
  validarFechaEvento,
} from "@/lib/format/fechaEvento";

// BUILD 024 — fechas declaradas por el trader. La base es la autoridad; esto es
// la comprobación previa que avisa antes de enviar.
describe("conversión datetime-local ↔ ISO", () => {
  it("ida y vuelta conserva el minuto exacto en la hora local", () => {
    const fecha = new Date(2026, 9, 14, 15, 32); // 14-oct-2026 15:32 local
    const valor = aValorLocal(fecha);
    expect(valor).toBe("2026-10-14T15:32");
    expect(isoDesdeValorLocal(valor)).toBe(fecha.toISOString());
  });

  it("un valor vacío o mal formado no se convierte en una fecha inventada", () => {
    expect(isoDesdeValorLocal("")).toBeNull();
    expect(isoDesdeValorLocal("14/10/2026 15:32")).toBeNull();
    expect(isoDesdeValorLocal("2026-13-40T99:99")).toBeNull();
  });
});

describe("validarFechaEvento — orden cronológico y futuro", () => {
  const ahora = new Date("2026-10-17T12:00:00Z");

  it("acepta una fecha pasada", () => {
    expect(validarFechaEvento("2026-10-14T09:30:00Z", { ahora })).toBeNull();
  });

  it("rechaza una fecha en el futuro, con la misma tolerancia de reloj que la base", () => {
    const dentro = new Date(ahora.getTime() + TOLERANCIA_FUTURO_MS - 1000).toISOString();
    const fuera = new Date(ahora.getTime() + TOLERANCIA_FUTURO_MS + 60_000).toISOString();
    expect(validarFechaEvento(dentro, { ahora })).toBeNull();
    expect(validarFechaEvento(fuera, { ahora })).toMatch(/todavía no han llegado/);
  });

  it("rechaza un parcial anterior a la entrada", () => {
    expect(
      validarFechaEvento("2026-10-14T09:29:00Z", {
        ahora,
        noAntesDe: "2026-10-14T09:30:00Z",
        nombreDelPrevio: "a la entrada",
      }),
    ).toBe("No puede ser anterior a la entrada.");
  });

  it("rechaza un cierre anterior al último parcial y acepta uno posterior", () => {
    const limites = { ahora, noAntesDe: "2026-10-14T10:00:00Z", nombreDelPrevio: "al último parcial" };
    expect(validarFechaEvento("2026-10-14T09:59:00Z", limites)).toBe("No puede ser anterior al último parcial.");
    expect(validarFechaEvento("2026-10-14T10:00:00Z", limites)).toBeNull();
  });

  it("sin fecha válida pide una", () => {
    expect(validarFechaEvento(null, { ahora })).toMatch(/fecha y hora válidas/);
  });
});

describe("esRegistroAPosteriori — cuándo se avisa del capital usado", () => {
  it("registrar a la vez que se entra no es a posteriori", () => {
    expect(esRegistroAPosteriori("2026-10-17T12:00:00Z", "2026-10-17T12:05:00Z")).toBe(false);
  });

  it("registrar tres días después sí lo es", () => {
    expect(esRegistroAPosteriori("2026-10-14T12:00:00Z", "2026-10-17T12:00:00Z")).toBe(true);
  });

  it("sin hora de registro (filas anteriores a BUILD 024) no se presume nada", () => {
    expect(esRegistroAPosteriori("2026-10-14T12:00:00Z", null)).toBe(false);
  });
});
