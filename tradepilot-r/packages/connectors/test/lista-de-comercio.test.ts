import { describe, expect, it } from "vitest";
import {
  comprobarFicheroListaDeComercio,
  conectorNysListaDeComercio,
  type ResultadoTraduccion,
} from "../src/index.js";
import { CABECERA, CUENTA_A, FILA_EJEMPLO, FILA_PERDIDA_CORTO, crearXlsx } from "./fixtures/xlsx.js";

const NY = "America/New_York";

async function traducir(filas: unknown[][], zonaHoraria = NY) {
  return conectorNysListaDeComercio.traducir(await crearXlsx(filas), { zonaHoraria });
}

function exito(r: ResultadoTraduccion) {
  if (!r.ok) throw new Error(`se esperaba éxito, llegó ${JSON.stringify(r.error)}`);
  return r;
}

/** Copia de la fila de ejemplo con una columna sustituida. */
function con(columna: string, valor: unknown, base: unknown[] = FILA_EJEMPLO): unknown[] {
  const f = [...base];
  f[CABECERA.indexOf(columna)] = valor;
  return f;
}

describe("fichero válido", () => {
  it("traduce la fila de ejemplo conservando exactamente bruto y neto", async () => {
    const r = exito(await traducir([CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]));
    expect(r.invalidas).toEqual([]);
    expect(r.validas).toHaveLength(2);
    const [f] = r.validas;
    expect(f).toMatchObject({
      fila: 2,
      cuentaExterna: CUENTA_A,
      simbolo: "MNQ",
      contrato: "/MNQZ26:XCME",
      entradaLocal: "2026-10-06 14:03:56",
      salidaLocal: "2026-10-06 14:07:51",
      precioEntrada: "31532",
      precioSalida: "31567.75",
      lado: "BUY",
      cantidad: "1",
      pnlBruto: "71.5",
      pnlNeto: "69.9",
      revision: [],
      notas: [],
    });
    // Octubre en Nueva York es EDT (UTC−4): conversión explícita, no del servidor.
    expect(f?.entradaUtc).toBe("2026-10-06T18:03:56.000Z");
    expect(f?.salidaUtc).toBe("2026-10-06T18:07:51.000Z");
  });

  it("acepta una pérdida en corto: P&L negativo con bruto y neto distintos y sin tocar", async () => {
    const r = exito(await traducir([CABECERA, FILA_PERDIDA_CORTO]));
    expect(r.validas[0]).toMatchObject({ lado: "SELL", cantidad: "2", pnlBruto: "-40", pnlNeto: "-43.2", revision: [] });
  });

  it("no resta comisiones ni deduce nada de la diferencia bruto−neto", async () => {
    const r = exito(await traducir([CABECERA, con("Net P/L", 12.34)]));
    expect(r.validas[0]?.pnlBruto).toBe("71.5");
    expect(r.validas[0]?.pnlNeto).toBe("12.34");
    expect(r.validas[0]?.revision).toEqual([]);
  });

  it("guarda los valores originales de todas las columnas, incluidas las desconocidas", async () => {
    const r = exito(await traducir([[...CABECERA, "Comentario"], [...FILA_EJEMPLO, "nota libre"]]));
    expect(r.columnasExtra).toEqual(["Comentario"]);
    expect(r.validas[0]?.original).toMatchObject({ "Entry Price": "31532", "Net P/L": "69.9", Comentario: "nota libre" });
  });

  it("encuentra la cabecera aunque haya un título encima", async () => {
    const r = exito(await traducir([["Lista de comercio"], [], CABECERA, FILA_EJEMPLO]));
    expect(r.validas).toHaveLength(1);
    expect(r.validas[0]?.fila).toBe(4);
  });

  it("acepta precios escritos como texto y celdas de fecha de Excel con el mismo resultado", async () => {
    const comoTexto = con("Entry Price", "31532.00", con("Exit Price", "31567.75"));
    const conFechas = con("Entry Date", new Date(Date.UTC(2026, 9, 6, 14, 3, 56)), con("Exit Date", new Date(Date.UTC(2026, 9, 6, 14, 7, 51))));
    const r = exito(await traducir([CABECERA, comoTexto, conFechas]));
    expect(r.invalidas).toEqual([]);
    expect(r.validas[0]?.precioEntrada).toBe("31532");
    expect(r.validas[1]?.entradaLocal).toBe("2026-10-06 14:03:56");
    expect(r.validas[1]?.entradaUtc).toBe("2026-10-06T18:03:56.000Z");
  });

  it("acepta el lado en minúsculas y lo conserva en el original", async () => {
    const r = exito(await traducir([CABECERA, con("Side", "buy")]));
    expect(r.validas[0]?.lado).toBe("BUY");
    expect(r.validas[0]?.original.Side).toBe("buy");
  });

  it("la misma hora con otra zona declarada da otro instante, nunca uno silencioso", async () => {
    const r = exito(await traducir([CABECERA, FILA_EJEMPLO], "Europe/Madrid"));
    expect(r.validas[0]?.entradaLocal).toBe("2026-10-06 14:03:56");
    expect(r.validas[0]?.entradaUtc).toBe("2026-10-06T12:03:56.000Z");
  });
});

