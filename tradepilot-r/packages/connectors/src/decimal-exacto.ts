// Decimales exactos en la frontera del fichero (I5).
//
// No se usa coma flotante para nada que se persista, ni `decimal.js` (que solo
// puede importarse en el kernel de quant-engine). Un decimal es aquí una cadena
// canónica; la única aritmética que hace el conector —comprobar que el P&L
// bruto cuadra con los precios— se hace con enteros escalados (`BigInt`), que
// son exactos por construcción.

const PATRON_DECIMAL = /^[+-]?(\d+)(?:\.(\d+))?$/;

export type DecimalLeido = { ok: true; valor: string } | { ok: false; motivo: string };

/**
 * Forma canónica: sin signo `+`, sin ceros a la izquierda, sin ceros
 * decimales a la derecha y sin `-0`. `"31532.00"` y `"31532"` son el mismo
 * número y deben producir la misma huella de deduplicación.
 */
function canonizar(signo: string, entera: string, decimales: string): string {
  const e = entera.replace(/^0+(?=\d)/, "");
  const d = decimales.replace(/0+$/, "");
  const cuerpo = d ? `${e}.${d}` : e;
  if (/^0(\.0*)?$/.test(cuerpo)) return "0";
  return signo === "-" ? `-${cuerpo}` : cuerpo;
}

/**
 * Lee un decimal escrito como texto. Solo admite punto decimal: una coma es
 * ambigua (`1,234` puede ser mil doscientos o uno coma dos) y se rechaza en
 * vez de adivinar.
 */
export function leerDecimalTexto(texto: string): DecimalLeido {
  const t = texto.trim();
  if (t === "") return { ok: false, motivo: "vacío" };
  if (t.includes(",")) return { ok: false, motivo: `"${t}" usa coma; solo se admite punto decimal` };
  const m = PATRON_DECIMAL.exec(t);
  if (!m) return { ok: false, motivo: `"${t}" no es un número` };
  return { ok: true, valor: canonizar(t.startsWith("-") ? "-" : "+", m[1] ?? "0", m[2] ?? "") };
}

/**
 * Lee un número que Excel guardó como número. Excel solo almacena dobles
 * IEEE-754; `String(n)` da la representación decimal más corta que vuelve
 * exactamente al mismo doble, que es lo que Excel muestra (p. ej. 69.9).
 * Se rechaza la notación exponencial porque indica un valor fuera de rango
 * para un precio o un importe.
 */
export function leerDecimalNumero(n: number): DecimalLeido {
  if (!Number.isFinite(n)) return { ok: false, motivo: "no es un número finito" };
  const texto = String(n);
  if (/e/i.test(texto)) return { ok: false, motivo: `${texto} está fuera del rango admitido` };
  return leerDecimalTexto(texto);
}

/** Número de cifras decimales de una cadena canónica. */
export function escalaDe(canonico: string): number {
  const punto = canonico.indexOf(".");
  return punto === -1 ? 0 : canonico.length - punto - 1;
}

/** Entero escalado: `"1.5"` con escala 2 → `150n`. Exige escala suficiente. */
export function aEscalado(canonico: string, escala: number): bigint {
  const negativo = canonico.startsWith("-");
  const sinSigno = negativo ? canonico.slice(1) : canonico;
  const [entera = "0", decimales = ""] = sinSigno.split(".");
  if (decimales.length > escala) throw new Error(`escala ${escala} insuficiente para ${canonico}`);
  const valor = BigInt(entera + decimales.padEnd(escala, "0"));
  return negativo ? -valor : valor;
}

export function esEntero(canonico: string): boolean {
  return !canonico.includes(".");
}

export function esNegativo(canonico: string): boolean {
  return canonico.startsWith("-");
}

export function esCero(canonico: string): boolean {
  return canonico === "0";
}
