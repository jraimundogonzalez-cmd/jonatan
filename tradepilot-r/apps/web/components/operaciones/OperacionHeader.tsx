// Identidad y riesgo de una Operación.
//
// TODO lo que hay aquí es TEXTO, nunca un `<input>` deshabilitado. La
// identidad de una Operación se fija al nacer y no se corrige (BUILD 016B), y
// `risk_amount` se congela como Capital_en_ese_instante × Riesgo% — presentar
// esos hechos como campos apagados sugeriría que en otro contexto podrían
// editarse. No pueden, por ninguna vía.
import { formatMoney } from "@/lib/format/money";
import { formatFecha, formatLado, formatPct, formatR } from "@/lib/format/operacion";
import type { OperacionRow } from "@/types/operations";
import { EstadoBadge } from "./EstadoBadge";
import styles from "./operaciones.module.css";

function Hecho({ label, children, grande }: { label: string; children: React.ReactNode; grande?: boolean }) {
  return (
    <div className={styles.hecho}>
      <span className={styles.hechoLabel}>{label}</span>
      <span className={grande ? styles.hechoValorGrande : styles.hechoValor}>{children}</span>
    </div>
  );
}

export function OperacionHeader({ operacion, currency }: { operacion: OperacionRow; currency: string }) {
  return (
    <>
      <div className={styles.seccion}>
        <h2 className={styles.seccionTitulo}>Identidad</h2>
        <div className={styles.hechos}>
          <Hecho label="Símbolo" grande>
            {operacion.symbol}
          </Hecho>
          <Hecho label="Lado">{formatLado(operacion.side)}</Hecho>
          <Hecho label="Apertura">{formatFecha(operacion.opened_at)}</Hecho>
          <Hecho label="Estado">
            <EstadoBadge status={operacion.status} />
          </Hecho>
          {operacion.instrument_key ? (
            <Hecho label="Instrumento (Intención)">{operacion.instrument_key}</Hecho>
          ) : null}
        </div>
      </div>

      <div className={styles.seccion}>
        <h2 className={styles.seccionTitulo}>Riesgo</h2>
        <div className={styles.hechos}>
          <Hecho label="Riesgo" grande>
            {formatMoney(operacion.risk_amount, currency)}
          </Hecho>
          <Hecho label="Riesgo %">{formatPct(operacion.risk_pct)}</Hecho>
          <Hecho label="Objetivo RR">{formatR(operacion.rr_objective)}</Hecho>
          {/* BUILD 022 — `be_trigger` sale de la vista de producto. La auditoría
              de BUILD 021 comprobó que no participa en ninguna rama de la
              fórmula de R_final: viaja en `RFinalInput` y sólo aparece en el
              `echoInput` del envelope explicativo. Sigue en la base, en el
              contrato y en el motor; deja de ocupar sitio en la pantalla de
              quien opera, donde sólo generaba preguntas. */}
          {operacion.r_max !== null ? (
            <Hecho label="R máximo alcanzado">{formatR(operacion.r_max)}</Hecho>
          ) : null}
        </div>
      </div>
    </>
  );
}
