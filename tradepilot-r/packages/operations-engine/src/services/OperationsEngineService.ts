/**
 * Operations Engine — dueño del ciclo de vida de la Operación (SPEC-002).
 * Solo `cerrarOperacion`/`editarOperacion` viven en TypeScript: son las
 * únicas dos vías que pueden necesitar invocar a Risk Engine (y, a través
 * suyo, a Quant Engine) para obtener R_final/pnl_amount — todo lo demás
 * (abrir, registrar parciales, cancelar) es capital-neutral y estructural,
 * resuelto enteramente en SQL (`supabase/functions/sql/operations.sql`,
 * SPEC-002 §1.4 punto 1: "nunca calcula R_final/pnl_amount por sí misma").
 */
import { randomUUID } from "node:crypto";
import {
  err,
  ok,
  RiskEngineService,
  type Money,
  type ProcesarEventoResultado,
  type Result,
  type RFinalInput,
  type RiskEngineError,
  type RValue,
} from "@tradepilot/risk-engine";
import type { ClosureReason, OperationsError, Trade } from "../domain/types.js";
import type { AplicarEdicionParams, TradeGateway } from "../ports/TradeGateway.js";

export interface CerrarOperacionInput {
  readonly trade_id: string;
  readonly closed_at: string;
  readonly closure_reason: ClosureReason;
  readonly cierre_manual_rr?: RValue;
  readonly r_max: RValue;
}

export interface CierreOperacionResultado {
  readonly trade: Trade;
  readonly accumulator_update: Result<ProcesarEventoResultado, RiskEngineError>;
}

export interface EditarOperacionInput {
  readonly trade_id: string;
  readonly risk_amount?: Money;
  readonly rr_objective?: RValue;
  readonly r_max?: RValue;
  readonly closure_reason?: ClosureReason;
  readonly cierre_manual_rr?: RValue;
  readonly notes?: string;
  readonly comments?: string;
}

export interface EdicionOperacionResultado {
  readonly trade: Trade;
  /** `null` = edición pura de datos, nunca se invocó a Risk Engine (SPEC-002 §5.6). */
  readonly accumulator_update: Result<ProcesarEventoResultado, RiskEngineError> | null;
}

function buildEdicionParams(input: EditarOperacionInput): AplicarEdicionParams {
  return {
    tradeId: input.trade_id,
    ...(input.risk_amount ? { riskAmount: input.risk_amount } : {}),
    ...(input.rr_objective ? { rrObjective: input.rr_objective } : {}),
    ...(input.r_max ? { rMax: input.r_max } : {}),
    ...(input.closure_reason ? { closureReason: input.closure_reason } : {}),
    ...(input.cierre_manual_rr ? { cierreManualRr: input.cierre_manual_rr } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.comments !== undefined ? { comments: input.comments } : {}),
  };
}

export class OperationsEngineService {
  constructor(
    private readonly tradeGateway: TradeGateway,
    private readonly riskEngineService: RiskEngineService,
  ) {}

  /**
   * Único camino de cierre. Camino crítico (SPEC-002 §6): calcularResultado
   * es síncrono y <1ms (BUILD 003) — nunca espera a Rule Engine ni a AI
   * Engine, ninguno de los dos se invoca desde aquí.
   */
  async cerrarOperacion(input: CerrarOperacionInput): Promise<Result<CierreOperacionResultado, OperationsError>> {
    const tradeResult = await this.tradeGateway.obtenerOperacion(input.trade_id);
    if (!tradeResult.ok) return tradeResult;
    const trade = tradeResult.value;

    if (trade.status !== "open") {
      return err({ code: "INVALID_STATE_TRANSITION", from: trade.status, to: "closed" });
    }

    const partialsResult = await this.tradeGateway.listarParcialesEjecutados(input.trade_id);
    if (!partialsResult.ok) return partialsResult;

    const rFinalInput: RFinalInput = {
      riesgo_eur: trade.risk_amount,
      rr_objetivo: trade.rr_objective,
      parciales_ejecutados: partialsResult.value,
      r_max: input.r_max,
      be_trigger: trade.be_trigger,
      ...(input.cierre_manual_rr ? { cierre_manual_rr: input.cierre_manual_rr } : {}),
    };

    const resultado = this.riskEngineService.calcularResultado(rFinalInput);
    if (!resultado.ok) return err({ code: "RISK_ENGINE_ERROR", error: resultado.error });

    const aplicado = await this.tradeGateway.aplicarCierre({
      tradeId: input.trade_id,
      closedAt: input.closed_at,
      closureReason: input.closure_reason,
      ...(input.cierre_manual_rr ? { cierreManualRr: input.cierre_manual_rr } : {}),
      rMax: input.r_max,
      rFinal: resultado.value.r_final.value,
      pnlAmount: resultado.value.beneficio_real.value,
    });
    if (!aplicado.ok) return aplicado;

    // event_id estable (= trade_id): OperacionCerrada es 1:1 con el cierre
    // de esta Operación, nunca se repite — un reintento de este paso tras un
    // fallo parcial (Operación ya cerrada, acumulador todavía no) es
    // idempotente por construcción vía el propio ledger de Risk Engine
    // (BUILD 003), sin inventar un mecanismo de reintento nuevo aquí.
    const accumulatorUpdate = await this.riskEngineService.procesarOperacionCerrada({
      kind: "OperacionCerrada",
      event_id: input.trade_id,
      account_id: trade.account_id,
      trade_id: input.trade_id,
      occurred_at: new Date().toISOString(),
      r_final_input: rFinalInput,
    });

    // El hecho financiero (capital movido, Operación cerrada) ya es
    // definitivo aquí — un fallo en la actualización del acumulador
    // agregado (asíncrono por diseño, BUILD 003: idempotente + reintentable)
    // no debe convertir en fallo la respuesta de <30s que el trader espera
    // (SPEC-002 §6); se devuelve inspeccionable dentro del resultado, nunca
    // se descarta en silencio.
    return ok({ trade: aplicado.value, accumulator_update: accumulatorUpdate });
  }

