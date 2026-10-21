/**
 * `scenario-generator` (SPEC-005 §3.1, §5.1) — traduce la propuesta de una
 * estrategia en un Scenario **estructuralmente válido por construcción**.
 *
 * Ninguna candidata generada aquí puede ser inválida, así que el rechazo
 * queda reservado a errores de implementación y nunca es el mecanismo normal
 * de generación (§5.1, último párrafo). Eso evita además gastar llamadas a
 * Quant Engine en candidatas que su validación rechazaría (§4.1).
 */
import type { BETrigger } from "@tradepilot/quant-engine";
import type { PlannedPartial, Scenario, ScenarioSpaceParams } from "../domain/types.js";
import { escalonesDeGrid, porcentajeDeEscalones, valorDeGrid } from "../evaluator/kernel.js";
import type { Rng } from "../prng.js";

/** Pasos de grid fijados por 02 §5.1 — no configurables, para que dos ejecuciones no difieran por un parámetro invisible. */
const RR_GRID_STEP = "0.1";
const PCT_GRID_STEP = 5;
const PCT_GRID_UNITS = 100 / PCT_GRID_STEP;

/**
 * Reparto tipo "palo roto" (Dirichlet(1,…,1) sobre `n+1` partes, la parte
 * `n+1` es el remanente no cerrado) — §5.1 punto 3. Se redondea al grid de 5%
 * y se ajusta el exceso decrementando la mayor, tal como §5.1 indica
 * ("ajustando el resto para que la suma sea exacta"), en vez de rechazar
 * muestras hasta que cuadren, que introduciría sesgo.
 */
function repartirPorcentajes(n: number, rng: Rng): number[] {
  const cortes = Array.from({ length: n }, () => rng.next()).sort((a, b) => a - b);
  const pesos: number[] = [];
  let previo = 0;
  for (const corte of cortes) {
    pesos.push(corte - previo);
    previo = corte;
  }

  // Cada parcial debe cerrar al menos un escalón (pct_close > 0 es requisito
  // de Quant Engine); con n ≤ 5 el mínimo total (5 escalones = 25%) nunca
  // puede superar el 100%, así que este ajuste siempre converge.
  const unidades = pesos.map((w) => Math.max(1, Math.round(w * PCT_GRID_UNITS)));

  let total = unidades.reduce((acc, u) => acc + u, 0);
  while (total > PCT_GRID_UNITS) {
    let idxMayor = 0;
    for (let i = 1; i < unidades.length; i++) {
      if (unidades[i]! > unidades[idxMayor]!) idxMayor = i;
    }
    if (unidades[idxMayor]! <= 1) break;
    unidades[idxMayor] = unidades[idxMayor]! - 1;
    total -= 1;
  }

  return unidades;
}

/** Muestra `n` niveles distintos del grid de RR y los devuelve ascendentes (§5.1 punto 2). */
function muestrearNivelesRR(n: number, escalonesDisponibles: number, rng: Rng): number[] {
  const disponibles = Array.from({ length: escalonesDisponibles }, (_, i) => i + 1);
  const elegidos: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = rng.nextInt(disponibles.length);
    elegidos.push(disponibles[idx]!);
    disponibles.splice(idx, 1);
  }
  return elegidos.sort((a, b) => a - b);
}

export function generarScenario(space: ScenarioSpaceParams, rng: Rng): Scenario {
  const escalonesRR = escalonesDeGrid(space.rr_objetivo, RR_GRID_STEP);
  const maxParciales = Math.min(space.max_partials, escalonesRR);

  const n = rng.nextInt(maxParciales + 1);
  const beTrigger: BETrigger = space.be_triggers[rng.nextInt(space.be_triggers.length)]!;

  if (n === 0) {
    return { rr_objetivo: space.rr_objetivo, parciales_planificados: [], be_trigger: beTrigger };
  }

  const niveles = muestrearNivelesRR(n, escalonesRR, rng);
  const unidades = repartirPorcentajes(n, rng);

  const parciales: PlannedPartial[] = niveles.map((tick, i) => ({
    sequence: (i + 1) as PlannedPartial["sequence"],
    rr_level: valorDeGrid(RR_GRID_STEP, tick),
    pct_close: porcentajeDeEscalones(unidades[i]!, PCT_GRID_STEP),
  }));

  return { rr_objetivo: space.rr_objetivo, parciales_planificados: parciales, be_trigger: beTrigger };
}
