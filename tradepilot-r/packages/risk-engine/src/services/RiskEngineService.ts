/**
 * Risk Engine — orquestador (26 §8, 22.5 §2.3). Invoca Quant Engine, persiste
 * el estado agregado por Cuenta, prepara los datos que consumirá Rule
 * Engine. **Nunca contiene una fórmula matemática propia** — cada línea de
 * este archivo que "calcula" algo es, en realidad, una llamada a
 * `@tradepilot/quant-engine` o una recombinación de sus resultados ya
 * calculados.
 */
import {
  calcularBeneficioMaximo,
  calcularBeneficioReal,
  calcularBeneficioSacrificado,
  calcularDesviacionDesdeAcumulador,
  calcularDrawdownState,
  calcularEsperanzaIncremental,
  calcularImpactoPorParcial,
  calcularPorcentajeConservado,
  calcularRFinal,
  EMPTY_WELFORD_ACCUMULATOR,
  err,
  ok,
  type DrawdownState,
  type ImpactoPorParcialItem,
  type Money,
  type Percent,
  type QuantError,
  type QuantResult,
  type RFinalInput,
  type RValue,
  type Result,
  type WelfordAccumulator,
} from "@tradepilot/quant-engine";
import type {
  AcumuladorActualizadoEvent,
  OperacionCanceladaEvent,
  OperacionCerradaEvent,
  OperacionEditadaEvent,
} from "../domain/events.js";
import type { DrawdownConfig, RiskEngineError } from "../domain/types.js";
import type { AccountRiskStateRepository, ApplyAccumulatorOutcome } from "../ports/AccountRiskStateRepository.js";
import type { CapitalFactsProvider } from "../ports/CapitalFactsProvider.js";

const MAX_VERSION_CONFLICT_RETRIES = 5;

/**
 * Pipeline (a) de SPEC-001 §2.2 — resultado completo de una Operación
 * individual. Cada campo es un `QuantResult` (o `Result<QuantResult,...>`
 * cuando la propia función de Quant Engine puede fallar de forma legítima,
 * como `porcentaje_conservado` con `r_max = 0`) — nunca un valor
 * recalculado a mano aquí.
 */
export interface ResultadoOperacion {
  readonly r_final: QuantResult<RValue>;
  readonly beneficio_real: QuantResult<Money>;
  readonly beneficio_maximo: QuantResult<Money>;
  readonly beneficio_sacrificado: QuantResult<Money>;
  readonly porcentaje_conservado: Result<QuantResult<Percent>, QuantError>;
  readonly impacto_por_parcial: QuantResult<ImpactoPorParcialItem[]>;
}

export interface ProcesarEventoResultado {
  readonly outcome: ApplyAccumulatorOutcome;
  readonly evento_emitido: AcumuladorActualizadoEvent | null;
}

export class RiskEngineService {
  constructor(
    private readonly accountRiskStateRepository: AccountRiskStateRepository,
    private readonly capitalFactsProvider: CapitalFactsProvider,
  ) {}

  /**
   * Pipeline síncrono de camino crítico (SPEC-002 §6 punto 1: debe permanecer
   * <1ms, nunca hace I/O) — invocado por Operations Engine al cerrar/editar
   * una Operación, antes de persistir la fila. No persiste nada por sí
   * mismo: Operations Engine decide qué guardar en su propia tabla.
   */
  calcularResultado(input: RFinalInput): Result<ResultadoOperacion, RiskEngineError> {
    const rFinalResult = calcularRFinal(input);
    if (!rFinalResult.ok) {
      return err({ code: "QUANT_ENGINE_ERROR", error: rFinalResult.error });
    }
    const rFinal = rFinalResult.value;

    const beneficioReal = calcularBeneficioReal(input.riesgo_eur, rFinal.value);
    const beneficioMaximo = calcularBeneficioMaximo(input.riesgo_eur, input.rr_objetivo);
    const beneficioSacrificado = calcularBeneficioSacrificado(beneficioMaximo.value, beneficioReal.value);
    const porcentajeConservado = calcularPorcentajeConservado(rFinal.value, input.r_max);

    const impactoResult = calcularImpactoPorParcial(input, rFinal.value);
    if (!impactoResult.ok) {
      // No debería ocurrir: calcularRFinal ya validó la misma forma de input
      // con la misma función de validación interna — defensivo, no un
      // camino esperado.
      return err({ code: "QUANT_ENGINE_ERROR", error: impactoResult.error });
    }

    return ok({
      r_final: rFinal,
      beneficio_real: beneficioReal,
      beneficio_maximo: beneficioMaximo,
      beneficio_sacrificado: beneficioSacrificado,
      porcentaje_conservado: porcentajeConservado,
      impacto_por_parcial: impactoResult.value,
    });
  }

  /**
   * Vía incremental de producción (SPEC-001 §5.3) — O(1) por operación
   * cerrada, idempotente (protección frente a doble entrega vía `event_id`)
   * y con concurrencia optimista (reintenta si otra actualización concurrente
   * ganó la carrera, nunca pierde una escritura en silencio).
   */
  async procesarOperacionCerrada(event: OperacionCerradaEvent): Promise<Result<ProcesarEventoResultado, RiskEngineError>> {
    const resultado = this.calcularResultado(event.r_final_input);
    if (!resultado.ok) return resultado;

    const rFinalValue = resultado.value.r_final.value;
    return this.writeAccumulatorWithRetry(event.account_id, event.event_id, "OperacionCerrada", (current) =>
      calcularEsperanzaIncremental(current, rFinalValue),
    );
  }

