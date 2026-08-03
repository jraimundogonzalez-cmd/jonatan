// @vitest-environment node
//
// middleware.ts corre en runtime Node/Edge real, nunca en un navegador — el
// polyfill de `Headers` de jsdom (entorno por defecto de este proyecto de
// tests) no es la misma clase que Next.js comprueba internamente con
// `instanceof Headers` en NextResponse.next(), así que este archivo se fija
// al entorno Node explícitamente en vez de heredar jsdom.
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

// Doble del cliente de Supabase (frontera de red) — se ejerce la lógica real
// de enrutado protegido de middleware.ts.
const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

import { middleware } from "@/middleware";

describe("middleware — navegación protegida", () => {
  it("redirige a /login (con redirectTo) cuando no hay sesión y la ruta es protegida", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const request = new NextRequest(new URL("https://app.tradepilot.example/cuentas"));

    const response = await middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=%2Fcuentas");
  });

  it("deja pasar /login sin sesión (ruta pública)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const request = new NextRequest(new URL("https://app.tradepilot.example/login"));

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("deja pasar /auth/confirm sin sesión (ruta pública, verificación del magic link)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const request = new NextRequest(new URL("https://app.tradepilot.example/auth/confirm?token_hash=abc&type=email"));

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("con sesión activa, deja pasar una ruta protegida", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const request = new NextRequest(new URL("https://app.tradepilot.example/cuentas"));

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("con sesión activa, redirige fuera de /login hacia la raíz", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const request = new NextRequest(new URL("https://app.tradepilot.example/login"));

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.tradepilot.example/");
  });
});
