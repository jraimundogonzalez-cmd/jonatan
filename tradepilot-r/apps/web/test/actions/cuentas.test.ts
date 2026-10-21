import { beforeEach, describe, expect, it, vi } from "vitest";

// Doble del cliente de Supabase (frontera de red) — se ejerce la lógica real
// de actions/cuentas.ts y lib/api/funding.ts (parseo de errores incluido),
// solo se sustituye la llamada .rpc() real a Postgres. vi.hoisted() evita el
// error de "temporal dead zone" que produce vi.mock() al elevarse por encima
// de declaraciones const normales.
const { rpcMock, revalidatePathMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { crearCuentaAction, registrarEventoCapitalAction } from "@/actions/cuentas";

describe("crearCuentaAction", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("revalida /cuentas cuando la creación tiene éxito", async () => {
    const account = { id: "acc-1", name: "Cuenta 1" };
    rpcMock.mockResolvedValueOnce({ data: account, error: null });

    const result = await crearCuentaAction({
      prop_firm_id: "pf-1",
      name: "Cuenta 1",
      initial_capital: "10000.0000",
      currency: "USD",
    });

    expect(result).toEqual({ ok: true, value: account });
    expect(revalidatePathMock).toHaveBeenCalledWith("/cuentas");
  });

  it("traduce un error de negocio (FUNDING_ERROR) y no revalida nada", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "FUNDING_ERROR:INVALID_INITIAL_CAPITAL:\"0\" no es válido" },
    });

    const result = await crearCuentaAction({
      prop_firm_id: "pf-1",
      name: "Cuenta 1",
      initial_capital: "0",
      currency: "USD",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_INITIAL_CAPITAL", detail: '"0" no es válido' },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("registrarEventoCapitalAction", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("revalida tanto el detalle de la Cuenta como el Dashboard tras un evento con éxito", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await registrarEventoCapitalAction("acc-1", "deposit", "500");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(revalidatePathMock).toHaveBeenCalledWith("/cuentas/acc-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/cuentas");
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });

  it("no revalida nada si el registro del evento falla", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "FUNDING_ERROR:ACCOUNT_NOT_FOUND:no existe" },
    });

    const result = await registrarEventoCapitalAction("acc-inexistente", "deposit", "500");

    expect(result).toEqual({ ok: false, error: { code: "ACCOUNT_NOT_FOUND" } });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
