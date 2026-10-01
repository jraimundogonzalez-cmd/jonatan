"use client";

// Registrar Evento de capital (mvp-0.1.md §9) — consume
// registrarEventoCapital vía la Server Action, nunca SQL directo. 'initial'
// no aparece en el selector: está reservado al flujo atómico de crearCuenta
// (ver hallazgo documentado en supabase/functions/sql/funding.sql).
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { registrarEventoCapitalAction } from "@/actions/cuentas";
import { Button, Input } from "@/components/ui";
import inputStyles from "@/components/ui/Input.module.css";
import { formatCapitalEventType } from "@/lib/format/capitalEvent";
import { validateCapitalEventAmount } from "@/lib/validation/capital";
import { fundingErrorMessage, type UserCapitalEventType } from "@/types/funding";

const EVENT_TYPES: readonly UserCapitalEventType[] = ["deposit", "withdrawal", "payout", "reset", "adjustment"];

export interface CapitalEventFormProps {
  accountId: string;
  redirectTo: string;
}

export function CapitalEventForm({ accountId, redirectTo }: CapitalEventFormProps) {
  const router = useRouter();
  const [eventType, setEventType] = useState<UserCapitalEventType>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    const amountValidation = validateCapitalEventAmount(amount);
    setAmountError(amountValidation.ok ? undefined : amountValidation.message);
    if (!amountValidation.ok) {
      return;
    }

    setSubmitting(true);
    const result = await registrarEventoCapitalAction(
      accountId,
      eventType,
      amountValidation.value,
      note.trim() === "" ? undefined : note.trim(),
    );

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
        <div className={inputStyles.field}>
          <label className={inputStyles.label} htmlFor="event_type">
            Tipo de evento
          </label>
          <select
            id="event_type"
            className={inputStyles.input}
            value={eventType}
            onChange={(event) => setEventType(event.target.value as UserCapitalEventType)}
            disabled={submitting}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatCapitalEventType(type)}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Importe"
          name="amount"
          numeric
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={amountError}
          helperText="Usa un valor negativo para una retirada o un ajuste a la baja."
          disabled={submitting}
        />

        <Input
          label="Nota (opcional)"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={submitting}
        />

        {formError ? (
          <p role="alert" style={{ color: "var(--risk)", fontSize: "0.875rem" }}>
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" loading={submitting}>
          Registrar evento
        </Button>
      </div>
    </form>
  );
}
