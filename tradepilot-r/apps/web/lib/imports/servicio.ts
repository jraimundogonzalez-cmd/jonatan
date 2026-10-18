// Orquestación de la importación de un fichero de operaciones cerradas.
//
// Dos pasos, sin estado entre ellos:
//   1. previsualizar — lee el fichero, valida, consulta qué existe ya y
//      clasifica cada fila. NO escribe nada. Cancelar es, simplemente, no
//      confirmar.
//   2. confirmar — vuelve a recibir el MISMO fichero, comprueba que su huella
//      es la previsualizada, repite exactamente el mismo análisis y envía las
//      filas a una única RPC transaccional. Nunca se confía en filas ya
//      procesadas que vengan del navegador.
//
// Este módulo no conoce la plataforma: usa el conector, que es quien sabe leer
// el fichero (I10). No crea Operaciones, no calcula R y no envía órdenes (I17).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ID_CONECTOR_NYS_LISTA_DE_COMERCIO,
  clasificar,
  comprobarFicheroListaDeComercio,
  conectorNysListaDeComercio,
  cuentasExternas,
  esZonaValida,
  filasAGuardar,
  huellaFichero,
  prepararFilas,
  type Existentes,
  type FilaClasificada,
} from "@tradepilot/connectors";
import { obtenerCuenta } from "@/lib/api/funding";
import { confirmarImportacion, consultarImportacionPrevia, type FilaParaGuardar } from "@/lib/api/imports";
import type { EstadoVinculo, FilaVistaPrevia, ImportBatch, ImportResult, VistaPrevia } from "@/types/imports";

const CONECTOR = conectorNysListaDeComercio;
const SOURCE = ID_CONECTOR_NYS_LISTA_DE_COMERCIO;

export interface EntradaImportacion {
  accountId: string;
  ficheroNombre: string;
  bytes: Uint8Array;
  zonaHoraria: string;
  /** Cuenta del archivo elegida por el usuario; obligatoria si el archivo trae varias. */
  cuentaExterna: string | null;
}

export interface EntradaConfirmacion extends EntradaImportacion {
  sha256Previsualizado: string;
  /** Números de fila en revisión que el usuario ha aceptado expresamente. */
  aceptadas: number[];
  confirmarVinculo: boolean;
}

const VACIO: Existentes = { claves: new Set(), coincidencias: new Set() };

function aVistaPrevia(f: FilaClasificada): FilaVistaPrevia {
  const d = f.datos;
  return {
    fila: f.fila,
    estado: f.estado,
    cuentaExterna: d?.cuentaExterna ?? f.original.Account ?? null,
    simbolo: d?.simbolo ?? null,
    contrato: d?.contrato ?? null,
    lado: d?.lado ?? null,
    cantidad: d?.cantidad ?? null,
    entradaLocal: d?.entradaLocal ?? null,
    salidaLocal: d?.salidaLocal ?? null,
    precioEntrada: d?.precioEntrada ?? null,
    precioSalida: d?.precioSalida ?? null,
    pnlBruto: d?.pnlBruto ?? null,
    pnlNeto: d?.pnlNeto ?? null,
    errores: f.errores,
    revision: f.revision,
    notas: f.notas,
    original: f.original,
  };
}

async function analizar(
  client: SupabaseClient,
  entrada: EntradaImportacion,
): Promise<ImportResult<{ vista: VistaPrevia; clasificadas: FilaClasificada[] }>> {
  const cuenta = await obtenerCuenta(client, entrada.accountId);
  if (!cuenta.ok) {
    return { ok: false, error: cuenta.error.code === "UNKNOWN" ? { code: "UNKNOWN", detail: cuenta.error.detail } : { code: "ACCOUNT_NOT_FOUND" } };
  }

  const problemaFichero = comprobarFicheroListaDeComercio(entrada.ficheroNombre, entrada.bytes);
  if (problemaFichero) return { ok: false, error: { code: "FICHERO", error: problemaFichero } };
  if (!esZonaValida(entrada.zonaHoraria)) {
    return { ok: false, error: { code: "FICHERO", error: { codigo: "ZONA_HORARIA_NO_VALIDA", zona: entrada.zonaHoraria } } };
  }

  const traduccion = await CONECTOR.traducir(entrada.bytes, { zonaHoraria: entrada.zonaHoraria });
  if (!traduccion.ok) return { ok: false, error: { code: "FICHERO", error: traduccion.error } };

  const preparadas = prepararFilas(SOURCE, traduccion.validas);
  const externas = cuentasExternas(preparadas);
  const cuentaExterna = entrada.cuentaExterna ?? (externas.length === 1 ? (externas[0] as string) : null);

  const bloqueos: string[] = [];
  let existentes = VACIO;
  let vinculo: EstadoVinculo | null = null;
  let zonaVinculada: string | null = null;

  if (externas.length === 0) {
    bloqueos.push("No hay ninguna fila válida en el archivo.");
  } else if (cuentaExterna === null) {
    bloqueos.push(`El archivo contiene ${externas.length} cuentas (${externas.join(", ")}): elige cuál corresponde a esta Cuenta.`);
  } else {
    if (!externas.includes(cuentaExterna)) bloqueos.push(`La cuenta ${cuentaExterna} no aparece en el archivo.`);
    const propias = preparadas.filter((p) => p.cuentaExterna === cuentaExterna);
    const consulta = await consultarImportacionPrevia(client, {
      accountId: entrada.accountId,
      source: SOURCE,
      cuentaExterna,
      claves: propias.map((p) => p.claveDeduplicacion),
      coincidencias: propias.map((p) => p.claveCoincidencia),
    });
    if (!consulta.ok) return consulta;
    const c = consulta.value;
    existentes = { claves: new Set(c.claves_existentes), coincidencias: new Set(c.coincidencias_existentes) };
    zonaVinculada = c.zona_horaria_vinculada;

    if (c.cuenta_externa_en_otra_cuenta) {
      vinculo = { tipo: "en_otra_cuenta", nombreOtraCuenta: c.cuenta_externa_en_otra_cuenta.account_name };
      bloqueos.push(`La cuenta ${cuentaExterna} ya está vinculada a tu Cuenta «${c.cuenta_externa_en_otra_cuenta.account_name}».`);
    } else if (c.cuenta_externa_vinculada === null) {
      vinculo = { tipo: "nuevo" };
    } else if (c.cuenta_externa_vinculada === cuentaExterna) {
      vinculo = { tipo: "coincide" };
    } else {
      vinculo = { tipo: "no_coincide", vinculada: c.cuenta_externa_vinculada };
      bloqueos.push(`Esta Cuenta está vinculada a ${c.cuenta_externa_vinculada}; el archivo es de ${cuentaExterna}.`);
    }
    if (zonaVinculada !== null && zonaVinculada !== entrada.zonaHoraria) {
      bloqueos.push(`Las importaciones anteriores de esta Cuenta usaron la zona ${zonaVinculada}; has elegido ${entrada.zonaHoraria}.`);
    }
  }

  const { filas, resumen } = clasificar(preparadas, traduccion.invalidas, cuentaExterna ?? "", existentes);
  if (bloqueos.length === 0 && resumen.nuevas + resumen.revision === 0) {
    bloqueos.push("No hay ninguna fila nueva que importar: todo está ya importado, es de otra cuenta o no es válido.");
  }

  return {
    ok: true,
    value: {
      clasificadas: filas,
      vista: {
        accountId: entrada.accountId,
        ficheroNombre: entrada.ficheroNombre,
        ficheroSha256: huellaFichero(entrada.bytes),
        hoja: traduccion.hoja,
        columnasExtra: traduccion.columnasExtra,
        zonaHoraria: entrada.zonaHoraria,
        zonaVinculada,
        cuentasExternas: externas,
        cuentaExterna,
        vinculo,
        resumen,
        filas: filas.map(aVistaPrevia),
        bloqueos,
      },
    },
  };
}

