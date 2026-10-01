import { describe, expect, it, vi } from "vitest";

// Regresión de BUILD 020. El doble de `.rpc()` de esta suite devuelve lo que
// devuelve PostgREST DE VERDAD —`numeric` serializado como número JSON—, no lo
// que el contrato dice. Ésa es la diferencia con el resto de suites: las demás
// devuelven cadenas, y por eso ninguna vio caer la aplicación entera.

import {
  ESCALAS_OPERACION,
  ESCALA_PORCENTAJE,
  ESCALA_R_Y_DINERO,
  normalizarFila,
  normalizarFilas,
} from "@/lib/api/decimales";
import { listarOperaciones, obtenerOperacion } from "@/lib/api/operations";
import { obtenerCuenta } from "@/lib/api/funding";
import type { SupabaseClient } from "@supabase/supabase-js";

const rpcMock = vi.fn();
const cliente = { rpc: rpcMock } as unknown as SupabaseClient;

/** Fila tal como llega de PostgREST: los `numeric` son números JSON. */
function filaCruda(): Record<string, unknown> {
  return {
    id: "trade-1",
    account_id: "acc-1",
    status: "closed",
    symbol: "XAUUSD",
    risk_pct: 1,
    risk_amount: 100.5,
    rr_objective: 3,
    r_max: 2.5,
    r_final: 1.5,
    pnl_amount: 150.75,
    cierre_manual_rr: 1.5,
    closure_reason: "MANUAL_CLOSE",
    notes: null,
  };
}

describe("normalizarFila", () => {
  it("convierte cada decimal a cadena con la escala de su columna", () => {
    const fila = normalizarFila(filaCruda(), ESCALAS_OPERACION);
    expect(fila.r_final).toBe("1.5000");
    expect(fila.pnl_amount).toBe("150.7500");
    expect(fila.cierre_manual_rr).toBe("1.5000");
    expect(fila.risk_amount).toBe("100.5000");
    // `risk_pct` es numeric(5,2): dos decimales, no cuatro.
    expect(fila.risk_pct).toBe("1.00");
  });

  it("deja intacto lo que ya es cadena", () => {
    const fila = normalizarFila({ r_final: "1.5000", risk_pct: "1.00" }, ESCALAS_OPERACION);
    expect(fila).toEqual({ r_final: "1.5000", risk_pct: "1.00" });
  });

  it("no toca los campos que no son decimales", () => {
    const fila = normalizarFila(filaCruda(), ESCALAS_OPERACION);
    expect(fila.id).toBe("trade-1");
    expect(fila.closure_reason).toBe("MANUAL_CLOSE");
    expect(fila.notes).toBeNull();
  });

  it("respeta los nulos: un decimal ausente sigue ausente", () => {
    const fila = normalizarFila({ ...filaCruda(), r_final: null, pnl_amount: null }, ESCALAS_OPERACION);
    expect(fila.r_final).toBeNull();
    expect(fila.pnl_amount).toBeNull();
  });

  it("normalizarFilas aplica lo mismo a una lista", () => {
    const filas = normalizarFilas([filaCruda(), filaCruda()], ESCALAS_OPERACION);
    expect(filas.map((f) => f.r_final)).toEqual(["1.5000", "1.5000"]);
  });

  it("las dos escalas del esquema son 4 y 2", () => {
    expect(ESCALA_R_Y_DINERO).toBe(4);
    expect(ESCALA_PORCENTAJE).toBe(2);
  });
});

describe("frontera de lectura de Operations", () => {
  it("obtenerOperacion devuelve cadenas aunque PostgREST devuelva números", async () => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValueOnce({ data: filaCruda(), error: null });

    const result = await obtenerOperacion(cliente, "trade-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // La promesa de `types/operations.ts` vuelve a ser cierta a partir de aquí.
    expect(typeof result.value.r_final).toBe("string");
    expect(typeof result.value.pnl_amount).toBe("string");
    expect(typeof result.value.cierre_manual_rr).toBe("string");
    expect(typeof result.value.r_max).toBe("string");
  });

  it("un formulario precargado con esa fila puede llamar a .trim()", async () => {
    // El fallo real: `CorreccionForm` precargaba `r_max` desde la fila y la
    // Server Action reventaba con `input.r_max.trim is not a function`. La
    // corrección del desenlace era imposible de guardar desde el navegador.
    rpcMock.mockReset();
    rpcMock.mockResolvedValueOnce({ data: filaCruda(), error: null });

    const result = await obtenerOperacion(cliente, "trade-1");
    if (!result.ok) throw new Error("lectura fallida");
    expect(() => (result.value.r_max ?? "").trim()).not.toThrow();
  });

  it("listarOperaciones normaliza cada fila de la lista", async () => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValueOnce({ data: [filaCruda(), filaCruda()], error: null });

    const result = await listarOperaciones(cliente, "acc-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((o) => o.r_final)).toEqual(["1.5000", "1.5000"]);
  });
});

describe("frontera de lectura de Funding", () => {
  it("obtenerCuenta devuelve el capital como cadena", async () => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValueOnce({
      data: { id: "acc-1", initial_capital: 10000, current_capital: 10772.8401, peak_capital: 10772.8401 },
      error: null,
    });

    const result = await obtenerCuenta(cliente, "acc-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.current_capital).toBe("10772.8401");
    expect(result.value.initial_capital).toBe("10000.0000");
  });
});
