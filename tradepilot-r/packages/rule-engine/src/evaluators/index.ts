/**
 * Los evaluadores (SPEC-004 §3) — **funciones puras, sin estado, sin I/O**.
 *
 * Invariante de pureza (§14.3): ningún evaluador comparte estado entre
 * invocaciones, así que el orden de evaluación entre Instances independientes
 * nunca puede alterar el resultado de ninguna. Es la garantía estructural de
 * la reproducibilidad exigida.
 *
 * **Ninguno calcula una magnitud.** Cada uno lee un valor YA calculado por su
 * módulo propietario (`InputRef`, un conjunto cerrado a propósito) y lo
 * compara con un umbral. La única aritmética es la del `margin` —una resta
 * entre dos valores ya conocidos— que SPEC-004 §2.2/§3 exige reportar y que
 * no es una fórmula del catálogo de Quant Engine.
 *
 * Todas las comparaciones y restas usan el kernel decimal vía
 * `@tradepilot/risk-engine`, nunca `number`: un veredicto de cumplimiento
 * jamás puede depender de un error de coma flotante.
 */
import { compare, rvalue, toDecimal, toDisplayString } from "@tradepilot/risk-engine";
import type { RValue } from "@tradepilot/risk-engine";
import type { EvaluationInputs, InputRef, Veredicto } from "../domain/types.js";

const R_SCALE = 4;

/** Resta exacta entre dos valores ya calculados — nunca una fórmula de dominio. */
function restar(a: RValue, b: RValue): RValue {
  return rvalue(toDecimal(a).minus(toDecimal(b)).toFixed(R_SCALE));
}

/** Reproyecta cualquier magnitud a `RValue` para poder compararla de forma homogénea. */
function comoRValue(valor: { readonly raw: { toFixed(n: number): string } }): RValue {
  return rvalue(valor.raw.toFixed(R_SCALE));
}

/**
 * Resuelve una referencia a una magnitud ya existente. Devuelve `null` si el
 * input necesario no está disponible — el llamador lo traduce a
 * `unavailable`, nunca a un veredicto inventado.
 */
export function resolverInput(ref: InputRef, inputs: EvaluationInputs): RValue | null {
  switch (ref) {
    case "drawdown_restante_pct":
      return inputs.risk_magnitudes ? comoRValue(inputs.risk_magnitudes.drawdown_restante_pct) : null;
    case "drawdown_restante_eur":
      return inputs.risk_magnitudes ? comoRValue(inputs.risk_magnitudes.drawdown_restante_eur) : null;
    case "piso_vigente":
      return inputs.risk_magnitudes ? comoRValue(inputs.risk_magnitudes.piso_vigente) : null;
    case "current_capital":
      return comoRValue(inputs.account_facts.current_capital);
    case "peak_capital":
      return comoRValue(inputs.account_facts.peak_capital);
    case "initial_capital":
      return comoRValue(inputs.account_facts.initial_capital);
    case "risk_pct":
      return inputs.operation_facts ? comoRValue(inputs.operation_facts.risk_pct) : null;
    default:
      return null;
  }
}

const INPUT_REFS: readonly string[] = [
  "drawdown_restante_pct",
  "drawdown_restante_eur",
  "piso_vigente",
  "current_capital",
  "peak_capital",
  "initial_capital",
  "risk_pct",
];

function leerInputRef(parametros: Readonly<Record<string, unknown>>): InputRef | null {
  const ref = parametros["input"];
  return typeof ref === "string" && INPUT_REFS.includes(ref) ? (ref as InputRef) : null;
}

function leerUmbral(parametros: Readonly<Record<string, unknown>>, campo: string): RValue | null {
  const valor = parametros[campo];
  return typeof valor === "string" ? rvalue(valor) : null;
}

/**
 * Comparación de umbral compartida por `static_threshold` y
 * `dynamic_threshold`. Los dos arquetipos difieren únicamente en QUÉ magnitud
 * leen (uno hechos fijos, otro magnitudes derivadas del pico) — no en cómo
 * comparan, así que compartir esta función evita dos copias de la misma
 * regla divergiendo con el tiempo.
 */
function evaluarUmbral(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  const ref = leerInputRef(parametros);
  if (!ref) return { verdict: "unavailable", reason: "parámetro 'input' ausente o no reconocido" };

  const umbral = leerUmbral(parametros, "threshold");
  if (!umbral) return { verdict: "unavailable", reason: "parámetro 'threshold' ausente" };

  const operador = parametros["operator"];
  if (operador !== "lte" && operador !== "gte") {
    return { verdict: "unavailable", reason: "parámetro 'operator' debe ser 'lte' o 'gte'" };
  }

  const valor = resolverInput(ref, inputs);
  if (!valor) return { verdict: "unavailable", reason: `magnitud '${ref}' no disponible` };

  const cmp = compare(valor, umbral);
  const cumple = operador === "lte" ? cmp <= 0 : cmp >= 0;
  // Margen: distancia con signo respecto al umbral, en la dirección del cumplimiento.
  const margin = operador === "lte" ? restar(umbral, valor) : restar(valor, umbral);

  return cumple ? { verdict: "compliant", margin } : { verdict: "violated", margin };
}

export function staticThreshold(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  return evaluarUmbral(parametros, inputs);
}

export function dynamicThreshold(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  return evaluarUmbral(parametros, inputs);
}

