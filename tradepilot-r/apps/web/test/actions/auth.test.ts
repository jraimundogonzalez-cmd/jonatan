import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Dobles de las dos fronteras externas de actions/auth.ts: el cliente de
// Supabase (red) y next/headers (contexto de request). Es la sustitución
// legítima de un límite de I/O en un test unitario — actions/auth.ts en sí
// no contiene ningún mock ni dato inventado en producción. vi.hoisted() evita
// el error de "temporal dead zone" que produce vi.mock() al elevarse por
// encima de declaraciones const normales.
const { signInWithOtpMock, signOutMock, cabeceras } = vi.hoisted(() => ({
  signInWithOtpMock: vi.fn(),
  signOutMock: vi.fn(),
  // Cabeceras de la petición tal como las manda el cliente. Los tests de
  // manipulación las cambian: el enlace no debe depender de ellas.
  cabeceras: new Map<string, string>([["host", "app.tradepilot.example"]]),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithOtp: signInWithOtpMock,
      signOut: signOutMock,
    },
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => cabeceras),
}));

import { signInWithMagicLink, signOutAction } from "@/actions/auth";

const ORIGEN = "https://app.tradepilot.example";
const SIN_CONFIGURAR = "El acceso no está disponible: falta configurar la dirección del sitio.";

function enlaceEnviado(): string {
  const call = signInWithOtpMock.mock.calls[0]?.[0];
  return call.options.emailRedirectTo as string;
}

describe("signInWithMagicLink", () => {
  beforeEach(() => {
    signInWithOtpMock.mockReset();
    signOutMock.mockReset();
    cabeceras.clear();
    cabeceras.set("host", "app.tradepilot.example");
    vi.stubEnv("TP_SITE_URL", ORIGEN);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rechaza un email inválido sin llamar a Supabase", async () => {
    const result = await signInWithMagicLink("no-es-un-email");
    expect(result).toEqual({ ok: false, message: "Ese email no parece válido" });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("construye emailRedirectTo con el origen configurado y el next saneado", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: null });

    const result = await signInWithMagicLink("trader@tradepilot.app", "/cuentas/abc");

    expect(result).toEqual({ ok: true });
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "trader@tradepilot.app",
      options: { emailRedirectTo: `${ORIGEN}/auth/confirm?next=%2Fcuentas%2Fabc` },
    });
  });

  it("sanea un redirectTo malicioso (open redirect) antes de construir el enlace", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: null });

    await signInWithMagicLink("trader@tradepilot.app", "https://evil.example/phishing");

    expect(enlaceEnviado()).toBe(`${ORIGEN}/auth/confirm?next=%2F`);
  });

  it("sanea un redirectTo con barra invertida antes de construir el enlace", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: null });

    await signInWithMagicLink("trader@tradepilot.app", "/\\evil.example");

    expect(enlaceEnviado()).toBe(`${ORIGEN}/auth/confirm?next=%2F`);
  });

  it("devuelve un mensaje de error honesto si Supabase falla", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: { message: "rate limited" } });

    const result = await signInWithMagicLink("trader@tradepilot.app");

    expect(result).toEqual({
      ok: false,
      message: "No se ha podido enviar el enlace de acceso. Inténtalo de nuevo.",
    });
  });

  describe("origen del enlace", () => {
    it("ignora una cabecera Host manipulada", async () => {
      signInWithOtpMock.mockResolvedValueOnce({ error: null });
      cabeceras.set("host", "evil.example");

      await signInWithMagicLink("trader@tradepilot.app", "/cuentas");

      expect(enlaceEnviado()).toBe(`${ORIGEN}/auth/confirm?next=%2Fcuentas`);
    });

    it("ignora x-forwarded-host y x-forwarded-proto manipulados", async () => {
      signInWithOtpMock.mockResolvedValueOnce({ error: null });
      cabeceras.set("x-forwarded-host", "evil.netlify.app");
      cabeceras.set("x-forwarded-proto", "http");

      await signInWithMagicLink("trader@tradepilot.app", "/cuentas");

      expect(enlaceEnviado()).toBe(`${ORIGEN}/auth/confirm?next=%2Fcuentas`);
      expect(enlaceEnviado()).not.toContain("evil");
    });

    it("sin configuración en producción no envía ningún enlace ni usa las cabeceras", async () => {
      vi.stubEnv("TP_SITE_URL", "");
      vi.stubEnv("NODE_ENV", "production");
      cabeceras.set("host", "evil.example");

      const result = await signInWithMagicLink("trader@tradepilot.app", "/cuentas");

      expect(result).toEqual({ ok: false, message: SIN_CONFIGURAR });
      expect(signInWithOtpMock).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("ORIGEN_NO_CONFIGURADO"));
    });

    it.each([
      ["http en un dominio público", "http://app.tradepilot.example"],
      ["un dominio con ruta", "https://app.tradepilot.example/login"],
      ["credenciales en la URL", "https://usuario:clave@app.tradepilot.example"],
      ["algo que no es una URL", "app.tradepilot.example"],
      ["un esquema no permitido", "javascript:alert(1)"],
    ])("rechaza un origen configurado no permitido: %s", async (_caso, valor) => {
      vi.stubEnv("TP_SITE_URL", valor);

      const result = await signInWithMagicLink("trader@tradepilot.app", "/cuentas");

      expect(result).toEqual({ ok: false, message: SIN_CONFIGURAR });
      expect(signInWithOtpMock).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("ORIGEN_NO_VALIDO"));
    });

    it("en desarrollo, sin variable, usa el origen local fijo y no las cabeceras", async () => {
      signInWithOtpMock.mockResolvedValueOnce({ error: null });
      vi.stubEnv("TP_SITE_URL", "");
      vi.stubEnv("NODE_ENV", "development");
      cabeceras.set("host", "evil.example");

      await signInWithMagicLink("trader@tradepilot.app", "/cuentas");

      expect(enlaceEnviado()).toBe("http://localhost:3000/auth/confirm?next=%2Fcuentas");
    });

    it("en desarrollo, una variable explícita manda sobre el origen local", async () => {
      signInWithOtpMock.mockResolvedValueOnce({ error: null });
      vi.stubEnv("TP_SITE_URL", "http://127.0.0.1:3005");
      vi.stubEnv("NODE_ENV", "development");

      await signInWithMagicLink("trader@tradepilot.app", "/cuentas");

      expect(enlaceEnviado()).toBe("http://127.0.0.1:3005/auth/confirm?next=%2Fcuentas");
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
