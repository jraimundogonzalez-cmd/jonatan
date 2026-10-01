// BUILD 022 — de dónde sale un R, término a término.
//
// BUILD 021 encontró que el trader veía «+1.0000 R» y no había forma de saber
// que salía de 0,5×1R + 0,25×2R + 0,25×0R. El número era correcto y opaco.
//
// Esta tabla NO calcula nada: cada línea la produce `calcularImpactoPorParcial`
// (Quant Engine), que comparte descomposición con `R_final` y tiene un
// property-test que garantiza que las contribuciones suman exactamente R.
import type { ImpactoUI } from "@/actions/operaciones";
import { formatR } from "@/lib/format/operacion";
import styles from "./operaciones.module.css";

export function DesgloseR({ impacto, total }: { impacto: readonly ImpactoUI[]; total: string }) {
  if (impacto.length === 0) return null;

  return (
    <table className={styles.tabla}>
      <tbody>
        {impacto.map((i) => (
          <tr key={i.sequence ?? "resto"}>
            <td>{i.sequence === null ? "Resto de la posición" : `Parcial ${i.sequence}`}</td>
            <td>{formatR(i.contribucion)}</td>
          </tr>
        ))}
        <tr className={styles.tablaTotal}>
          <td>R final</td>
          <td>{formatR(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}
