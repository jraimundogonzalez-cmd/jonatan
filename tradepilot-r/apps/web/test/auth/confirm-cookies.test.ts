// @vitest-environment node
//
// El intercambio PKCE de app/auth/confirm/route.ts con el cliente SSR REAL
// (lib/supabase/server.ts → @supabase/ssr → auth-js). Solo se sustituyen las
// fronteras: el almacén de cookies de next/headers, redirect() de
// next/navigation y fetch (ninguna petición sale del proceso; la URL y la
// clave son ficticias). Comprueba que el verificador se lee de la cookie que
// dejó signInWithOtp, que se envía a /token?grant_type=pkce y que la sesión
// queda escrita en las cookies de la respuesta.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieJar, redirectMock } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  redirectMock: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      if (value === "") cookieJar.delete(name);
      else cookieJar.set(name, value);
    },
  })),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { GET } from "@/app/auth/confirm/route";

const URL_FICTICIA = "https://proyecto-ficticio.supabase.co";
const CLAVE_FICTICIA = "clave-anon-ficticia";
const CLAVE_ALMACEN = "sb-proyecto-ficticio-auth-token";
const VERIFICADOR = "verificador-pkce-de-prueba";

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

function sesionFicticia() {
  return {
    access_token: "token-de-acceso-ficticio",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "token-de-refresco-ficticio",
    user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", email: "trader@tradepilot.app" },
  };
}

function decodificar(valor: string): string {
  return valor.startsWith("base64-") ? Buffer.from(valor.slice("base64-".length), "base64url").toString() : valor;
}

describe("GET /auth/confirm — intercambio PKCE con el cliente SSR real", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookieJar.clear();
    redirectMock.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_FICTICIA);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", CLAVE_FICTICIA);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lee el verificador de la cookie, lo envía y guarda la sesión en cookies", async () => {
    cookieJar.set(`${CLAVE_ALMACEN}-code-verifier`, JSON.stringify(VERIFICADOR));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(sesionFicticia()), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const destino = await destinoDe("?code=codigo-de-prueba&next=%2Fcuentas");

    expect(destino).toBe("/cuentas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${URL_FICTICIA}/auth/v1/token?grant_type=pkce`);
    expect(JSON.parse(String(init.body))).toEqual({ auth_code: "codigo-de-prueba", code_verifier: VERIFICADOR });

    // La sesión queda en la cookie de sesión de @supabase/ssr (posiblemente
    // troceada como <clave>.0, <clave>.1…) y el verificador se consume.
    const trozos = Array.from(cookieJar.keys())
      .filter((nombre) => nombre === CLAVE_ALMACEN || nombre.startsWith(`${CLAVE_ALMACEN}.`))
      .sort();
    expect(trozos.length).toBeGreaterThan(0);
    const sesion = JSON.parse(decodificar(trozos.map((n) => cookieJar.get(n)!).join("")));
    expect(sesion.access_token).toBe("token-de-acceso-ficticio");
    expect(sesion.refresh_token).toBe("token-de-refresco-ficticio");
    expect(cookieJar.has(`${CLAVE_ALMACEN}-code-verifier`)).toBe(false);
  });

  it("sin la cookie del verificador (otro navegador) no llama a Supabase y va a la página de error", async () => {
    const destino = await destinoDe("?code=codigo-de-prueba&next=%2Fcuentas");

    expect(destino).toBe("/auth/auth-code-error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Array.from(cookieJar.keys()).some((n) => n === CLAVE_ALMACEN || n.startsWith(`${CLAVE_ALMACEN}.`))).toBe(
      false,
    );
  });

  it("un code rechazado por Supabase no deja sesión y va a la página de error", async () => {
    cookieJar.set(`${CLAVE_ALMACEN}-code-verifier`, JSON.stringify(VERIFICADOR));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 404, error_code: "flow_state_not_found", msg: "invalid flow state" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const destino = await destinoDe("?code=codigo-caducado");

    expect(destino).toBe("/auth/auth-code-error");
    expect(Array.from(cookieJar.keys()).some((n) => n === CLAVE_ALMACEN || n.startsWith(`${CLAVE_ALMACEN}.`))).toBe(
      false,
    );
  });
});
