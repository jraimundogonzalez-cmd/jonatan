import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toDisplayString } from "@tradepilot/quant-engine";
import { SupabaseAccountRiskStateRepository } from "../../../src/adapters/SupabaseAccountRiskStateRepository.js";
import { SupabaseCapitalFactsProvider } from "../../../src/adapters/SupabaseCapitalFactsProvider.js";
import { rvalue } from "../../../src/index.js";

// BUILD 020 — el resto de las suites de este paquete usa repositorios en
// memoria que devuelven decimales en CADENA, que es lo que el contrato dice.
// PostgREST entrega `numeric` como número JSON. Estas comprobaciones usan
// filas con la forma REAL de la plataforma: sin normalización de frontera,
// cerrar una Operación desde la aplicación reventaba con
// `value.trim is not a function` en cuanto Risk Engine leía el acumulador.
const rpcMock = vi.fn();
const client = { rpc: rpcMock } as unknown as SupabaseClient;

describe("SupabaseAccountRiskStateRepository con decimales de PostgREST", () => {
  beforeEach(() => rpcMock.mockReset());

  it("obtener() acepta `mean` y `m2` como números JSON", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { account_id: "acc-1", n: 3, mean: 0.5, m2: 2.25, version: 7, updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.obtener("acc-1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.accumulator.mean)).toBe("0.5000");
    expect(toDisplayString(result.value.accumulator.m2)).toBe("2.2500");
    expect(result.value.version).toBe(7);
  });

  it("aplicarActualizacion() acepta la fila de vuelta también como números", async () => {
    // Este es el camino que se ejercitaba al cerrar: la RPC devuelve el estado
    // nuevo, y esa segunda traducción es distinta de la de `obtener()` — vive
    // en `applyRowToState`, y arreglar sólo la primera dejaba el fallo intacto.
    rpcMock.mockResolvedValueOnce({
      data: [{ applied: true, current_version: 8, current_n: 4, current_mean: 0.75, current_m2: 3.5 }],
      error: null,
    });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.aplicarActualizacion({
      accountId: "acc-1",
      eventId: "evt-1",
      eventType: "trade_closed",
      expectedVersion: 7,
      nuevoAcumulador: { n: 4, mean: rvalue("0.7500"), m2: rvalue("3.5000") },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("applied");
    if (result.value.kind !== "applied") throw new Error("unreachable");
    expect(toDisplayString(result.value.state.accumulator.mean)).toBe("0.7500");
    expect(toDisplayString(result.value.state.accumulator.m2)).toBe("3.5000");
  });
});

describe("SupabaseCapitalFactsProvider con decimales de PostgREST", () => {
  beforeEach(() => rpcMock.mockReset());

  it("acepta el capital como número JSON", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { current_capital: 10772.8401, initial_capital: 10000 },
      error: null,
    });
    const provider = new SupabaseCapitalFactsProvider(client);
    const result = await provider.obtenerHechosDeCapital("acc-1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(toDisplayString(result.value.current_capital)).toBe("10772.8401");
    expect(toDisplayString(result.value.initial_capital)).toBe("10000.0000");
  });
});
