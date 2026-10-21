import type { RFinalInput, RValue, WelfordAccumulator } from "@tradepilot/quant-engine";

/**
 * Contratos de eventos que Risk Engine escucha (22.5 §2.3, "Escucha":
 * `OperacionRegistrada`, `ParcialEjecutado`, `OperacionCerrada`,
 * `OperacionEditada`, `CapitalEventoRegistrado`).
 *
 * **Nota honesta de alcance**: Operations Engine (SPEC-002) todavía no
 * existe en código — no hay tabla `trades`, no hay emisor real de estos
 * eventos hoy. Estos tipos son el contrato de consumo que Risk Engine ya
 * implementa y prueba contra eventos sintéticos, listo para conectarse en
 * cuanto Operations Engine exista, sin cambiar ninguna firma pública.
 * `OperacionRegistrada`/`ParcialEjecutado` NO están aquí a propósito:
 * SPEC-002 §4.3 ya estableció que son "capital-neutral hasta el cierre" —
 * no disparan ningún recálculo de Risk Engine, así que no necesitan un
 * contrato de consumo.
 */

interface DomainEventBase {
  /** Clave de idempotencia — nunca se procesa dos veces el mismo event_id (protección frente a doble entrega). */
  readonly event_id: string;
  readonly account_id: string;
  readonly occurred_at: string;
}

export interface OperacionCerradaEvent extends DomainEventBase {
  readonly kind: "OperacionCerrada";
  readonly trade_id: string;
  /** Ya ensamblado por el llamador (Operations Engine) — Risk Engine nunca construye un RFinalInput por su cuenta. */
  readonly r_final_input: RFinalInput;
}

/**
 * `OperacionEditada`/`OperacionCancelada` no pueden aplicarse como una
 * actualización incremental de Welford — el algoritmo no admite una
 * "resta" O(1) sin reimplementar la matemática (prohibido: Quant Engine
 * está congelado). SPEC-001 §5.3 autoriza explícitamente la vía de
 * recuperación: reconstruir el acumulador completo a partir de la muestra
 * vigente. `muestra_r_final_vigente` es esa muestra, ya excluyendo
 * Operaciones canceladas (SPEC-002 invariante 4) — Risk Engine nunca lee la
 * tabla de Operaciones directamente, el llamador se la entrega.
 */
export interface OperacionEditadaEvent extends DomainEventBase {
  readonly kind: "OperacionEditada";
  readonly trade_id: string;
  readonly muestra_r_final_vigente: readonly RValue[];
}

export interface OperacionCanceladaEvent extends DomainEventBase {
  readonly kind: "OperacionCancelada";
  readonly trade_id: string;
  readonly muestra_r_final_vigente: readonly RValue[];
}

export type RiskEngineInboundEvent = OperacionCerradaEvent | OperacionEditadaEvent | OperacionCanceladaEvent;

/** Evento de dominio propio de Risk Engine, emitido tras cualquier actualización del acumulador. */
export interface AcumuladorActualizadoEvent {
  readonly kind: "AcumuladorActualizado";
  readonly account_id: string;
  readonly accumulator: WelfordAccumulator;
  readonly trigger: "incremental" | "reconstruccion";
  readonly occurred_at: string;
}
