// Inspección del directorio central de un ZIP ANTES de descomprimir nada.
//
// Un `.xlsx` es un ZIP. Un ZIP de 2 MB puede declarar gigas descomprimidos (una
// "bomba ZIP") y agotar la memoria del servidor al abrirlo. Aquí se leen solo
// las cabeceras del directorio central —sin descomprimir— y se rechaza el
// fichero si declara demasiado contenido, demasiadas entradas, cifrado o el
// formato ZIP64 (que una exportación de operaciones no necesita).
//
// Límite conocido: son los tamaños que el ZIP DECLARA. Un fichero fabricado
// para mentir en ellos no se detecta aquí; el riesgo aceptado es el de una
// aplicación local que solo abre los archivos que sube su propio usuario.

/** 64 MB descomprimidos: una exportación de miles de operaciones ocupa unos pocos MB. */
export const MAXIMO_DESCOMPRIMIDO_BYTES = 64 * 1024 * 1024;
export const MAXIMO_ENTRADAS_ZIP = 500;

export type InspeccionZip =
  | { ok: true; entradas: number; descomprimido: number }
  | { ok: false; motivo: "ESTRUCTURA" | "ZIP64" | "CIFRADO" | "DEMASIADAS_ENTRADAS" | "DEMASIADO_GRANDE"; descomprimido?: number };

const leer16 = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const leer32 = (b: Uint8Array, i: number) => (leer16(b, i) + leer16(b, i + 2) * 0x10000) >>> 0;

export function inspeccionarZip(bytes: Uint8Array): InspeccionZip {
  // Fin del directorio central: firma 0x06054b50, a 22 bytes del final más un
  // comentario de hasta 65535 bytes.
  const minimo = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= minimo; i--) {
    if (leer32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { ok: false, motivo: "ESTRUCTURA" };

  const entradas = leer16(bytes, eocd + 10);
  const tamanoDirectorio = leer32(bytes, eocd + 12);
  const inicioDirectorio = leer32(bytes, eocd + 16);
  if (entradas === 0xffff || tamanoDirectorio === 0xffffffff || inicioDirectorio === 0xffffffff) return { ok: false, motivo: "ZIP64" };
  if (entradas > MAXIMO_ENTRADAS_ZIP) return { ok: false, motivo: "DEMASIADAS_ENTRADAS" };
  if (inicioDirectorio + tamanoDirectorio > eocd) return { ok: false, motivo: "ESTRUCTURA" };

  let descomprimido = 0;
  let p = inicioDirectorio;
  for (let n = 0; n < entradas; n++) {
    if (p + 46 > eocd || leer32(bytes, p) !== 0x02014b50) return { ok: false, motivo: "ESTRUCTURA" };
    const indicadores = leer16(bytes, p + 8);
    const comprimido = leer32(bytes, p + 20);
    const tamano = leer32(bytes, p + 24);
    if (indicadores & 0x1) return { ok: false, motivo: "CIFRADO" };
    if (comprimido === 0xffffffff || tamano === 0xffffffff) return { ok: false, motivo: "ZIP64" };
    descomprimido += tamano;
    if (descomprimido > MAXIMO_DESCOMPRIMIDO_BYTES) return { ok: false, motivo: "DEMASIADO_GRANDE", descomprimido };
    p += 46 + leer16(bytes, p + 28) + leer16(bytes, p + 30) + leer16(bytes, p + 32);
  }
  return { ok: true, entradas, descomprimido };
}