describe("estructura del fichero", () => {
  it("columna renombrada → error que nombra la que falta", async () => {
    const renombrada = CABECERA.map((c) => (c === "Net P/L" ? "Net PnL" : c));
    const r = await traducir([renombrada, FILA_EJEMPLO]);
    expect(r).toEqual({
      ok: false,
      error: { codigo: "COLUMNAS_AUSENTES", faltan: ["Net P/L"], encontradas: expect.arrayContaining(["Net PnL"]) },
    });
  });

  it("columnas ausentes → error con todas las que faltan", async () => {
    const r = await traducir([CABECERA.slice(0, 8), FILA_EJEMPLO.slice(0, 8)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ codigo: "COLUMNAS_AUSENTES", faltan: ["Quantity", "Gross P/L", "Net P/L"] });
  });

  it("sin cabecera reconocible → CABECERA_NO_ENCONTRADA", async () => {
    const r = await traducir([["a", "b", "c"], [1, 2, 3]]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("CABECERA_NO_ENCONTRADA");
  });

  it("columna duplicada → error", async () => {
    const r = await traducir([[...CABECERA, "Net P/L"], [...FILA_EJEMPLO, 1]]);
    expect(r).toEqual({ ok: false, error: { codigo: "COLUMNAS_DUPLICADAS", duplicadas: ["Net P/L"] } });
  });

  it("solo cabecera → SIN_FILAS_DE_DATOS", async () => {
    const r = await traducir([CABECERA, [], []]);
    expect(r).toEqual({ ok: false, error: { codigo: "SIN_FILAS_DE_DATOS" } });
  });

  it("ignora filas totalmente vacías entre datos", async () => {
    const r = exito(await traducir([CABECERA, FILA_EJEMPLO, [], FILA_PERDIDA_CORTO]));
    expect(r.validas.map((f) => f.fila)).toEqual([2, 4]);
  });

  it("zona horaria no reconocida → error de fichero, no una conversión por defecto", async () => {
    const r = await traducir([CABECERA, FILA_EJEMPLO], "Hora/DeMiPueblo");
    expect(r).toEqual({ ok: false, error: { codigo: "ZONA_HORARIA_NO_VALIDA", zona: "Hora/DeMiPueblo" } });
  });

  it("contenido ZIP que no es un libro de Excel → XLSX_ILEGIBLE sin lanzar", async () => {
    const zipVacio = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);
    const r = await conectorNysListaDeComercio.traducir(zipVacio, { zonaHoraria: NY });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("XLSX_ILEGIBLE");
  });

  it("xlsx truncado → rechazado antes de descomprimir, sin lanzar", async () => {
    const bytes = await crearXlsx([CABECERA, FILA_EJEMPLO]);
    const r = await conectorNysListaDeComercio.traducir(bytes.slice(0, Math.floor(bytes.length / 2)), { zonaHoraria: NY });
    expect(r).toEqual({ ok: false, error: { codigo: "ZIP_NO_ADMITIDO", motivo: "ESTRUCTURA" } });
  });
});

describe("comprobación previa del fichero", () => {
  it("extensión incorrecta", async () => {
    expect(comprobarFicheroListaDeComercio("export.csv", await crearXlsx([CABECERA]))).toEqual({
      codigo: "EXTENSION_NO_ADMITIDA",
      nombre: "export.csv",
    });
  });

  it("fichero vacío", () => {
    expect(comprobarFicheroListaDeComercio("export.xlsx", new Uint8Array())).toEqual({ codigo: "FICHERO_VACIO" });
  });

  it("un CSV renombrado a .xlsx no es un xlsx", () => {
    const csv = new TextEncoder().encode(CABECERA.join(";"));
    expect(comprobarFicheroListaDeComercio("export.xlsx", csv)).toEqual({ codigo: "NO_ES_XLSX" });
  });

  it("acepta la extensión en mayúsculas", async () => {
    expect(comprobarFicheroListaDeComercio("EXPORT.XLSX", await crearXlsx([CABECERA]))).toBeNull();
  });
});

