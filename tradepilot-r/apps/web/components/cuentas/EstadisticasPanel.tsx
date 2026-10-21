// Estadísticas de cartera de una Cuenta — primera tanda.
//
// Qué hace esta pantalla: **enseñar lo observado**, nada más. No propone, no
// recomienda y no juzga contra ningún límite (I13 calcular ≠ juzgar, I17
// Evaluate ≠ Execute). Las hipótesis y las recomendaciones son una fase
// posterior y exigirán validación; no se mezclan aquí con los hechos.
//
// Ni una de estas cifras se calcula en este componente: todas vienen de Quant
// Engine a través de `estadisticasDeCuenta`, sobre la **misma muestra** que
// produce el resultado acumulado. Dos fuentes para el mismo hecho harían que
// una de las dos mintiese.
//
// `null` NO se pinta como cero. Un cero se lee como un resultado; un «—» con
// su explicación se lee como lo que es: todavía no hay datos para decirlo.
// Por eso la desviación aparece vacía con una sola Operación — la varianza
// muestral no está definida para N = 1 y el motor lo rechaza a propósito.
import { Card } from "@/components/ui";
import { formatPct, formatR } from "@/lib/format/operacion";
import type { EstadisticasCuentaUI } from "@/lib/operations/lecturas";

const ETIQUETA = { color: "var(--text-secondary)", fontSize: "0.8125rem", margin: 0 } as const;
const CIFRA = { fontSize: "1.375rem", fontWeight: 600, margin: "4px 0 0" } as const;

function Dato({
  titulo,
  valor,
  ausente,
  color,
}: {
  titulo: string;
  valor: string | null;
  ausente: string;
  color?: string;
}) {
  return (
    <div>
      <dt style={ETIQUETA}>{titulo}</dt>
      {valor === null ? (
        <>
          <dd className="font-mono-num" style={{ ...CIFRA, color: "var(--text-secondary)" }}>
            —
          </dd>
          <p style={{ ...ETIQUETA, marginTop: 2, fontSize: "0.75rem" }}>{ausente}</p>
        </>
      ) : (
        <dd className="font-mono-num" style={{ ...CIFRA, color }}>
          {valor}
        </dd>
      )}
    </div>
  );
}

export function EstadisticasPanel({ estadisticas }: { estadisticas: EstadisticasCuentaUI }) {
  const n = estadisticas.operaciones_en_la_muestra;

  if (n === 0) {
    return (
      <Card>
        <p style={ETIQUETA}>Estadísticas</p>
        <p style={{ margin: "var(--space-2) 0 0" }}>
          Todavía no hay ninguna Operación cerrada con resultado. En cuanto cierres la primera,
          aquí aparecerán la esperanza en R, el acierto y las rachas.
        </p>
      </Card>
    );
  }

  const esperanzaNegativa = estadisticas.esperanza !== null && estadisticas.esperanza.startsWith("-");
  const rachaTexto =
    estadisticas.racha_longitud === null
      ? null
      : `${estadisticas.racha_longitud} ${estadisticas.racha_longitud === 1 ? "Operación" : "Operaciones"}`;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <p style={{ ...ETIQUETA, fontWeight: 600 }}>Estadísticas</p>
        <p style={{ ...ETIQUETA, marginLeft: "auto" }}>
          Muestra: {n} {n === 1 ? "Operación cerrada" : "Operaciones cerradas"}
        </p>
      </div>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-4)",
          margin: "var(--space-3) 0 0",
        }}
      >
        <Dato
          titulo="Esperanza por Operación"
          valor={estadisticas.esperanza === null ? null : formatR(estadisticas.esperanza)}
          ausente="Sin muestra"
          color={esperanzaNegativa ? "var(--color-negative, #f87171)" : "var(--color-positive, #4ade80)"}
        />
        <Dato
          titulo="Desviación de R"
          valor={estadisticas.desviacion === null ? null : formatR(estadisticas.desviacion)}
          ausente="No definida con una sola Operación"
        />
        <Dato
          titulo="Acierto"
          valor={estadisticas.win_rate === null ? null : formatPct(estadisticas.win_rate)}
          ausente="Sin muestra"
        />
        <Dato
          titulo={
            estadisticas.racha_signo === "negativa" ? "Racha máxima de pérdidas" : "Racha máxima de ganancias"
          }
          valor={rachaTexto}
          ausente="Sin muestra"
          color={
            estadisticas.racha_signo === "negativa"
              ? "var(--color-negative, #f87171)"
              : "var(--color-positive, #4ade80)"
          }
        />
      </dl>

      <p style={{ ...ETIQUETA, marginTop: "var(--space-3)" }}>
        Calculado sobre las mismas {n} Operaciones cerradas que componen el resultado acumulado. El
        acierto por sí solo no dice si ganas: hay que leerlo junto a la esperanza.
      </p>
    </Card>
  );
}
