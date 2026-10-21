// Clasificación de una importación: qué se guardaría, qué no y por qué.
//
// Independiente de la plataforma: trabaja sobre filas ya traducidas y sobre
// las claves que la base de datos dice tener. Es la lógica que pinta la vista
// previa y la que decide qué se envía al confirmar; las dos usan esta misma
// función para que no puedan divergir.
import { claveCoincidencia, claveDeduplicacion, huellaBase } from "./huella.js";
import type { FilaInvalida, FilaOperacionCerrada, ProblemaDeFila } from "./tipos.js";

export interface FilaPreparada extends FilaOperacionCerrada {
  claveDeduplicacion: string;
  claveCoincidencia: string;
  /** 1 para la primera aparición de una fila; 2, 3… para copias idénticas. */
  ocurrencia: number;
}

export function prepararFilas(conector: string, validas: FilaOperacionCerrada[]): FilaPreparada[] {
  const vistas = new Map<string, number>();
  return validas.map((f) => {
    const base = huellaBase(conector, f);
    const ocurrencia = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, ocurrencia);
    return {
      ...f,
      ocurrencia,
      claveDeduplicacion: claveDeduplicacion(base, ocurrencia),
      claveCoincidencia: claveCoincidencia(conector, f),
    };
  });
}

/** Cuentas externas distintas presentes en las filas válidas, por orden de aparición. */
export function cuentasExternas(filas: FilaOperacionCerrada[]): string[] {
  return [...new Set(filas.map((f) => f.cuentaExterna))];
}

export type EstadoFila =
  /** Se guardará al confirmar. */
  | "nueva"
  /** Solo se guardará si el usuario la acepta expresamente. */
  | "revision"
  /** Ya está importada (misma clave): no se guarda otra vez. */
  | "duplicada"
  /** Pertenece a otra cuenta externa del fichero: no entra en este lote. */
  | "otra_cuenta"
  /** No supera la validación: no se guarda. */
  | "invalida";

export interface FilaClasificada {
  fila: number;
  estado: EstadoFila;
  /** Presente salvo en las inválidas. */
  datos: FilaPreparada | null;
  errores: ProblemaDeFila[];
  revision: ProblemaDeFila[];
  notas: ProblemaDeFila[];
  original: Record<string, string>;
}

export interface ResumenClasificacion {
  total: number;
  nuevas: number;
  revision: number;
  duplicadas: number;
  otraCuenta: number;
  invalidas: number;
}

export interface Existentes {
  /** Claves de deduplicación ya guardadas para esta cuenta y conector. */
  claves: ReadonlySet<string>;
  /** Claves de coincidencia ya guardadas para esta cuenta y conector. */
  coincidencias: ReadonlySet<string>;
}

export function clasificar(
  preparadas: FilaPreparada[],
  invalidas: FilaInvalida[],
  cuentaExterna: string,
  existentes: Existentes,
): { filas: FilaClasificada[]; resumen: ResumenClasificacion } {
  const filas: FilaClasificada[] = [];

  for (const p of preparadas) {
    const base = { fila: p.fila, datos: p, errores: [], notas: p.notas, original: p.original };
    if (p.cuentaExterna !== cuentaExterna) {
      filas.push({ ...base, estado: "otra_cuenta", revision: p.revision });
      continue;
    }
    if (existentes.claves.has(p.claveDeduplicacion)) {
      filas.push({ ...base, estado: "duplicada", revision: p.revision });
      continue;
    }
    const revision = [...p.revision];
    if (p.ocurrencia > 1) {
      revision.push({
        campo: "*",
        codigo: "FILA_IDENTICA_EN_FICHERO",
        mensaje: `Es la copia nº ${p.ocurrencia} de una fila idéntica del mismo fichero. Puede ser legítima (dos ejecuciones iguales) o un duplicado de la exportación: decide tú`,
      });
    }
    if (existentes.coincidencias.has(p.claveCoincidencia)) {
      revision.push({
        campo: "*",
        codigo: "POSIBLE_DUPLICADO_DE_IMPORTADA",
        mensaje: "Ya hay una fila importada con la misma cuenta, contrato, horas, lado y cantidad pero distintos precios o P&L. No se fusiona: si es una corrección de la plataforma, no la aceptes",
      });
    }
    filas.push({ ...base, estado: revision.length > 0 ? "revision" : "nueva", revision });
  }

  for (const inv of invalidas) {
    filas.push({ fila: inv.fila, estado: "invalida", datos: null, errores: inv.errores, revision: [], notas: [], original: inv.original });
  }

  filas.sort((a, b) => a.fila - b.fila);
  const cuenta = (e: EstadoFila) => filas.filter((f) => f.estado === e).length;
  return {
    filas,
    resumen: {
      total: filas.length,
      nuevas: cuenta("nueva"),
      revision: cuenta("revision"),
      duplicadas: cuenta("duplicada"),
      otraCuenta: cuenta("otra_cuenta"),
      invalidas: cuenta("invalida"),
    },
  };
}

/**
 * Filas que se enviarán a la base de datos: todas las nuevas y, de las que
 * están en revisión, solo las que el usuario ha aceptado por número de fila.
 */
export function filasAGuardar(filas: FilaClasificada[], aceptadas: ReadonlySet<number>): FilaClasificada[] {
  return filas.filter((f) => f.estado === "nueva" || (f.estado === "revision" && aceptadas.has(f.fila)));
}
