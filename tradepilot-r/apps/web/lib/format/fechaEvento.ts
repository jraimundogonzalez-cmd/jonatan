// BUILD 024 — la fecha y hora de un hecho (entrada, parcial, cierre) la declara
// el trader; ya no es siempre «ahora».
//
// Aquí sólo hay conversión y una comprobación PREVIA para avisar antes de
// enviar. La autoridad sigue siendo la base: los triggers de
// `20261017120000_event_times.sql` rechazan un hecho en el futuro o fuera de
// orden aunque esta capa fallara.
//
// Nada de este fichero lee ni calcula riesgo, capital ni R.

/** Margen que absorbe la diferencia de reloj entre navegador y servidor. Igual que el trigger. */
export const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/**
 * A partir de cuántos minutos entre el hecho y su registro se considera que la
 * operación se está registrando «a posteriori», y por tanto que el riesgo se
 * congela con un capital que no es el de la hora del hecho.
 */
export const UMBRAL_A_POSTERIORI_MIN = 15;

function dosCifras(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `Date` → valor de un `<input type="datetime-local">` en la hora local del navegador. */
export function aValorLocal(fecha: Date): string {
  return (
    `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}` +
    `T${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`
  );
}

/**
 * Valor de `datetime-local` (hora local, sin zona) → ISO 8601 en UTC.
 * Devuelve `null` si el valor está vacío o no es una fecha válida.
 */
export function isoDesdeValorLocal(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(valor.trim())) return null;
  const fecha = new Date(valor.trim());
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export interface LimitesFechaEvento {
  /** Momento de referencia; por defecto, ahora. */
  readonly ahora?: Date;
  /** El hecho no puede ser anterior a este instante (apertura, parcial previo…). */
  readonly noAntesDe?: string | null;
  /** El hecho previo, con su preposición: «a la entrada», «al parcial anterior». */
  readonly nombreDelPrevio?: string;
}

/**
 * Comprobación previa al envío. Devuelve el mensaje para el trader, o `null` si
 * la fecha es aceptable. Es la misma regla que aplica la base, sólo que antes.
 */
export function validarFechaEvento(iso: string | null, limites: LimitesFechaEvento = {}): string | null {
  if (iso === null) return "Indica una fecha y hora válidas.";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Indica una fecha y hora válidas.";
  const ahora = (limites.ahora ?? new Date()).getTime();
  if (t > ahora + TOLERANCIA_FUTURO_MS) {
    return "Esa fecha y hora todavía no han llegado. Indica cuándo ocurrió de verdad.";
  }
  if (limites.noAntesDe) {
    const previo = new Date(limites.noAntesDe).getTime();
    if (!Number.isNaN(previo) && t < previo) {
      return `No puede ser anterior ${limites.nombreDelPrevio ?? "al hecho previo"}.`;
    }
  }
  return null;
}

/**
 * ¿Se registró este hecho bastante después de ocurrir? Con `registroIso` nulo
 * (filas anteriores a BUILD 024) no se sabe, y la respuesta es `false`: no se
 * presume nada.
 */
export function esRegistroAPosteriori(
  hechoIso: string,
  registroIso: string | null,
  umbralMin: number = UMBRAL_A_POSTERIORI_MIN,
): boolean {
  if (registroIso === null) return false;
  const hecho = new Date(hechoIso).getTime();
  const registro = new Date(registroIso).getTime();
  if (Number.isNaN(hecho) || Number.isNaN(registro)) return false;
  return registro - hecho > umbralMin * 60 * 1000;
}
