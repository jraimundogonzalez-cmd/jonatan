import type { Money, RValue, Result } from "@tradepilot/risk-engine";
import type { ClosureReason, OperationsError, Trade, TradePartialExecuted } from "../domain/types.js";

export interface AplicarCierreParams {
  readonly tradeId: string;
  readonly closedAt: string;
  readonly closureReason: ClosureReason;
  readonly cierreManualRr?: RValue;
  readonly rMax: RValue;
  readonly rFinal: RValue;
  readonly pnlAmount: Money;
  /**
   * BUILD 018 — testigo de la evidencia: cuántos parciales ejecutados se
   * usaron para calcular `rFinal`. El `for update` del cierre no protege esta
   * lectura, porque ocurrió en una transacción anterior; si otra sesión
   * inserta un parcial en esa ventana, la base rechaza con `EVIDENCE_CHANGED`
   * y el orquestador recalcula. Siempre se envía desde la ruta real.
   */
  readonly expectedPartials: number;
  /** Idempotencia del cierre — una repetición exacta devuelve la Operación sin escribir. */
  readonly idempotencyKey?: string;
}

/**
 * Cualquier campo ausente conserva su valor actual (semántica `Partial`,
 * SPEC-002 §7 `Partial<OperacionEditable>`) — `status` no aparece aquí a
 * propósito, `editarOperacion` nunca lo toca (FORBIDDEN_STATUS_EDIT).
 *
 * BUILD 016B/018: `riskAmount` y `rrObjective` desaparecen de la superficie de
 * aplicación — son hechos de **identidad**, inmutables desde el nacimiento, y
 * la base los rechaza con `IMMUTABLE_IDENTITY_FACT`. Los parámetros SQL siguen
 * existiendo por compatibilidad histórica: contrato SQL y superficie de
 * aplicación son cosas distintas. Aquí sólo queda el **desenlace**, que es lo
 * único corregible.
 */
export interface AplicarEdicionParams {
  readonly tradeId: string;
  readonly rMax?: RValue;
  readonly closureReason?: ClosureReason;
  readonly cierreManualRr?: RValue;
  readonly rFinal?: RValue;
  readonly pnlAmount?: Money;
  readonly notes?: string;
  readonly comments?: string;
  /**
   * BUILD 019 — borrado explícito de `cierre_manual_rr`. `undefined`/`false`
   * conservan la semántica `Partial` de siempre; sólo `true` vacía el campo.
   * Enviarlo junto a `cierreManualRr` es un error de dominio: no existe
   * precedencia entre fijar y borrar, y la RPC lo rechaza.
   */
  readonly borrarCierreManualRr?: boolean;
}

/**
 * Puerto (Dependency Inversion, mismo patrón que `AccountRiskStateRepository`
 * de Risk Engine) — el servicio depende de esta abstracción, nunca de
 * Supabase directamente. Permite probar toda la orquestación con un
 * doble en memoria.
 */
export interface TradeGateway {
  obtenerOperacion(tradeId: string): Promise<Result<Trade, OperationsError>>;
  listarParcialesEjecutados(tradeId: string): Promise<Result<readonly TradePartialExecuted[], OperationsError>>;

  /**
   * Muestra vigente de R_final por Cuenta (excluye Canceladas) — la entrega
   * Operations Engine a Risk Engine para reconstruir su acumulador tras una
   * edición; Risk Engine nunca lee `trades` directamente (BUILD 003,
   * `packages/risk-engine/src/domain/events.ts`).
   */
  listarRFinalVigentePorCuenta(accountId: string): Promise<Result<readonly RValue[], OperationsError>>;

  aplicarCierre(params: AplicarCierreParams): Promise<Result<Trade, OperationsError>>;
  aplicarEdicion(params: AplicarEdicionParams): Promise<Result<Trade, OperationsError>>;
}
