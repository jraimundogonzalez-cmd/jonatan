// Input — SPEC-012 §6.3: "capturar un valor libre", nunca una elección de
// conjunto cerrado (eso es Selector, no construido en esta entrega). Variante
// "numeric" siempre monoespaciada (03 §5.3, SPEC-012 §4.2).
import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import styles from "./Input.module.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: string;
  type?: "text" | "email" | "date";
  numeric?: boolean;
  error?: string | undefined;
  helperText?: string | undefined;
}

export function Input({ label, type = "text", numeric = false, error, helperText, className, ...rest }: InputProps) {
  const generatedId = useId();
  const id = rest.name ? `field-${rest.name}` : generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={numeric ? "decimal" : undefined}
        className={[styles.input, numeric ? styles.numeric : "", className].filter(Boolean).join(" ")}
        data-invalid={error ? "true" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {error ? (
        <span id={errorId} role="alert" className={styles.error}>
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className={styles.helper}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
