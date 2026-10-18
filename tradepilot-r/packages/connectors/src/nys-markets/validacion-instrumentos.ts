// Multiplicadores de contrato usados SOLO para comprobar que el P&L bruto del
// fichero cuadra con sus precios. Nunca sustituyen un importe del fichero: si
// no cuadra, la fila se marca para revisión y se conserva el valor original.
//
// No es la tabla `instrument_unit_specs` (09_DECISIONS.md §4: no decidida).
// Es una lista mínima de comprobación local a este conector, con los símbolos
// tal como los escribe la columna `Symbol` de este fichero.
//
// Fuente: especificaciones públicas de CME — valor por punto de índice.
//   MNQ  Micro E-mini Nasdaq-100   2 USD
//   NQ   E-mini Nasdaq-100        20 USD
//   MES  Micro E-mini S&P 500      5 USD
//   ES   E-mini S&P 500           50 USD
export const MULTIPLICADOR_POR_SIMBOLO: Readonly<Record<string, bigint>> = {
  MNQ: 2n,
  NQ: 20n,
  MES: 5n,
  ES: 50n,
};
