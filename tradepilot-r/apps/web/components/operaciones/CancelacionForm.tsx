"use client";

// BUILD 022 — cancelar una Operación abierta por error.
//
// POR QUÉ EXISTE ESTA PANTALLA: BUILD 021 demostró que una Operación abierta
// por equivocación no tenía salida. El único apaño era cerrarla como cierre
// manual a 0R: no movía capital, pero dejaba una Operación fantasma que
// contaba como cerrada y contaminaría cualquier estadística futura. Cancelar
// NO es cerrar a 0R — es declarar que esa Operación nunca existió como
// operativa.
//
// El dominio ya sabía hacerlo desde BUILD 004 (`cancelar_operacion`): exige
// motivo, no mueve capital, no produce desenlace y `listar_r_final_vigente_
// por_cuenta` la excluye por construcción. Lo único que faltaba era la puerta.
//
// LOS CUATRO MOTIVOS DE CIERRE SE OFRECEN SIEMPRE, Y AQUÍ IGUAL: la
// cancelación simple sólo es legal sin parciales ejecutados
// (`enforce_trade_invariants`), pero esa regla **no se replica aquí**.
// Replicarla sería una segunda copia que podría divergir del trigger en
// silencio. Se ofrece, el dominio juzga, y el rechazo llega tipado.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import { cancelarOperacionAction } from "@/actions/operaciones";
import { categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import styles from "./operaciones.module.css";

export function CancelacionForm({
  tradeId,
  accountId,
  symbol,
}: {
  tradeId: string;
  accountId: string;
  symbol: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<OperationsError | null>(null);

  function cancelar() {
    setError(null);
    startTransition(async () => {
      const result = await cancelarOperacionAction(tradeId, accountId, motivo.trim());
      if (result.ok) {
        router.refresh();
        router.push(`/operaciones/${tradeId}`);
        return;
      }
      setError(result.error);
      if (categoriaDeError(result.error) === "estado") router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.aviso}>
        <strong>Cancelar no es cerrar.</strong> Una Operación cancelada no tiene resultado: no cuenta
        como Operación cerrada, no entra en tu R agregado y no mueve el capital de la Cuenta. Es la vía
        para {symbol} si la abriste por error.
      </div>

      <Input
        name="cancellation_reason"
        label="Motivo de la cancelación"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Registrada por error"
        helperText="Queda guardado con la Operación. El dominio exige un motivo."
        error={
          error && error.code === "CANCELLATION_REQUIRES_REASON" ? mensajeDeError(error) : undefined
        }
      />

      <div className={styles.checkboxFila}>
        <input
          id="confirmar_cancelacion"
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
        />
        <div>
          <label htmlFor="confirmar_cancelacion" className={styles.checkboxTexto}>
            Entiendo que esta Operación quedará como Cancelada
          </label>
          <p className={styles.checkboxAyuda}>Cancelada es un estado terminal: no podrá reabrirse ni cerrarse.</p>
        </div>
      </div>

      {error && error.code !== "CANCELLATION_REQUIRES_REASON" ? (
        <div className={styles.error}>
          {mensajeDeError(error)}
          {categoriaDeError(error) === "bug" ? (
            <code className={styles.errorCodigo}>{codigoDeError(error)}</code>
          ) : null}
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button
          variant="destructive"
          onClick={cancelar}
          loading={pending}
          disabled={!confirmado || motivo.trim() === ""}
        >
          Cancelar Operación
        </Button>
      </div>
    </div>
  );
}
