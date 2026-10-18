// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { previsualizarMock, confirmarMock, revalidatePathMock } = vi.hoisted(() => ({
  previsualizarMock: vi.fn(),
  confirmarMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: vi.fn() })) }));
vi.mock("@/lib/imports/servicio", () => ({
  previsualizarImportacion: previsualizarMock,
  confirmarImportacionDeFichero: confirmarMock,
}));

import { confirmarImportacionAction, previsualizarImportacionAction } from "@/actions/importaciones";
import { parseImportError } from "@/lib/api/imports";
import { importErrorMessage } from "@/types/imports";

function formulario(campos: Record<string, string>, conFichero = true): FormData {
  const fd = new FormData();
  if (conFichero) fd.set("fichero", new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "lista.xlsx"));
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("Server Actions de importación", () => {
  beforeEach(() => {
    previsualizarMock.mockReset();
    confirmarMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("sin archivo → error de archivo vacío, sin llegar al servicio", async () => {
    const r = await previsualizarImportacionAction(formulario({ accountId: "a", zonaHoraria: "UTC" }, false));
    expect(r).toEqual({ ok: false, error: { code: "FICHERO", error: { codigo: "FICHERO_VACIO" } } });
    expect(previsualizarMock).not.toHaveBeenCalled();
  });

  it("sin zona horaria → no hay valor por defecto: se pide", async () => {
    const r = await previsualizarImportacionAction(formulario({ accountId: "a" }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", field: "zonaHoraria" } });
    expect(previsualizarMock).not.toHaveBeenCalled();
  });

  it("sin Cuenta de destino → se pide", async () => {
    const r = await previsualizarImportacionAction(formulario({ zonaHoraria: "UTC" }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", field: "accountId" } });
  });

  it("previsualizar pasa los bytes del archivo y no revalida nada (no escribe)", async () => {
    previsualizarMock.mockResolvedValueOnce({ ok: true, value: {} });
    await previsualizarImportacionAction(formulario({ accountId: "a", zonaHoraria: "UTC", cuentaExterna: "NYS00000-000001" }));
    const entrada = previsualizarMock.mock.calls[0]![1];
    expect(entrada).toMatchObject({ accountId: "a", zonaHoraria: "UTC", cuentaExterna: "NYS00000-000001", ficheroNombre: "lista.xlsx" });
    expect(entrada.bytes).toBeInstanceOf(Uint8Array);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("confirmar traduce aceptadas y vínculo, y revalida la Cuenta solo si se guardó", async () => {
    confirmarMock.mockResolvedValueOnce({ ok: true, value: { id: "lote-1" } });
    await confirmarImportacionAction(
      formulario({ accountId: "a", zonaHoraria: "UTC", sha256: "abc", aceptadas: "3,7,x", confirmarVinculo: "si" }),
    );
    expect(confirmarMock.mock.calls[0]![1]).toMatchObject({ sha256Previsualizado: "abc", aceptadas: [3, 7], confirmarVinculo: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/cuentas/a/importaciones");

    revalidatePathMock.mockReset();
    confirmarMock.mockResolvedValueOnce({ ok: false, error: { code: "FICHERO_CAMBIADO" } });
    await confirmarImportacionAction(formulario({ accountId: "a", zonaHoraria: "UTC", sha256: "abc" }));
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("errores de la base de datos", () => {
  it("traduce los códigos de imports.sql", () => {
    expect(parseImportError("IMPORT_ERROR:ACCOUNT_MISMATCH:esta Cuenta está vinculada a X")).toEqual({
      code: "ACCOUNT_MISMATCH",
      detail: "esta Cuenta está vinculada a X",
    });
    expect(parseImportError("IMPORT_ERROR:VALIDATION_ERROR:source_timezone:zona mala")).toEqual({
      code: "VALIDATION_ERROR",
      field: "source_timezone",
      detail: "zona mala",
    });
  });

  it("un error no catalogado no se pinta crudo", () => {
    const e = parseImportError('invalid input syntax for type numeric: "abc"');
    expect(e.code).toBe("UNKNOWN");
    expect(importErrorMessage(e)).not.toContain("invalid input");
  });
});
