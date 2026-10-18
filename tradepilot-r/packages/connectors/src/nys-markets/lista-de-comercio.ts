// Conector de fichero para la exportación «Lista de comercio» de NYS Markets.
//
// Toda la variación específica de esta plataforma vive aquí (I10,
// 06_CONNECTORS.md §1): nombres de columna, convención BUY/SELL y la
// comprobación de P&L. El núcleo no sabe que este fichero existe.
//
// Lo que este conector NO hace, a propósito:
//   · No agrupa filas. Varias filas pueden compartir hora de salida y eso no
//     las convierte en una sola posición: no hay regla validada para unirlas.
//   · No traduce BUY/SELL a long/short ni calcula R, riesgo, stop ni objetivo.
//   · No resta comisiones: el P&L neto se guarda tal como viene.
//   · No rellena lo que el fichero no trae (órdenes, modificaciones de stop o
//     TP, MAE/MFE, estrategia). Esos datos quedan ausentes.
import { comprobarFichero } from "../fichero.js";
import {
  aEscalado,
  escalaDe,
  esCero,
  esEntero,
  esNegativo,
  leerDecimalNumero,
  leerDecimalTexto,
  type DecimalLeido,
} from "../decimal-exacto.js";
import { leerXlsx } from "../xlsx.js";
import {
  esZonaValida,
  formatearReloj,
  leerRelojTexto,
  relojAUtc,
  relojDesdeFechaExcel,
  type RelojLeido,
} from "../zona-horaria.js";
import type {
  Celda,
  ConectorDeFichero,
  FilaInvalida,
  FilaOperacionCerrada,
  HojaLeida,
  ProblemaDeFila,
  ResultadoTraduccion,
} from "../tipos.js";
import { MULTIPLICADOR_POR_SIMBOLO } from "./validacion-instrumentos.js";

export const ID_CONECTOR_NYS_LISTA_DE_COMERCIO = "nys_markets_trade_list";

/** Columnas de la exportación, en el orden en que las entrega la plataforma. */
export const COLUMNAS_LISTA_DE_COMERCIO = [
  "Account",
  "Symbol",
  "Contract",
  "Entry Date",
  "Entry Price",
  "Exit Date",
  "Exit Price",
  "Side",
  "Quantity",
  "Gross P/L",
  "Net P/L",
] as const;

type Columna = (typeof COLUMNAS_LISTA_DE_COMERCIO)[number];

export const MAXIMO_FILAS = 5000;

/** Filas que se inspeccionan buscando la cabecera (puede haber un título encima). */
const FILAS_BUSQUEDA_CABECERA = 10;

const normalizarCabecera = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

const COLUMNA_POR_CABECERA = new Map<string, Columna>(
  COLUMNAS_LISTA_DE_COMERCIO.map((c) => [normalizarCabecera(c), c]),
);

function textoDeCelda(celda: Celda | undefined): string {
  if (!celda) return "";
  switch (celda.tipo) {
    case "vacia":
      return "";
    case "texto":
      return celda.valor.trim();
    case "numero":
      return String(celda.valor);
    case "booleano":
      return celda.valor ? "TRUE" : "FALSE";
    case "fecha": {
      const r = relojDesdeFechaExcel(celda.valor);
      return r.ok ? formatearReloj(r.reloj) : "";
    }
  }
}

interface Cabecera {
  hoja: HojaLeida;
  filaCabecera: number;
  indicePorColumna: Map<Columna, number>;
  columnasExtra: { nombre: string; indice: number }[];
}

type BusquedaCabecera =
  | { ok: true; cabecera: Cabecera }
  | { ok: false; error: ResultadoTraduccion & { ok: false } };

