// @vitest-environment node
//
// Ramas de app/auth/confirm/route.ts con un doble del cliente de Supabase
// (frontera de red) y de redirect() de next/navigation, que en Next.js lanza
// una excepción de control de flujo: el doble la imita para que el test vea
// el destino y que la ejecución se corta ahí.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtpMock, exchangeCodeForSessionMock, redirectMock } = vi.hoisted(() => ({
  verifyOtpMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  redirectMock: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  })),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { GET } from "@/app/auth/confirm/route";

async function destinoDe(query: string): Promise<string> {
  const request = new NextRequest(new URL(`https://app.tradepilot.example/auth/confirm${query}`));
  try {
    await GET(request);
  } catch (e) {
    const mensaje = (e as Error).message;
    if (mensaje.startsWith("NEXT_REDIRECT:")) return mensaje.slice("NEXT_REDIRECT:".length);
    throw e;
  }
  throw new Error("GET terminó sin redirigir");
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    redirectMock.mockClear();
  });

  describe("flujo PKCE (?code=)", () => {
    it("intercambia un code válido y redirige al next saneado", async () => {
      exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: {} }, error: null });

      const destino = await destinoDe("?code=codigo-de-prueba&next=%2Fcuentas%2Fabc");

      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("codigo-de-prueba");
      expect(verifyOtpMock).not.toHaveBeenCalled();
      expect(destino).toBe("/cuentas/abc");
    });

    it("sin next, redirige a /", async () => {
      exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: {} }, error: null });

      expect(await destinoDe("?code=codigo-de-prueba")).toBe("/");
    });

    it("un code caducado, ya usado o sin verificador va a la página de error", async () => {
      exchangeCodeForSessionMock.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { name: "AuthApiError", message: "invalid flow state, no valid flow state found", status: 404 },
      });

      expect(await destinoDe("?code=codigo-caducado&next=%2Fcuentas")).toBe("/auth/auth-code-error");
    });

    it("no reenvía a un next externo aunque el intercambio salga bien (open redirect)", async () => {
      exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: {} }, error: null });

      expect(await destinoDe("?code=codigo-de-prueba&next=https%3A%2F%2Fevil.example%2Fphishing")).toBe("/");
      exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: {} }, error: null });
      expect(await destinoDe("?code=codigo-de-prueba&next=%2F%2Fevil.example")).toBe("/");
    });

    it("un code vacío no llama a Supabase", async () => {
      expect(await destinoDe("?code=&next=%2Fcuentas")).toBe("/auth/auth-code-error");
      expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    });
  });

  describe("flujo con plantilla propia (?token_hash=&type=)", () => {
    it("conserva el comportamiento anterior: verifyOtp y redirección al next", async () => {
      verifyOtpMock.mockResolvedValueOnce({ data: {}, error: null });

      const destino = await destinoDe("?token_hash=hash-de-prueba&type=email&next=%2Fcuentas");

      expect(verifyOtpMock).toHaveBeenCalledWith({ type: "email", token_hash: "hash-de-prueba" });
      expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
      expect(destino).toBe("/cuentas");
    });

    it("un token_hash inválido va a la página de error", async () => {
      verifyOtpMock.mockResolvedValueOnce({ data: {}, error: { message: "Token has expired or is invalid" } });

      expect(await destinoDe("?token_hash=hash-caducado&type=email")).toBe("/auth/auth-code-error");
    });

    it("token_hash sin type no se verifica", async () => {
      expect(await destinoDe("?token_hash=hash-de-prueba")).toBe("/auth/auth-code-error");
      expect(verifyOtpMock).not.toHaveBeenCalled();
    });

    it("si llegan los dos, manda token_hash y no se intercambia el code", async () => {
      verifyOtpMock.mockResolvedValueOnce({ data: {}, error: { message: "Token has expired or is invalid" } });

      expect(await destinoDe("?token_hash=hash-caducado&type=email&code=codigo-de-prueba")).toBe(
        "/auth/auth-code-error",
      );
      expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    });
  });

  // `next` llega en la URL del enlace del correo, codificado. Estas variantes
  // pasaban el saneador anterior y el navegador las resuelve a otro dominio:
  // `/\evil.example` (la barra invertida cuenta como `/`) y `/<TAB>/evil.example`
  // (el tabulador se descarta). La ruta debe acabar en `/` en los dos flujos y,
  // seguida como la sigue un navegador, quedarse en el propio origen.
  describe("next malicioso tras un acceso válido (open redirect)", () => {
    const ORIGEN = "https://app.tradepilot.example";
    const casos: Array<[string, string]> = [
      ["barra invertida", "%2F%5Cevil.example"],
      ["barra invertida tras ruta", "%2F%5C%2Fevil.example%2Fphishing"],
      ["tabulador", "%2F%09%2Fevil.example"],
      ["salto de línea", "%2F%0A%2Fevil.example"],
      ["barra invertida doblemente codificada", "%2F%255Cevil.example"],
      ["tabulador doblemente codificado", "%2F%2509%2Fevil.example"],
    ];

    it.each(casos)("flujo PKCE: rechaza %s", async (_caso, next) => {
      exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: {} }, error: null });

      const destino = await destinoDe(`?code=codigo-de-prueba&next=${next}`);

      expect(exchangeCodeForSessionMock).toHaveBeenCalledTimes(1);
      expect(destino).toBe("/");
      expect(new URL(destino, `${ORIGEN}/auth/confirm`).origin).toBe(ORIGEN);
    });

    it.each(casos)("flujo token_hash: rechaza %s", async (_caso, next) => {
      verifyOtpMock.mockResolvedValueOnce({ data: {}, error: null });

      const destino = await destinoDe(`?token_hash=hash-de-prueba&type=email&next=${next}`);

      expect(verifyOtpMock).toHaveBeenCalledTimes(1);
      expect(destino).toBe("/");
      expect(new URL(destino, `${ORIGEN}/auth/confirm`).origin).toBe(ORIGEN);
    });

    it("un next interno legítimo sigue funcionando en los dos flujos", async () => {
      exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: {} }, error: null });
      expect(await destinoDe("?code=codigo-de-prueba&next=%2Fcuentas%2Fabc%2Foperaciones")).toBe("/cuentas/abc/operaciones");
      verifyOtpMock.mockResolvedValueOnce({ data: {}, error: null });
      expect(await destinoDe("?token_hash=hash-de-prueba&type=email&next=%2Fimportar")).toBe("/importar");
    });
  });

  describe("parámetros incorrectos", () => {
    it("sin parámetros va a la página de error sin llamar a Supabase", async () => {
      expect(await destinoDe("")).toBe("/auth/auth-code-error");
      expect(verifyOtpMock).not.toHaveBeenCalled();
      expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    });

    it("el error que devuelve Supabase (?error=…) va a la página de error", async () => {
      expect(
        await destinoDe("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid"),
      ).toBe("/auth/auth-code-error");
      expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    });

    it("la página de error no lleva el code ni el motivo, y no se registra nada", async () => {
      const espiaConsola = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => undefined),
      );
      exchangeCodeForSessionMock.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { name: "AuthApiError", message: "invalid flow state", status: 404 },
      });

      const destino = await destinoDe("?code=codigo-secreto-de-prueba");

      expect(destino).toBe("/auth/auth-code-error");
      expect(destino).not.toContain("codigo-secreto-de-prueba");
      for (const espia of espiaConsola) {
        expect(espia).not.toHaveBeenCalled();
        espia.mockRestore();
      }
    });
  });
});
