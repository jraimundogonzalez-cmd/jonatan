// @vitest-environment node
//
// Servicio de importación con el conector REAL y ficheros .xlsx generados en
// el test. La base de datos es un doble: la atomicidad, la clave única y el
// aislamiento reales se prueban contra Postgres en
// supabase/tests/16_trade_file_imports.sql.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmarImportacionDeFichero, previsualizarImportacion } from "@/lib/imports/servicio";
import type { FilaParaGuardar } from "@/lib/api/imports";
import {
  CABECERA,
  CUENTA_A,
  CUENTA_B,
  FILA_EJEMPLO,
  FILA_PERDIDA_CORTO,
  crearXlsx,
} from "../../../../packages/connectors/test/fixtures/xlsx";

const CUENTA_TP = "11111111-1111-1111-1111-111111111111";
const NY = "America/New_York";

/** Doble de la base: guarda filas por clave y lotes, con la misma semántica de vínculo que imports.sql. */
function baseFalsa() {
  const filas = new Map<string, FilaParaGuardar>();
  const lotes: { external_account_ref: string; source_timezone: string; rows_imported: number }[] = [];
  let fallarConfirmacion = false;
  const llamadas: string[] = [];

  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) => {
    llamadas.push(nombre);
    switch (nombre) {
      case "obtener_cuenta":
        return args.p_id === CUENTA_TP
          ? { data: { id: CUENTA_TP, name: "Flex 25K #1", initial_capital: "25000", current_capital: "25000", peak_capital: "25000" }, error: null }
          : { data: null, error: null };
      case "consultar_importacion_previa": {
        const claves = args.p_dedup_keys as string[];
        const coincidencias = args.p_match_keys as string[];
        const guardadas = [...filas.values()];
        return {
          data: {
            claves_existentes: claves.filter((c) => filas.has(c)),
            coincidencias_existentes: coincidencias.filter((c) => guardadas.some((f) => f.match_key === c)),
            cuenta_externa_vinculada: lotes[0]?.external_account_ref ?? null,
            zona_horaria_vinculada: lotes[0]?.source_timezone ?? null,
            cuenta_externa_en_otra_cuenta: null,
          },
          error: null,
        };
      }
      case "confirmar_importacion": {
        if (fallarConfirmacion) return { data: null, error: { message: 'new row for relation "imported_trade_rows" violates check constraint' } };
        // Todo o nada, como la transacción real.
        const nuevas = (args.p_rows as FilaParaGuardar[]).filter((f) => !filas.has(f.dedup_key));
        for (const f of nuevas) filas.set(f.dedup_key, f);
        const lote = {
          id: `lote-${lotes.length + 1}`,
          external_account_ref: args.p_external_account_ref as string,
          source_timezone: args.p_source_timezone as string,
          rows_imported: nuevas.length,
        };
        lotes.push(lote);
        return { data: lote, error: null };
      }
      default:
        throw new Error(`RPC inesperada: ${nombre}`);
    }
  });

  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
    filas,
    lotes,
    llamadas,
    fallar: () => {
      fallarConfirmacion = true;
    },
  };
}

async function entrada(filas: unknown[][], extra: Partial<{ ficheroNombre: string; zonaHoraria: string; cuentaExterna: string | null; accountId: string }> = {}) {
  return {
    accountId: CUENTA_TP,
    ficheroNombre: "lista.xlsx",
    bytes: await crearXlsx(filas),
    zonaHoraria: NY,
    cuentaExterna: null,
    ...extra,
  };
}

async function previsualizarYConfirmar(
  db: ReturnType<typeof baseFalsa>,
  filas: unknown[][],
  opciones: { aceptadas?: number[]; confirmarVinculo?: boolean } = {},
) {
  const e = await entrada(filas);
  const vista = await previsualizarImportacion(db.client, e);
  if (!vista.ok) throw new Error(JSON.stringify(vista.error));
  const r = await confirmarImportacionDeFichero(db.client, {
    ...e,
    sha256Previsualizado: vista.value.ficheroSha256,
    aceptadas: opciones.aceptadas ?? [],
    confirmarVinculo: opciones.confirmarVinculo ?? true,
  });
  return { vista: vista.value, r };
}

