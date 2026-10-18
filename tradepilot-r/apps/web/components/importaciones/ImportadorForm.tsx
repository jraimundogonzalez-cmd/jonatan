"use client";

// Importador de la «Lista de comercio» (.xlsx).
//
// Flujo: elegir Cuenta, zona horaria y archivo → previsualizar (no guarda
// nada) → revisar → confirmar o cancelar. La previsualización y la
// confirmación las decide el servidor con el mismo análisis; este componente
// solo pinta y recoge las decisiones del usuario (qué filas en revisión
// acepta, y si confirma el vínculo de cuenta la primera vez).
//
// La zona horaria NO tiene valor por defecto: elegirla es una declaración del
// usuario sobre su archivo, y un valor preseleccionado sería una suposición.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EstadoFila } from "@tradepilot/connectors";
import { Button } from "@/components/ui";
import { confirmarImportacionAction, previsualizarImportacionAction } from "@/actions/importaciones";
import { ETIQUETA_ESTADO } from "@/lib/format/importacion";
import { ZONAS_HORARIAS_OFRECIDAS, importErrorMessage, type ImportError, type VistaPrevia } from "@/types/imports";
import opStyles from "@/components/operaciones/operaciones.module.css";
import styles from "./importaciones.module.css";

interface CuentaOpcion {
  id: string;
  name: string;
}

type Filtro = "todas" | EstadoFila;