function buscarCabecera(hojas: HojaLeida[]): BusquedaCabecera {
  let mejorParcial: { encontradas: string[]; faltan: string[] } | null = null;
  for (const hoja of hojas) {
    const limite = Math.min(hoja.filas.length, FILAS_BUSQUEDA_CABECERA);
    for (let i = 0; i < limite; i++) {
      const fila = hoja.filas[i] ?? [];
      const textos = fila.map(textoDeCelda);
      const reconocidas = textos.filter((t) => COLUMNA_POR_CABECERA.has(normalizarCabecera(t)));
      if (reconocidas.length < 3) continue;

      const vistas = new Map<string, number>();
      for (const t of reconocidas) vistas.set(normalizarCabecera(t), (vistas.get(normalizarCabecera(t)) ?? 0) + 1);
      const duplicadas = [...vistas].filter(([, n]) => n > 1).map(([c]) => COLUMNA_POR_CABECERA.get(c) as string);
      if (duplicadas.length > 0) {
        return { ok: false, error: { ok: false, error: { codigo: "COLUMNAS_DUPLICADAS", duplicadas } } };
      }

      const indicePorColumna = new Map<Columna, number>();
      const columnasExtra: { nombre: string; indice: number }[] = [];
      textos.forEach((t, indice) => {
        if (t === "") return;
        const col = COLUMNA_POR_CABECERA.get(normalizarCabecera(t));
        if (col) indicePorColumna.set(col, indice);
        else columnasExtra.push({ nombre: t, indice });
      });
      const faltan = COLUMNAS_LISTA_DE_COMERCIO.filter((c) => !indicePorColumna.has(c));
      if (faltan.length === 0) {
        return { ok: true, cabecera: { hoja, filaCabecera: i, indicePorColumna, columnasExtra } };
      }
      if (!mejorParcial || faltan.length < mejorParcial.faltan.length) {
        mejorParcial = { encontradas: textos.filter((t) => t !== ""), faltan: [...faltan] };
      }
    }
  }
  if (mejorParcial) {
    return {
      ok: false,
      error: { ok: false, error: { codigo: "COLUMNAS_AUSENTES", faltan: mejorParcial.faltan, encontradas: mejorParcial.encontradas } },
    };
  }
  return { ok: false, error: { ok: false, error: { codigo: "CABECERA_NO_ENCONTRADA", faltan: [...COLUMNAS_LISTA_DE_COMERCIO] } } };
}

const problema = (campo: string, codigo: string, mensaje: string): ProblemaDeFila => ({ campo, codigo, mensaje });

function leerDecimal(celda: Celda | undefined): DecimalLeido {
  if (!celda || celda.tipo === "vacia") return { ok: false, motivo: "vacío" };
  if (celda.tipo === "numero") return leerDecimalNumero(celda.valor);
  if (celda.tipo === "texto") return leerDecimalTexto(celda.valor);
  return { ok: false, motivo: "no es un número" };
}

function leerReloj(celda: Celda | undefined): RelojLeido {
  if (!celda || celda.tipo === "vacia") return { ok: false, motivo: "vacío" };
  if (celda.tipo === "fecha") return relojDesdeFechaExcel(celda.valor);
  if (celda.tipo === "texto") return leerRelojTexto(celda.valor);
  // Un número suelto en una columna de fecha podría ser un número de serie de
  // Excel sin formato… o cualquier otra cosa. No se adivina.
  return { ok: false, motivo: "no es una fecha (número sin formato de fecha)" };
}

/**
 * Comprueba que el P&L bruto cuadra con los precios, con aritmética exacta.
 * Devuelve `null` si cuadra, un problema si no, o una nota si no se puede
 * comprobar. Nunca corrige el valor del fichero.
 */
function comprobarPnlBruto(
  simbolo: string,
  lado: "BUY" | "SELL",
  entrada: string,
  salida: string,
  cantidad: string,
  bruto: string,
): { revision?: ProblemaDeFila; nota?: ProblemaDeFila } {
  const multiplicador = MULTIPLICADOR_POR_SIMBOLO[simbolo.toUpperCase()];
  if (multiplicador === undefined) {
    return {
      nota: problema("Gross P/L", "PNL_SIN_COMPROBAR", `No hay especificación de validación para ${simbolo}; el P&L bruto se guarda sin comprobar`),
    };
  }
  if (esNegativo(cantidad)) {
    return {
      nota: problema("Gross P/L", "PNL_SIN_COMPROBAR", "Con cantidad negativa la convención de signo no está verificada; el P&L bruto no se comprueba"),
    };
  }
  const escalaPrecio = Math.max(escalaDe(entrada), escalaDe(salida));
  const escalaCantidad = escalaDe(cantidad);
  const escalaProducto = escalaPrecio + escalaCantidad;
  const escala = Math.max(escalaProducto, escalaDe(bruto));
  const diferencia = aEscalado(salida, escalaPrecio) - aEscalado(entrada, escalaPrecio);
  const signo = lado === "BUY" ? 1n : -1n;
  const esperado = diferencia * aEscalado(cantidad, escalaCantidad) * multiplicador * signo * 10n ** BigInt(escala - escalaProducto);
  if (esperado === aEscalado(bruto, escala)) return {};
  const negativo = esperado < 0n;
  const abs = (negativo ? -esperado : esperado).toString().padStart(escala + 1, "0");
  const textoEsperado = `${negativo ? "-" : ""}${escala > 0 ? `${abs.slice(0, -escala)}.${abs.slice(-escala)}` : abs}`;
  return {
    revision: problema(
      "Gross P/L",
      "PNL_BRUTO_NO_CUADRA",
      `Con ${lado} de ${cantidad} ${simbolo} de ${entrada} a ${salida} el bruto esperado es ${textoEsperado}, el fichero dice ${bruto}. Se conserva el valor del fichero`,
    ),
  };
}

