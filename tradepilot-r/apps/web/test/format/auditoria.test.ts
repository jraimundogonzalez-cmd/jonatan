import { describe, expect, it } from "vitest";
import { aEntradaLegible } from "@/lib/format/auditoria";
import { formatFecha } from "@/lib/format/operacion";
import type { AuditEntryRow } from "@/types/operations";

// BUILD 022 — BUG-021-1 y la auditoría en lenguaje de producto.

function entrada(diff: AuditEntryRow["diff"]): AuditEntryRow {
  return {
    id: 1,
    entity_type: "trade",
    entity_id: "trade-1",
    action: "update",
    diff,
    // La columna real de `audit_log`. Antes el tipo decía `created_at`, la
    // fila no lo traía nunca, y la pantalla pintaba «Invalid Date».
    occurred_at: "2026-08-13T19:52:43.426+00:00",
  };
}

describe("BUG-021-1 — la fecha de la auditoría", () => {
  it("la fila trae `occurred_at` y se puede formatear", () => {
    const e = entrada({ before: {}, after: {} });
    expect(e.occurred_at).toBeTruthy();
    expect(formatFecha(e.occurred_at)).not.toContain("Invalid");
  });

  it("`created_at` ya no se usa: no existe en el tipo de la entrada", () => {
    const e = entrada({ before: {}, after: {} }) as unknown as Record<string, unknown>;
    expect(e["created_at"]).toBeUndefined();
  });
});

describe("aEntradaLegible — hechos, no columnas", () => {
  const CIERRE = entrada({
    before: { status: "open", r_final: null, pnl_amount: null, closure_reason: null },
    after: {
      status: "closed",
      r_final: 1,
      pnl_amount: 100.98,
      closure_reason: "BREAK_EVEN",
      closure_idempotency_key: "8354c670-d35f-48f1-a9a4-2d999d61fdef",
      time_in_market_sec: 2,
    },
  });

  it("titula por lo que le ocurrió a la Operación", () => {
    expect(aEntradaLegible(CIERRE, "USD", "13/08/2026").titulo).toBe("Operación cerrada");
  });

  it("reconoce una cancelación", () => {
    const e = entrada({ before: { status: "open" }, after: { status: "cancelled", cancellation_reason: "Error" } });
    expect(aEntradaLegible(e, "USD", "hoy").titulo).toBe("Operación cancelada");
  });

  it("reconoce una corrección del desenlace", () => {
    const e = entrada({
      before: { status: "closed", r_final: 1, closure_reason: "BREAK_EVEN" },
      after: { status: "closed", r_final: 1.75, closure_reason: "TAKE_PROFIT_FULL" },
    });
    expect(aEntradaLegible(e, "USD", "hoy").titulo).toBe("Desenlace corregido");
  });

  it("distingue una anotación de una corrección", () => {
    const e = entrada({ before: { notes: null }, after: { notes: "entré tarde" } });
    expect(aEntradaLegible(e, "USD", "hoy").titulo).toBe("Notas actualizadas");
  });

  it("nombra los campos en castellano y formatea sus valores", () => {
    const legible = aEntradaLegible(CIERRE, "USD", "13/08/2026");
    const rFinal = legible.cambios.find((c) => c.etiqueta === "R final");
    expect(rFinal).toEqual({ etiqueta: "R final", antes: "—", despues: "+1.0000 R" });

    const pnl = legible.cambios.find((c) => c.etiqueta === "P&L");
    // Dinero a 2 decimales, como en el resto de la interfaz.
    expect(pnl?.despues).toBe("100.98 USD");
  });

  it("traduce el motivo de cierre", () => {
    const legible = aEntradaLegible(CIERRE, "USD", "hoy");
    expect(legible.cambios.find((c) => c.etiqueta === "Motivo de cierre")?.despues).toBe("Break-even");
  });

  it("aparta la clave de idempotencia al detalle técnico, sin borrarla", () => {
    const legible = aEntradaLegible(CIERRE, "USD", "hoy");
    const enProducto = legible.cambios.map((c) => c.etiqueta).join(" ");
    expect(enProducto).not.toContain("idempotency");
    expect(legible.tecnico.join(" ")).toContain("closure_idempotency_key");
    expect(legible.tecnico.join(" ")).toContain("time_in_market_sec");
  });

  it("no inventa cambios: un campo que no cambió no aparece", () => {
    const e = entrada({
      before: { status: "closed", r_final: 1.75, closure_reason: "TAKE_PROFIT_FULL" },
      after: { status: "closed", r_final: 1.75, closure_reason: "TAKE_PROFIT_FULL", notes: "x" },
    });
    const legible = aEntradaLegible(e, "USD", "hoy");
    expect(legible.cambios.map((c) => c.etiqueta)).toEqual(["Notas"]);
  });
});
