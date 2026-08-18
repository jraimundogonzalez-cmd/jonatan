import type { FixedDecimal } from "../decimal/kernel.js";

export type Money = FixedDecimal<"Money">;
export type RValue = FixedDecimal<"RValue">;
export type Percent = FixedDecimal<"Percent">;

/**
 * Mecanismo de breakeven configurado en el Plan de Gestión (26 §2, 22 §3).
 * No interviene en el cálculo de `calcularRFinal` — el desenlace del resto se
 * infiere de los datos observados (`parciales_ejecutados`, `r_max`,
 * `cierre_manual_rr`), nunca de esta bandera de configuración. Se conserva en
 * el input únicamente para eco/auditoría (`inputs_echo`, §7.2).
 */
export enum BETrigger {
  NONE = "NONE",
  AFTER_NTH_PARTIAL = "AFTER_NTH_PARTIAL",
  CUSTOM_LEVEL = "CUSTOM_LEVEL",
}

export interface ParcialEjecutado {
  readonly sequence: 1 | 2 | 3 | 4 | 5;
  readonly rr_level: RValue;
  readonly pct_close: Percent;
  readonly executed_at: string; // ISO 8601
}

/**
 * Input de `calcularRFinal` (SPEC-001 §3.4).
 *
 * **Corrección de alcance sobre SPEC-001 §3.4, encontrada al implementar
 * (Challenge Mode sobre código, no sobre diseño)**: el documento original
 * anotaba `cierre_manual_rr` como válido "solo si el usuario cerró
 * manualmente con R_max ≥ rr_objetivo". Esa restricción no cubre un caso real
 * y frecuente — el propio golden dataset de implementation/mvp-0.1.md §11.1
 * lo exige: un cierre manual con parciales ya ejecutados pero R_max por
 * debajo del objetivo (ni stop original, ni breakeven, ni objetivo
 * alcanzado — el trader cerró el remanente a mano en un punto intermedio).
 * `cierre_manual_rr` se generaliza aquí a "el valor de R en el que el
 * usuario cerró manualmente el tramo no cubierto por parciales", sin
 * restricción sobre su relación con `rr_objetivo` — sigue siendo un dato
 * observado, nunca inferido, así que no viola ninguna regla de "nunca
 * calcular sobre datos inconsistentes" (SPEC-001 §1.3): cuando está
 * presente, tiene prioridad sobre cualquier inferencia basada en
 * `r_max`/`rr_objetivo`/`k` (ver `calcularRCierreResto` en r-final.ts).
 * Documentado también en implementation/mvp-0.1.md §7 (nota de corrección).
 */
export interface RFinalInput {
  readonly riesgo_eur: Money;
  readonly rr_objetivo: RValue;
  /** 0..5, ordenados por `sequence` ascendente — SPEC-001 §3.1 */
  readonly parciales_ejecutados: readonly ParcialEjecutado[];
  readonly r_max: RValue;
  readonly be_trigger: BETrigger;
  readonly cierre_manual_rr?: RValue;
}

export type ImpactoPorParcialItem =
  | { readonly kind: "parcial"; readonly sequence: 1 | 2 | 3 | 4 | 5; readonly contribution: RValue }
  | { readonly kind: "resto"; readonly contribution: RValue };
