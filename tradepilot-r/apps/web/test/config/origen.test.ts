import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { obtenerOrigenCanonico, ORIGEN_DESARROLLO, validarOrigen } from "@/lib/config/origen";

describe("validarOrigen", () => {
  it.each([
    ["https://app.tradepilot.example", "https://app.tradepilot.example"],
    ["https://app.tradepilot.example/", "https://app.tradepilot.example"],
    ["  https://app.tradepilot.example  ", "https://app.tradepilot.example"],
    ["https://APP.TradePilot.example:8443", "https://app.tradepilot.example:8443"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://[::1]:3000", "http://[::1]:3000"],
  ])("acepta %s como %s", (valor, origen) => {
    expect(validarOrigen(valor)).toEqual({ ok: true, origen });
  });

  it.each([
    "app.tradepilot.example",
    "/auth/confirm",
    "http://app.tradepilot.example",
    "http://localhost.evil.example:3000",
    "ftp://app.tradepilot.example",
    "javascript:alert(1)",
    "https://usuario@app.tradepilot.example",
    "https://usuario:clave@app.tradepilot.example",
    "https://app.tradepilot.example/login",
    "https://app.tradepilot.example/?next=/",
    "https://app.tradepilot.example/#x",
  ])("rechaza %s", (valor) => {
    expect(validarOrigen(valor)).toMatchObject({ ok: false, error: "ORIGEN_NO_VALIDO" });
  });
});

describe("obtenerOrigenCanonico", () => {
  it("usa la variable configurada", () => {
    expect(obtenerOrigenCanonico({ TP_SITE_URL: "https://app.tradepilot.example", NODE_ENV: "production" })).toEqual({
      ok: true,
      origen: "https://app.tradepilot.example",
    });
  });

  it("sin variable en producción es un error, no un origen por defecto", () => {
    expect(obtenerOrigenCanonico({ NODE_ENV: "production" })).toMatchObject({ ok: false, error: "ORIGEN_NO_CONFIGURADO" });
    expect(obtenerOrigenCanonico({ TP_SITE_URL: "   ", NODE_ENV: "production" })).toMatchObject({
      ok: false,
      error: "ORIGEN_NO_CONFIGURADO",
    });
  });

  it("sin variable en tests (ni desarrollo ni producción) también es un error", () => {
    expect(obtenerOrigenCanonico({ NODE_ENV: "test" })).toMatchObject({ ok: false, error: "ORIGEN_NO_CONFIGURADO" });
  });

  it("sin variable en desarrollo usa el origen local fijo", () => {
    expect(obtenerOrigenCanonico({ NODE_ENV: "development" })).toEqual({ ok: true, origen: ORIGEN_DESARROLLO });
  });

  it("una variable inválida no cae al origen de desarrollo", () => {
    expect(obtenerOrigenCanonico({ TP_SITE_URL: "http://evil.example", NODE_ENV: "development" })).toMatchObject({
      ok: false,
      error: "ORIGEN_NO_VALIDO",
    });
  });
});
