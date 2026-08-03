// Botón — SPEC-012 §6.3: "disparar una acción, nunca navegar (eso es un link)".
// Nunca más de una acción primaria visible a la vez en la misma vista — regla
// de composición de pantalla, no algo que el componente pueda forzar por sí
// solo; se respeta en cada pantalla que lo usa.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "text";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const variantClass = styles[variant];
  return (
    <button
      type={type}
      className={[styles.button, variantClass, className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
