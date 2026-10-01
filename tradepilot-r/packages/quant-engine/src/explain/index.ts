/**
 * Envelope público Explainable Quant (SPEC-001 §3.2/§7). Toda función pública
 * de Quant Engine retorna `QuantResult<T>`, nunca `T` directamente.
 */
export interface QuantResult<T> {
  readonly value: T;
  readonly formula_id: string;
  readonly formula_version: string | null;
  readonly inputs_echo: Record<string, unknown>;
  readonly confidence: Confidence;
}

export type Confidence =
  | { readonly type: "exact" }
  | { readonly type: "passthrough"; readonly label: string; readonly interval: readonly [number, number] };

/**
 * Quant Engine nunca *calcula* `confidence`, solo la reporta (SPEC-001 §7.3).
 * `wrapExact` es la única forma usada por Grupo B: aritmética exacta sobre
 * datos reales ya cerrados.
 */
export function wrapExact<T>(
  value: T,
  formula_id: string,
  inputs_echo: Record<string, unknown>,
  formula_version: string | null = null,
): QuantResult<T> {
  return { value, formula_id, formula_version, inputs_echo, confidence: { type: "exact" } };
}
