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
  calcularEvidenciaParciales,
  calcularRAgregado,
  err,
  ok,
  restar,
  RiskEngineService,
  type Money,
  type ProcesarEventoResultado,
  type Result,
  type RFinalInput,
  type EvidenciaParciales,
  type ImpactoPorParcialItem,
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
  /** BUILD 018 — idempotencia del cierre. Un reintento con la misma clave no duplica el efecto económico. */
  readonly idempotency_key?: string;
  /**
   * BUILD 019 — cuántos parciales ejecutados vio la **previsualización** que el
   * usuario acaba de confirmar.
   *
   * El testigo de 018 (`p_expected_partials`) cubre la ventana entre la lectura
   * de este servicio y la escritura de la RPC: milisegundos. La previsualización
   * abre otra ventana mucho mayor —entre mirar y confirmar pueden pasar
   * minutos— que aquel testigo **no puede cubrir**, porque su lectura fresca
   * coincidiría consigo misma y la RPC aceptaría sin más.
   *
   * Sin esto: previsualizas 0.5R, otra sesión registra un parcial, confirmas, y
   * se persiste 1.2R sin que nadie avise. La previsualización habría mentido.
   *
   * No es semántica nueva: es el mismo `EVIDENCE_CHANGED`, detectado un peldaño
   * más arriba. Omitirlo desactiva sólo esta comprobación, nunca la de 018.
   */
  readonly evidencia_previsualizada?: number;
}

/**
 * BUILD 019 — resultado de una previsualización. No es un hecho persistido y
 * la UI debe presentarlo como tal.
 */
export interface PrevisualizacionCierre {
  readonly r_final: RValue;
  readonly pnl_amount: Money;
  /** Los parciales sobre los que se calculó. Viaja de vuelta como `evidencia_previsualizada`. */
  readonly evidencia_leida: number;
  /**
   * BUILD 022 — de dónde sale ese R, término a término.
   *
   * `calcularResultado` ya lo calculaba desde BUILD 003 y esta previsualización
   * lo tiraba a la basura antes de llegar a la pantalla. El trader veía el
   * resultado y no podía ver su origen. Ahora viaja: no es una segunda cuenta,
   * es la que ya se hacía.
   */
  readonly impacto_por_parcial: readonly ImpactoPorParcialItem[];
}

/**
 * BUILD 022 — lo que una corrección va a cambiar, ANTES de cambiarlo.
 *
 * BUILD 021 encontró la asimetría que esto corrige: cerrar exigía
 * previsualizar, y corregir —que reescribe R, reescribe P&L y mueve capital
 * real— no avisaba de nada. La protección estaba en el lado equivocado.
 *
 * No hay una segunda calculadora: se arma el mismo `RFinalInput` que arma
 * `editarOperacion` (misma función privada, `construirEntradaDeCorreccion`) y
 * se llama al mismo `calcularResultado`. Lo único que esta vía NO hace es
 * escribir.
 */
export interface PrevisualizacionCorreccion {
  readonly r_actual: RValue | null;
  readonly r_nuevo: RValue;
  readonly delta_r: RValue;
  readonly pnl_actual: Money | null;
  readonly pnl_nuevo: Money;
  readonly delta_pnl: Money;
  readonly motivo_actual: ClosureReason | null;
  readonly motivo_nuevo: ClosureReason | null;
  readonly r_max_actual: RValue | null;
  readonly r_max_nuevo: RValue;
  readonly cierre_manual_actual: RValue | null;
  readonly cierre_manual_nuevo: RValue | null;
  /** El desglose que explica el R nuevo: qué aporta cada parcial y qué el resto. */
  readonly impacto_por_parcial: readonly ImpactoPorParcialItem[];
  readonly evidencia_leida: number;
}

/** BUILD 022 — resultado agregado de una Cuenta, en R (decisión E-1). */
export interface ResumenDeCuenta {
  readonly r_agregado: RValue;
  /** Cuántos resultados vigentes componen `r_agregado`. Debe coincidir con `cerradas`. */
  readonly operaciones_en_la_muestra: number;
  readonly cerradas: number;
  readonly abiertas: number;
  readonly canceladas: number;
}

export interface CierreOperacionResultado {
  readonly trade: Trade;
  readonly accumulator_update: Result<ProcesarEventoResultado, RiskEngineError>;
}

/**
 * BUILD 016B/018 — `risk_amount` y `rr_objective` ya no están aquí: son hechos
 * de identidad y la base los rechaza. Sólo el **desenlace** es corregible.
 */
