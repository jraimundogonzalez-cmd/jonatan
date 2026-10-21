"use client";

// Formulario de creación de Cuenta (mvp-0.1.md §5, paso 5) — reutilizado tanto
// por el onboarding (/onboarding/cuenta, siempre con exactamente 1 Empresa)
// como por "Nueva Cuenta" (/cuentas/nueva, que puede tener varias) para no
// duplicar el mismo formulario en dos sitios.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { crearCuentaAction } from "@/actions/cuentas";
import { Button, Input } from "@/components/ui";
import inputStyles from "@/components/ui/Input.module.css";
import { validateInitialCapital } from "@/lib/validation/capital";
import { fundingErrorMessage, type PropFirm } from "@/types/funding";

const CURRENCIES = ["USD", "EUR", "GBP"] as const;

export interface CuentaFormProps {
  /** Al menos 1 elemento. Con más de 1, se muestra un selector — con exactamente 1 (caso de onboarding), se usa directamente sin preguntar (I16 Zero Friction). */
  propFirms: readonly PropFirm[];
  redirectTo: string;
}

export function CuentaForm({ propFirms, redirectTo }: CuentaFormProps) {
  const router = useRouter();
  const [propFirmId, setPropFirmId] = useState(propFirms[0]?.id ?? "");
  const [name, setName] = useState("Cuenta 1");
  const [initialCapital, setInitialCapital] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD");
  const [profitSplitPct, setProfitSplitPct] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [capitalError, setCapitalError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const selectedPropFirm = propFirms.find((propFirm) => propFirm.id === propFirmId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    if (!selectedPropFirm) {
      setFormError("Selecciona una Empresa");
      return;
    }

    const trimmedName = name.trim();
    const nameValidation = trimmedName.length === 0 ? "El nombre de la Cuenta no puede estar vacío" : undefined;
    const capitalValidation = validateInitialCapital(initialCapital);

    setNameError(nameValidation);
    setCapitalError(capitalValidation.ok ? undefined : capitalValidation.message);

    if (nameValidation || !capitalValidation.ok) {
      return;
    }

    setSubmitting(true);
    const result = await crearCuentaAction({
      prop_firm_id: selectedPropFirm.id,
      name: trimmedName,
      initial_capital: capitalValidation.value,
      currency,
      profit_split_pct: selectedPropFirm.is_personal || profitSplitPct.trim() === "" ? undefined : profitSplitPct.trim(),
    });

    if (!result.ok) {
      setFormError(fundingErrorMessage(result.error));
      setSubmitting(false);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {propFirms.length > 1 ? (
          <div className={inputStyles.field}>
            <label className={inputStyles.label} htmlFor="prop_firm_id">
              Empresa
            </label>
            <select
              id="prop_firm_id"
              className={inputStyles.input}
              value={propFirmId}
              onChange={(event) => setPropFirmId(event.target.value)}
              disabled={submitting}
            >
              {propFirms.map((propFirm) => (
                <option key={propFirm.id} value={propFirm.id}>
                  {propFirm.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Input
          label="Nombre de la Cuenta"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          disabled={submitting}
        />

        <Input
          label="Capital inicial"
          name="initial_capital"
          numeric
          inputMode="decimal"
          value={initialCapital}
          onChange={(event) => setInitialCapital(event.target.value)}
          error={capitalError}
          disabled={submitting}
        />

        <div className={inputStyles.field}>
          <label className={inputStyles.label} htmlFor="currency">
            Moneda
          </label>
          <select
            id="currency"
            className={inputStyles.input}
            value={currency}
            onChange={(event) => setCurrency(event.target.value as (typeof CURRENCIES)[number])}
            disabled={submitting}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        {/* I18 Automation Before Interaction / mvp-0.1.md §10.2: el campo se
            oculta por completo si la Empresa es personal — nunca se pide un
            dato que no puede aplicar. */}
        {selectedPropFirm && !selectedPropFirm.is_personal ? (
          <Input
            label="Profit Split (%, opcional)"
            name="profit_split_pct"
            numeric
            inputMode="decimal"
            value={profitSplitPct}
            onChange={(event) => setProfitSplitPct(event.target.value)}
            disabled={submitting}
          />
        ) : null}

        {formError ? (
          <p role="alert" style={{ color: "var(--risk)", fontSize: "0.875rem" }}>
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" loading={submitting}>
          Crear cuenta
        </Button>
      </div>
    </form>
  );
}
