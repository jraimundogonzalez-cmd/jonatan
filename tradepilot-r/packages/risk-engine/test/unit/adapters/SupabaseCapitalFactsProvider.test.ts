import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toDisplayString } from "@tradepilot/quant-engine";
import { SupabaseCapitalFactsProvider } from "../../../src/adapters/SupabaseCapitalFactsProvider.js";

const rpcMock = vi.fn();
const client = { rpc: rpcMock } as unknown as SupabaseClient;

describe("SupabaseCapitalFactsProvider.obtenerHechosDeCapital", () => {
  beforeEach(() => rpcMock.mockReset());

  it("reutiliza obtener_cuenta de Funding Management — nunca lee una tabla propia", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { current_capital: "9500.0000", initial_capital: "10000.0000" },
      error: null,
    });
    const provider = new SupabaseCapitalFactsProvider(client);
    const result = await provider.obtenerHechosDeCapital("acc-1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.current_capital)).toBe("9500.0000");
    expect(toDisplayString(result.value.initial_capital)).toBe("10000.0000");
    expect(rpcMock).toHaveBeenCalledWith("obtener_cuenta", { p_id: "acc-1" });
  });

  it("devuelve ACCOUNT_NOT_FOUND cuando obtener_cuenta responde sin fila", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const provider = new SupabaseCapitalFactsProvider(client);
    const result = await provider.obtenerHechosDeCapital("acc-ajena");
    expect(result).toEqual({ ok: false, error: { code: "ACCOUNT_NOT_FOUND", account_id: "acc-ajena" } });
  });

  it("mapea un error de Postgres a CAPITAL_FACTS_UNAVAILABLE (nunca ACCOUNT_NOT_FOUND, no son lo mismo)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "connection reset" } });
    const provider = new SupabaseCapitalFactsProvider(client);
    const result = await provider.obtenerHechosDeCapital("acc-1");
    expect(result).toEqual({
      ok: false,
      error: { code: "CAPITAL_FACTS_UNAVAILABLE", account_id: "acc-1", detail: "connection reset" },
    });
  });
});
