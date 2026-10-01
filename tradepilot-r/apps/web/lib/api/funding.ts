// API pública de Funding Management (implementation/mvp-0.1.md §8).
// Cada función envuelve una llamada RPC a Postgres (supabase/functions/sql/funding.sql) —
// nunca una llamada SQL directa desde un componente (mvp-0.1.md §6.3).
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESCALAS_CUENTA, ESCALAS_EVENTO_CAPITAL, normalizarFila, normalizarFilas } from "./decimales";
import {
  KNOWN_FUNDING_ERROR_CODES,
  type Account,
  type CapitalEvent,
  type CapitalEventType,
  type CrearCuentaInput,
  type CrearEmpresaInput,
  type FundingError,
  type FundingResult,
  type PropFirm,
} from "@/types/funding";

function ok<T>(value: T): FundingResult<T> {
  return { ok: true, value };
}

function err(error: FundingError): FundingResult<never> {
  return { ok: false, error };
}

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
  return ok(normalizarFila(data as Account, ESCALAS_CUENTA));
}

/**
 * Lista las Empresas del usuario actual. Añadida durante la implementación
 * del onboarding y de Nueva Cuenta — el catálogo de mvp-0.1.md §8 no incluía
 * ninguna función de lectura de `prop_firms` (ver hallazgo junto a
 * `listar_empresas` en funding.sql).
 */
export async function listarEmpresas(client: SupabaseClient): Promise<FundingResult<PropFirm[]>> {
  const { data, error } = await client.rpc("listar_empresas");
  if (error) return err(parsePostgresError(error.message));
  return ok((data ?? []) as PropFirm[]);
}

export async function listarCuentas(client: SupabaseClient): Promise<FundingResult<Account[]>> {
  const { data, error } = await client.rpc("listar_cuentas");
  if (error) return err(parsePostgresError(error.message));
  return ok(normalizarFilas((data ?? []) as Account[], ESCALAS_CUENTA));
}

export async function obtenerCuenta(client: SupabaseClient, id: string): Promise<FundingResult<Account>> {
  const { data, error } = await client.rpc("obtener_cuenta", { p_id: id });
  if (error) return err(parsePostgresError(error.message));
  if (!data) return err({ code: "ACCOUNT_NOT_FOUND" });
  return ok(normalizarFila(data as Account, ESCALAS_CUENTA));
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

/**
 * Historial de eventos de capital de una Cuenta, orden cronológico descendente.
 * Añadida durante la implementación de la pantalla de Detalle de Cuenta — el
 * catálogo de mvp-0.1.md §8 no tenía ninguna función de lectura del ledger
 * (ver hallazgo documentado junto a `listar_eventos_capital` en funding.sql).
 */
export async function listarEventosCapital(
  client: SupabaseClient,
  accountId: string,
): Promise<FundingResult<CapitalEvent[]>> {
  const { data, error } = await client.rpc("listar_eventos_capital", { p_account_id: accountId });
  if (error) return err(parsePostgresError(error.message));
  return ok(normalizarFilas((data ?? []) as CapitalEvent[], ESCALAS_EVENTO_CAPITAL));
}
