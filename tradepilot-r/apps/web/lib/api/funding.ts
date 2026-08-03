// API pública de Funding Management (implementation/mvp-0.1.md §8).
// Cada función envuelve una llamada RPC a Postgres (supabase/functions/sql/funding.sql) —
// nunca una llamada SQL directa desde un componente (mvp-0.1.md §6.3).
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountStatus = "challenge" | "funded" | "live" | "paused" | "terminated" | "merged";
export type CapitalEventType = "initial" | "deposit" | "withdrawal" | "payout" | "reset" | "adjustment";

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
  profit_split_pct?: string;
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

function ok<T>(value: T): FundingResult<T> {
  return { ok: true, value };
}

function err(error: FundingError): FundingResult<never> {
  return { ok: false, error };
}

const KNOWN_FUNDING_ERROR_CODES = new Set<FundingError["code"]>([
  "PROP_FIRM_NOT_FOUND",
  "ACCOUNT_NOT_FOUND",
  "INVALID_INITIAL_CAPITAL",
  "INVALID_AMOUNT",
  "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "UNKNOWN",
]);

/**
 * Traduce un error crudo de Postgres/PostgREST al catálogo tipado.
 * Formato esperado de las funciones de negocio: "FUNDING_ERROR:<CODE>:<detalle>"
 * (supabase/functions/sql/funding.sql). Cualquier otra cosa (violación de RLS,
 * constraint no prevista) se traduce a un error explícito — nunca se descarta
 * en silencio (Trust Layer, SPEC-014).
 */
function parsePostgresError(message: string): FundingError {
  if (message.toLowerCase().includes("row-level security")) {
    return { code: "UNAUTHORIZED" };
  }

  const match = /^FUNDING_ERROR:([A-Z_]+):(.*)$/s.exec(message);
  if (match) {
    const [, code, detail] = match as unknown as [string, string, string];
    if (KNOWN_FUNDING_ERROR_CODES.has(code as FundingError["code"])) {
      switch (code) {
        case "PROP_FIRM_NOT_FOUND":
          return { code: "PROP_FIRM_NOT_FOUND" };
        case "ACCOUNT_NOT_FOUND":
          return { code: "ACCOUNT_NOT_FOUND" };
        case "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT":
          return { code: "PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT" };
        case "UNAUTHORIZED":
          return { code: "UNAUTHORIZED" };
        case "INVALID_INITIAL_CAPITAL":
          return { code: "INVALID_INITIAL_CAPITAL", detail };
        case "INVALID_AMOUNT":
          return { code: "INVALID_AMOUNT", detail };
        case "VALIDATION_ERROR": {
          const [field, ...rest] = detail.split(":");
          return { code: "VALIDATION_ERROR", field: field ?? "unknown", detail: rest.join(":") || detail };
        }
        default:
          break;
      }
    }
  }

  return { code: "UNKNOWN", detail: message };
}

export async function crearEmpresa(
  client: SupabaseClient,
  input: CrearEmpresaInput,
): Promise<FundingResult<PropFirm>> {
  const { data, error } = await client.rpc("crear_empresa", {
    p_name: input.name,
    p_is_personal: input.is_personal,
  });
  if (error) return err(parsePostgresError(error.message));
  return ok(data as PropFirm);
}

export async function crearCuenta(
  client: SupabaseClient,
  input: CrearCuentaInput,
): Promise<FundingResult<Account>> {
  const { data, error } = await client.rpc("crear_cuenta", {
    p_prop_firm_id: input.prop_firm_id,
    p_name: input.name,
    p_initial_capital: input.initial_capital,
    p_currency: input.currency,
    p_profit_split_pct: input.profit_split_pct ?? null,
  });
  if (error) return err(parsePostgresError(error.message));
  return ok(data as Account);
}

export async function listarCuentas(client: SupabaseClient): Promise<FundingResult<Account[]>> {
  const { data, error } = await client.rpc("listar_cuentas");
  if (error) return err(parsePostgresError(error.message));
  return ok((data ?? []) as Account[]);
}

export async function obtenerCuenta(client: SupabaseClient, id: string): Promise<FundingResult<Account>> {
  const { data, error } = await client.rpc("obtener_cuenta", { p_id: id });
  if (error) return err(parsePostgresError(error.message));
  if (!data) return err({ code: "ACCOUNT_NOT_FOUND" });
  return ok(data as Account);
}

export async function registrarEventoCapital(
  client: SupabaseClient,
  accountId: string,
  eventType: CapitalEventType,
  amount: string,
  note?: string,
): Promise<FundingResult<void>> {
  const { error } = await client.rpc("registrar_evento_capital", {
    p_account_id: accountId,
    p_event_type: eventType,
    p_amount: amount,
    p_note: note ?? null,
  });
  if (error) return err(parsePostgresError(error.message));
  return ok(undefined);
}
