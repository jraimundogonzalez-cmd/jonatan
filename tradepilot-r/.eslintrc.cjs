/**
 * Regla de lint que blinda SPEC-001 §4.3 / implementation/mvp-0.1.md §6.4 y §13.1:
 * "decimal.js" solo puede importarse dentro de packages/quant-engine/src/decimal/ —
 * es el único punto de configuración de precisión/redondeo del monorepo.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  ignorePatterns: ["dist/", "node_modules/", "**/*.d.ts"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      excludedFiles: ["packages/quant-engine/src/decimal/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "decimal.js",
                message:
                  "decimal.js solo puede importarse desde packages/quant-engine/src/decimal/kernel.ts. " +
                  "Importa FixedDecimal/toFixedDecimal desde '@tradepilot/quant-engine' en su lugar.",
              },
            ],
          },
        ],
      },
    },
  ],
};