/** Progreso hacia un objetivo: cumple cuando la magnitud alcanza o supera el objetivo. */
export function progressToTarget(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  const ref = leerInputRef(parametros);
  if (!ref) return { verdict: "unavailable", reason: "parámetro 'input' ausente o no reconocido" };

  const objetivo = leerUmbral(parametros, "target");
  if (!objetivo) return { verdict: "unavailable", reason: "parámetro 'target' ausente" };

  const valor = resolverInput(ref, inputs);
  if (!valor) return { verdict: "unavailable", reason: `magnitud '${ref}' no disponible` };

  const margin = restar(valor, objetivo);
  return compare(valor, objetivo) >= 0
    ? { verdict: "compliant", margin }
    : { verdict: "violated", margin };
}

/** Pertenencia a conjunto — p.ej. Instrument Restriction sobre `symbol`. */
export function setMembership(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  if (!inputs.operation_facts) {
    return { verdict: "unavailable", reason: "set_membership requiere operation_facts" };
  }

  const campo = parametros["field"];
  if (campo !== "symbol" && campo !== "side") {
    return { verdict: "unavailable", reason: "parámetro 'field' debe ser 'symbol' o 'side'" };
  }

  const valor = campo === "symbol" ? inputs.operation_facts.symbol : inputs.operation_facts.side;
  const permitidos = parametros["allowed"];
  const prohibidos = parametros["denied"];

  const cero = rvalue("0.0000");
  if (Array.isArray(permitidos)) {
    return permitidos.includes(valor)
      ? { verdict: "compliant", margin: cero }
      : { verdict: "violated", margin: cero };
  }
  if (Array.isArray(prohibidos)) {
    return prohibidos.includes(valor)
      ? { verdict: "violated", margin: cero }
      : { verdict: "compliant", margin: cero };
  }
  return { verdict: "unavailable", reason: "se requiere 'allowed' o 'denied'" };
}

/**
 * Ventana temporal sobre `opened_at`. Se evalúa siempre en UTC y contra el
 * instante REAL del hecho, nunca contra el momento en que el worker corre —
 * un retraso de cola jamás puede cambiar retroactivamente un veredicto
 * (mismo principio de reproducibilidad que SPEC-001 §4.4).
 */
export function timeWindow(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  if (!inputs.operation_facts) {
    return { verdict: "unavailable", reason: "time_window requiere operation_facts" };
  }

  const momento = new Date(inputs.operation_facts.opened_at);
  if (Number.isNaN(momento.getTime())) {
    return { verdict: "unavailable", reason: "opened_at no es un instante válido" };
  }

  const cero = rvalue("0.0000");
  const diasPermitidos = parametros["allowed_weekdays_utc"];
  if (Array.isArray(diasPermitidos)) {
    if (!diasPermitidos.includes(momento.getUTCDay())) {
      return { verdict: "violated", margin: cero };
    }
  }

  const desde = parametros["allowed_hour_from_utc"];
  const hasta = parametros["allowed_hour_to_utc"];
  if (typeof desde === "number" && typeof hasta === "number") {
    const hora = momento.getUTCHours();
    const dentro = desde <= hasta ? hora >= desde && hora < hasta : hora >= desde || hora < hasta;
    if (!dentro) return { verdict: "violated", margin: cero };
  }

  return { verdict: "compliant", margin: cero };
}

/**
 * Compuesto (p.ej. Consistency Rule): cumple si todas las reglas de las que
 * depende cumplen. Si alguna dependencia no está disponible, el resultado es
 * `unavailable` — nunca se asume cumplimiento por ausencia de datos.
 */
export function composite(
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
): Veredicto {
  const requeridas = parametros["requires_compliant"];
  if (!Array.isArray(requeridas) || requeridas.length === 0) {
    return { verdict: "unavailable", reason: "parámetro 'requires_compliant' ausente o vacío" };
  }

  const hermanos = inputs.sibling_verdicts ?? {};
  const cero = rvalue("0.0000");

  for (const clave of requeridas) {
    const veredicto = hermanos[String(clave)];
    if (!veredicto) return { verdict: "unavailable", reason: `falta el veredicto de '${String(clave)}'` };
    if (veredicto.verdict === "unavailable") {
      return { verdict: "unavailable", reason: `la dependencia '${String(clave)}' no está disponible` };
    }
    if (veredicto.verdict === "violated") return { verdict: "violated", margin: cero };
  }

  return { verdict: "compliant", margin: cero };
}

export type Evaluador = (
  parametros: Readonly<Record<string, unknown>>,
  inputs: EvaluationInputs,
) => Veredicto;

/**
 * Registro de arquetipos. `calculation` **no aparece** y no existe ningún
 * camino de ejecución que pueda alcanzarla (Resolución 2 del fundador):
 * Rule Engine no calcula. `time_window_external_source` queda diferido por
 * 22 §9, sin calendario externo disponible todavía.
 */
export const EVALUADORES: Readonly<Record<string, Evaluador>> = {
  static_threshold: staticThreshold,
  dynamic_threshold: dynamicThreshold,
  progress_to_target: progressToTarget,
  set_membership: setMembership,
  time_window: timeWindow,
  composite,
};

export function describirVeredicto(v: Veredicto): { verdict: string; margin: string | null; reason?: string } {
  return v.verdict === "unavailable"
    ? { verdict: v.verdict, margin: null, reason: v.reason }
    : { verdict: v.verdict, margin: toDisplayString(v.margin) };
}
