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
import { corregirDesenlaceAction } from "@/actions/operaciones";
import { MOTIVOS_DE_CIERRE } from "@/lib/format/operacion";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import type { ClosureReason, OperacionRow } from "@/types/operations";
import styles from "./operaciones.module.css";

export function CorreccionForm({ operacion }: { operacion: OperacionRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [closureReason, setClosureReason] = useState<ClosureReason>(operacion.closure_reason ?? "STOP_LOSS");
  const [rMax, setRMax] = useState(operacion.r_max ?? "");
  const [cierreManualRr, setCierreManualRr] = useState(operacion.cierre_manual_rr ?? "");
  const [borrarCierreManual, setBorrarCierreManual] = useState(false);
  const [notes, setNotes] = useState(operacion.notes ?? "");
  const [error, setError] = useState<OperationsError | null>(null);

  const tieneCierreManual = operacion.cierre_manual_rr !== null;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const result = await corregirDesenlaceAction({
        trade_id: operacion.id,
        account_id: operacion.account_id,
        closure_reason: closureReason,
        r_max: rMax,
        // Fijar y borrar a la vez no significa nada y el dominio lo rechaza:
        // por eso, si se marca el borrado, no se envía valor.
        ...(borrarCierreManual ? {} : { cierre_manual_rr: cierreManualRr }),
        ...(borrarCierreManual ? { borrar_cierre_manual_rr: true } : {}),
        notes,
      });

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
          onChange={(e) => setClosureReason(e.target.value as ClosureReason)}
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
        onChange={(e) => setRMax(e.target.value)}
        error={campoConError === "r_max" && error ? mensajeDeError(error) : undefined}
      />

      {tieneCierreManual ? (
        <div className={styles.checkboxFila}>
          <input
            id="borrar_cierre_manual"
            type="checkbox"
            checked={borrarCierreManual}
            onChange={(e) => setBorrarCierreManual(e.target.checked)}
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
          onChange={(e) => setCierreManualRr(e.target.value)}
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
          onChange={(e) => setCierreManualRr(e.target.value)}
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

      <div className={styles.acciones}>
        <Button onClick={guardar} loading={pending}>
          Guardar corrección
        </Button>
      </div>
      <p className={styles.previsualizacionNota}>
        El resultado se recalcula en el servidor con el motor de cálculo y la corrección queda registrada
        en la auditoría de la Operación.
      </p>
    </div>
  );
}
