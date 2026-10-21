// Zona horaria de un fichero importado.
//
// Un fichero de operaciones trae horas de RELOJ («2026-10-06 14:03:56») sin
// zona. Esa hora no es un instante hasta que alguien declara en qué zona se
// escribió. Este módulo nunca supone la zona: la recibe declarada y convierte
// de forma explícita, rechazando los dos casos en que la conversión no es
// única:
//
//   · hora INEXISTENTE — cae en el salto de primavera (02:30 en Madrid el día
//     del cambio no existe);
//   · hora AMBIGUA — cae en la hora repetida de otoño (02:30 ocurre dos veces).
//
// En ambos casos la fila se rechaza con un mensaje: elegir una de las dos
// interpretaciones sería una conversión silenciosa.

const PATRON_RELOJ = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface RelojLocal {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

export type RelojLeido = { ok: true; reloj: RelojLocal } | { ok: false; motivo: string };

export function leerRelojTexto(texto: string): RelojLeido {
  const t = texto.trim();
  if (/(z|[+-]\d{2}:?\d{2})$/i.test(t) && /[ T]\d{2}:\d{2}/.test(t)) {
    return { ok: false, motivo: `"${t}" incluye una zona horaria; el formato esperado es una hora de reloj sin zona` };
  }
  const m = PATRON_RELOJ.exec(t);
  if (!m) return { ok: false, motivo: `"${t}" no tiene el formato AAAA-MM-DD HH:MM:SS` };
  const reloj: RelojLocal = {
    anio: Number(m[1]),
    mes: Number(m[2]),
    dia: Number(m[3]),
    hora: Number(m[4]),
    minuto: Number(m[5]),
    segundo: m[6] === undefined ? 0 : Number(m[6]),
  };
  // Date.UTC normaliza (31 de febrero → 3 de marzo); si al volver no coincide,
  // la fecha no existe en el calendario.
  const ms = Date.UTC(reloj.anio, reloj.mes - 1, reloj.dia, reloj.hora, reloj.minuto, reloj.segundo);
  const d = new Date(ms);
  if (
    reloj.hora > 23 ||
    reloj.minuto > 59 ||
    reloj.segundo > 59 ||
    d.getUTCFullYear() !== reloj.anio ||
    d.getUTCMonth() !== reloj.mes - 1 ||
    d.getUTCDate() !== reloj.dia
  ) {
    return { ok: false, motivo: `"${t}" no es una fecha u hora válida` };
  }
  return { ok: true, reloj };
}

/**
 * Celda de fecha de Excel → reloj de pared. Ver la cabecera de `xlsx.ts`: los
 * componentes UTC del `Date` SON el reloj de pared. Se redondea al segundo
 * porque el número de serie de Excel es un doble y puede llegar como
 * 14:03:55.9999.
 */
export function relojDesdeFechaExcel(fecha: Date): RelojLeido {
  if (Number.isNaN(fecha.getTime())) return { ok: false, motivo: "fecha de Excel no válida" };
  const d = new Date(Math.round(fecha.getTime() / 1000) * 1000);
  return {
    ok: true,
    reloj: {
      anio: d.getUTCFullYear(),
      mes: d.getUTCMonth() + 1,
      dia: d.getUTCDate(),
      hora: d.getUTCHours(),
      minuto: d.getUTCMinutes(),
      segundo: d.getUTCSeconds(),
    },
  };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Representación canónica del reloj: `AAAA-MM-DD HH:MM:SS`. */
export function formatearReloj(r: RelojLocal): string {
  return `${r.anio}-${dos(r.mes)}-${dos(r.dia)} ${dos(r.hora)}:${dos(r.minuto)}:${dos(r.segundo)}`;
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string): Intl.DateTimeFormat {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formateadores.set(zona, f);
  }
  return f;
}

/** `true` si `zona` es un identificador IANA que el entorno reconoce. */
export function esZonaValida(zona: string): boolean {
  if (typeof zona !== "string" || zona.trim() === "" || zona !== zona.trim()) return false;
  try {
    formateador(zona);
    return true;
  } catch {
    return false;
  }
}

/** Desfase (ms) de `zona` respecto a UTC en el instante `utcMs`. */
function desfase(zona: string, utcMs: number): number {
  const partes: Record<string, number> = {};
  for (const p of formateador(zona).formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") partes[p.type] = Number(p.value);
  }
  const comoUtc = Date.UTC(
    partes.year ?? 0,
    (partes.month ?? 1) - 1,
    partes.day ?? 1,
    partes.hour ?? 0,
    partes.minute ?? 0,
    partes.second ?? 0,
  );
  return comoUtc - Math.floor(utcMs / 1000) * 1000;
}

export type InstanteUtc =
  | { ok: true; utc: string }
  | { ok: false; codigo: "HORA_INEXISTENTE" | "HORA_AMBIGUA"; motivo: string };

/** Reloj de pared en `zona` → instante UTC ISO-8601, o rechazo explícito. */
export function relojAUtc(reloj: RelojLocal, zona: string): InstanteUtc {
  const pared = Date.UTC(reloj.anio, reloj.mes - 1, reloj.dia, reloj.hora, reloj.minuto, reloj.segundo);
  const candidatos = new Set([desfase(zona, pared - 86_400_000), desfase(zona, pared), desfase(zona, pared + 86_400_000)]);
  const soluciones = [...candidatos]
    .filter((d) => desfase(zona, pared - d) === d)
    .map((d) => pared - d)
    .sort((a, b) => a - b);
  const texto = formatearReloj(reloj);
  if (soluciones.length === 0) {
    return {
      ok: false,
      codigo: "HORA_INEXISTENTE",
      motivo: `${texto} no existe en ${zona} (cae en el cambio de horario de primavera)`,
    };
  }
  if (soluciones.length > 1) {
    return {
      ok: false,
      codigo: "HORA_AMBIGUA",
      motivo: `${texto} ocurre dos veces en ${zona} (cambio de horario de otoño); no se elige una por ti`,
    };
  }
  return { ok: true, utc: new Date(soluciones[0] as number).toISOString() };
}
