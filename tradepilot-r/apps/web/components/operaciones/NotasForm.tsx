"use client";

// BUILD 022 — anotar una Operación desde su propia pantalla.
//
// Antes, el único acceso a las notas estaba dentro de «Corregir desenlace»:
// para escribir «entré tarde, la señal ya se había ido» había que entrar por
// una puerta que se llama corregir un error. Anotar no es corregir.
//
// No hay capacidad nueva detrás: `editarOperacion` ya distingue una edición
// que toca el desenlace de una que no. Una edición sólo-notas no invoca a
// Risk Engine, no recalcula R y no mueve capital — y queda auditada, como
// cualquier otro cambio.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import { guardarNotasAction } from "@/actions/operaciones";
import { categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import styles from "./operaciones.module.css";

export function NotasForm({
  tradeId,
  accountId,
  notas,
}: {
  tradeId: string;
  accountId: string;
  notas: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState(notas ?? "");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<OperationsError | null>(null);

  const sucio = texto !== (notas ?? "");

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const result = await guardarNotasAction(tradeId, accountId, texto);
      if (result.ok) {
        setGuardado(true);
        router.refresh();
        return;
      }
      setError(result.error);
      if (categoriaDeError(result.error) === "estado") router.refresh();
    });
  }

  return (
    <div>
      <Input
        name="notes"
        label="Notas"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setGuardado(false);
        }}
        helperText="Tu contexto de la Operación. No participa en ningún cálculo."
      />

      {error ? (
        <div className={styles.error}>
          {mensajeDeError(error)}
          {categoriaDeError(error) === "bug" ? (
            <code className={styles.errorCodigo}>{codigoDeError(error)}</code>
          ) : null}
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button variant="secondary" onClick={guardar} loading={pending} disabled={!sucio}>
          Guardar notas
        </Button>
        {guardado && !sucio ? <span className={styles.hechoLabel}>Guardadas.</span> : null}
      </div>
    </div>
  );
}
