"use client";

// Apertura de una Operación libre. Es capital-neutral: no mueve dinero, sólo
// congela `risk_amount` = capital vigente × riesgo%. Ese cálculo lo hace la RPC
// y aquí no se replica ni se previsualiza.
//
// Si hay Planes de Gestión guardados se puede elegir uno; si no, se declara un
// objetivo RR ad hoc (Plan anónimo), que el dominio ya admite desde BUILD 004.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsError } from "@tradepilot/operations-engine";
import { Button, Input } from "@/components/ui";
import { registrarOperacionAction } from "@/actions/operaciones";
import { campoDeError, categoriaDeError, codigoDeError, mensajeDeError } from "@/types/operations";
import type { PlanGestionRow, TradeSide } from "@/types/operations";
import styles from "./operaciones.module.css";

export function NuevaOperacionForm({
  accountId,
  planes,
}: {
  accountId: string;
  planes: readonly PlanGestionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<TradeSide>("long");
  const [riskPct, setRiskPct] = useState("1.00");
  const [planId, setPlanId] = useState<string>(planes[0]?.id ?? "");
  const [rrObjective, setRrObjective] = useState("3.0000");
  const [error, setError] = useState<OperationsError | null>(null);

  const usaPlanGuardado = planId !== "";

  function abrir() {
    setError(null);
    startTransition(async () => {
      const result = await registrarOperacionAction({
        account_id: accountId,
        symbol: symbol.trim().toUpperCase(),
        side,
        opened_at: new Date().toISOString(),
        risk_pct: riskPct.trim(),
        ...(usaPlanGuardado
          ? { management_plan_id: planId }
          : { rr_objective: rrObjective.trim(), be_trigger: "NONE" }),
      });
      if (result.ok) {
        router.refresh();
        router.push(`/operaciones/${result.value.id}`);
        return;
      }
      setError(result.error);
      if (categoriaDeError(result.error) === "estado") router.refresh();
    });
  }

  const campoConError = error ? campoDeError(error) : null;

  return (
    <div>
      <Input
        name="symbol"
        label="Símbolo"
        helperText="No podrá corregirse después: la identidad de una Operación se fija al nacer."
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="EURUSD"
      />

      <div className={styles.campo}>
        <label className={styles.campoLabel} htmlFor="side">
          Lado
        </label>
        <select
          id="side"
          className={styles.select}
          value={side}
          onChange={(e) => setSide(e.target.value as TradeSide)}
        >
          <option value="long">Largo</option>
          <option value="short">Corto</option>
        </select>
      </div>

      <Input
        name="risk_pct"
        label="Riesgo (%)"
        numeric
        helperText="Sobre el capital vigente de la Cuenta. El importe en riesgo se congela al abrir."
        value={riskPct}
        onChange={(e) => setRiskPct(e.target.value)}
        error={campoConError === "risk_pct" && error ? mensajeDeError(error) : undefined}
      />

      {planes.length > 0 ? (
        <div className={styles.campo}>
          <label className={styles.campoLabel} htmlFor="plan">
            Plan de Gestión
          </label>
          <select
            id="plan"
            className={styles.select}
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {planes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? "(sin nombre)"} · objetivo {p.rr_objective} R
              </option>
            ))}
            <option value="">Sin Plan guardado (objetivo ad hoc)</option>
          </select>
        </div>
      ) : null}

      {!usaPlanGuardado ? (
        <Input
          name="rr_objective"
          label="Objetivo RR"
          numeric
          helperText="El múltiplo de R al que apuntabas al entrar."
          value={rrObjective}
          onChange={(e) => setRrObjective(e.target.value)}
          error={campoConError === "rr_objective" && error ? mensajeDeError(error) : undefined}
        />
      ) : null}

      {error && campoConError === null ? (
        <div className={styles.error}>
          {mensajeDeError(error)}
          {categoriaDeError(error) === "bug" ? (
            <code className={styles.errorCodigo}>{codigoDeError(error)}</code>
          ) : null}
        </div>
      ) : null}

      <div className={styles.acciones}>
        <Button onClick={abrir} loading={pending} disabled={symbol.trim() === ""}>
          Abrir Operación
        </Button>
      </div>
    </div>
  );
}
