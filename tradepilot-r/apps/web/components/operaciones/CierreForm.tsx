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
import { DesgloseR } from "./DesgloseR";
import { formatMoney } from "@/lib/format/money";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import type { ClosureReason } from "@/types/operations";
import styles from "./operaciones.module.css";

export function CierreForm({
  tradeId,
  accountId,
  currency,
  hayParciales,
  rMaximoEvidenciado,
}: {
  tradeId: string;
  accountId: string;
  currency: string;
  /**
   * BUILD 022 — si la Operación tiene evidencia registrada. Determina si la
   * previsualización es obligatoria (ver `exigePrevisualizacion`). Es un dato,
   * no una regla de dominio: lo aporta la página desde la lista de parciales.
   */
  hayParciales: boolean;
  /** El mayor R ejecutado, calculado por Quant Engine. Cota inferior de `r_max`. */
  rMaximoEvidenciado: string | null;
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
  // BUILD 021 observó la contradicción: un parcial ejecutado a +2R y el campo
  // «R máximo alcanzado» vacío. El precio alcanzó al menos ese nivel — lo
  // exige el propio trigger (`max(rr_level) ≤ r_max`). Se parte de ahí, y
  // sigue siendo editable: r_max es una cota que declara el trader, y el
  // máximo evidenciado es sólo su suelo demostrable.
  const [rMax, setRMax] = useState(rMaximoEvidenciado ?? "");
  const [cierreManualRr, setCierreManualRr] = useState("");
  const [preview, setPreview] = useState<PrevisualizacionUI | null>(null);
  const [error, setError] = useState<OperationsError | null>(null);
  const [evidenciaCambio, setEvidenciaCambio] = useState<string | null>(null);

  const exigeCierreManual = closureReason === "MANUAL_CLOSE";

  /**
   * BUILD 022 — la previsualización deja de ser obligatoria SIEMPRE.
   *
   * BUILD 021 midió el caso frecuente —cerrar sin parciales— y encontró un
   * clic que devolvía el dato que el trader acababa de teclear: sin evidencia
   * y sin premisa manual, R sale directo de lo que él mismo declaró. Se exige
   * cuando el resultado depende de algo que el trader NO está mirando:
   *
   *  · con parciales → el R final sale de una suma ponderada de evidencia;
   *  · en cierre manual → el resultado depende de una premisa explícita.
   *
   * Esto es política de UX, no de dominio: no se replica aquí ninguna de las
   * cuatro reglas de BUILD 018, no se decide ninguna legalidad y no se toca
   * ninguna protección. `EVIDENCE_CHANGED`, `p_expected_partials` y la
   * idempotencia siguen intactos — y cuando se confirma sin previsualizar,
   * `evidencia_previsualizada` sencillamente no se envía: el testigo de
   * BUILD 018, que compara la lectura fresca del servicio contra la de la
   * RPC, sigue cubriendo la ventana real de escritura.
   */
  const exigePrevisualizacion = hayParciales || exigeCierreManual;
  const puedeConfirmar = preview !== null || !exigePrevisualizacion;

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
    if (!puedeConfirmar) return;
    setError(null);
    startTransition(async () => {
      const result = await cerrarOperacionAction({
        ...datosFormulario(),
        idempotency_key: idempotencyKey,
        ...(preview !== null ? { evidencia_previsualizada: preview.evidencia_leida } : {}),
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
            {/* BUILD 022 — «Parciales usados: N» era el testigo de evidencia
                asomando por la interfaz. En su lugar, de dónde sale el R. */}
          </div>
          {preview.impacto.length > 1 ? (
            <>
              <h4 className={styles.seccionTitulo}>De dónde sale ese R</h4>
              <DesgloseR impacto={preview.impacto} total={preview.r_final} />
            </>
          ) : null}
          <p className={styles.previsualizacionNota}>
            Esto todavía no ha ocurrido. Al confirmar, el resultado se vuelve a calcular en el servidor
            sobre la evidencia vigente en ese instante — nunca se guarda esta estimación.
          </p>
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button
          variant={exigePrevisualizacion ? "primary" : "secondary"}
          onClick={previsualizar}
          loading={pending && preview === null}
        >
          Previsualizar resultado
        </Button>
        <Button onClick={confirmar} disabled={!puedeConfirmar} loading={pending && preview !== null}>
          Confirmar cierre
        </Button>
      </div>
    </div>
  );
}
