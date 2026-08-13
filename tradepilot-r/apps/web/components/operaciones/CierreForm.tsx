"use client";

// El formulario de cierre. Es el punto crítico de BUILD 019.
//
// El usuario introduce TRES cosas: r_max, el motivo, y —cuando el motivo lo
// exige— el nivel de cierre manual. `r_final`, `pnl_amount` y
// `time_in_market_sec` no existen como campo aquí y no pueden existir: los
// tipos de entrada del servicio no los admiten.
//
// Los cuatro motivos se ofrecen SIEMPRE. Filtrarlos exigiría una segunda copia
// de las cuatro reglas de BUILD 018 dentro de React, que podría divergir en
// silencio de la del trigger. La legalidad la juzga el dominio y el rechazo
// llega tipado, señalando el campo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import { cerrarOperacionAction, previsualizarCierreAction, type PrevisualizacionUI } from "@/actions/operaciones";
import { MOTIVOS_DE_CIERRE, formatR } from "@/lib/format/operacion";
import { formatMoney } from "@/lib/format/money";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import type { ClosureReason } from "@/types/operations";
import styles from "./operaciones.module.css";

export function CierreForm({
  tradeId,
  accountId,
  currency,
}: {
  tradeId: string;
  accountId: string;
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // LA CLAVE SE GENERA AQUÍ, al montar el formulario — no al pulsar el botón.
  // Generarla en el submit convertiría un doble clic en dos claves distintas, y
  // BUILD 018 rechazaría la segunda con INVALID_STATE_TRANSITION en vez de
  // devolver la Operación ya cerrada. Con clave estable, el doble clic, un
  // timeout o una respuesta perdida tras el COMMIT son idempotentes y
  // silenciosos. Sólo EVIDENCE_CHANGED la regenera.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const [closureReason, setClosureReason] = useState<ClosureReason>("STOP_LOSS");
  const [rMax, setRMax] = useState("");
  const [cierreManualRr, setCierreManualRr] = useState("");
  const [preview, setPreview] = useState<PrevisualizacionUI | null>(null);
  const [error, setError] = useState<OperationsError | null>(null);
  const [evidenciaCambio, setEvidenciaCambio] = useState<string | null>(null);

  const exigeCierreManual = closureReason === "MANUAL_CLOSE";

  function datosFormulario() {
    return {
      trade_id: tradeId,
      account_id: accountId,
      closure_reason: closureReason,
      r_max: rMax,
      ...(exigeCierreManual && cierreManualRr.trim() !== "" ? { cierre_manual_rr: cierreManualRr } : {}),
    };
  }

  function previsualizar() {
    setError(null);
    startTransition(async () => {
      const result = await previsualizarCierreAction(datosFormulario());
      if (result.ok) {
        setPreview(result.value);
      } else {
        setPreview(null);
        setError(result.error);
      }
    });
  }

  function confirmar() {
    if (preview === null) return;
    setError(null);
    startTransition(async () => {
      const result = await cerrarOperacionAction({
        ...datosFormulario(),
        idempotency_key: idempotencyKey,
        evidencia_previsualizada: preview.evidencia_leida,
      });

      if (result.ok) {
        router.refresh();
        router.push(`/operaciones/${tradeId}`);
        return;
      }

      if (result.error.code === "EVIDENCE_CHANGED") {
        // El protocolo completo: informar, recalcular sobre la evidencia
        // fresca, clave nueva —porque el desenlace calculado será otro— y
        // exigir una confirmación explícita más.
        setEvidenciaCambio(mensajeDeError(result.error));
        setIdempotencyKey(crypto.randomUUID());
        setPreview(null);
        router.refresh();
        const nueva = await previsualizarCierreAction(datosFormulario());
        if (nueva.ok) setPreview(nueva.value);
        else setError(nueva.error);
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
        <label className={styles.campoLabel} htmlFor="closure_reason">
          Motivo de cierre
        </label>
        <select
          id="closure_reason"
          className={styles.select}
          value={closureReason}
          onChange={(e) => {
            setClosureReason(e.target.value as ClosureReason);
            setPreview(null);
          }}
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
        helperText="El múltiplo de R más alto que el precio llegó a alcanzar a tu favor antes de cerrar."
        value={rMax}
        onChange={(e) => {
          setRMax(e.target.value);
          setPreview(null);
        }}
        placeholder="2.5000"
        error={campoConError === "r_max" && error ? mensajeDeError(error) : undefined}
      />

      {exigeCierreManual ? (
        <Input
          name="cierre_manual_rr"
          label="Cierre manual en (R)"
          numeric
          helperText="El nivel de R al que cerraste el resto de la posición a mano."
          value={cierreManualRr}
          onChange={(e) => {
            setCierreManualRr(e.target.value);
            setPreview(null);
          }}
          placeholder="1.5000"
          error={campoConError === "cierre_manual_rr" && error ? mensajeDeError(error) : undefined}
        />
      ) : null}

      {evidenciaCambio ? (
        <div className={styles.aviso}>
          <strong>La evidencia cambió.</strong> {evidenciaCambio} Revisa el resultado estimado antes de
          confirmar de nuevo.
        </div>
      ) : null}

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
          <h3 className={styles.previsualizacionTitulo}>
            Resultado estimado sobre la evidencia actual · previsualización
          </h3>
          <div className={styles.hechos}>
            <div className={styles.hecho}>
              <span className={styles.hechoLabel}>R final estimado</span>
              <span className={styles.hechoValorGrande}>{formatR(preview.r_final)}</span>
            </div>
            <div className={styles.hecho}>
              <span className={styles.hechoLabel}>P&amp;L estimado</span>
              <span className={styles.hechoValorGrande}>{formatMoney(preview.pnl_amount, currency)}</span>
            </div>
            <div className={styles.hecho}>
              <span className={styles.hechoLabel}>Parciales usados</span>
              <span className={styles.hechoValor}>{preview.evidencia_leida}</span>
            </div>
          </div>
          <p className={styles.previsualizacionNota}>
            Esto todavía no ha ocurrido. Al confirmar, el resultado se vuelve a calcular en el servidor
            sobre la evidencia vigente en ese instante — nunca se guarda esta estimación.
          </p>
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button variant="secondary" onClick={previsualizar} loading={pending && preview === null}>
          Previsualizar resultado
        </Button>
        <Button onClick={confirmar} disabled={preview === null} loading={pending && preview !== null}>
          Confirmar cierre
        </Button>
      </div>
    </div>
  );
}