describe("filas inválidas: se rechazan una a una sin tumbar el fichero", () => {
  it("fechas inválidas", async () => {
    const r = exito(
      await traducir([CABECERA, con("Entry Date", "2026-13-01 10:00:00"), con("Exit Date", "06/10/2026 14:07"), FILA_EJEMPLO]),
    );
    expect(r.validas).toHaveLength(1);
    expect(r.invalidas.map((i) => [i.fila, i.errores.map((e) => e.codigo)])).toEqual([
      [2, ["FECHA_INVALIDA"]],
      [3, ["FECHA_INVALIDA"]],
    ]);
  });

  it("números inválidos, incluida la coma decimal ambigua", async () => {
    const r = exito(await traducir([CABECERA, con("Entry Price", "31.532,5"), con("Net P/L", "abc"), con("Quantity", 0)]));
    expect(r.validas).toEqual([]);
    expect(r.invalidas.map((i) => i.errores.map((e) => e.codigo))).toEqual([["NUMERO_INVALIDO"], ["NUMERO_INVALIDO"], ["CANTIDAD_CERO"]]);
  });

  it("campos vacíos y lado desconocido", async () => {
    const r = exito(await traducir([CABECERA, con("Account", ""), con("Side", "LONG")]));
    expect(r.invalidas.map((i) => i.errores.map((e) => e.codigo))).toEqual([["CAMPO_VACIO"], ["LADO_INVALIDO"]]);
  });

  it("salida anterior a la entrada", async () => {
    const r = exito(await traducir([CABECERA, con("Exit Date", "2026-10-06 13:00:00")]));
    expect(r.invalidas[0]?.errores.map((e) => e.codigo)).toEqual(["SALIDA_ANTERIOR_A_ENTRADA"]);
  });

  it("precio cero o negativo", async () => {
    const r = exito(await traducir([CABECERA, con("Entry Price", 0), con("Exit Price", -1)]));
    expect(r.invalidas.map((i) => i.errores.map((e) => e.codigo))).toEqual([["PRECIO_NO_POSITIVO"], ["PRECIO_NO_POSITIVO"]]);
  });

  it("hora inexistente (salto de primavera) y ambigua (hora repetida de otoño)", async () => {
    const r = exito(
      await traducir([
        CABECERA,
        con("Entry Date", "2026-03-08 02:30:00", con("Exit Date", "2026-03-08 04:00:00")),
        con("Entry Date", "2026-11-01 01:30:00", con("Exit Date", "2026-11-01 03:00:00")),
      ]),
    );
    expect(r.invalidas.map((i) => i.errores.map((e) => e.codigo))).toEqual([["HORA_INEXISTENTE"], ["HORA_AMBIGUA"]]);
  });

  it("una hora con zona escrita no se convierte en silencio", async () => {
    const r = exito(await traducir([CABECERA, con("Entry Date", "2026-10-06T14:03:56Z")]));
    expect(r.invalidas[0]?.errores[0]?.codigo).toBe("FECHA_INVALIDA");
  });
});

describe("datos que exigen revisión, nunca corrección", () => {
  it("cantidad negativa: se conserva, no se invierte el lado y va a revisión", async () => {
    const r = exito(await traducir([CABECERA, con("Quantity", -1)]));
    expect(r.validas[0]).toMatchObject({ cantidad: "-1", lado: "BUY" });
    expect(r.validas[0]?.revision.map((p) => p.codigo)).toEqual(["CANTIDAD_NEGATIVA"]);
    expect(r.validas[0]?.notas.map((p) => p.codigo)).toEqual(["PNL_SIN_COMPROBAR"]);
  });

  it("cantidad no entera → revisión", async () => {
    const r = exito(await traducir([CABECERA, con("Quantity", 1.5, con("Gross P/L", 107.25))]));
    expect(r.validas[0]?.revision.map((p) => p.codigo)).toEqual(["CANTIDAD_NO_ENTERA"]);
  });

  it("bruto que no cuadra con los precios: se conserva el valor del fichero y va a revisión", async () => {
    const r = exito(await traducir([CABECERA, con("Gross P/L", 70)]));
    expect(r.validas[0]?.pnlBruto).toBe("70");
    expect(r.validas[0]?.revision[0]).toMatchObject({ codigo: "PNL_BRUTO_NO_CUADRA" });
    expect(r.validas[0]?.revision[0]?.mensaje).toContain("71.5");
  });

  it("lado contrario al movimiento: el signo del bruto no cuadra → revisión", async () => {
    const r = exito(await traducir([CABECERA, con("Side", "SELL")]));
    expect(r.validas[0]?.revision[0]?.mensaje).toContain("-71.5");
  });

  it("instrumento sin especificación: nota informativa, no revisión", async () => {
    const r = exito(await traducir([CABECERA, con("Symbol", "GC")]));
    expect(r.validas[0]?.revision).toEqual([]);
    expect(r.validas[0]?.notas.map((p) => p.codigo)).toEqual(["PNL_SIN_COMPROBAR"]);
  });
});