  /**
   * Único camino de edición auditada (SPEC-002 §5.6). Recalcula vía Risk
   * Engine solo si el cambio puede afectar R_final/pnl_amount, y solo si la
   * Operación ya está Cerrada (si está Abierta, R_final todavía no existe).
   */
  async editarOperacion(input: EditarOperacionInput): Promise<Result<EdicionOperacionResultado, OperationsError>> {
    const tradeResult = await this.tradeGateway.obtenerOperacion(input.trade_id);
    if (!tradeResult.ok) return tradeResult;
    const trade = tradeResult.value;

    const touchesRFinal =
      input.risk_amount !== undefined ||
      input.rr_objective !== undefined ||
      input.r_max !== undefined ||
      input.closure_reason !== undefined ||
      input.cierre_manual_rr !== undefined;

    if (!touchesRFinal || trade.status !== "closed") {
      const aplicado = await this.tradeGateway.aplicarEdicion(buildEdicionParams(input));
      if (!aplicado.ok) return aplicado;
      return ok({ trade: aplicado.value, accumulator_update: null });
    }

    const rMax = input.r_max ?? trade.r_max;
    if (rMax === null) {
      return err({ code: "GATEWAY_ERROR", detail: "una Operación Cerrada sin r_max es un estado inconsistente" });
    }
    const cierreManualRr = input.cierre_manual_rr ?? trade.cierre_manual_rr ?? undefined;

    const partialsResult = await this.tradeGateway.listarParcialesEjecutados(input.trade_id);
    if (!partialsResult.ok) return partialsResult;

    const rFinalInput: RFinalInput = {
      riesgo_eur: input.risk_amount ?? trade.risk_amount,
      rr_objetivo: input.rr_objective ?? trade.rr_objective,
      parciales_ejecutados: partialsResult.value,
      r_max: rMax,
      be_trigger: trade.be_trigger,
      ...(cierreManualRr ? { cierre_manual_rr: cierreManualRr } : {}),
    };

    const resultado = this.riskEngineService.calcularResultado(rFinalInput);
    if (!resultado.ok) return err({ code: "RISK_ENGINE_ERROR", error: resultado.error });

    const aplicado = await this.tradeGateway.aplicarEdicion({
      ...buildEdicionParams(input),
      rFinal: resultado.value.r_final.value,
      pnlAmount: resultado.value.beneficio_real.value,
    });
    if (!aplicado.ok) return aplicado;

    // Vía de reconstrucción (BUILD 003): Welford no admite resta O(1), una
    // edición que cambia R_final se resuelve reconstruyendo el acumulador
    // completo desde la muestra vigente — Operations Engine es quien la
    // conoce y se la entrega, Risk Engine nunca lee `trades` directamente.
    const sampleResult = await this.tradeGateway.listarRFinalVigentePorCuenta(trade.account_id);
    if (!sampleResult.ok) return sampleResult;

    const accumulatorUpdate = await this.riskEngineService.procesarOperacionEditada({
      kind: "OperacionEditada",
      event_id: randomUUID(),
      account_id: trade.account_id,
      trade_id: input.trade_id,
      occurred_at: new Date().toISOString(),
      muestra_r_final_vigente: sampleResult.value,
    });

    return ok({ trade: aplicado.value, accumulator_update: accumulatorUpdate });
  }
}