export function ImportadorForm({ cuentas, cuentaInicial }: { cuentas: CuentaOpcion[]; cuentaInicial: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [accountId, setAccountId] = useState(cuentaInicial ?? "");
  const [zonaHoraria, setZonaHoraria] = useState("");
  const [fichero, setFichero] = useState<File | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [aceptadas, setAceptadas] = useState<Set<number>>(new Set());
  const [confirmarVinculo, setConfirmarVinculo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [error, setError] = useState<ImportError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const nombreCuenta = cuentas.find((c) => c.id === accountId)?.name ?? "";
  const puedePrevisualizar = accountId !== "" && zonaHoraria !== "" && fichero !== null && !pending;

  /** Cualquier cambio en los datos de entrada invalida la vista previa. */
  function descartarVista() {
    setVista(null);
    setAceptadas(new Set());
    setConfirmarVinculo(false);
    setError(null);
  }

  function formData(cuentaExterna: string | null): FormData {
    const fd = new FormData();
    fd.set("fichero", fichero as File);
    fd.set("accountId", accountId);
    fd.set("zonaHoraria", zonaHoraria);
    if (cuentaExterna) fd.set("cuentaExterna", cuentaExterna);
    return fd;
  }

  function previsualizar(cuentaExterna: string | null) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await previsualizarImportacionAction(formData(cuentaExterna));
      if (!r.ok) {
        setVista(null);
        setError(r.error);
        return;
      }
      setVista(r.value);
      setAceptadas(new Set());
      setConfirmarVinculo(false);
      setFiltro("todas");
    });
  }

  function confirmar() {
    if (!vista) return;
    setError(null);
    startTransition(async () => {
      const fd = formData(vista.cuentaExterna);
      fd.set("sha256", vista.ficheroSha256);
      fd.set("aceptadas", [...aceptadas].join(","));
      fd.set("confirmarVinculo", confirmarVinculo ? "si" : "no");
      const r = await confirmarImportacionAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/cuentas/${accountId}/importaciones/${r.value.id}`);
    });
  }

  function cancelar() {
    descartarVista();
    setAviso("Importación cancelada. No se ha guardado nada.");
  }

  function alternarAceptada(fila: number) {
    setAceptadas((prev) => {
      const s = new Set(prev);
      if (s.has(fila)) s.delete(fila);
      else s.add(fila);
      return s;
    });
  }

  const filasVisibles = useMemo(
    () => (vista ? vista.filas.filter((f) => filtro === "todas" || f.estado === filtro) : []),
    [vista, filtro],
  );

  const faltaVinculo = vista?.vinculo?.tipo === "nuevo" && !confirmarVinculo;
  const puedeConfirmar = vista !== null && vista.bloqueos.length === 0 && !faltaVinculo && !pending;
  const aGuardar = vista ? vista.resumen.nuevas + aceptadas.size : 0;

  return (
    <div>
      <div className={styles.formulario}>
        <label className={styles.campo}>
          <span className={styles.etiqueta}>Cuenta de destino en TradePilot</span>
          <select
            className={styles.select}
            name="accountId"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              descartarVista();
            }}
          >
            <option value="">— Elige una Cuenta —</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campo}>
          <span className={styles.etiqueta}>Zona horaria de las fechas del archivo</span>
          <select
            className={styles.select}
            name="zonaHoraria"
            value={zonaHoraria}
            onChange={(e) => {
              setZonaHoraria(e.target.value);
              descartarVista();
            }}
          >
            <option value="">— Elige la zona —</option>
            {ZONAS_HORARIAS_OFRECIDAS.map((z) => (
              <option key={z.valor} value={z.valor}>
                {z.etiqueta}
              </option>
            ))}
          </select>
          <p className={styles.ayuda}>
            El archivo trae horas sin zona. Elige la que muestra tu plataforma; la hora original se guarda tal cual
            junto a su conversión. Todas las importaciones de una Cuenta deben usar la misma zona.
          </p>
        </label>

        <label className={styles.campo}>
          <span className={styles.etiqueta}>Archivo «Lista de comercio» (.xlsx)</span>
          <input
            className={styles.fichero}
            type="file"
            name="fichero"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFichero(e.target.files?.[0] ?? null);
              descartarVista();
            }}
          />
        </label>

        <div className={opStyles.acciones}>
          <Button variant="primary" onClick={() => previsualizar(null)} disabled={!puedePrevisualizar} loading={pending && !vista}>
            Previsualizar
          </Button>
        </div>
      </div>

      {aviso ? <p className={styles.aviso}>{aviso}</p> : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {importErrorMessage(error)}
        </p>
      ) : null}

      {vista ? (
        <section className={opStyles.previsualizacion} aria-label="Vista previa de la importación">
          <p className={opStyles.previsualizacionTitulo}>Vista previa — todavía no se ha guardado nada</p>

          <p className={styles.ayuda}>
            {vista.ficheroNombre} · hoja «{vista.hoja}» · zona {vista.zonaHoraria}
            {vista.columnasExtra.length > 0 ? ` · columnas no reconocidas (se conservan): ${vista.columnasExtra.join(", ")}` : ""}
          </p>

          {vista.cuentasExternas.length > 1 ? (
            <label className={styles.campo} style={{ margin: "0.75rem 0" }}>
              <span className={styles.etiqueta}>El archivo contiene varias cuentas. ¿Cuál corresponde a «{nombreCuenta}»?</span>
              <select
                className={styles.select}
                value={vista.cuentaExterna ?? ""}
                onChange={(e) => previsualizar(e.target.value || null)}
              >
                <option value="">— Elige la cuenta del archivo —</option>
                {vista.cuentasExternas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {vista.cuentaExterna && vista.vinculo?.tipo === "coincide" ? (
            <p className={styles.correcto}>
              ✓ {vista.cuentaExterna} es la cuenta ya vinculada a «{nombreCuenta}».
            </p>
          ) : null}
          {vista.cuentaExterna && vista.vinculo?.tipo === "nuevo" ? (
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", margin: "0.75rem 0" }}>
              <input type="checkbox" checked={confirmarVinculo} onChange={(e) => setConfirmarVinculo(e.target.checked)} />
              <span>
                Es la primera importación de «{nombreCuenta}». Confirmo que la cuenta <strong>{vista.cuentaExterna}</strong> del
                archivo es esta Cuenta. A partir de ahora solo se aceptarán archivos de {vista.cuentaExterna} en ella.
              </span>
            </label>
          ) : null}

          {vista.bloqueos.length > 0 ? (
            <div className={styles.bloqueos} role="alert">
              <strong>No se puede confirmar todavía:</strong>
              <ul>
                {vista.bloqueos.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className={styles.resumen}>
            {(
              [
                ["Filas", vista.resumen.total],
                ["Nuevas", vista.resumen.nuevas],
                ["En revisión", vista.resumen.revision],
                ["Ya importadas", vista.resumen.duplicadas],
                ["De otra cuenta", vista.resumen.otraCuenta],
                ["Inválidas", vista.resumen.invalidas],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta} className={styles.resumenItem}>
                <dt className={opStyles.hechoLabel}>{etiqueta}</dt>
                <dd className={styles.resumenValor} style={{ margin: 0 }}>
                  {valor}
                </dd>
              </div>
            ))}
          </dl>

          {vista.resumen.revision > 0 ? (
            <p className={styles.ayuda}>
              Las filas «Requiere revisión» solo se guardan si las marcas en la columna «Aceptar». Ninguna se fusiona
              ni se corrige: se guarda el valor del archivo con el motivo de la revisión.
            </p>
          ) : null}

          <div className={styles.filtros}>
            <label>
              <span className={styles.etiqueta}>Mostrar </span>
              <select className={styles.select} value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
                <option value="todas">Todas</option>
                {(Object.keys(ETIQUETA_ESTADO) as EstadoFila[]).map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_ESTADO[e]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.tablaContenedor}>
            <table className={styles.tablaImport}>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Estado</th>
                  <th>Cuenta</th>
                  <th>Contrato</th>
                  <th>Lado</th>
                  <th className={styles.numero}>Cant.</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th className={styles.numero}>P. entrada</th>
                  <th className={styles.numero}>P. salida</th>
                  <th className={styles.numero}>Bruto</th>
                  <th className={styles.numero}>Neto</th>
                  <th>Detalle</th>
                  <th>Aceptar</th>
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((f) => (
                  <tr key={f.fila}>
                    <td>{f.fila}</td>
                    <td>
                      <span className={`${styles.estado} ${styles[`estado_${f.estado}`] ?? ""}`}>{ETIQUETA_ESTADO[f.estado]}</span>
                    </td>
                    <td>{f.cuentaExterna ?? "—"}</td>
                    <td>{f.contrato ?? f.original.Contract ?? "—"}</td>
                    <td>{f.lado ?? f.original.Side ?? "—"}</td>
                    <td className={styles.numero}>{f.cantidad ?? f.original.Quantity ?? "—"}</td>
                    <td>{f.entradaLocal ?? f.original["Entry Date"] ?? "—"}</td>
                    <td>{f.salidaLocal ?? f.original["Exit Date"] ?? "—"}</td>
                    <td className={styles.numero}>{f.precioEntrada ?? f.original["Entry Price"] ?? "—"}</td>
                    <td className={styles.numero}>{f.precioSalida ?? f.original["Exit Price"] ?? "—"}</td>
                    <td className={styles.numero}>{f.pnlBruto ?? f.original["Gross P/L"] ?? "—"}</td>
                    <td className={styles.numero}>{f.pnlNeto ?? f.original["Net P/L"] ?? "—"}</td>
                    <td>
                      {f.errores.length + f.revision.length + f.notas.length > 0 ? (
                        <ul className={styles.detalle}>
                          {f.errores.map((p, i) => (
                            <li key={`e${i}`} className={styles.error}>
                              {p.mensaje}
                            </li>
                          ))}
                          {f.revision.map((p, i) => (
                            <li key={`r${i}`} className={styles.aviso}>
                              {p.mensaje}
                            </li>
                          ))}
                          {f.notas.map((p, i) => (
                            <li key={`n${i}`}>{p.mensaje}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td>
                      {f.estado === "revision" ? (
                        <input
                          type="checkbox"
                          aria-label={`Aceptar la fila ${f.fila}`}
                          checked={aceptadas.has(f.fila)}
                          onChange={() => alternarAceptada(f.fila)}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={opStyles.acciones}>
            <Button variant="primary" onClick={confirmar} disabled={!puedeConfirmar} loading={pending}>
              {`Confirmar importación (${aGuardar} ${aGuardar === 1 ? "fila" : "filas"})`}
            </Button>
            <Button variant="secondary" onClick={cancelar} disabled={pending}>
              Cancelar
            </Button>
          </div>
          <p className={opStyles.previsualizacionNota}>
            Se guardan los datos originales de cada fila. No se crean Operaciones, no se calcula R y no se envía nada a
            ninguna plataforma.
          </p>
        </section>
      ) : null}
    </div>
  );
}
