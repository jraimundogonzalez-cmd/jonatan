"use client";

// Alta de un parcial ejecutado. Es evidencia: una vez insertada no se reescribe
// ni se borra (BUILD 016B), así que este formulario sólo inserta.
//
// La `sequence` se ofrece ya calculada —la siguiente libre— y no se pide al
// usuario. Eso es UX, no dominio: la unicidad la garantiza
// `UNIQUE (trade_id, sequence)` desde BUILD 004, y si otra sesión se adelanta,
// el dominio devuelve DUPLICATE_PARTIAL_SEQUENCE y aquí se recarga.
//
// BUILD 024 — la hora del parcial la declara el trader (por defecto, ahora) y
// no puede ser anterior a la entrada ni al parcial previo.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import { registrarParcialAction } from "@/actions/operaciones";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import { aValorLocal, isoDesdeValorLocal, validarFechaEvento } from "@/lib/format/fechaEvento";
import styles from "./operaciones.module.css";

export function ParcialForm({
  tradeId,
  accountId,
  siguienteSequence,
  noAntesDe,
  nombreDelPrevio,
}: {
  tradeId: string;
  accountId: string;
  siguienteSequence: number;
  /** Hora de la entrada o del último parcial: el nuevo no puede ser anterior. */
  noAntesDe?: string | null;
  nombreDelPrevio?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rrLevel, setRrLevel] = useState("");
  const [pctClose, setPctClose] = useState("");
  const [error, setError] = useState<OperationsError | null>(null);
  const [fecha, setFecha] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  useEffect(() => {
    setFecha((actual) => (actual === "" ? aValorLocal(new Date()) : actual));
  }, []);

  function registrar() {
    setError(null);
    const executedAtIso = isoDesdeValorLocal(fecha);
    const problemaFecha = validarFechaEvento(executedAtIso, {
      noAntesDe: noAntesDe ?? null,
      ...(nombreDelPrevio ? { nombreDelPrevio } : {}),
    });
    setErrorFecha(problemaFecha);
    if (problemaFecha !== null || executedAtIso === null) return;
    startTransition(async () => {
      const result = await registrarParcialAction(
        tradeId,
        accountId,
        siguienteSequence,
        rrLevel.trim(),
        pctClose.trim(),
        executedAtIso,
      );
      if (result.ok) {
        setRrLevel("");
        setPctClose("");
        setFecha(aValorLocal(new Date()));
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
      <Input
        name="executed_at"
        type="datetime-local"
        label="Fecha y hora del parcial"
        helperText="Cuándo se ejecutó en el mercado. Se guarda aparte de la hora a la que lo registras."
        value={fecha}
        max={aValorLocal(new Date())}
        onChange={(e) => {
          setFecha(e.target.value);
          setErrorFecha(null);
        }}
        error={errorFecha ?? (campoConError === "fecha" && error ? mensajeDeError(error) : undefined)}
      />

      {error && campoConError !== "pct_close" && campoConError !== "fecha" ? (
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
