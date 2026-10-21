"use client";

// Onboarding, paso único (mvp-0.1.md §5, paso 4; I16 Zero Friction, I21 One
// Thought Rule): una sola decisión — capital propio o prop firm.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { crearEmpresaPersonalAction, crearEmpresaPropFirmAction } from "@/actions/empresas";
import { Button, Input } from "@/components/ui";
import { fundingErrorMessage } from "@/types/funding";

type Mode = "choice" | "prop_firm_form";

export interface EmpresaChoiceProps {
  /** A dónde navegar tras crear la Empresa con éxito (onboarding y "Nueva Cuenta" reutilizan este componente con destinos distintos). */
  redirectTo: string;
}

export function EmpresaChoice({ redirectTo }: EmpresaChoiceProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choice");
  const [propFirmName, setPropFirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handlePersonal() {
    setSubmitting(true);
    setError(undefined);
    const result = await crearEmpresaPersonalAction();
    if (!result.ok) {
      setError(fundingErrorMessage(result.error));
      setSubmitting(false);
      return;
    }
    router.push(redirectTo);
  }

  async function handlePropFirmSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = propFirmName.trim();
    if (trimmed.length === 0) {
      setError("Introduce el nombre de la Empresa");
      return;
    }
    setSubmitting(true);
    setError(undefined);
    const result = await crearEmpresaPropFirmAction(trimmed);
    if (!result.ok) {
      setError(fundingErrorMessage(result.error));
      setSubmitting(false);
      return;
    }
    router.push(redirectTo);
  }

  if (mode === "prop_firm_form") {
    return (
      <form onSubmit={handlePropFirmSubmit} noValidate>
        <Input
          label="Nombre de la Empresa"
          name="name"
          value={propFirmName}
          onChange={(event) => setPropFirmName(event.target.value)}
          error={error}
          disabled={submitting}
        />
        <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)" }}>
          <Button type="submit" variant="primary" loading={submitting}>
            Crear
          </Button>
          <Button
            type="button"
            variant="text"
            disabled={submitting}
            onClick={() => {
              setMode("choice");
              setError(undefined);
            }}
          >
            Volver
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Button variant="secondary" loading={submitting} onClick={handlePersonal}>
        Capital propio
      </Button>
      <Button
        variant="secondary"
        disabled={submitting}
        onClick={() => {
          setMode("prop_firm_form");
          setError(undefined);
        }}
      >
        Prop firm
      </Button>
      {error ? (
        <p role="alert" style={{ color: "var(--risk)", fontSize: "0.875rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
