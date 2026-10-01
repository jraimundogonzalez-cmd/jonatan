/**
 * PRNG determinista (mulberry32) — misma semilla ⇒ misma secuencia, siempre,
 * en cualquier máquina (SPEC-005 §6.1 `deterministic_given_seed`).
 *
 * Es infraestructura de muestreo estándar y nombrada, no una fórmula del
 * catálogo de dominio, así que vivir aquí no es "formula drift" (26 §Riesgos
 * #1). `Math.random()` queda prohibido en todo el paquete: haría irrepetible
 * el resultado y violaría el invariante de reproducibilidad.
 */
export interface Rng {
  /** Siguiente valor en [0, 1). */
  next(): number;
  /** Entero uniforme en [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export function crearRng(seed: number): Rng {
  let state = seed | 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
  };
}
