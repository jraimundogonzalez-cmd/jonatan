// Tipos de dominio de Funding Management (implementation/mvp-0.1.md §7-§8).
// Separados de lib/api/funding.ts (que solo contiene las llamadas RPC) para
// que components/hooks/actions puedan importar tipos sin arrastrar código de red.

export type AccountStatus = "challenge" | "funded" | "live" | "paused" | "terminated" | "merged";
export type CapitalEventType = "initial" | "deposit" | "withdrawal" | "payout" | "reset" | "adjustment";

/** event_type que un usuario puede registrar manualmente — 'initial' está reservado a crearCuenta (§14.7 de mvp-0.1.md). */
export type UserCapitalEventType = Exclude<CapitalEventType, "initial">;

export interface PropFirm {
  id: string;
  user_id: string;
  name: string;
  is_personal: boolean;
  color: string | null;
  status: "active" | "archived";
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  prop_firm_id: string;
  name: string;
  currency: string;
  initial_capital: string;
  current_capital: string;
  peak_capital: string;
  status: AccountStatus;
  profit_split_pct: string | null;
  rule_profile_snapshot_id: string | null;
  created_at: string;
}

export interface CapitalEvent {
  id: string;
  account_id: string;
  event_type: CapitalEventType;
  amount: string;
  occurred_at: string;
  note: string | null;
  created_at: string;
}

export interface CrearEmpresaInput {
  name: string;
  is_personal: boolean;
}

export interface CrearCuentaInput {
  prop_firm_id: string;
  name: string;
  /** String, nunca number — evita que el cliente introduzca un float por el borde de la API (§8, §14.6 de mvp-0.1.md). */
  initial_capital: string;
  currency: string; // ISO 4217, 3 letras
  profit_split_pct?: string | undefined;
}

/**
 * Catálogo de errores tipados de la API de Funding Management.
 *
 * `VALIDATION_ERROR`/`INVALID_AMOUNT`/`UNKNOWN` son ampliaciones sobre el
 * catálogo original de mvp-0.1.md §8, encontradas al implementar la capa RPC
 * real (§14.7) — un nombre vacío o un error de Postgres no catalogado no
 * tenían representación honesta en el union original.
 */
export type FundingError =
  | { code: "PROP_FIRM_NOT_FOUND" }
  | { code: "ACCOUNT_NOT_FOUND" }
  | { code: "INVALID_INITIAL_CAPITAL"; detail: string }
  | { code: "INVALID_AMOUNT"; detail: string }
  | { code: "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT" }
  | { code: "VALIDATION_ERROR"; field: string; detail: string }
  | { code: "UNAUTHORIZED" }
  | { code: "UNKNOWN"; detail: string };

export type FundingResult<T> = { ok: true; value: T } | { ok: false; error: FundingError };

export const KNOWN_FUNDING_ERROR_CODES: ReadonlySet<FundingError["code"]> = new Set([
  "PROP_FIRM_NOT_FOUND",
  "ACCOUNT_NOT_FOUND",
  "INVALID_INITIAL_CAPITAL",
  "INVALID_AMOUNT",
  "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "UNKNOWN",
] satisfies Array<FundingError["code"]>);

/**
 * Mensaje humano por código de error — Trust Layer (SPEC-014): nunca un código
 * crudo sin lenguaje humano, nunca acusatorio, siempre con el siguiente paso
 * cuando lo hay.
 */
export function fundingErrorMessage(error: FundingError): string {
  switch (error.code) {
    case "PROP_FIRM_NOT_FOUND":
      return "No se encuentra la Empresa indicada.";
    case "ACCOUNT_NOT_FOUND":
      return "No se encuentra la Cuenta indicada.";
    case "INVALID_INITIAL_CAPITAL":
      return `Capital inicial no válido: ${error.detail}`;
    case "INVALID_AMOUNT":
      return `Importe no válido: ${error.detail}`;
    case "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT":
      return "Una cuenta de capital propio no puede tener reparto de beneficios (Profit Split).";
    case "VALIDATION_ERROR":
      return error.detail;
    case "UNAUTHORIZED":
      return "No tienes acceso a este recurso.";
    case "UNKNOWN":
      // BUILD 022 (BUG-021-2) — aquí se filtraba el mensaje crudo de
      // PostgreSQL a la pantalla. Con un identificador malformado en la URL,
      // el trader leía literalmente:
      //
      //   invalid input syntax for type uuid: "a486d4aa-…"
      //
      // El Trust Layer (SPEC-014) no dice que el error se oculte: dice que un
      // bug no se disfraza de error de usuario y que el detalle técnico queda
      // REGISTRADO. Sigue estando entero en `detalleTecnico`, para el log; lo
      // que ya no hace es dominar la pantalla. Es el mismo criterio que
      // `types/operations.ts` aplica desde BUILD 019.
      return "Ha ocurrido un error inesperado y la operación no se ha completado. El detalle técnico queda registrado.";
  }
}

/**
 * El detalle técnico exacto, para registro y depuración — nunca para pintarlo.
 * Devuelve `null` cuando el error ya es de usuario y no esconde nada más.
 */
export function detalleTecnico(error: FundingError): string | null {
  return error.code === "UNKNOWN" ? error.detail : null;
}
