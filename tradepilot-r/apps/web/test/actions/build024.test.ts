import { beforeEach, describe, expect, it, vi } from "vitest";

// BUILD 024 — la hora declarada viaja intacta hasta la RPC, y los rechazos
// cronológicos de la base llegan al trader como errores suyos, en el campo fecha.
const { rpcMock, revalidatePathMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("server-only", () => ({}));

import { cerrarOperacionAction, registrarOperacionAction, registrarParcialAction } from "@/actions/operaciones";
import { campoDeError, categoriaDeError, mensajeDeError } from "@/types/operations";

const HACE_TRES_DIAS = "2026-10-14T13:30:00.000Z";

describe("fechas declaradas", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("la apertura envía la hora de entrada declarada, no la de registro", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "t1", account_id: "a1" }, error: null });
    await registrarOperacionAction({
      account_id: "a1",
      symbol: "MNQ",
      side: "long",
      opened_at: HACE_TRES_DIAS,
      risk_pct: "1.00",
      rr_objective: "3.0000",
      be_trigger: "NONE",
    });
    const [nombre, args] = rpcMock.mock.calls[0]!;
    expect(nombre).toBe("registrar_operacion");
    expect(args.p_opened_at).toBe(HACE_TRES_DIAS);
    // La capa web no envía ningún importe: el riesgo lo congela la RPC (DEC-013 sin tocar).
    expect(Object.keys(args)).not.toContain("p_risk_amount");
  });

  it("el parcial envía su hora de ejecución declarada", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { id: "p1", trade_id: "t1", sequence: 1, rr_level: 1, pct_close: 50, executed_at: HACE_TRES_DIAS, recorded_at: null },
      error: null,
    });
    await registrarParcialAction("t1", "a1", 1, "1.0000", "50.00", HACE_TRES_DIAS);
    expect(rpcMock).toHaveBeenCalledWith("registrar_parcial_ejecutado", expect.objectContaining({ p_executed_at: HACE_TRES_DIAS }));
  });

  it("un parcial fuera de orden se explica al trader en el campo fecha", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "OPERATIONS_ERROR:CHRONOLOGY_VIOLATION:el parcial 2 (…) es anterior al parcial previo (…)" },
    });
    const result = await registrarParcialAction("t1", "a1", 2, "2.0000", "10.00", HACE_TRES_DIAS);
    if (result.ok) throw new Error("debía rechazarse");
    expect(result.error.code).toBe("CHRONOLOGY_VIOLATION");
    expect(categoriaDeError(result.error)).toBe("usuario");
    expect(campoDeError(result.error)).toBe("fecha");
    expect(mensajeDeError(result.error)).toMatch(/orden de la operación/);
  });

  it("una apertura en el futuro se explica al trader en el campo fecha", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "OPERATIONS_ERROR:EVENT_IN_FUTURE:opened_at (…) es posterior al momento actual" },
    });
    const result = await registrarOperacionAction({
      account_id: "a1",
      symbol: "MNQ",
      side: "long",
      opened_at: "2099-01-01T00:00:00.000Z",
      risk_pct: "1.00",
      rr_objective: "3.0000",
      be_trigger: "NONE",
    });
    if (result.ok) throw new Error("debía rechazarse");
    expect(result.error.code).toBe("EVENT_IN_FUTURE");
    expect(categoriaDeError(result.error)).toBe("usuario");
    expect(campoDeError(result.error)).toBe("fecha");
  });

  it("un cierre con fecha ilegible se rechaza antes de tocar la base", async () => {
    const result = await cerrarOperacionAction({
      trade_id: "t1",
      account_id: "a1",
      closure_reason: "STOP_LOSS",
      r_max: "0.0000",
      closed_at: "no-es-una-fecha",
    });
    if (result.ok) throw new Error("debía rechazarse");
    expect(result.error).toMatchObject({ code: "VALIDATION_ERROR", campo: "fecha" });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
