"use client";

// Corrección del desenlace de una Operación Cerrada.
//
// BUILD 019 no abre nada nuevo aquí salvo una cosa: el borrado explícito de
// `cierre_manual_rr`. Antes, una Operación cerrada como cierre manual no podía
// corregirse JAMÁS a take profit completo ni a break-even, porque ambos exigen
// que ese campo esté vacío y no existía forma de vaciarlo — `null` significaba
// "no tocar", nunca "borrar".
//
// La casilla NO se marca sola al cambiar de motivo. Deducirlo volvería a hacer
// implícito el borrado, y además obligaría a este componente a conocer las
// cuatro reglas de BUILD 018. El usuario declara; el dominio juzga.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import {
  corregirDesenlaceAction,
  previsualizarCorreccionAction,
  type PrevisualizacionCorreccionUI,
} from "@/actions/operaciones";
import { DesgloseR } from "./DesgloseR";
import { formatMoney } from "@/lib/format/money";
import { MOTIVOS_DE_CIERRE, formatMotivoCierre, formatR } from "@/lib/format/operacion";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import type { ClosureReason, OperacionRow } from "@/types/operations";
import styles from "./operaciones.module.css";

export function CorreccionForm({ operacion, currency }: { operacion: OperacionRow; currency: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [closureReason, setClosureReason] = useState<ClosureReason>(operacion.closure_reason ?? "STOP_LOSS");
  const [rMax, setRMax] = useState(operacion.r_max ?? "");
  const [cierreManualRr, setCierreManualRr] = useState(operacion.cierre_manual_rr ?? "");
  const [borrarCierreManual, setBorrarCierreManual] = useState(false);
  const [notes, setNotes] = useState(operacion.notes ?? "");
  const [error, setError] = useState<OperationsError | null>(null);
  // BUILD 022 — nada se guarda sin haberse enseñado antes.
  const [preview, setPreview] = useState<PrevisualizacionCorreccionUI | null>(null);

  const tieneCierreManual = operacion.cierre_manual_rr !== null;

  function datosFormulario() {
    return {
      trade_id: operacion.id,
      account_id: operacion.account_id,
      closure_reason: closureReason,
      r_max: rMax,
      // Fijar y borrar a la vez no significa nada y el dominio lo rechaza:
      // por eso, si se marca el borrado, no se envía valor.
      ...(borrarCierreManual ? {} : { cierre_manual_rr: cierreManualRr }),
      ...(borrarCierreManual ? { borrar_cierre_manual_rr: true } : {}),
      notes,
    };
  }

  /** Invalida la previsualización: cualquier cambio la deja obsoleta. */
  function cambio<T>(set: (v: T) => void) {
    return (v: T) => {
      setPreview(null);
      set(v);
    };
  }

  function previsualizar() {
    setError(null);
    startTransition(async () => {
      const result = await previsualizarCorreccionAction(datosFormulario());
      if (result.ok) {
        setPreview(result.value);
        return;
      }
      setPreview(null);
      setError(result.error);
    });
  }

  function guardar() {
    if (preview === null) return;
    setError(null);
    startTransition(async () => {
      const result = await corregirDesenlaceAction(datosFormulario());

      if (result.ok) {
        router.refresh();
        router.push(`/operaciones/${operacion.id}`);
        return;
      }
      setError(result.error);
      if (categoriaDeError(result.error) === "estado") router.refresh();
    });
  }

  const campoConError = error ? campoDeError(error) : null;

  return (
    <div>
      <div className={styles.campo}>
        <label className={styles.campoLabel} htmlFor="correccion_motivo">
          Motivo de cierre
        </label>
        <select
          id="correccion_motivo"
          className={styles.select}
          value={closureReason}
          onChange={(e) => cambio(setClosureReason)(e.target.value as ClosureReason)}
        >
          {MOTIVOS_DE_CIERRE.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {campoConError === "closure_reason" && error ? (
          <p className={styles.campoError}>{mensajeDeError(error)}</p>
        ) : null}
      </div>

      <Input
        name="r_max"
        label="R máximo alcanzado"
        numeric
        helperText="Puede corregirse a la baja o al alza, mientras el desenlace resultante siga siendo coherente."
        value={rMax}
        onChange={(e) => cambio(setRMax)(e.target.value)}
        error={campoConError === "r_max" && error ? mensajeDeError(error) : undefined}
      />

      {tieneCierreManual ? (
        <div className={styles.checkboxFila}>
          <input
            id="borrar_cierre_manual"
            type="checkbox"
            checked={borrarCierreManual}
            onChange={(e) => cambio(setBorrarCierreManual)(e.target.checked)}
          />
          <div>
            <label htmlFor="borrar_cierre_manual" className={styles.checkboxTexto}>
              Este cierre ya no es manual
            </label>
            <p className={styles.checkboxAyuda}>
              Borra el nivel de cierre manual ({operacion.cierre_manual_rr} R). Hace falta marcarlo para
              poder corregir el motivo a take profit completo o a break-even, que exigen que ese dato no
              exista.
            </p>
          </div>
        </div>
      ) : null}

      {tieneCierreManual && !borrarCierreManual ? (
        <Input
          name="cierre_manual_rr"
          label="Cierre manual en (R)"
          numeric
          value={cierreManualRr}
          onChange={(e) => cambio(setCierreManualRr)(e.target.value)}
          error={campoConError === "cierre_manual_rr" && error ? mensajeDeError(error) : undefined}
        />
      ) : null}

      {!tieneCierreManual && closureReason === "MANUAL_CLOSE" ? (
        <Input
          name="cierre_manual_rr"
          label="Cierre manual en (R)"
          numeric
          helperText="Un cierre manual exige indicar a qué nivel de R se cerró el resto."
          value={cierreManualRr}
          onChange={(e) => cambio(setCierreManualRr)(e.target.value)}
          error={campoConError === "cierre_manual_rr" && error ? mensajeDeError(error) : undefined}
        />
      ) : null}

      <Input
        name="notes"
        label="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        helperText="Anotación libre. No participa en ningún cálculo."
      />

      {error && campoConError === null ? (
        <div className={styles.error}>
          {mensajeDeError(error)}
          {categoriaDeError(error) === "bug" ? (
            <code className={styles.errorCodigo}>{codigoDeError(error)}</code>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className={styles.previsualizacion}>
          <h3 className={styles.previsualizacionTitulo}>Esta corrección va a cambiar tu resultado</h3>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th />
                <th>Ahora</th>
                <th>Después</th>
                <th>Cambio</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>R final</td>
                <td>{preview.r_actual === null ? "—" : formatR(preview.r_actual)}</td>
                <td className={styles.hechoValorGrande}>{formatR(preview.r_nuevo)}</td>
                <td className={preview.delta_r.startsWith("-") ? styles.negativo : styles.positivo}>
                  {formatR(preview.delta_r)}
                </td>
              </tr>
              <tr>
                <td>P&amp;L y capital</td>
                <td>{preview.pnl_actual === null ? "—" : formatMoney(preview.pnl_actual, currency)}</td>
                <td className={styles.hechoValorGrande}>{formatMoney(preview.pnl_nuevo, currency)}</td>
                <td className={preview.delta_pnl.startsWith("-") ? styles.negativo : styles.positivo}>
                  {formatMoney(preview.delta_pnl, currency)}
                </td>
              </tr>
              {preview.motivo_actual !== preview.motivo_nuevo ? (
                <tr>
                  <td>Motivo de cierre</td>
                  <td>{formatMotivoCierre(preview.motivo_actual)}</td>
                  <td>{formatMotivoCierre(preview.motivo_nuevo)}</td>
                  <td>—</td>
                </tr>
              ) : null}
              {preview.cierre_manual_actual !== preview.cierre_manual_nuevo ? (
                <tr>
                  <td>Cierre manual en</td>
                  <td>{preview.cierre_manual_actual === null ? "—" : formatR(preview.cierre_manual_actual)}</td>
                  <td>{preview.cierre_manual_nuevo === null ? "—" : formatR(preview.cierre_manual_nuevo)}</td>
                  <td>—</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <h4 className={styles.seccionTitulo}>De dónde sale el R nuevo</h4>
          <DesgloseR impacto={preview.impacto} total={preview.r_nuevo} />

          <p className={styles.previsualizacionNota}>
            {preview.delta_pnl.startsWith("-") ? "El capital de la Cuenta bajará" : "El capital de la Cuenta subirá"}{" "}
            {formatMoney(preview.delta_pnl, currency)} al confirmar. Esto todavía no ha ocurrido: al
            confirmar, el resultado se vuelve a calcular en el servidor con el mismo motor.
          </p>
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button variant="secondary" onClick={previsualizar} loading={pending && preview === null}>
          Ver qué va a cambiar
        </Button>
        <Button onClick={guardar} disabled={preview === null} loading={pending && preview !== null}>
          Confirmar corrección
        </Button>
      </div>
      <p className={styles.previsualizacionNota}>
        Corregir un desenlace reescribe tu R, tu P&amp;L y mueve el capital de la Cuenta. Por eso hay que
        ver el impacto antes de confirmarlo. La corrección queda registrada en el historial de la Operación.
      </p>
    </div>
  );
}