describe("lo que el fichero no trae no se inventa", () => {
  it("la fila traducida no tiene R, riesgo, stop, objetivo, estrategia ni MAE/MFE", async () => {
    const r = exito(await traducir([CABECERA, FILA_EJEMPLO]));
    const claves = Object.keys(r.validas[0] ?? {});
    for (const prohibida of ["r", "rFinal", "riesgo", "stop", "takeProfit", "estrategia", "mae", "mfe", "comision"]) {
      expect(claves).not.toContain(prohibida);
    }
  });
});

/** Busca la primera cabecera del directorio central y devuelve su posición. */
function directorioCentral(b: Uint8Array): number {
  for (let i = b.length - 22; i >= 0; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
      return (b[i + 16]! | (b[i + 17]! << 8) | (b[i + 18]! << 16)) + (b[i + 19]! << 24);
    }
  }
  throw new Error("sin directorio central");
}

describe("protecciones del lector frente a ficheros hostiles", () => {
  it("un ZIP que declara demasiado contenido descomprimido (bomba ZIP) se rechaza sin abrirlo", async () => {
    const bytes = await crearXlsx([CABECERA, FILA_EJEMPLO]);
    const p = directorioCentral(bytes);
    // Tamaño descomprimido declarado de la primera entrada: 100 MB.
    new DataView(bytes.buffer, bytes.byteOffset).setUint32(p + 24, 100 * 1024 * 1024, true);
    expect(comprobarFicheroListaDeComercio("lista.xlsx", bytes)).toEqual({ codigo: "CONTENIDO_DEMASIADO_GRANDE", maximo: 64 * 1024 * 1024 });
    const r = await conectorNysListaDeComercio.traducir(bytes, { zonaHoraria: NY });
    expect(r).toMatchObject({ ok: false, error: { codigo: "CONTENIDO_DEMASIADO_GRANDE" } });
  });

  it("un ZIP cifrado se rechaza", async () => {
    const bytes = await crearXlsx([CABECERA, FILA_EJEMPLO]);
    const p = directorioCentral(bytes);
    bytes[p + 8] = bytes[p + 8]! | 0x1;
    expect(comprobarFicheroListaDeComercio("lista.xlsx", bytes)).toEqual({ codigo: "ZIP_NO_ADMITIDO", motivo: "CIFRADO" });
  });

  it("un xlsx normal pasa la inspección", async () => {
    expect(comprobarFicheroListaDeComercio("lista.xlsx", await crearXlsx([CABECERA, FILA_EJEMPLO]))).toBeNull();
  });

  it("demasiadas columnas → error de fichero", async () => {
    const extras = Array.from({ length: 60 }, (_, i) => `Extra ${i}`);
    const r = await traducir([[...CABECERA, ...extras], FILA_EJEMPLO]);
    expect(r).toEqual({ ok: false, error: { codigo: "DEMASIADAS_COLUMNAS", columnas: 71, maximo: 64 } });
  });

  it("una celda desmesurada invalida su fila y no se guarda entera", async () => {
    const r = exito(await traducir([[...CABECERA, "Notas"], [...FILA_EJEMPLO, "x".repeat(5000)]]));
    expect(r.validas).toEqual([]);
    expect(r.invalidas[0]?.errores.map((e) => e.codigo)).toEqual(["CELDA_DEMASIADO_LARGA"]);
    expect(r.invalidas[0]?.original.Notas?.length).toBeLessThanOrEqual(257);
  });

  it("una columna llamada __proto__ se conserva como dato y no toca el prototipo", async () => {
    const r = exito(await traducir([[...CABECERA, "__proto__"], [...FILA_EJEMPLO, "valor"]]));
    const original = r.validas[0]!.original;
    expect(Object.prototype.hasOwnProperty.call(original, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(original)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(original))["__proto__"]).toBe("valor");
  });
});
