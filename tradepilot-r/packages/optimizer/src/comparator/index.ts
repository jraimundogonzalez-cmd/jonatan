/**
 * `comparator` (SPEC-005 §9) — ordena y descarta candidatas operando
 * **exclusivamente sobre valores ya calculados** por `evaluator-bridge`.
 * No recalcula `Score`, `Expectancy` ni ningún valor (verificación de §13.1).
 */
import type { Constraint, Objective, ObjectiveMetric } from "../domain/types.js";
import { compararR } from "../evaluator/kernel.js";
import type { EvaluatedCandidate } from "../search/SearchStrategy.js";

/**
 * Tope del conjunto devuelto (§13.5): un frente de Pareto de 200 "ganadoras"
 * no es una recomendación útil ni cumple I16. Se fija en 3 = "la mejor + las
 * 2 siguientes" de 02 §5.3, dentro del rango 3-5 que §13.5 recomienda.
 */
export const MAX_WINNERS = 3;

/** Una candidata es viable si satisface **todas** las restricciones duras (§4.3). */
export function esViable(candidata: EvaluatedCandidate, constraints: readonly Constraint[]): boolean {
  return constraints.every((c) => {
    const valor = candidata.objective_values[c.metric];
    // Sin valor no se puede afirmar cumplimiento — se excluye, nunca se asume.
    if (!valor) return false;
    const cmp = compararR(valor, c.threshold);
    return c.operator === "lte" ? cmp <= 0 : cmp >= 0;
  });
}

/** `> 0` si `a` es mejor que `b` en ese objetivo, según su dirección. */
function mejorEn(a: EvaluatedCandidate, b: EvaluatedCandidate, objetivo: Objective): number {
  const va = a.objective_values[objetivo.metric];
  const vb = b.objective_values[objetivo.metric];
  if (!va || !vb) return 0;
  const cmp = compararR(va, vb);
  return objetivo.direction === "maximize" ? cmp : -cmp;
}

/**
 * Desempate determinista (§9.3): (1) menos parciales — una gestión más simple
 * es preferible en igualdad de resultado, coherente con I16; (2) orden
 * canónico de evaluación, que garantiza el mismo ganador ante empate exacto.
 */
function desempatar(a: EvaluatedCandidate, b: EvaluatedCandidate): number {
  const porParciales = a.scenario.parciales_planificados.length - b.scenario.parciales_planificados.length;
  if (porParciales !== 0) return porParciales;
  return a.evaluation_index - b.evaluation_index;
}

/** Orden total simple por el único objetivo declarado (§9.1). */
function ordenarPorObjetivoUnico(
  candidatas: readonly EvaluatedCandidate[],
  objetivo: Objective,
): readonly EvaluatedCandidate[] {
  return [...candidatas].sort((a, b) => {
    const cmp = mejorEn(b, a, objetivo); // descendente por "mejor"
    return cmp !== 0 ? cmp : desempatar(a, b);
  });
}

/** `a` domina a `b` si es igual o mejor en todos los objetivos y estrictamente mejor en al menos uno. */
function domina(a: EvaluatedCandidate, b: EvaluatedCandidate, objetivos: readonly Objective[]): boolean {
  let algunoEstrictamenteMejor = false;
  for (const objetivo of objetivos) {
    const cmp = mejorEn(a, b, objetivo);
    if (cmp < 0) return false;
    if (cmp > 0) algunoEstrictamenteMejor = true;
  }
  return algunoEstrictamenteMejor;
}

/**
 * Frente de Pareto (§9.2) — comparación por pares sobre el conjunto ya
 * evaluado, **conmutativa respecto al orden de evaluación** (§13.3 punto 2).
 */
function frenteDePareto(
  candidatas: readonly EvaluatedCandidate[],
  objetivos: readonly Objective[],
): readonly EvaluatedCandidate[] {
  return candidatas.filter((c) => !candidatas.some((otra) => otra !== c && domina(otra, c, objetivos)));
}

/**
 * Selecciona las ganadoras. Cuando el frente excede `MAX_WINNERS` se recorta
 * por el mismo desempate determinista de §9.3 — la reducción por *crowding*
 * queda deliberadamente fuera de este build, tal como §14.3 la difiere hasta
 * que exista uso multiobjetivo real medido.
 */
export function seleccionar(
  candidatas: readonly EvaluatedCandidate[],
  objetivos: readonly Objective[],
): readonly EvaluatedCandidate[] {
  if (candidatas.length === 0) return [];

  if (objetivos.length === 1) {
    return ordenarPorObjetivoUnico(candidatas, objetivos[0]!).slice(0, MAX_WINNERS);
  }

  return [...frenteDePareto(candidatas, objetivos)].sort(desempatar).slice(0, MAX_WINNERS);
}

/** Métricas que hay que calcular: las de los objetivos más las de las restricciones. */
export function metricasNecesarias(
  objetivos: readonly Objective[],
  constraints: readonly Constraint[],
): ReadonlySet<ObjectiveMetric> {
  return new Set<ObjectiveMetric>([...objetivos.map((o) => o.metric), ...constraints.map((c) => c.metric)]);
}
