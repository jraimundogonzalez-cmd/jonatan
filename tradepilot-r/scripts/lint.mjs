// Lanza ESLint con la configuración clásica (.eslintrc.cjs) en cualquier
// sistema. El script anterior era `ESLINT_USE_FLAT_CONFIG=false eslint …`: esa
// forma de fijar una variable sólo existe en shells de Unix, y en Windows
// (cmd.exe, que es lo que usa npm allí) fallaba antes de llegar a ESLint.
//
// La variable hace falta: sin ella, ESLint 8 encuentra el `eslint.config.js`
// de la carpeta superior del repositorio (la app de fitness) y cambia de modo.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// `eslint/bin/eslint.js` no está en los `exports` del paquete; su package.json sí.
const eslint = join(dirname(require.resolve("eslint/package.json")), "bin", "eslint.js");
const args = process.argv.slice(2);

const r = spawnSync(process.execPath, [eslint, ".", "--ext", ".ts,.tsx", ...args], {
  stdio: "inherit",
  env: { ...process.env, ESLINT_USE_FLAT_CONFIG: "false" },
});
process.exit(r.status ?? 1);