function traducirFila(
  celdas: Celda[],
  numeroFila: number,
  cabecera: Cabecera,
  zonaHoraria: string,
): { valida: FilaOperacionCerrada } | { invalida: FilaInvalida } {
  const celda = (c: Columna) => celdas[cabecera.indicePorColumna.get(c) as number];
  const original: Record<string, string> = {};
  for (const c of COLUMNAS_LISTA_DE_COMERCIO) original[c] = textoDeCelda(celda(c));
  for (const extra of cabecera.columnasExtra) original[extra.nombre] = textoDeCelda(celdas[extra.indice]);

  const errores: ProblemaDeFila[] = [];
  const revision: ProblemaDeFila[] = [];
  const notas: ProblemaDeFila[] = [];

  const texto = (c: Columna): string => {
    const v = original[c] ?? "";
    if (v === "") errores.push(problema(c, "CAMPO_VACIO", `${c} está vacío`));
    return v;
  };
  const decimal = (c: Columna): string | null => {
    const r = leerDecimal(celda(c));
    if (!r.ok) {
      errores.push(problema(c, r.motivo === "vacío" ? "CAMPO_VACIO" : "NUMERO_INVALIDO", r.motivo === "vacío" ? `${c} está vacío` : `${c}: ${r.motivo}`));
      return null;
    }
    return r.valor;
  };
  const instante = (c: Columna): { local: string; utc: string } | null => {
    const r = leerReloj(celda(c));
    if (!r.ok) {
      errores.push(problema(c, r.motivo === "vacío" ? "CAMPO_VACIO" : "FECHA_INVALIDA", r.motivo === "vacío" ? `${c} está vacío` : `${c}: ${r.motivo}`));
      return null;
    }
    const u = relojAUtc(r.reloj, zonaHoraria);
    if (!u.ok) {
      errores.push(problema(c, u.codigo, `${c}: ${u.motivo}`));
      return null;
    }
    return { local: formatearReloj(r.reloj), utc: u.utc };
  };

  const cuentaExterna = texto("Account");
  const simbolo = texto("Symbol");
  const contrato = texto("Contract");
  const entrada = instante("Entry Date");
  const precioEntrada = decimal("Entry Price");
  const salida = instante("Exit Date");
  const precioSalida = decimal("Exit Price");
  const ladoTexto = texto("Side").toUpperCase();
  const cantidad = decimal("Quantity");
  const pnlBruto = decimal("Gross P/L");
  const pnlNeto = decimal("Net P/L");

  let lado: "BUY" | "SELL" | null = null;
  if (ladoTexto === "BUY" || ladoTexto === "SELL") lado = ladoTexto;
  else if (ladoTexto !== "") errores.push(problema("Side", "LADO_INVALIDO", `Side "${original.Side}" no es BUY ni SELL`));

  for (const [c, v] of [["Entry Price", precioEntrada], ["Exit Price", precioSalida]] as const) {
    if (v !== null && (esNegativo(v) || esCero(v))) errores.push(problema(c, "PRECIO_NO_POSITIVO", `${c} debe ser mayor que 0 (es ${v})`));
  }
  if (cantidad !== null) {
    if (esCero(cantidad)) errores.push(problema("Quantity", "CANTIDAD_CERO", "Quantity no puede ser 0"));
    else if (esNegativo(cantidad)) {
      revision.push(
        problema("Quantity", "CANTIDAD_NEGATIVA", `Quantity es ${cantidad}. La convención de signo de la plataforma no está verificada: se conserva tal cual y no se invierte el lado`),
      );
    }
    if (!esEntero(cantidad)) {
      revision.push(problema("Quantity", "CANTIDAD_NO_ENTERA", `Quantity ${cantidad} no es un número entero de contratos`));
    }
  }
  if (entrada && salida && salida.utc < entrada.utc) {
    errores.push(problema("Exit Date", "SALIDA_ANTERIOR_A_ENTRADA", `La salida (${salida.local}) es anterior a la entrada (${entrada.local})`));
  }

  if (
    errores.length > 0 ||
    !entrada ||
    !salida ||
    lado === null ||
    precioEntrada === null ||
    precioSalida === null ||
    cantidad === null ||
    pnlBruto === null ||
    pnlNeto === null
  ) {
    return { invalida: { fila: numeroFila, errores, original } };
  }

  const pnl = comprobarPnlBruto(simbolo, lado, precioEntrada, precioSalida, cantidad, pnlBruto);
  if (pnl.revision) revision.push(pnl.revision);
  if (pnl.nota) notas.push(pnl.nota);

  return {
    valida: {
      fila: numeroFila,
      cuentaExterna,
      simbolo,
      contrato,
      entradaLocal: entrada.local,
      entradaUtc: entrada.utc,
      precioEntrada,
      salidaLocal: salida.local,
      salidaUtc: salida.utc,
      precioSalida,
      lado,
      cantidad,
      pnlBruto,
      pnlNeto,
      original,
      revision,
      notas,
    },
  };
}

