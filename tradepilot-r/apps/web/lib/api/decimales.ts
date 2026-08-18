// Normalización de decimales en la frontera de lectura de la API.
//
// EL PROBLEMA, ENCONTRADO EJECUTANDO LA APLICACIÓN DE VERDAD (BUILD 020):
// PostgREST serializa `numeric` como **número JSON**, no como cadena. Al
// llegar a JavaScript, `JSON.parse` lo convierte en `number`, y todo el
// proyecto asume cadenas (I5: los decimales viajan como texto en las fronteras
// jsonb/API). `types/operations.ts` y `types/funding.ts` declaran `string` y
// eso dejaba de ser cierto en cuanto había un PostgREST real al otro lado.
//
// Los síntomas eran inmediatos y de dos clases distintas:
//
//   TypeError: value.startsWith is not a function   (lib/format/money.ts)
//   TypeError: input.r_max.trim is not a function   (actions/operaciones.ts)
//
// La segunda es la peligrosa: no es un fallo de pintado, es un formulario
// precargado con un `number` que revienta la Server Action al enviarlo. La
// corrección del desenlace era imposible de guardar por eso.
//
// Ningún test lo detectó porque los dobles de `.rpc()` devuelven cadenas —
// que es lo que el contrato dice. El contrato es correcto; lo que faltaba era
// comprobar qué devuelve la plataforma real.
//
// DÓNDE SE ARREGLA Y POR QUÉ AQUÍ:
// En el punto exacto donde la fila entra en la aplicación, no en cada sitio
// que la muestra. Normalizar en los formateadores habría arreglado la pantalla
// y dejado el formulario roto, que es justo lo que pasó. A partir de estas
// funciones, la promesa de `types/*.ts` («todos los números viajan como
// cadenas») vuelve a ser cierta para el resto del código.
//
// LO QUE ESTO ARREGLA Y LO QUE NO:
// Devuelve el valor a la forma que el contrato declara. **No recupera la
// precisión ya perdida**: cuando `JSON.parse` lee `10000.0000` ya ha
// construido un double, y aquí sólo se puede formatear. Para `numeric(18,4)`
// el double es exacto hasta ~9·10^11, muy por encima de cualquier capital
// realista, pero por encima de eso habría pérdida silenciosa. La solución de
// raíz —que las RPC de lectura devuelvan `text`— toca contratos congelados y
// queda como deuda documentada; no se decide aquí.

/** Campo → escala decimal de su columna. Las dos escalas del esquema: 4 y 2. */
export type Escalas = Readonly<Record<string, number>>;

/** `numeric(18,4)` y `numeric(8,4)`: dinero y valores de R. */
export const ESCALA_R_Y_DINERO = 4;
/** `numeric(5,2)`: porcentajes. */
export const ESCALA_PORCENTAJE = 2;

export const ESCALAS_OPERACION: Escalas = {
  risk_pct: ESCALA_PORCENTAJE,
  risk_amount: ESCALA_R_Y_DINERO,
  rr_objective: ESCALA_R_Y_DINERO,
  r_max: ESCALA_R_Y_DINERO,
  r_final: ESCALA_R_Y_DINERO,
  pnl_amount: ESCALA_R_Y_DINERO,
  cierre_manual_rr: ESCALA_R_Y_DINERO,
};

export const ESCALAS_PARCIAL: Escalas = {
  rr_level: ESCALA_R_Y_DINERO,
  pct_close: ESCALA_PORCENTAJE,
};

export const ESCALAS_PLAN_GESTION: Escalas = {
  rr_objective: ESCALA_R_Y_DINERO,
};

export const ESCALAS_DESTINO: Escalas = {
  risk_pct: ESCALA_PORCENTAJE,
};

export const ESCALAS_CUENTA: Escalas = {
  initial_capital: ESCALA_R_Y_DINERO,
  current_capital: ESCALA_R_Y_DINERO,
  peak_capital: ESCALA_R_Y_DINERO,
  profit_split_pct: ESCALA_PORCENTAJE,
};

export const ESCALAS_EVENTO_CAPITAL: Escalas = {
  amount: ESCALA_R_Y_DINERO,
};

/**
 * Devuelve la fila con sus campos decimales como cadenas. Un valor que ya es
 * cadena se deja intacto: si algún día las RPC devolviesen `text`, esto se
 * convierte en una función identidad en vez de en un error.
 */
export function normalizarFila<T>(fila: T, escalas: Escalas): T {
  if (fila === null || typeof fila !== "object") return fila;
  const origen = fila as Record<string, unknown>;
  let copia: Record<string, unknown> | null = null;
  for (const [campo, decimales] of Object.entries(escalas)) {
    const valor = origen[campo];
    if (typeof valor !== "number") continue;
    if (!Number.isFinite(valor)) continue;
    copia ??= { ...origen };
    copia[campo] = valor.toFixed(decimales);
  }
  return (copia ?? origen) as T;
}

export function normalizarFilas<T>(filas: readonly T[], escalas: Escalas): T[] {
  return filas.map((f) => normalizarFila(f, escalas));
}
