import { beforeEach, describe, expect, it, vi } from "vitest";

// Dobles de las dos fronteras externas de actions/auth.ts: el cliente de
// Supabase (red) y next/headers (contexto de request). Es la sustitución
// legítima de un límite de I/O en un test unitario — actions/auth.ts en sí
// no contiene ningún mock ni dato inventado en producción. vi.hoisted() evita
// el error de "temporal dead zone" que produce vi.mock() al elevarse por
// encima de declaraciones const normales.
const { signInWithOtpMock, signOutMock } = vi.hoisted(() => ({
  signInWithOtpMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithOtp: signInWithOtpMock,
      signOut: signOutMock,
    },
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["host", "app.tradepilot.example"]])),
}));

import { signInWithMagicLink, signOutAction } from "@/actions/auth";

describe("signInWithMagicLink", () => {
  beforeEach(() => {
    signInWithOtpMock.mockReset();
    signOutMock.mockReset();
  });

  it("rechaza un email inválido sin llamar a Supabase", async () => {
    const result = await signInWithMagicLink("no-es-un-email");
    expect(result).toEqual({ ok: false, message: "Ese email no parece válido" });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("construye emailRedirectTo con el next saneado y devuelve ok:true", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: null });

    const result = await signInWithMagicLink("trader@tradepilot.app", "/cuentas/abc");

    expect(result).toEqual({ ok: true });
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "trader@tradepilot.app",
      options: { emailRedirectTo: expect.stringContaining("/auth/confirm?next=%2Fcuentas%2Fabc") },
    });
  });

  it("sanea un redirectTo malicioso (open redirect) antes de construir el enlace", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: null });

    await signInWithMagicLink("trader@tradepilot.app", "https://evil.example/phishing");

    const call = signInWithOtpMock.mock.calls[0]?.[0];
    expect(call.options.emailRedirectTo).toContain("next=%2F");
    expect(call.options.emailRedirectTo).not.toContain("evil.example");
  });

  it("devuelve un mensaje de error honesto si Supabase falla", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: { message: "rate limited" } });

    const result = await signInWithMagicLink("trader@tradepilot.app");

    expect(result).toEqual({
      ok: false,
      message: "No se ha podido enviar el enlace de acceso. Inténtalo de nuevo.",
    });
  });
});

describe("signOutAction", () => {
  it("llama a supabase.auth.signOut() y no redirige por sí misma", async () => {
    signOutMock.mockResolvedValueOnce({ error: null });
    await signOutAction();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
