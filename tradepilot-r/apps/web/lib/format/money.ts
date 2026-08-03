// Formateo de importes para mostrar en pantalla — nunca convierte a `number`
// de JS (I15, precisión decimal): opera puramente sobre el string exacto que
// ya devuelve la base de datos (`numeric(18,4)`), solo insertando separadores
// de millar en la parte entera. Se muestran las 4 decimales completas tal
// como se almacenan — la misma convención que el resto del proyecto usa para
// R y € (mvp-0.1.md §11.1) — nunca se redondea a 2 decimales, que exigiría
// una regla de redondeo propia (HALF_EVEN) solo para mostrar en pantalla.
export function formatMoney(value: string, currency: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integerPart = "0", decimalPart = ""] = unsigned.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const withDecimals = decimalPart ? `${grouped}.${decimalPart}` : grouped;
  return `${negative ? "-" : ""}${withDecimals} ${currency}`;
}