export const conectorNysListaDeComercio: ConectorDeFichero = {
  id: ID_CONECTOR_NYS_LISTA_DE_COMERCIO,
  ingestion_modes: ["file_import"],
  extensiones: [".xlsx"],

  async traducir(bytes, { zonaHoraria }): Promise<ResultadoTraduccion> {
    if (!esZonaValida(zonaHoraria)) return { ok: false, error: { codigo: "ZONA_HORARIA_NO_VALIDA", zona: zonaHoraria } };

    let hojas: HojaLeida[];
    try {
      hojas = await leerXlsx(bytes);
    } catch (e) {
      return { ok: false, error: { codigo: "XLSX_ILEGIBLE", detalle: e instanceof Error ? e.message : String(e) } };
    }
    if (hojas.length === 0) return { ok: false, error: { codigo: "XLSX_ILEGIBLE", detalle: "el libro no contiene hojas" } };

    const busqueda = buscarCabecera(hojas);
    if (!busqueda.ok) return busqueda.error;
    const { cabecera } = busqueda;

    const datos = cabecera.hoja.filas
      .map((celdas, i) => ({ celdas, numero: i + 1 }))
      .slice(cabecera.filaCabecera + 1)
      .filter(({ celdas }) => celdas.some((c) => c.tipo !== "vacia"));

    if (datos.length === 0) return { ok: false, error: { codigo: "SIN_FILAS_DE_DATOS" } };
    if (datos.length > MAXIMO_FILAS) return { ok: false, error: { codigo: "DEMASIADAS_FILAS", filas: datos.length, maximo: MAXIMO_FILAS } };

    const validas: FilaOperacionCerrada[] = [];
    const invalidas: FilaInvalida[] = [];
    for (const { celdas, numero } of datos) {
      const r = traducirFila(celdas, numero, cabecera, zonaHoraria);
      if ("valida" in r) validas.push(r.valida);
      else invalidas.push(r.invalida);
    }
    return {
      ok: true,
      hoja: cabecera.hoja.nombre,
      columnasExtra: cabecera.columnasExtra.map((c) => c.nombre),
      validas,
      invalidas,
    };
  },
};

/** Comprobación de nombre, tamaño y firma, con las extensiones de este conector. */
export function comprobarFicheroListaDeComercio(nombre: string, bytes: Uint8Array) {
  return comprobarFichero(nombre, bytes, conectorNysListaDeComercio.extensiones);
}