describe("vista previa", () => {
  let db: ReturnType<typeof baseFalsa>;
  beforeEach(() => {
    db = baseFalsa();
  });

  it("archivo válido: resume y clasifica sin escribir nada", async () => {
    const r = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]));
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value.resumen).toMatchObject({ total: 2, nuevas: 2, revision: 0, duplicadas: 0, invalidas: 0 });
    expect(r.value.cuentaExterna).toBe(CUENTA_A);
    expect(r.value.vinculo).toEqual({ tipo: "nuevo" });
    expect(r.value.bloqueos).toEqual([]);
    expect(db.llamadas).not.toContain("confirmar_importacion");
  });

  it("extensión incorrecta: error de fichero y ni una RPC de escritura", async () => {
    const r = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_EJEMPLO], { ficheroNombre: "lista.csv" }));
    expect(r).toMatchObject({ ok: false, error: { code: "FICHERO", error: { codigo: "EXTENSION_NO_ADMITIDA" } } });
    expect(db.llamadas).not.toContain("confirmar_importacion");
  });

  it("columnas renombradas: error de fichero que nombra la columna", async () => {
    const r = await previsualizarImportacion(db.client, await entrada([CABECERA.map((c) => (c === "Side" ? "Direction" : c)), FILA_EJEMPLO]));
    expect(r).toMatchObject({ ok: false, error: { code: "FICHERO", error: { codigo: "COLUMNAS_AUSENTES", faltan: ["Side"] } } });
  });

  it("Cuenta de TradePilot desconocida", async () => {
    const r = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_EJEMPLO], { accountId: "otra" }));
    expect(r).toEqual({ ok: false, error: { code: "ACCOUNT_NOT_FOUND" } });
  });

  it("archivo con dos cuentas: exige elegir; elegida una, la otra queda fuera", async () => {
    const deB = [...FILA_PERDIDA_CORTO];
    deB[0] = CUENTA_B;
    const sinElegir = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_EJEMPLO, deB]));
    if (!sinElegir.ok) throw new Error("unreachable");
    expect(sinElegir.value.cuentaExterna).toBeNull();
    expect(sinElegir.value.bloqueos[0]).toContain("elige");

    const elegida = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_EJEMPLO, deB], { cuentaExterna: CUENTA_B }));
    if (!elegida.ok) throw new Error("unreachable");
    expect(elegida.value.resumen).toMatchObject({ nuevas: 1, otraCuenta: 1 });
    expect(elegida.value.bloqueos).toEqual([]);
  });
});

