"use client";

// Login/Registro — mismo formulario, un solo campo, una sola decisión
// (I21 One Thought Rule, mvp-0.1.md §5 pasos 1-2).
import { useState, type FormEvent } from "react";
import { signInWithMagicLink } from "@/actions/auth";
import { Button, Input } from "@/components/ui";
import { validateEmail } from "@/lib/validation/email";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export interface LoginFormProps {
  /** Ruta a la que volver tras verificar el enlace — capturada por el middleware cuando bloqueó una ruta protegida sin sesión. */
  redirectTo: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateEmail(email);
    if (!validation.ok) {
      setStatus({ kind: "error", message: validation.message });
      return;
    }

    setStatus({ kind: "submitting" });
    const result = await signInWithMagicLink(validation.value, redirectTo);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    setStatus({ kind: "sent" });
  }

  if (status.kind === "sent") {
    return (
      <p role="status">
        Revisa tu correo — te hemos enviado un enlace de acceso a <strong>{email}</strong>.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={status.kind === "error" ? status.message : undefined}
        disabled={status.kind === "submitting"}
      />
      <div style={{ marginTop: "var(--space-4)" }}>
        <Button type="submit" variant="primary" loading={status.kind === "submitting"}>
          Enviar enlace de acceso
        </Button>
      </div>
    </form>
  );
}
