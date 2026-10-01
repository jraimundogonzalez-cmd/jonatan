/**
 * PRNG determinista (mulberry32) para generar datos de prueba reproducibles
 * sin depender de `Math.random()` — evita tests de escala/propiedades no
 * reproducibles, sin añadir ninguna dependencia nueva al proyecto.
 */
export function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cadena decimal aleatoria pero determinista en [min, max], con 4 decimales. */
export function randomDecimalString(rng: () => number, min: number, max: number): string {
  const value = min + rng() * (max - min);
  return value.toFixed(4);
}
