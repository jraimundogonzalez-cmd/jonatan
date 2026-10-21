import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_WELFORD_ACCUMULATOR, calcularEsperanzaIncremental, rvalue } from "@tradepilot/quant-engine";
import { SupabaseAccountRiskStateRepository } from "../../../src/adapters/SupabaseAccountRiskStateRepository.js";

// Doble del cliente de Supabase (frontera de red) — solo se sustituye
// `.rpc()`, la misma técnica que apps/web/test/actions/cuentas.test.ts.
const rpcMock = vi.fn();
const client = { rpc: rpcMock } as unknown as SupabaseClient;

describe("SupabaseAccountRiskStateRepository.obtener", () => {
  beforeEach(() => rpcMock.mockReset());

  it("traduce la fila de risk_engine_obtener_estado a AccountRiskState", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { account_id: "acc-1", n: 2, mean: "1.5000", m2: "0.5000", version: 2, updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.obtener("acc-1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.accumulator.n).toBe(2);
    expect(rpcMock).toHaveBeenCalledWith("risk_engine_obtener_estado", { p_account_id: "acc-1" });
  });

  it("devuelve ACCOUNT_NOT_FOUND cuando la RPC responde sin fila (RLS o Cuenta inexistente)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.obtener("acc-ajena");
    expect(result).toEqual({ ok: false, error: { code: "ACCOUNT_NOT_FOUND", account_id: "acc-ajena" } });
  });

  it("envuelve un error de Postgres como REPOSITORY_ERROR, nunca lo descarta en silencio", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "connection reset" } });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.obtener("acc-1");
    expect(result).toEqual({ ok: false, error: { code: "REPOSITORY_ERROR", detail: "connection reset" } });
  });
});

describe("SupabaseAccountRiskStateRepository.aplicarActualizacion", () => {
  beforeEach(() => rpcMock.mockReset());

  const nuevoAcumulador = calcularEsperanzaIncremental(EMPTY_WELFORD_ACCUMULATOR, rvalue("1.5000"));

  it("envía n/mean/m2 como los tipos exactos que espera la RPC (mean/m2 como string con escala fija)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ applied: true, current_version: 1, current_n: 1, current_mean: "1.5000", current_m2: "0.0000" }],
      error: null,
    });
    const repo = new SupabaseAccountRiskStateRepository(client);
    await repo.aplicarActualizacion({
      accountId: "acc-1",
      eventId: "evt-1",
      eventType: "OperacionCerrada",
      expectedVersion: 0,
      nuevoAcumulador,
    });
    expect(rpcMock).toHaveBeenCalledWith("risk_engine_apply_accumulator_update", {
      p_account_id: "acc-1",
      p_event_id: "evt-1",
      p_event_type: "OperacionCerrada",
      p_expected_version: 0,
      p_new_n: 1,
      p_new_mean: "1.5000",
      p_new_m2: "0.0000",
    });
  });

  it("mapea applied=true a outcome kind='applied'", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ applied: true, current_version: 1, current_n: 1, current_mean: "1.5000", current_m2: "0.0000" }],
      error: null,
    });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.aplicarActualizacion({
      accountId: "acc-1",
      eventId: "evt-1",
      eventType: "OperacionCerrada",
      expectedVersion: 0,
      nuevoAcumulador,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("applied");
  });

  it("desambigua already_processed vs version_conflict con una segunda lectura del ledger, nunca adivinando", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{ applied: false, current_version: 1, current_n: 1, current_mean: "1.5000", current_m2: "0.0000" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null }); // risk_engine_ya_procesado

    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.aplicarActualizacion({
      accountId: "acc-1",
      eventId: "evt-dup",
      eventType: "OperacionCerrada",
      expectedVersion: 0,
      nuevoAcumulador,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("already_processed");
    expect(rpcMock).toHaveBeenCalledWith("risk_engine_ya_procesado", { p_event_id: "evt-dup" });
  });

  it("mapea applied=false + evento no procesado a version_conflict", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{ applied: false, current_version: 3, current_n: 3, current_mean: "0.5000", current_m2: "1.0000" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: false, error: null });

    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.aplicarActualizacion({
      accountId: "acc-1",
      eventId: "evt-nuevo",
      eventType: "OperacionCerrada",
      expectedVersion: 0,
      nuevoAcumulador,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("version_conflict");
    if (result.value.kind !== "version_conflict") throw new Error("unreachable");
    expect(result.value.current.version).toBe(3);
  });

  it("devuelve ACCOUNT_NOT_FOUND cuando la RPC devuelve un array vacío (RLS bloqueó el UPDATE y el re-SELECT de reserva)", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.aplicarActualizacion({
      accountId: "acc-ajena",
      eventId: "evt-1",
      eventType: "OperacionCerrada",
      expectedVersion: 0,
      nuevoAcumulador,
    });
    expect(result).toEqual({ ok: false, error: { code: "ACCOUNT_NOT_FOUND", account_id: "acc-ajena" } });
  });
});

describe("SupabaseAccountRiskStateRepository.yaProcesado", () => {
  beforeEach(() => rpcMock.mockReset());

  it("devuelve el booleano de la RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const repo = new SupabaseAccountRiskStateRepository(client);
    const result = await repo.yaProcesado("evt-1");
    expect(result).toEqual({ ok: true, value: true });
  });
});
