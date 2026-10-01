// Formateo de importes para mostrar en pantalla.
//
// BUILD 022 (decisión E-3): el dinero se muestra con **2 decimales**. El dato
// interno no cambia — sigue siendo `numeric(18,4)` en la base, en el kernel y
// en todas las fronteras. Lo que cambia es sólo lo que lee una persona:
// `176.7150 USD` era exacto y era ilegible de un vistazo.
//
// El redondeo NO se hace aquí. Se delega en `toMoneyDisplayString`, que vive
// en el kernel decimal (`packages/quant-engine/src/decimal/kernel.ts`), único
// punto del monorepo autorizado a importar `decimal.js`. Hacerlo en esta capa
// habría significado un `toFixed(2)` de JavaScript —coma flotante— o una regla
// de redondeo artesanal repetida por cada pantalla; el modo es el mismo
// HALF_EVEN que gobierna todo el proyecto, no una segunda convención.
//
// Esta función sólo pone separadores de millar y la divisa.
import { money, toMoneyDisplayString } from "@tradepilot/risk-engine";

export function formatMoney(value: string, currency: string): string {
  const redondeado = toMoneyDisplayString(money(value));
  const negative = redondeado.startsWith("-");
  const unsigned = negative ? redondeado.slice(1) : redondeado;
  const [integerPart = "0", decimalPart = ""] = unsigned.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const withDecimals = decimalPart ? `${grouped}.${decimalPart}` : grouped;
  return `${negative ? "-" : ""}${withDecimals} ${currency}`;
}

/**
 * El importe exacto, con la escala completa del dominio. Para donde el valor
 * es evidencia y no información de un vistazo: auditoría y detalle técnico.
 */
export function formatMoneyExacto(value: string, currency: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integerPart = "0", decimalPart = ""] = unsigned.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const withDecimals = decimalPart ? `${grouped}.${decimalPart}` : grouped;
  return `${negative ? "-" : ""}${withDecimals} ${currency}`;
}
