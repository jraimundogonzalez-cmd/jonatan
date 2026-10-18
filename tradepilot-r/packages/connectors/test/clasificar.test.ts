import { describe, expect, it } from "vitest";
import {
  ID_CONECTOR_NYS_LISTA_DE_COMERCIO as CONECTOR,
  clasificar,
  conectorNysListaDeComercio,
  cuentasExternas,
  filasAGuardar,
  prepararFilas,
  type Existentes,
} from "../src/index.js";
import { CABECERA, CUENTA_A, CUENTA_B, FILA_EJEMPLO, FILA_PERDIDA_CORTO, crearXlsx } from "./fixtures/xlsx.js";

const NADA: Existentes = { claves: new Set(), coincidencias: new Set() };

async function preparar(filas: unknown[][], zonaHoraria = "America/New_York") {
  const r = await conectorNysListaDeComercio.traducir(await crearXlsx(filas), { zonaHoraria });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return { preparadas: prepararFilas(CONECTOR, r.validas), invalidas: r.invalidas };
}

describe("deduplicación", () => {
  it("importar dos veces el mismo fichero: la segunda vez todo es duplicado", async () => {
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]);
    const primera = clasificar(preparadas, invalidas, CUENTA_A, NADA);
    expect(primera.resumen).toMatchObject({ nuevas: 2, duplicadas: 0 });

    // Lo que la base de datos tendría tras la primera importación.
    const guardadas = filasAGuardar(primera.filas, new Set());
    const existentes: Existentes = {
      claves: new Set(guardadas.map((f) => f.datos!.claveDeduplicacion)),
      coincidencias: new Set(guardadas.map((f) => f.datos!.claveCoincidencia)),
    };

    const otraVez = await preparar([CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]);
    const segunda = clasificar(otraVez.preparadas, otraVez.invalidas, CUENTA_A, existentes);
    expect(segunda.resumen).toMatchObject({ total: 2, nuevas: 0, revision: 0, duplicadas: 2 });
    expect(filasAGuardar(segunda.filas, new Set([2, 3]))).toEqual([]);
  });

  it("la clave no depende de la zona declarada ni de cómo se escribió el decimal", async () => {
    const a = await preparar([CABECERA, FILA_EJEMPLO], "America/New_York");
    const filaConTexto = [...FILA_EJEMPLO];
    filaConTexto[4] = "31532.00";
    const b = await preparar([CABECERA, filaConTexto], "Europe/Madrid");
    expect(b.preparadas[0]?.claveDeduplicacion).toBe(a.preparadas[0]?.claveDeduplicacion);
  });

  it("cualquier cambio en un importe produce otra clave", async () => {
    const a = await preparar([CABECERA, FILA_EJEMPLO]);
    const neto = [...FILA_EJEMPLO];
    neto[10] = 69.8;
    const b = await preparar([CABECERA, neto]);
    expect(b.preparadas[0]?.claveDeduplicacion).not.toBe(a.preparadas[0]?.claveDeduplicacion);
    expect(b.preparadas[0]?.claveCoincidencia).toBe(a.preparadas[0]?.claveCoincidencia);
  });
});

