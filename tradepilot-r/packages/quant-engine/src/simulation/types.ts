import type { RValue } from "../core/types.js";

export interface ScoreInput {
  readonly muestra_r_final_candidata: readonly RValue[];
  /** Siempre explícito — nunca un valor por defecto oculto (SPEC-001 §3.8, 26 §Riesgos #3). */
  readonly lambda: RValue;
}
