import { beforeEach, describe, expect, it, vi } from "vitest";

// BUILD 022 — cancelación, notas y la fuga de PostgreSQL (BUG-021-2).
const { rpcMock, revalidatePathMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
// `actions/operaciones.ts` construye el motor de dominio, que sólo puede
// correr en servidor. En un test no hay frontera cliente/servidor que proteger.
vi.mock("server-only", () => ({}));

import { cancelarOperacionAction } from "@/actions/operaciones";
import { fundingErrorMessage, detalleTecnico } from "@/types/funding";
import { mensajeDeError } from "@/types/operations";

const CANCELADA = {
  id: "trade-1",
  account_id: "acc-1",
  status: "cancelled",
  cancellation_reason: "Registrada por error",
  r_final: null,
  pnl_amount: null,
  closure_reason: null,
};

describe("cancelar una Operación abierta por error", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("llama a la RPC de dominio que ya existía, con su motivo", async () => {
    rpcMock.mockResolvedValueOnce({ data: CANCELADA, error: null });

    const result = await cancelarOperacionAction("trade-1", "acc-1", "Registrada por error");
    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("cancelar_operacion", {
      p_trade_id: "trade-1",
      p_motivo: "Registrada por error",
    });
  });

  it("la Operación queda Cancelada, NO cerrada, y sin resultado", async () => {
    rpcMock.mockResolvedValueOnce({ data: CANCELADA, error: null });

    const result = await cancelarOperacionAction("trade-1", "acc-1", "Registrada por error");
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.status).toBe("cancelled");
    expect(result.value.status).not.toBe("closed");
    // Lo que separa cancelar de «cerrar a 0R»: no hay desenlace ninguno.
    expect(result.value.r_final).toBeNull();
    expect(result.value.pnl_amount).toBeNull();
    expect(result.value.closure_reason).toBeNull();
  });

  it("nunca toca `aplicar_cierre_operacion` ni el motor de cálculo", async () => {
    rpcMock.mockResolvedValueOnce({ data: CANCELADA, error: null });
    await cancelarOperacionAction("trade-1", "acc-1", "Error");
    const llamadas = rpcMock.mock.calls.map((c) => c[0]);
    expect(llamadas).not.toContain("aplicar_cierre_operacion");
    expect(llamadas).not.toContain("aplicar_edicion_operacion");
  });

  it("revalida la Cuenta: el R agregado y los conteos cambian", async () => {
    rpcMock.mockResolvedValueOnce({ data: CANCELADA, error: null });
    await cancelarOperacionAction("trade-1", "acc-1", "Error");
    expect(revalidatePathMock).toHaveBeenCalledWith("/cuentas/acc-1");
  });

  it("el dominio manda: si hay parciales, rechaza y la interfaz lo explica", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "OPERATIONS_ERROR:INVALID_STATE_TRANSITION:open:cancelled:cancelación simple solo permitida sin parciales ejecutados (1 ejecutados)",
      },
    });

    const result = await cancelarOperacionAction("trade-1", "acc-1", "Error");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
    // El mensaje distingue el caso por el estado DESTINO, sin parsear texto ni
    // replicar la regla del trigger.
    expect(mensajeDeError(result.error)).toContain("parciales ejecutados");
    expect(mensajeDeError(result.error)).not.toContain("cerrada");
  });

  it("un motivo vacío lo rechaza el dominio, no la interfaz", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "OPERATIONS_ERROR:CANCELLATION_REQUIRES_REASON:se requiere un motivo de cancelación" },
    });

    const result = await cancelarOperacionAction("trade-1", "acc-1", "");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CANCELLATION_REQUIRES_REASON");
  });
});

describe("BUG-021-2 — un error técnico no llega a la pantalla", () => {
  it("un UUID malformado ya no muestra el mensaje crudo de PostgreSQL", () => {
    const error = {
      code: "UNKNOWN" as const,
      detail: 'invalid input syntax for type uuid: "a486d4aa-cae2-4db1-aa42-fd531f844ad225ce6f0f"',
    };
    const mensaje = fundingErrorMessage(error);
    expect(mensaje).not.toContain("invalid input syntax");
    expect(mensaje).not.toContain("uuid");
    expect(mensaje).toContain("error inesperado");
  });

  it("pero el detalle técnico sigue disponible para registrarlo", () => {
    const error = { code: "UNKNOWN" as const, detail: 'invalid input syntax for type uuid: "xxx"' };
    expect(detalleTecnico(error)).toContain("invalid input syntax");
  });

  it("un error de usuario no esconde nada: sigue siendo explícito", () => {
    expect(fundingErrorMessage({ code: "ACCOUNT_NOT_FOUND" })).toContain("Cuenta");
    expect(detalleTecnico({ code: "ACCOUNT_NOT_FOUND" })).toBeNull();
  });
});
