"use client";

// Alta de un parcial ejecutado. Es evidencia: una vez insertada no se reescribe
// ni se borra (BUILD 016B), así que este formulario sólo inserta.
//
// La `sequence` se ofrece ya calculada —la siguiente libre— y no se pide al
// usuario. Eso es UX, no dominio: la unicidad la garantiza
// `UNIQUE (trade_id, sequence)` desde BUILD 004, y si otra sesión se adelanta,
// el dominio devuelve DUPLICATE_PARTIAL_SEQUENCE y aquí se recarga.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import { registrarParcialAction } from "@/actions/operaciones";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import styles from "./operaciones.module.css";

export function ParcialForm({
  tradeId,
  accountId,
  siguienteSequence,
}: {
  tradeId: string;
  accountId: string;
  siguienteSequence: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rrLevel, setRrLevel] = useState("");
  const [pctClose, setPctClose] = useState("");
  const [error, setError] = useState<OperationsError | null>(null);

  function registrar() {
    setError(null);
    startTransition(async () => {
      const result = await registrarParcialAction(
        tradeId,
        accountId,
        siguienteSequence,
        rrLevel.trim(),
        pctClose.trim(),
        new Date().toISOString(),
      );
      if (result.ok) {
        setRrLevel("");
        setPctClose("");
        router.refresh();
        return;
      }
      setError(result.error);
      if (categoriaDeError(result.error) === "estado") router.refresh();
    });
  }

  if (siguienteSequence > 5) {
    return <p className={styles.hechoLabel}>Se han registrado los 5 parciales que admite una Operación.</p>;
  }

  const campoConError = error ? campoDeError(error) : null;

  return (
    <div>
      <p className={styles.hechoLabel}>Parcial nº {siguienteSequence}</p>
      <Input
        name="rr_level"
        label="Nivel de R"
        numeric
        helperText="El múltiplo de R al que ejecutaste este parcial."
        value={rrLevel}
        onChange={(e) => setRrLevel(e.target.value)}
        placeholder="1.0000"
      />
      <Input
        name="pct_close"
        label="% cerrado"
        numeric
        helperText="Porcentaje de la posición que cerraste en este parcial."
        value={pctClose}
        onChange={(e) => setPctClose(e.target.value)}
        placeholder="50.00"
        error={campoConError === "pct_close" && error ? mensajeDeError(error) : undefined}
      />

      {error && campoConError !== "pct_close" ? (
        <div className={styles.error}>
          {mensajeDeError(error)}
          {categoriaDeError(error) === "bug" ? (
            <code className={styles.errorCodigo}>{codigoDeError(error)}</code>
          ) : null}
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button onClick={registrar} loading={pending}>
          Registrar parcial
        </Button>
      </div>
    </div>
  );
}