describe("confirmación", () => {
  let db: ReturnType<typeof baseFalsa>;
  beforeEach(() => {
    db = baseFalsa();
  });

  it("envía todas las filas en UNA sola llamada, con bruto y neto exactos como texto", async () => {
    const { r } = await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]);
    expect(r.ok).toBe(true);
    const confirmaciones = db.rpc.mock.calls.filter((c) => c[0] === "confirmar_importacion");
    expect(confirmaciones).toHaveLength(1);
    const enviadas = confirmaciones[0]![1].p_rows as FilaParaGuardar[];
    expect(enviadas.map((f) => [f.gross_pnl, f.net_pnl])).toEqual([
      ["71.5", "69.9"],
      ["-40", "-43.2"],
    ]);
    expect(enviadas[0]).toMatchObject({ entry_local: "2026-10-06 14:03:56", entry_utc: "2026-10-06T18:03:56.000Z", side: "BUY", quantity: "1" });
    expect(Object.keys(enviadas[0]!)).not.toContain("r_final");
  });

  it("importar dos veces el mismo archivo no duplica: la segunda vista previa no tiene nada nuevo", async () => {
    await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]);
    expect(db.filas.size).toBe(2);

    const segunda = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]));
    if (!segunda.ok) throw new Error("unreachable");
    expect(segunda.value.resumen).toMatchObject({ nuevas: 0, duplicadas: 2 });
    expect(segunda.value.vinculo).toEqual({ tipo: "coincide" });
    expect(segunda.value.bloqueos[0]).toContain("No hay ninguna fila nueva");

    const intento = await confirmarImportacionDeFichero(db.client, {
      ...(await entrada([CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO])),
      sha256Previsualizado: segunda.value.ficheroSha256,
      aceptadas: [2, 3],
      confirmarVinculo: false,
    });
    expect(intento).toMatchObject({ ok: false, error: { code: "IMPORTACION_BLOQUEADA" } });
    expect(db.filas.size).toBe(2);
  });

  it("filas idénticas legítimas: la copia solo se guarda si se acepta, y con su motivo", async () => {
    const sinAceptar = await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO, FILA_EJEMPLO]);
    expect(sinAceptar.vista.resumen).toMatchObject({ nuevas: 1, revision: 1 });
    expect(db.filas.size).toBe(1);

    const otra = baseFalsa();
    await previsualizarYConfirmar(otra, [CABECERA, FILA_EJEMPLO, FILA_EJEMPLO], { aceptadas: [3] });
    expect(otra.filas.size).toBe(2);
    const copia = [...otra.filas.values()].find((f) => f.occurrence === 2);
    expect(copia?.review_reasons).toEqual(["FILA_IDENTICA_EN_FICHERO"]);
  });

  it("primera importación sin confirmar el vínculo de cuenta → rechazo sin escribir", async () => {
    const { r } = await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO], { confirmarVinculo: false });
    expect(r).toMatchObject({ ok: false, error: { code: "LINK_CONFIRMATION_REQUIRED" } });
    expect(db.llamadas).not.toContain("confirmar_importacion");
  });

  it("cuenta del archivo distinta de la vinculada → bloqueada", async () => {
    await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO]);
    const deB = [...FILA_PERDIDA_CORTO];
    deB[0] = CUENTA_B;
    const { vista, r } = await previsualizarYConfirmar(db, [CABECERA, deB]);
    expect(vista.vinculo).toEqual({ tipo: "no_coincide", vinculada: CUENTA_A });
    expect(r).toMatchObject({ ok: false, error: { code: "IMPORTACION_BLOQUEADA" } });
    expect(db.filas.size).toBe(1);
  });

  it("otra zona horaria que la de importaciones anteriores → bloqueada", async () => {
    await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO]);
    const r = await previsualizarImportacion(db.client, await entrada([CABECERA, FILA_PERDIDA_CORTO], { zonaHoraria: "Europe/Madrid" }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.bloqueos.join(" ")).toContain("America/New_York");
  });

  it("el archivo confirmado no es el previsualizado → rechazo sin escribir", async () => {
    const e = await entrada([CABECERA, FILA_EJEMPLO]);
    const vista = await previsualizarImportacion(db.client, e);
    if (!vista.ok) throw new Error("unreachable");
    const r = await confirmarImportacionDeFichero(db.client, {
      ...(await entrada([CABECERA, FILA_PERDIDA_CORTO])),
      sha256Previsualizado: vista.value.ficheroSha256,
      aceptadas: [],
      confirmarVinculo: true,
    });
    expect(r).toEqual({ ok: false, error: { code: "FICHERO_CAMBIADO" } });
    expect(db.llamadas).not.toContain("confirmar_importacion");
  });

  it("fallo de la transacción: error devuelto, sin reintento ni troceado, nada guardado", async () => {
    db.fallar();
    const { r } = await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]);
    expect(r).toMatchObject({ ok: false, error: { code: "UNKNOWN" } });
    expect(db.rpc.mock.calls.filter((c) => c[0] === "confirmar_importacion")).toHaveLength(1);
    expect(db.filas.size).toBe(0);
  });

  it("solo toca las RPC de importación y la lectura de la Cuenta: nunca Operaciones ni Cuentas", async () => {
    await previsualizarYConfirmar(db, [CABECERA, FILA_EJEMPLO, FILA_PERDIDA_CORTO]);
    expect(new Set(db.llamadas)).toEqual(new Set(["obtener_cuenta", "consultar_importacion_previa", "confirmar_importacion"]));
  });
});
