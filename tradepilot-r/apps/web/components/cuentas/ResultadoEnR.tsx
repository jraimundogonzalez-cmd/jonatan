// BUILD 022 — el resultado de una Cuenta, en R.
//
// BUILD 021 lo dijo sin rodeos: la pantalla de Cuenta era 100 % dinero —
// capital inicial, capital actual, historial de eventos, todo en divisa, ni
// una R— mientras que TradePilot se define como un diario que mide en R. El
// producto registraba en R y devolvía euros.
//
// `r_agregado` NO se calcula aquí ni se lee de ningún contador persistente:
// lo produce `calcularRAgregado` (Quant Engine) sobre la **muestra vigente**
// que devuelve `listar_r_final_vigente_por_cuenta` — la misma muestra con la
// que el dominio reconstruye su acumulador. Es reproducible a mano: suma los
// R de tus Operaciones cerradas y sale este número.
//
// Las Canceladas se cuentan aparte y a propósito: no tienen resultado, no
// entran en la muestra y no pueden mover este número.
import { Card } from "@/components/ui";
import { formatR } from "@/lib/format/operacion";
import type { ResumenCuentaUI } from "@/lib/operations/lecturas";

export function ResultadoEnR({ resumen }: { resumen: ResumenCuentaUI }) {
  const negativo = resumen.r_agregado.startsWith("-");

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", margin: 0 }}>Resultado acumulado</p>
          <p
            className="font-mono-num"
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              margin: "4px 0 0",
              color: negativo ? "var(--color-negative, #f87171)" : "var(--color-positive, #4ade80)",
            }}
          >
            {formatR(resumen.r_agregado)}
          </p>
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, auto)",
            gap: "var(--space-4)",
            margin: 0,
            marginLeft: "auto",
          }}
        >
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Cerradas</dt>
            <dd className="font-mono-num" style={{ margin: "4px 0 0" }}>{resumen.cerradas}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Abiertas</dt>
            <dd className="font-mono-num" style={{ margin: "4px 0 0" }}>{resumen.abiertas}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Canceladas</dt>
            <dd className="font-mono-num" style={{ margin: "4px 0 0" }}>{resumen.canceladas}</dd>
          </div>
        </dl>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", margin: "var(--space-3) 0 0" }}>
        Suma de las {resumen.operaciones_en_la_muestra} Operaciones cerradas con resultado. Las Canceladas
        no cuentan: no tienen desenlace.
      </p>
    </Card>
  );
}