export interface EditarOperacionInput {
  readonly trade_id: string;
  readonly r_max?: RValue;
  readonly closure_reason?: ClosureReason;
  readonly cierre_manual_rr?: RValue;
  readonly notes?: string;
  readonly comments?: string;
  /**
   * BUILD 019 — borrado explícito de `cierre_manual_rr`, la decisión D1.
   *
   * Nunca se deriva de `closure_reason`: derivarlo volvería a hacer implícito
   * el borrado y, además, obligaría a este servicio a conocer las cuatro reglas
   * de BUILD 018 — una segunda fuente de verdad de algo ya congelado en el
   * trigger. El usuario lo declara, el dominio lo juzga.
   */
  readonly borrar_cierre_manual_rr?: boolean;
}

export interface EdicionOperacionResultado {
  readonly trade: Trade;
  /** `null` = edición pura de datos, nunca se invocó a Risk Engine (SPEC-002 §5.6). */
  readonly accumulator_update: Result<ProcesarEventoResultado, RiskEngineError> | null;
}

function buildEdicionParams(input: EditarOperacionInput): AplicarEdicionParams {
  return {
    tradeId: input.trade_id,
    ...(input.r_max ? { rMax: input.r_max } : {}),
    ...(input.closure_reason ? { closureReason: input.closure_reason } : {}),
    ...(input.cierre_manual_rr ? { cierreManualRr: input.cierre_manual_rr } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.comments !== undefined ? { comments: input.comments } : {}),
    ...(input.borrar_cierre_manual_rr ? { borrarCierreManualRr: true } : {}),
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

    // BUILD 019 — la red de idempotencia va ANTES de la comprobación de estado,
    // en el mismo orden que `aplicar_cierre_operacion`.
    //
    // Hallazgo real de la verificación end-to-end de este build: BUILD 018
    // construyó la idempotencia del cierre dentro de la RPC, pero este servicio
    // cortaba antes con `status !== "open"` y **la RPC nunca llegaba a
    // ejecutarse** en un reintento. Por la ruta real de la aplicación —la
    // única que la interfaz puede usar— un reenvío del mismo cierre devolvía
    // `INVALID_STATE_TRANSITION` en vez de la Operación ya cerrada. La
    // idempotencia existía y era inalcanzable.
    //
    // Esto no duplica la autoridad: la RPC sigue decidiendo bajo `for update`,
    // que es donde la decisión es correcta. Este atajo sólo puede evitar un
    // error, nunca inventar un éxito — su condición es exactamente la de la
    // RPC, y sólo se cumple si este mismo cierre ya se aplicó.
    if (
      trade.status === "closed" &&
      input.idempotency_key !== undefined &&
      trade.closure_idempotency_key === input.idempotency_key
    ) {
      // Risk Engine es idempotente por `event_id` (= trade_id), así que
      // reprocesar converge en vez de duplicar: un reintento tras un fallo
      // parcial —Operación cerrada, acumulador todavía no— se completa aquí.
      const accumulatorUpdate = await this.riskEngineService.procesarOperacionCerrada({
        kind: "OperacionCerrada",
        event_id: input.trade_id,
        account_id: trade.account_id,
        trade_id: input.trade_id,
        occurred_at: new Date().toISOString(),
        r_final_input: {
          riesgo_eur: trade.risk_amount,
          rr_objetivo: trade.rr_objective,
          parciales_ejecutados: [],
          r_max: input.r_max,
          be_trigger: trade.be_trigger,
        },
      });
      return ok({ trade, accumulator_update: accumulatorUpdate });
    }

    if (trade.status !== "open") {
      return err({ code: "INVALID_STATE_TRANSITION", from: trade.status, to: "closed" });
    }

    const partialsResult = await this.tradeGateway.listarParcialesEjecutados(input.trade_id);
    if (!partialsResult.ok) return partialsResult;

    // BUILD 019 — la ventana previsualización → confirmación. Se comprueba
    // ANTES de calcular y antes de tocar la RPC: si la evidencia ya no es la
    // que el usuario vio, no hay nada que calcular todavía.
    if (
      input.evidencia_previsualizada !== undefined &&
      input.evidencia_previsualizada !== partialsResult.value.length
    ) {
      return err({
        code: "EVIDENCE_CHANGED",
        esperados: input.evidencia_previsualizada,
        actuales: partialsResult.value.length,
      });
    }

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
      // El testigo de la evidencia: exactamente los parciales sobre los que se
      // acaba de calcular. La ruta real **siempre** lo envía.
      expectedPartials: partialsResult.value.length,
      ...(input.idempotency_key ? { idempotencyKey: input.idempotency_key } : {}),
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
   * BUILD 019 — previsualización del desenlace. **No escribe absolutamente
   * nada**: ni Operación, ni capital, ni evento, ni auditoría.
   *
   * No hay aquí una segunda fórmula: hay una segunda invocación de la única que
   * existe. Arma el mismo `RFinalInput` que `cerrarOperacion` y llama al mismo
   * `calcularResultado`. Si esto y el cierre divergieran alguna vez, sería
   * porque alguien duplicó la fórmula — y hay un test que lo vigila.
   *
   * Devuelve además cuántos parciales usó, que es lo que el llamante enviará de
   * vuelta como `evidencia_previsualizada` al confirmar.
   */
  async previsualizarCierre(
    input: CerrarOperacionInput,
  ): Promise<Result<PrevisualizacionCierre, OperationsError>> {
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

    return ok({
      r_final: resultado.value.r_final.value,
      pnl_amount: resultado.value.beneficio_real.value,
      evidencia_leida: partialsResult.value.length,
      impacto_por_parcial: resultado.value.impacto_por_parcial.value,
    });
  }

  /**
   * BUILD 022 — el estado de la evidencia de una Operación: **R realizado**,
   * porcentaje cerrado, porcentaje abierto y el mayor R evidenciado.
   *
   * Sólo lee. Existe para que la pantalla de una Operación abierta pueda
   * enseñar lo que el sistema ya sabe sin calcular ni una sola cifra: la
   * aritmética entera vive en `calcularEvidenciaParciales` (Quant Engine), que
   * comparte descomposición con `R_final`.
   */
  async resumenEvidencia(tradeId: string): Promise<Result<EvidenciaParciales, OperationsError>> {
    const partialsResult = await this.tradeGateway.listarParcialesEjecutados(tradeId);
    if (!partialsResult.ok) return partialsResult;

    const evidencia = calcularEvidenciaParciales(partialsResult.value);
    if (!evidencia.ok) {
      return err({ code: "RISK_ENGINE_ERROR", error: { code: "QUANT_ENGINE_ERROR", error: evidencia.error } });
    }
    return ok(evidencia.value.value);
  }

  /**
   * BUILD 022 — el resultado agregado de una Cuenta (decisión E-1 del usuario).
   *
   * `r_agregado` sale de la **muestra vigente** —la misma que Operations
   * entrega a Risk Engine para reconstruir su acumulador— y se recalcula
   * entera cada vez. No se lee `account_risk_state`: ese acumulador es
   * eventualmente consistente por diseño (BUILD 003, su actualización es
   * asíncrona y reintentable), así que podría mostrar una cifra que no
   * coincidiera con la lista de Operaciones de la pantalla de al lado. Aquí
   * el número siempre es reproducible a mano desde los resultados vigentes.
   *
   * Los conteos salen de un listado aparte porque cuentan estados, no
   * resultados: una Cancelada no tiene `r_final` y por definición no está en
   * la muestra.
   */
  async resumenDeCuenta(accountId: string): Promise<Result<ResumenDeCuenta, OperationsError>> {
    const muestraResult = await this.tradeGateway.listarRFinalVigentePorCuenta(accountId);
    if (!muestraResult.ok) return muestraResult;

    const operacionesResult = await this.tradeGateway.listarOperacionesPorCuenta(accountId);
    if (!operacionesResult.ok) return operacionesResult;

    const agregado = calcularRAgregado(muestraResult.value);
    if (!agregado.ok) {
      return err({ code: "RISK_ENGINE_ERROR", error: { code: "QUANT_ENGINE_ERROR", error: agregado.error } });
    }

    const operaciones = operacionesResult.value;
    return ok({
      r_agregado: agregado.value.value,
      operaciones_en_la_muestra: muestraResult.value.length,
      cerradas: operaciones.filter((t) => t.status === "closed").length,
      abiertas: operaciones.filter((t) => t.status === "open").length,
      canceladas: operaciones.filter((t) => t.status === "cancelled").length,
    });
  }

  /**
   * BUILD 022 — construye el `RFinalInput` de una corrección. **Un solo sitio**
   * para las dos vías: `previsualizarCorreccion` (que enseña) y
   * `editarOperacion` (que aplica). Si divergieran, la pantalla mentiría.
   *
   * `riesgo_eur` y `rr_objetivo` salen SIEMPRE de la Operación: son identidad y
   * no pueden llegar como entrada de la corrección.
   */
  private async construirEntradaDeCorreccion(
    trade: Trade,
    input: EditarOperacionInput,
  ): Promise<Result<{ rFinalInput: RFinalInput; parciales: number }, OperationsError>> {
    const rMax = input.r_max ?? trade.r_max;
    if (rMax === null) {
      return err({ code: "GATEWAY_ERROR", detail: "una Operación Cerrada sin r_max es un estado inconsistente" });
    }
    // Cuando se borra, el recálculo NO puede arrastrar el valor anterior de la
    // Operación: la premisa acaba de desaparecer.
    const cierreManualRr = input.borrar_cierre_manual_rr
      ? undefined
      : (input.cierre_manual_rr ?? trade.cierre_manual_rr ?? undefined);

    const partialsResult = await this.tradeGateway.listarParcialesEjecutados(trade.id);
    if (!partialsResult.ok) return partialsResult;

    return ok({
      rFinalInput: {
        riesgo_eur: trade.risk_amount,
        rr_objetivo: trade.rr_objective,
        parciales_ejecutados: partialsResult.value,
        r_max: rMax,
        be_trigger: trade.be_trigger,
        ...(cierreManualRr ? { cierre_manual_rr: cierreManualRr } : {}),
      },
      parciales: partialsResult.value.length,
    });
  }

  /**
   * BUILD 022 — qué va a cambiar una corrección, antes de aplicarla.
   *
   * No escribe nada. Reutiliza `construirEntradaDeCorreccion` y
   * `calcularResultado`, exactamente los mismos que usa `editarOperacion`: lo
   * que se enseña aquí es, literalmente, lo que se va a persistir si el usuario
   * confirma sin cambiar nada más.
   *
   * Las diferencias (`delta_r`, `delta_pnl`) se calculan con el kernel decimal,
   * nunca con aritmética de JavaScript. `delta_pnl` es además el importe exacto
   * que `aplicar_edicion_operacion` asentará como evento de capital.
   */
  async previsualizarCorreccion(
    input: EditarOperacionInput,
  ): Promise<Result<PrevisualizacionCorreccion, OperationsError>> {
    const tradeResult = await this.tradeGateway.obtenerOperacion(input.trade_id);
    if (!tradeResult.ok) return tradeResult;
    const trade = tradeResult.value;

    if (trade.status !== "closed") {
      return err({ code: "INVALID_STATE_TRANSITION", from: trade.status, to: "closed" });
    }

    const entrada = await this.construirEntradaDeCorreccion(trade, input);
    if (!entrada.ok) return entrada;

    const resultado = this.riskEngineService.calcularResultado(entrada.value.rFinalInput);
    if (!resultado.ok) return err({ code: "RISK_ENGINE_ERROR", error: resultado.error });

    const rNuevo = resultado.value.r_final.value;
    const pnlNuevo = resultado.value.beneficio_real.value;
    const cierreManualNuevo = entrada.value.rFinalInput.cierre_manual_rr ?? null;

    return ok({
      r_actual: trade.r_final,
      r_nuevo: rNuevo,
      delta_r: trade.r_final === null ? rNuevo : restar(rNuevo, trade.r_final),
      pnl_actual: trade.pnl_amount,
      pnl_nuevo: pnlNuevo,
      delta_pnl: trade.pnl_amount === null ? pnlNuevo : restar(pnlNuevo, trade.pnl_amount),
      motivo_actual: trade.closure_reason,
      motivo_nuevo: input.closure_reason ?? trade.closure_reason,
      r_max_actual: trade.r_max,
      r_max_nuevo: entrada.value.rFinalInput.r_max,
      cierre_manual_actual: trade.cierre_manual_rr,
      cierre_manual_nuevo: cierreManualNuevo,
      impacto_por_parcial: resultado.value.impacto_por_parcial.value,
      evidencia_leida: entrada.value.parciales,
    });
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

    // Borrar `cierre_manual_rr` cambia la rama de `R_cierre_resto` que aplica
    // la fórmula congelada, luego cambia R_final. Omitirlo aquí persistiría un
    // desenlace calculado sobre una premisa recién borrada — y el trigger de
    // 018 lo aceptaría, porque sería internamente coherente. Es el fallo más
    // sutil que puede introducir este build, y tiene test propio.
    const touchesRFinal =
      input.r_max !== undefined ||
      input.closure_reason !== undefined ||
      input.cierre_manual_rr !== undefined ||
      input.borrar_cierre_manual_rr === true;

    if (!touchesRFinal || trade.status !== "closed") {
      const aplicado = await this.tradeGateway.aplicarEdicion(buildEdicionParams(input));
      if (!aplicado.ok) return aplicado;
      return ok({ trade: aplicado.value, accumulator_update: null });
    }

    const entrada = await this.construirEntradaDeCorreccion(trade, input);
    if (!entrada.ok) return entrada;
    const { rFinalInput } = entrada.value;

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