  /**
   * Vía de recuperación (SPEC-001 §5.3: "recuperación tras corrupción") —
   * Welford no admite una resta O(1), así que una edición o cancelación que
   * invalida un R_final ya contabilizado se resuelve reconstruyendo el
   * acumulador completo a partir de la muestra vigente que el llamador
   * aporta (Operations Engine, que sí conoce su propio historial de
   * Operaciones — Risk Engine nunca lo lee directamente).
   */
  async procesarOperacionEditada(event: OperacionEditadaEvent): Promise<Result<ProcesarEventoResultado, RiskEngineError>> {
    return this.reconstruirAcumulador(event.account_id, event.event_id, "OperacionEditada", event.muestra_r_final_vigente);
  }

  async procesarOperacionCancelada(event: OperacionCanceladaEvent): Promise<Result<ProcesarEventoResultado, RiskEngineError>> {
    return this.reconstruirAcumulador(event.account_id, event.event_id, "OperacionCancelada", event.muestra_r_final_vigente);
  }

  private async reconstruirAcumulador(
    accountId: string,
    eventId: string,
    eventType: string,
    muestraVigente: readonly RValue[],
  ): Promise<Result<ProcesarEventoResultado, RiskEngineError>> {
    const nuevoAcumulador = muestraVigente.reduce(calcularEsperanzaIncremental, EMPTY_WELFORD_ACCUMULATOR);
    return this.writeAccumulatorWithRetry(accountId, eventId, eventType, () => nuevoAcumulador);
  }

  /**
   * Único punto de escritura del acumulador — usado tanto por la vía
   * incremental como por la de reconstrucción, para no duplicar el bucle de
   * reintento por conflicto de versión en dos sitios.
   */
  private async writeAccumulatorWithRetry(
    accountId: string,
    eventId: string,
    eventType: string,
    computeNext: (current: WelfordAccumulator) => WelfordAccumulator,
  ): Promise<Result<ProcesarEventoResultado, RiskEngineError>> {
    const initialState = await this.accountRiskStateRepository.obtener(accountId);
    if (!initialState.ok) return initialState;

    let current = initialState.value;

    for (let attempt = 0; attempt < MAX_VERSION_CONFLICT_RETRIES; attempt++) {
      const nuevoAcumulador = computeNext(current.accumulator);

      const applyResult = await this.accountRiskStateRepository.aplicarActualizacion({
        accountId,
        eventId,
        eventType,
        expectedVersion: current.version,
        nuevoAcumulador,
      });
      if (!applyResult.ok) return applyResult;

      const outcome = applyResult.value;
      if (outcome.kind !== "version_conflict") {
        const eventoEmitido: AcumuladorActualizadoEvent | null =
          outcome.kind === "applied"
            ? {
                kind: "AcumuladorActualizado",
                account_id: accountId,
                accumulator: outcome.state.accumulator,
                trigger: eventType === "OperacionCerrada" ? "incremental" : "reconstruccion",
                occurred_at: new Date().toISOString(),
              }
            : null;
        return ok({ outcome, evento_emitido: eventoEmitido });
      }

      current = outcome.current;
    }

    return err({ code: "VERSION_CONFLICT_EXCEEDED", account_id: accountId, attempts: MAX_VERSION_CONFLICT_RETRIES });
  }

  /**
   * Prepara los datos que Rule Engine consumirá (SPEC-004 §3,
   * `EvaluationInputs.risk_magnitudes`) — nunca decide si el resultado es
   * aceptable, solo lo calcula y lo devuelve.
   */
  async obtenerEstadoDrawdown(accountId: string, config: DrawdownConfig): Promise<Result<DrawdownState, RiskEngineError>> {
    const factsResult = await this.capitalFactsProvider.obtenerHechosDeCapital(accountId);
    if (!factsResult.ok) return factsResult;
    const facts = factsResult.value;

    // `exactOptionalPropertyTypes` exige que `peak_capital_basis` esté
    // ausente por completo (nunca presente-con-undefined) cuando no aplica —
    // Quant Engine está congelado, así que el ajuste vive aquí, no en su tipo.
    const drawdownResult = calcularDrawdownState({
      current_capital: facts.current_capital,
      initial_capital: facts.initial_capital,
      drawdown_type: config.drawdown_type,
      max_total_drawdown_pct: config.max_total_drawdown_pct,
      ...(config.peak_capital_basis ? { peak_capital_basis: config.peak_capital_basis } : {}),
    });
    if (!drawdownResult.ok) {
      return err({ code: "QUANT_ENGINE_ERROR", error: drawdownResult.error });
    }

    return ok(drawdownResult.value.value);
  }

  /** Esperanza matemática agregada de la Cuenta (22.5 §2.3, "Devuelve"). */
  async obtenerEsperanzaAgregada(accountId: string): Promise<Result<RValue, RiskEngineError>> {
    const stateResult = await this.accountRiskStateRepository.obtener(accountId);
    if (!stateResult.ok) return stateResult;

    if (stateResult.value.accumulator.n === 0) {
      return err({
        code: "QUANT_ENGINE_ERROR",
        error: { code: "EMPTY_SAMPLE", detail: "la Cuenta no tiene operaciones cerradas todavía" },
      });
    }

    return ok(stateResult.value.accumulator.mean);
  }

  /** Desviación muestral agregada de la Cuenta — misma fuente que la esperanza, sin recalcular nada. */
  async obtenerDesviacionAgregada(accountId: string): Promise<Result<RValue, RiskEngineError>> {
    const stateResult = await this.accountRiskStateRepository.obtener(accountId);
    if (!stateResult.ok) return stateResult;

    const desviacionResult = calcularDesviacionDesdeAcumulador(stateResult.value.accumulator);
    if (!desviacionResult.ok) {
      return err({ code: "QUANT_ENGINE_ERROR", error: desviacionResult.error });
    }

    return ok(desviacionResult.value.value);
  }
}