export async function previsualizarImportacion(client: SupabaseClient, entrada: EntradaImportacion): Promise<ImportResult<VistaPrevia>> {
  const r = await analizar(client, entrada);
  return r.ok ? { ok: true, value: r.value.vista } : r;
}

export async function confirmarImportacionDeFichero(
  client: SupabaseClient,
  entrada: EntradaConfirmacion,
): Promise<ImportResult<ImportBatch>> {
  const r = await analizar(client, entrada);
  if (!r.ok) return r;
  const { vista, clasificadas } = r.value;

  if (vista.ficheroSha256 !== entrada.sha256Previsualizado) return { ok: false, error: { code: "FICHERO_CAMBIADO" } };
  if (vista.cuentaExterna === null) return { ok: false, error: { code: "CUENTA_EXTERNA_REQUERIDA" } };
  if (vista.bloqueos.length > 0) return { ok: false, error: { code: "IMPORTACION_BLOQUEADA", motivos: vista.bloqueos } };
  if (vista.vinculo?.tipo === "nuevo" && !entrada.confirmarVinculo) {
    return { ok: false, error: { code: "LINK_CONFIRMATION_REQUIRED", detail: vista.cuentaExterna } };
  }

  const aGuardar = filasAGuardar(clasificadas, new Set(entrada.aceptadas));
  const guardadas = new Set(aGuardar.map((f) => f.fila));
  const filas: FilaParaGuardar[] = aGuardar.map((f) => {
    const d = f.datos!;
    return {
      row_number: d.fila,
      occurrence: d.ocurrencia,
      dedup_key: d.claveDeduplicacion,
      match_key: d.claveCoincidencia,
      external_account_ref: d.cuentaExterna,
      symbol: d.simbolo,
      contract: d.contrato,
      entry_local: d.entradaLocal,
      exit_local: d.salidaLocal,
      entry_utc: d.entradaUtc,
      exit_utc: d.salidaUtc,
      entry_price: d.precioEntrada,
      exit_price: d.precioSalida,
      side: d.lado,
      quantity: d.cantidad,
      gross_pnl: d.pnlBruto,
      net_pnl: d.pnlNeto,
      review_reasons: f.revision.map((p) => p.codigo),
      raw: d.original,
    };
  });

  const noGuardadas = clasificadas.filter((f) => !guardadas.has(f.fila));
  const resumen = {
    total: vista.resumen.total,
    duplicadas: vista.resumen.duplicadas,
    revision_no_aceptadas: noGuardadas.filter((f) => f.estado === "revision").length,
    otra_cuenta: vista.resumen.otraCuenta,
    invalidas: vista.resumen.invalidas,
    hoja: vista.hoja,
    columnas_extra: vista.columnasExtra,
    detalle: noGuardadas.map((f) => ({
      fila: f.fila,
      estado: f.estado,
      motivos: [...f.errores, ...f.revision].map((p) => `${p.campo}: ${p.mensaje}`),
    })),
  };

  return confirmarImportacion(client, {
    accountId: entrada.accountId,
    source: SOURCE,
    ficheroNombre: entrada.ficheroNombre,
    ficheroSha256: vista.ficheroSha256,
    zonaHoraria: entrada.zonaHoraria,
    cuentaExterna: vista.cuentaExterna,
    confirmarVinculo: entrada.confirmarVinculo,
    filas,
    resumen,
  });
}