describe("filas idénticas legítimas", () => {
  it("no se descartan: la primera es nueva, la copia va a revisión con otra clave", async () => {
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO, FILA_EJEMPLO]);
    const { filas, resumen } = clasificar(preparadas, invalidas, CUENTA_A, NADA);
    expect(resumen).toMatchObject({ nuevas: 1, revision: 1, duplicadas: 0 });
    expect(filas[1]?.revision.map((p) => p.codigo)).toEqual(["FILA_IDENTICA_EN_FICHERO"]);
    expect(preparadas[0]?.claveDeduplicacion).not.toBe(preparadas[1]?.claveDeduplicacion);
  });

  it("solo se guarda la copia si el usuario la acepta", async () => {
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO, FILA_EJEMPLO]);
    const { filas } = clasificar(preparadas, invalidas, CUENTA_A, NADA);
    expect(filasAGuardar(filas, new Set()).map((f) => f.fila)).toEqual([2]);
    expect(filasAGuardar(filas, new Set([3])).map((f) => f.fila)).toEqual([2, 3]);
  });

  it("reimportar el fichero con las dos copias aceptadas no duplica ninguna", async () => {
    const primera = await preparar([CABECERA, FILA_EJEMPLO, FILA_EJEMPLO]);
    const guardadas = filasAGuardar(clasificar(primera.preparadas, primera.invalidas, CUENTA_A, NADA).filas, new Set([3]));
    const existentes: Existentes = {
      claves: new Set(guardadas.map((f) => f.datos!.claveDeduplicacion)),
      coincidencias: new Set(guardadas.map((f) => f.datos!.claveCoincidencia)),
    };
    const segunda = await preparar([CABECERA, FILA_EJEMPLO, FILA_EJEMPLO]);
    expect(clasificar(segunda.preparadas, segunda.invalidas, CUENTA_A, existentes).resumen).toMatchObject({
      nuevas: 0,
      revision: 0,
      duplicadas: 2,
    });
  });

  it("varias filas que comparten hora de salida pero difieren son operaciones distintas, no se agrupan", async () => {
    const otra = [...FILA_EJEMPLO];
    otra[4] = 31540;
    otra[9] = 55.5;
    otra[10] = 53.9;
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO, otra]);
    const { resumen } = clasificar(preparadas, invalidas, CUENTA_A, NADA);
    expect(resumen).toMatchObject({ total: 2, nuevas: 2, revision: 0 });
  });
});

describe("coincidencias que no se pueden resolver con seguridad", () => {
  it("misma operación con otros importes que una ya importada → revisión, nunca fusión", async () => {
    const primera = await preparar([CABECERA, FILA_EJEMPLO]);
    const existentes: Existentes = {
      claves: new Set([primera.preparadas[0]!.claveDeduplicacion]),
      coincidencias: new Set([primera.preparadas[0]!.claveCoincidencia]),
    };
    const corregida = [...FILA_EJEMPLO];
    corregida[10] = 69.4;
    const segunda = await preparar([CABECERA, corregida]);
    const { filas } = clasificar(segunda.preparadas, segunda.invalidas, CUENTA_A, existentes);
    expect(filas[0]?.estado).toBe("revision");
    expect(filas[0]?.revision.map((p) => p.codigo)).toEqual(["POSIBLE_DUPLICADO_DE_IMPORTADA"]);
  });
});

describe("cuenta externa", () => {
  it("un fichero con dos cuentas: las filas de la otra cuenta no entran en el lote", async () => {
    const deB = [...FILA_PERDIDA_CORTO];
    deB[0] = CUENTA_B;
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO, deB]);
    expect(cuentasExternas(preparadas)).toEqual([CUENTA_A, CUENTA_B]);
    const { filas, resumen } = clasificar(preparadas, invalidas, CUENTA_A, NADA);
    expect(resumen).toMatchObject({ nuevas: 1, otraCuenta: 1 });
    expect(filasAGuardar(filas, new Set([3])).map((f) => f.fila)).toEqual([2]);
  });

  it("cuenta que no aparece en el fichero: nada que guardar", async () => {
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO]);
    const { filas, resumen } = clasificar(preparadas, invalidas, "NYS99999-999999", NADA);
    expect(resumen).toMatchObject({ nuevas: 0, otraCuenta: 1 });
    expect(filasAGuardar(filas, new Set([2]))).toEqual([]);
  });

  it("las inválidas se cuentan y nunca se guardan", async () => {
    const mala = [...FILA_EJEMPLO];
    mala[3] = "no es fecha";
    const { preparadas, invalidas } = await preparar([CABECERA, FILA_EJEMPLO, mala]);
    const { filas, resumen } = clasificar(preparadas, invalidas, CUENTA_A, NADA);
    expect(resumen).toMatchObject({ total: 2, nuevas: 1, invalidas: 1 });
    expect(filasAGuardar(filas, new Set([3])).map((f) => f.fila)).toEqual([2]);
  });
});

describe("fixtures deterministas", () => {
  it("el mismo contenido genera exactamente los mismos bytes aunque pase el tiempo", async () => {
    const a = await crearXlsx([CABECERA, FILA_EJEMPLO]);
    await new Promise((r) => setTimeout(r, 1100));
    const b = await crearXlsx([CABECERA, FILA_EJEMPLO]);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });
});
