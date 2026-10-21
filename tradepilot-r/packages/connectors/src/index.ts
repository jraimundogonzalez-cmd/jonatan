// API pública de @tradepilot/connectors.
export type {
  Celda,
  ConectorDeFichero,
  ErrorDeFichero,
  FilaInvalida,
  FilaOperacionCerrada,
  HojaLeida,
  ProblemaDeFila,
  ResultadoTraduccion,
} from "./tipos.js";
export { comprobarFichero, TAMANO_MAXIMO_BYTES } from "./fichero.js";
export { inspeccionarZip, MAXIMO_DESCOMPRIMIDO_BYTES, MAXIMO_ENTRADAS_ZIP } from "./zip.js";
export { esZonaValida } from "./zona-horaria.js";
export { huellaFichero } from "./huella.js";
export {
  clasificar,
  cuentasExternas,
  filasAGuardar,
  prepararFilas,
  type EstadoFila,
  type Existentes,
  type FilaClasificada,
  type FilaPreparada,
  type ResumenClasificacion,
} from "./clasificar.js";
export {
  COLUMNAS_LISTA_DE_COMERCIO,
  ID_CONECTOR_NYS_LISTA_DE_COMERCIO,
  MAXIMO_COLUMNAS,
  MAXIMO_FILAS,
  MAXIMO_LARGO_CELDA,
  comprobarFicheroListaDeComercio,
  conectorNysListaDeComercio,
} from "./nys-markets/lista-de-comercio.js";
