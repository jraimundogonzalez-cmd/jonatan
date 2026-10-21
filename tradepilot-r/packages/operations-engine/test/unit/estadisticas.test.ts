// Estadísticas de cartera — primera tanda conectada a la interfaz.
//
// Lo que estas pruebas fijan: que las magnitudes salen de la MISMA muestra que
// el R agregado, y que una muestra insuficiente se dice con `null`, no con un
// cero que se leería como un resultado.
import { beforeEach, describe, expect, it } from "vitest";
import { RiskEngineService, rvalue, toDisplayString } from "@tradepilot/risk-engine";
import { OperationsEngineService } from "../../src/services/OperationsEngineService.js";
import { InMemoryTradeGateway } from "../fakes/InMemoryTradeGateway.js";
import {
  InMemoryAccountRiskStateRepository,
  InMemoryCapitalFactsProvider,
} from "../fakes/InMemoryRiskEngineDependencies.js";

const ACCOUNT_ID = "acc-1";

let gateway: InMemoryTradeGateway;
let service: OperationsEngineService;

beforeEach(() => {
  gateway = new InMemoryTradeGateway();
  service = new OperationsEngineService(
    gateway,
    new RiskEngineService(new InMemoryAccountRiskStateRepository(), new InMemoryCapitalFactsProvider()),
  );
});

describe("estadisticasDeCuenta", () => {
  it("con muestra VACÍA no es un error: devuelve null en todo y n = 0", async () => {
    const r = await service.estadisticasDeCuenta(ACCOUNT_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.operaciones_en_la_muestra).toBe(0);
    expect(r.value.esperanza).toBeNull();
    expect(r.value.desviacion).toBeNull();
    expect(r.value.win_rate).toBeNull();
    expect(r.value.racha).toBeNull();
  });

  it("con UNA sola Operación hay esperanza, acierto y racha; la desviación NO está definida", async () => {
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("2.0000")]);

    const r = await service.estadisticasDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.operaciones_en_la_muestra).toBe(1);
    expect(r.value.esperanza).not.toBeNull();
    expect(toDisplayString(r.value.esperanza!)).toBe("2.0000");
    // La varianza muestral no está definida para N = 1. No se sortea con un 0.
    expect(r.value.desviacion).toBeNull();
    expect(r.value.win_rate).not.toBeNull();
    expect(r.value.racha).toEqual({ longitud: 1, signo: "positiva" });
  });

  it("la esperanza es la media de la muestra, reproducible a mano", async () => {
    // (2 + (-1) + 1.75 + (-0.75)) / 4 = 2 / 4 = 0.5
    gateway.seedVigenteSample(ACCOUNT_ID, [
      rvalue("2.0000"),
      rvalue("-1.0000"),
      rvalue("1.7500"),
      rvalue("-0.7500"),
    ]);

    const r = await service.estadisticasDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.esperanza!)).toBe("0.5000");
    expect(r.value.operaciones_en_la_muestra).toBe(4);
  });

  it("el acierto cuenta las Operaciones con R > 0, no las que ganan dinero", async () => {
    // 2 de 4 por encima de cero → 50 %
    gateway.seedVigenteSample(ACCOUNT_ID, [
      rvalue("2.0000"),
      rvalue("-1.0000"),
      rvalue("1.7500"),
      rvalue("-0.7500"),
    ]);

    const r = await service.estadisticasDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(toDisplayString(r.value.win_rate!)).toBe("50.00");
  });

  it("la desviación aparece en cuanto hay dos Operaciones", async () => {
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("1.0000"), rvalue("-1.0000")]);

    const r = await service.estadisticasDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.desviacion).not.toBeNull();
  });

  it("la racha máxima detecta la secuencia de pérdidas más larga y su signo", async () => {
    gateway.seedVigenteSample(ACCOUNT_ID, [
      rvalue("1.0000"),
      rvalue("-1.0000"),
      rvalue("-1.0000"),
      rvalue("-1.0000"),
      rvalue("2.0000"),
    ]);

    const r = await service.estadisticasDeCuenta(ACCOUNT_ID);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.racha).toEqual({ longitud: 3, signo: "negativa" });
  });

  it("usa la MISMA muestra que el R agregado: una sola fuente para el mismo hecho", async () => {
    const muestra = [rvalue("2.0000"), rvalue("-1.0000"), rvalue("1.7500")];
    gateway.seedVigenteSample(ACCOUNT_ID, muestra);

    const [resumen, estadisticas] = await Promise.all([
      service.resumenDeCuenta(ACCOUNT_ID),
      service.estadisticasDeCuenta(ACCOUNT_ID),
    ]);
    if (!resumen.ok || !estadisticas.ok) throw new Error("unreachable");
    expect(estadisticas.value.operaciones_en_la_muestra).toBe(resumen.value.operaciones_en_la_muestra);
    // 2.75 / 3 = 0.9166...
    expect(toDisplayString(resumen.value.r_agregado)).toBe("2.7500");
    expect(toDisplayString(estadisticas.value.esperanza!)).toBe("0.9167");
  });

  it("no toca ninguna RPC de escritura: solo mide", async () => {
    gateway.seedVigenteSample(ACCOUNT_ID, [rvalue("1.0000"), rvalue("2.0000")]);
    await service.estadisticasDeCuenta(ACCOUNT_ID);
    expect(gateway.cierreCallCount).toBe(0);
    expect(gateway.edicionCallCount).toBe(0);
  });
});
