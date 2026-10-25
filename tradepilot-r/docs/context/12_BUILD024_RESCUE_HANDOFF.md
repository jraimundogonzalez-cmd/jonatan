# 12 · Rescate de BUILD 024 — registro de continuidad

> Documento de traspaso entre sesiones. Describe el **estado real**, no el
> esperado. Si no coincide con `git log` / `git status`, gana git: para y
> aclara la diferencia antes de seguir.
>
> Este documento **no autoriza nada**. Las operaciones permitidas las fija el
> mensaje del usuario de cada sesión.

**Último registro**: 2026-10-25 17:34 (+01:00) · sesión 3 (continuación), raíz de trazado de Next.js (ver §18)

---

## 1. Dónde

| | |
|---|---|
| Repositorio | `%USERPROFILE%\Proyectos\tradepilot-r` (clon de `github.com/jraimundogonzalez-cmd/jonatan`) |
| Aplicación | `%USERPROFILE%\Proyectos\tradepilot-r\tradepilot-r` |
| Rama de trabajo | `claude/tradepilot-r-build024-rescate` (**publicada en origin en `1252d18`** en la sesión 3, §12; los commits posteriores son solo locales hasta nueva autorización. Historia del registro reescrita en la sesión 2, §11, antes del push) |
| Respaldo del registro | `rescate/build024-registro-original` (solo local, **no publicar**): la historia anterior del registro, con los identificadores sin anonimizar (`c9ed89b`). No borrar. |
| Partió de | `620cb42` (`claude/tradepilot-r-position-manager-mwbovl`, sin cambios) |
| Último commit de trabajo | `fix: fijar raiz de trazado de Next.js` (§18, **local**; su hash: `git log -1 --format=%h -- tradepilot-r/apps/web/next.config.mjs`). Antes, `449a360` (protección del lanzador, §17, local), `ae06815` (corrección de `Abrir_TradePilot.bat`, §15, local) y `baba52e` (primera ejecución, §16). Anteriores: `5234494` y los commits de **este documento** `1252d18` (sesión 2, publicado), `bbb65d0` (plan de despliegue, local), `556bf1b` (Fase B, local) y `35bbbe6` (auditoría de la Fase C, local); después, `ef94ce8` (registro del lanzador, local) y el de la primera ejecución (§16, local). El último de este documento: `git log -1 --format=%h -- tradepilot-r/docs/context/12_BUILD024_RESCUE_HANDOFF.md` |
| Rama auxiliar | `rescate/build024-sobre-3961c27` (solo local): BUILD 024, navegación y lint reconstruidos sobre su base real `3961c27` (`f2a8545`, `ce6fa48`, `a437b0c`). Prueba de procedencia; no trabajar sobre ella. |
| Worktrees | solo la principal (la temporal se eliminó) |

## 2. Estado de git al cerrar

- Rama `claude/tradepilot-r-build024-rescate`, árbol **limpio** tras el
  commit `fix: fijar raiz de trazado de Next.js` (§18).
- Upstream `origin/claude/tradepilot-r-build024-rescate` en `1252d18` (push de
  la sesión 3, §12). Tras los ocho commits locales de la sesión 3
  (`bbb65d0`, `556bf1b`, `35bbbe6`, `ae06815`, `ef94ce8`, `baba52e`,
  `449a360` y el de §18), la rama va **8 por delante** y 0 por detrás del
  remoto; no están publicados. Sin stash.
- `node_modules/`, `packages/*/dist/` y `apps/web/.next/` existen en local
  (ignorados por git) por `npm ci` y los builds de hoy.

Commits de la rama sobre `620cb42`:

| Commit | Contenido |
|---|---|
| `a620b51` | BUILD 024 (20 ficheros) |
| `2e7a694` | Navegación móvil en la cabecera |
| `65bc83d` | Lint en Windows (`scripts/lint.mjs`, script `lint`) |
| `f8c28ae` | `supabase/esquema-esperado.txt` regenerado (427 → 435 objetos) |
| `2c35a8e` | Documentación: `COMO-EMPEZAR.md`, `10_CURRENT_STATUS.md`, `03_DATABASE.md` |
| `5234494` | Script `build:packages` |
| `1252d18` | Este documento, anonimizado (sustituye a `fda1199`, `2d3e74e`, `4e3e5d0` y `c9ed89b`, que siguen en la rama de respaldo). **Publicado** |
| `bbb65d0` | Este documento: push, compilación limpia y plan de alojamiento (§12). Local |
| `556bf1b` | Este documento: Fase B completada (§13). Local |
| `35bbbe6` | Este documento: auditoría local de la Fase C (§14). Local |
| `ae06815` | `Abrir_TradePilot.bat`: comprobación de la base original, `build:packages` y código de salida de `supabase start` (§15). Local |
| `ef94ce8` | Este documento: registro de la corrección del lanzador (§15). Local |
| `baba52e` | Este documento: primera ejecución controlada del lanzador (§16). Local |
| `449a360` | Lanzador sin secretos en pantalla, `escribir-env-local.ps1`, `comprobar-funciones.ps1`, origen `localhost` y `TP_NO_ABRIR_NAVEGADOR`, con su documentación (§17). Local |
| (siguiente) | `next.config.mjs`: `outputFileTracingRoot` en la raíz del monorepo (aviso de los dos lockfiles, §18). Local |

## 3. Contexto ya verificado (no repetir)

- Base local real: volumen Docker `supabase_db_tradepilot-r`, montado solo por
  el contenedor `supabase_db_tradepilot-r` (PostgreSQL 17, `unless-stopped`; se
  arranca solo al abrir Docker Desktop). Su `system_identifier` y los números
  de las Cuentas no se publican (ver §11). 2 Cuentas NYS, 0 operaciones, 18 migraciones (última `20261017120000`). Comprobado de nuevo
  en solo lectura a las 22:11: sin cambios. **Desde el 2026-10-24 17:21**: 19
  migraciones (última `20261018120000`), 0 pendientes; mismas Cuentas y 0
  operaciones (Fase B, §13).
- Diagnóstico de solo lectura (2026-10-21 20:09, sobre `620cb42`): **BLOQUEADA**
  por `20261017120000_event_times` (en la base, no en el código) y sus 8 objetos.
  Pendiente: `20261018120000_trade_file_imports` (59 objetos). Informe:
  `diagnosticos\diagnostico-20261021-200919.txt` (ignorado por git).
- BUILD 024 no estaba en ningún commit ni rama del remoto. Su rama original,
  `claude/tradepilot-r-uso-diario`, no existe en GitHub. Los commits `c70f927`
  y `6a9d03a` no aparecen.
- Fuentes de lectura (NO modificar): `%USERPROFILE%\Downloads\TradePilot-R-Windows\tradepilot-r`
  y `..._1\tradepilot-r`. Idénticas entre sí salvo `package-lock.json`. Base de
  ambas: `3961c27`. A las 22:11, 0 ficheros modificados hoy en ellas.
- Copia de seguridad intacta: `%USERPROFILE%\Backups\TradePilot\tradepilot_pg_dumpall_2026-10-18_213427.sql`
  (624 750 bytes, 18/10/2026 21:34:29). Sigue **sin restauración validada**.
  Copias nuevas del 2026-10-24 en `tradepilot-r\respaldos\` (ver §13.1 y §13.3).
- Supabase decide qué migraciones aplicar por la **versión** en
  `supabase_migrations.schema_migrations` (`version`, `name`, `statements`). La
  migración rescatada conserva su nombre exacto, así que `migration up` no la
  volverá a ejecutar. No renombrar ni renumerar. Nunca `db reset`, ni
  `migration repair --status reverted`, ni ejecutar el `.sql` a mano.

## 4. Ficheros: recuperados, fusionados, descartados

**Recuperados sin cambios** (copiados de la copia local sobre `3961c27`; ninguno
se tocó en `3961c27..620cb42`, así que se aplicaron sin conflicto):

- BUILD 024 (`a620b51`):
  - nuevos: `supabase/migrations/20261017120000_event_times.sql`,
    `supabase/tests/16_event_times.sql`, `apps/web/lib/format/fechaEvento.ts`
    y su test, `components/operaciones/AvisoRegistroHistorico.tsx`,
    `test/actions/build024.test.ts`;
  - modificados: `actions/operaciones.ts`, `NuevaOperacionForm.tsx`,
    `ParcialForm.tsx`, `CierreForm.tsx`, `DesenlacePanel.tsx`,
    `OperacionHeader.tsx`, `operaciones/[id]/page.tsx`,
    `operaciones/[id]/cerrar/page.tsx`, `types/operations.ts`,
    `components/ui/Input.tsx` (`datetime-local`), y en `operations-engine`
    `domain/types.ts` y `adapters/SupabaseTradeGateway.ts`.
- Navegación móvil (`2e7a694`): `Header.tsx`, `Header.module.css`, `Header.test.tsx`.
- Lint (`65bc83d`): `scripts/lint.mjs`.

**Comprobación de integridad**: el blob de la migración en git tiene el SHA-256
`c719ba2e…2e12`, igual que en las dos copias locales; `16_event_times.sql`,
`b6b74ff2…f7a1`, igual que el original. La copia de trabajo tiene CRLF por
`core.autocrlf=true` (como todo el clon); el blob es LF, como el original.

**Fusionados**:
- `supabase/tests/README.md`: conflicto real. Las dos suites tienen el número
  16 (`16_trade_file_imports.sql` y `16_event_times.sql`). Se listan las dos y
  se documenta la colisión. **No se renombró** la rescatada (sus mensajes
  dicen `SUITE16`).
- `docs/context/10_CURRENT_STATUS.md`: sección BUILD 024 (git, sin conflicto),
  más una nota de rescate con lo verificado y lo no verificado.
- `package.json`: conflicto contiguo. Se conserva la versión de la rama (con
  `connectors`) y solo cambia `lint` → `node scripts/lint.mjs`. Aparte, se añade
  `build:packages` con los seis paquetes (`5234494`).
- `COMO-EMPEZAR.md`: solo los fragmentos de BUILD 024 (fecha y hora en
  apertura, parcial y cierre; aviso a posteriori) y el botón «Enviar enlace de
  acceso». Comprobados contra las etiquetas de los formularios y `LoginForm.tsx`.
- `docs/context/03_DATABASE.md`: nota con la migración y sus objetos.
- `supabase/esquema-esperado.txt`: regenerado (ver §5), +9 líneas.

**Descartados**:
- `Abrir_TradePilot.bat` de la copia: ejecutaba `supabase migration up --local`
  en cada apertura. Se conserva el lanzador seguro del clon.
- `package.json` `postinstall`: ejecutaría código en cada `npm install`/`npm ci`.
- `package.json` `dev` (`build:packages && dev web`): no validable sin arrancar
  la web. Ver §6.
- Partes de `COMO-EMPEZAR.md` sobre el ZIP, `EMPIEZA-AQUI.txt` y
  `migration up --local`: contradicen el flujo seguro actual
  (diagnóstico → copia → actualizador).
- `AGENTS.md`: solo un recuento de tests desfasado.
- Artefactos locales: `apps/web/.env.local` (secretos; no abierto),
  `apps/web/next-env.d.ts`, `supabase-status.err`, `EMPIEZA-AQUI.txt`.

## 5. Pruebas (sobre `5234494` salvo indicación)

| Comprobación | Resultado |
|---|---|
| `npm ci` | OK. `package-lock.json` sin cambios. npm **no ejecutó** el `postinstall` de `esbuild@0.21.5` (no aprobado en allowScripts); no afectó a nada de lo de abajo |
| `npm run typecheck` | **SUPERADO** (exit 0) |
| `npm run lint` | **SUPERADO** (exit 0; 209 ficheros, 0 errores, 0 avisos, medido con `-f json`) |
| `npm run test` | **434 superadas, 1 fallida** (quant 98, risk 27, operations 70, optimizer 21, rule 29, connectors 52, web 137/138) |
| ↳ fallida | `test/security/fronteras.test.ts` › «el nombre de la plataforma solo aparece donde se elige el conector (I10)»: `expected ['lib\imports\servicio.ts'] to deeply equal ['lib/imports/servicio.ts']`. Separador de rutas de Windows en el test. **No la causa el rescate**: ni ese test ni `lib/imports` cambian en `620cb42..HEAD`. Deducido; no ejecutado sobre `620cb42`. Sin corregir (fuera de alcance) |
| ↳ tests nuevos | `fechaEvento` 10, `build024` 5, `Header` 1: **SUPERADOS** |
| ↳ `lanzadores.test.ts` (esquema al día) | Falló antes de regenerar la referencia; **SUPERADO** después |
| `npm run build` | **SUPERADO** (sobre `65bc83d`; los commits posteriores solo tocan docs, la referencia de esquema y añaden `build:packages`) |
| `npm run build:packages` | **SUPERADO** (los seis `dist/index.js` regenerados) |
| `esquema-esperado.txt` | Regenerado con `generar-esquema-esperado.sh` y `LC_ALL=C`: 435 objetos; diff = cabecera + los 8 objetos de BUILD 024, que son exactamente los 8 del diagnóstico de la base real |
| Suite SQL `16_event_times` | **SUPERADA**: 15 comprobaciones, `SUITE 16 · TODO CORRECTO`, exit 0 |
| Suite SQL `16_trade_file_imports` | **SUPERADA** (`TODAS LAS COMPROBACIONES DE 16 EN VERDE`) |
| Suites SQL 01–15 | Ejecutadas sobre `620cb42` y sobre el rescate, y comparadas tras normalizar UUID, fechas y anchos: 3 325 líneas, 3 317 idénticas, 8 que solo añaden la columna nueva al final, **0 otras diferencias**. Muchas de estas suites se leen a mano; lo comprobado es «mismo comportamiento que `620cb42`», no una revisión manual de cada valor |
| Parejas de concurrencia (`11_concurrency_*`, `12_concurrency_*`, `14_race_*`) | **NO EJECUTADAS** (necesitan dos sesiones simultáneas) |
| Recorrido en navegador | **NO EJECUTADO** (abrir la web no está autorizado) |
| Diagnóstico contra la base real con este código | **EJECUTADO** en la sesión 2 (2026-10-22 18:54, sobre `2d3e74e`): LISTA PARA ACTUALIZAR, 0 bloqueos, 1 migración pendiente. Ver §11 |

**Aislamiento de la base desechable** (hoy, ya eliminada): contenedor
`tp-desechable-esquema`, imagen `postgres:17` (descargada hoy; sigue en local),
`--rm`, `--network none`, sin puertos, sin montajes, datos en `tmpfs`, código
introducido con `docker cp` desde `git archive`. `system_identifier`
distinto del de la base real (comprobado; valores no publicados). El volumen original solo lo usaba
`supabase_db_tradepilot-r`.

## 6. Problemas y decisiones pendientes (necesitan al usuario)

1. **`Abrir_TradePilot.bat` no compila los paquetes internos**: lanza
   `npm run dev --workspace=@tradepilot/web` tras `npm install`. Con
   `packages/*/dist` ausente (instalación limpia), la web fallaría con «Module
   not found: '@tradepilot/quant-engine'». Hoy existen en local por los builds
   de esta sesión. Propuesta: que el lanzador ejecute `npm run build:packages`
   antes de la web, **sin** `migration up` (y quizá el script `dev`). Sin
   aplicar: es un cambio del lanzador, no validable sin abrirlo.
   **Confirmado** leyendo el lanzador (línea 282), en §14.1. Hoy los seis
   `dist` existen y ningún `src` es más reciente.
   **Corregido en el código** en `ae06815` (§15): el lanzador ejecuta
   `npm run build:packages` antes de la web y se detiene si falla.
   **Validado** en la primera ejecución controlada (§16.1): exit 0, seis
   paquetes.
2. `fronteras.test.ts` falla en Windows (separador de rutas). Fuera de alcance; arreglarlo requiere autorización.
3. Dos suites con número 16. Se dejó así a propósito; renumerar es opcional.
4. ~~Push de la rama de rescate a GitHub.~~ **Resuelto** en la sesión 3
   (`1252d18`, verificado con `git ls-remote`; §12).
5. `.env.local` del clon nuevo: no existe. Según `10_CURRENT_STATUS.md`,
   `Abrir_TradePilot.bat` lo reescribe (guardando el anterior en
   `.env.anterior.local`). No se ha comprobado aquí. **Actualización (§14.1)**:
   el código lo confirma (líneas 202-204). Hoy `apps/web/.env.local` **no
   existe** (comprobado solo por el nombre; solo está `.env.example`).
   **Actualización (§16.4)**: el lanzador lo **creó** el 2026-10-25 con la
   URL local y la anon key. Es **confidencial**. Sigue sin resolverse la
   copia única.
6. Revisar antes de abrir: los contenedores llevan la etiqueta `workdir` de la
   carpeta antigua de Descargas, y `supabase_edge_runtime_tradepilot-r` sale con
   código 255. **Auditado (§14.2-§14.4)**: confirmado en los 9 contenedores.
   Kong y Studio montan ficheros desde esa carpeta. La causa del 255 no se ha
   podido determinar. Sigue abierto: hay que decidir cómo resolverlo (§14.6).
7. `probar-restauracion.ps1` (`Probar_copia_de_seguridad_TradePilot.bat`) **no
   es aislado**: crea, restaura y borra una base temporal **dentro del
   PostgreSQL original**. Por eso no se usó en la Fase B (§13.1). Cambiarlo
   requiere autorización.
8. Para restaurar una copia en una instancia nueva de la imagen
   `supabase/postgres`, hay que crear antes el rol `supabase_functions_admin`
   (lo crea el arranque del CLI, no la imagen). Sin él aparecen 5 errores de
   propietario o permisos en `supabase_functions` (§13.1).
9. **Exposición de puertos en la red local** (§14.5): 54321-54324 se publican
   en todas las interfaces, y una regla de entrada de Windows permite
   `com.docker.backend.exe` sin restricciones. Revisarlo requiere una
   autorización independiente.
10. **`Abrir_TradePilot.bat` ejecuta `supabase start` sin comprobar nada
    antes y sin mirar su resultado** (§14.1, §14.4). Las correcciones
    recomendadas están en §14.6. **Corregido en el código** en `ae06815`
    (§15): comprueba la base original antes y después y trata el código de
    salida. **Validado** en la primera ejecución controlada (§16.1).
11. **Riesgos descubiertos en la primera ejecución** (§16.6): `supabase start`
    imprime secretos en la consola, la redirección usa `localhost` en vez de
    `127.0.0.1`, y una sesión antigua de Chrome provocó escrituras en `auth`.

## 7. Hecho y expresamente no hecho

**Hecho**: rama de rescate y rama auxiliar locales; 6 commits de trabajo y 1
de este documento; `npm ci`; typecheck, lint, test, build y `build:packages`;
PostgreSQL 17 desechable para la referencia de esquema y las suites SQL
(eliminado al terminar); lecturas de solo lectura de la base real para
comprobar que no cambió.

**No hecho**: push, merge, cambios en `620cb42` o en otras ramas; arrancar,
parar o reiniciar contenedores de Supabase; `supabase start`, `db reset`,
`migration up`, `migration repair`; SQL de escritura contra la base real;
restauraciones; abrir la web; ejecutar `.bat`/`.ps1` de TradePilot hoy; abrir o
mostrar `.env.local`; modificar las carpetas antiguas o la copia de seguridad.

> Lo anterior describe las sesiones 1 y 2. En la sesión 3 sí se hizo, con
> autorización expresa de cada paso: el push de la rama (§12), la copia, la
> prueba aislada de restauración, `Actualizar_TradePilot.bat` y el
> diagnóstico (§13). Sigue **sin hacerse**: merge, pull request, abrir la web,
> abrir `.env.local`, `supabase start`, `db reset`, restaurar sobre la
> original, y crear recursos externos o desplegar.
>
> Después (§15) se modificó y confirmó en local `Abrir_TradePilot.bat`
> (`ae06815`), sin publicar el commit. El 2026-10-25, con autorización
> expresa, el lanzador completo **se ejecutó una vez** y la web se abrió en
> local (§16). Esa apertura **renovó una sesión de Auth** en la base real;
> no creó datos de dominio.

## 8. Riesgos para la siguiente sesión

- La base real sigue **BLOQUEADA** para el código de `620cb42`. Con esta rama
  está **al día** desde la Fase B (19/19 migraciones, 435/435 objetos, §13).
  No ejecutar contra ella código de ramas anteriores.
- Cualquier prueba funcional en el navegador **escribe en la base real**. Las
  Operaciones, los eventos de capital y `audit_log` son evidencia inmutable:
  no se pueden borrar después (AGENTS.md §5). Ver §13.6.
- **No borrar ni mover `%USERPROFILE%\Downloads\TradePilot-R-Windows`**
  mientras existan los contenedores actuales: Kong monta desde allí la
  plantilla del correo y Studio sus `snippets` (§14.1).
- Los puertos de Supabase local, incluida la base de datos con la contraseña
  local por defecto y Studio sin autenticación, podrían ser accesibles desde
  la red local (§14.5).
- No ejecutar `supabase start` ni el lanzador si `supabase_db_tradepilot-r`
  está parado: el CLI 2.121.0 eliminaría y recrearía los 9 contenedores
  (§14.4). Desde `ae06815` el lanzador debería detenerse en ese caso
  (`:verificar_base`, §15). En la ejecución de §16 la base estaba sana, así
  que **la rama de parada no se ha probado con el lanzador completo**.
- **Abrir la web en un navegador con una sesión anterior escribe en `auth`**
  de la base real, aunque no se haga clic en nada (§16.3). Usar un perfil de
  navegador limpio.
- `supabase start` muestra en la consola secretos de la pila local (§16.6).
  No compartir capturas ni copias de esa ventana.
- Docker Desktop vuelve a levantar los contenedores de Supabase solo, sobre el
  volumen real. Cualquier herramienta que se conecte a `127.0.0.1:54322` habla
  con la base real: **las pruebas SQL nunca van ahí**.
- `postgres:17` queda descargada; cualquier contenedor desechable nuevo debe
  repetir la demostración de aislamiento (§5).

## 9. Siguiente acción (en orden; cada paso necesita autorización explícita)

1. Revisar esta rama (`git log 620cb42..HEAD`, `git diff 620cb42..HEAD`) y
   decidir sobre §6.1 a §6.4.
2. ~~Diagnóstico de solo lectura.~~ **Hecho** en la sesión 2 (§11): LISTA, 0
   bloqueos, 1 pendiente (`trade_file_imports`).
3. ~~Push de `claude/tradepilot-r-build024-rescate`.~~ **Hecho** en la sesión 3
   (§12).
4. ~~Fase B: copia → prueba de la copia → `Actualizar_TradePilot.bat` →
   diagnóstico final.~~ **Hecha** en la sesión 3 (§13). La prueba de la copia
   se hizo en una instancia aislada, no con `Probar_copia_de_seguridad_TradePilot.bat`
   (§6.7).
5. **En curso.** Fase C: resolver §6.1, §6.5 y §6.6; después abrir la web y
   hacer el recorrido de BUILD 024 en el navegador. Objetivos y decisiones en
   §13.6. **Auditoría de solo lectura hecha** (§14). **Lanzador corregido**
   en `ae06815` (§14.6.1-3; ver §15). **Primera ejecución controlada hecha**
   (§16): arranque técnico correcto; validación visual con sesión limpia
   pendiente. **Riesgos 1-4 de §16.6 corregidos en el código** y probados en
   aislamiento (§17); el lanzador completo con esos cambios no se ha
   ejecutado. Siguiente: la validación controlada con un perfil de navegador
   limpio (§17.5), **NO autorizada todavía**.
6. Fase D (alojamiento externo): ver el plan y los bloqueos de §12.

## 10. Comprobaciones mínimas para reanudar

```powershell
$r = "$env:USERPROFILE\Proyectos\tradepilot-r"
git -C $r branch --show-current          # claude/tradepilot-r-build024-rescate
git -C $r status --short --branch        # limpio; [ahead 8] respecto a origin (bbb65d0 + 556bf1b + 35bbbe6 + ae06815 + ef94ce8 + baba52e + 449a360 + commit de §18)
git -C $r log --oneline 620cb42..HEAD    # 15 commits: a620b51 … 5234494 + 1252d18 + bbb65d0 + 556bf1b + 35bbbe6 + ae06815 + ef94ce8 + baba52e + 449a360 + el de §18
git -C $r show HEAD:tradepilot-r/supabase/migrations/20261017120000_event_times.sql | Out-Null  # existe
git -C $r ls-remote --heads origin claude/tradepilot-r-build024-rescate   # 1252d184bfb527616f13b6c699973185aad7c858
git -C $r ls-remote --heads origin 'rescate/*'                            # vacío: las ramas de respaldo no se publican
# Base real, SOLO LECTURA (solo si el usuario autoriza conectarse):
docker exec -e PGOPTIONS='-c default_transaction_read_only=on' supabase_db_tradepilot-r psql -U postgres -d postgres -X -At -c "select count(*) from supabase_migrations.schema_migrations"   # 19 (desde la Fase B, §13)
```

## 11. Sesión 2 · 2026-10-22

- **Estado al empezar**: coincide con §1, §2 y §10 (rama, árbol limpio, sin
  upstream ni stash, HEAD `fda1199`, 7 commits sobre `620cb42`, la migración
  existe en HEAD, `ls-remote` vacío). No se repitió ninguna prueba.
- **Autorizado**: solo el diagnóstico de solo lectura (§9.2), ejecutando
  `scripts\windows\diagnostico.ps1` directamente (el `.bat` acaba en `pause`).
- **Revisión del código del diagnóstico** (`diagnostico.ps1` + las funciones de
  `comun.ps1` que usa: `Assert-Entorno`, `Get-Diagnostico`, `Write-Diagnostico`):
  solo `docker info`, `docker ps`, `docker exec … psql` con
  `PGOPTIONS=-c default_transaction_read_only=on`, `docker volume inspect`, y
  escribe un `.txt` en `diagnosticos\`. No arranca nada, no copia ficheros al
  contenedor, no usa `supabase`. Coincide con lo autorizado.
- **Resultado**: **NO EJECUTADO**. Docker Desktop estaba cerrado (`docker ps`:
  no existe la tubería `dockerDesktopLinuxEngine`), así que el contenedor
  tampoco estaba en marcha. No se arrancó nada. No hay informe nuevo.
- Ojo: el mensaje de error del script propone `Abrir_TradePilot.bat` para
  arrancar la base. **No** es la vía para el diagnóstico: hace `npm install` y
  lanza la web (§6.1), y abrir la web no está autorizado. Abrir Docker Desktop basta para que el contenedor
  `unless-stopped` se levante solo (§3), y abrirlo es decisión del usuario.
- **Segundo intento (18:54)**, tras abrir el usuario Docker Desktop:
  - Docker 29.8.2 responde. `supabase_db_tradepilot-r`: `running=true`,
    `healthy`, `unless-stopped`, único montaje = volumen
    `supabase_db_tradepilot-r` → `/var/lib/postgresql/data`. No se arrancó,
    paró ni reinició nada (lo levantó Docker Desktop).
  - Ejecutado: `powershell -NoProfile -ExecutionPolicy Bypass -File
    scripts\windows\diagnostico.ps1` sobre `2d3e74e` (hoy en la rama de
    respaldo; mismo código y mismo esquema esperado que `5234494`: entre ambos
    solo cambia este documento). Exit 0.
  - **VEREDICTO: LISTA PARA ACTUALIZAR**. Bloqueos 0, avisos 0.
  - Migraciones: 18 aplicadas (última `20261017120000`), **1 pendiente**:
    `20261018120000_trade_file_imports`. Objetos: 376 en la base, 435
    esperados; los 59 que faltan los trae esa migración (o `funciones:imports.sql`).
  - Filas: `accounts` 2, `account_capital_events` 2, `account_risk_state` 2,
    `domain_events` 2, `profiles` 1, `prop_firms` 1; `trades` y todas las
    demás 0. Igual que en §3.
  - Informe: `diagnosticos\diagnostico-20261022-185422.txt` (ignorado por git,
    `.gitignore:18`).
  - Confirma la previsión de §5 y §9.2. La base ya **no** está BLOQUEADA para
    el código de esta rama (sí lo sigue estando para `620cb42`).
- **Push detenido**: el repositorio `jraimundogonzalez-cmd/jonatan`
  es **público** (API de GitHub: `"visibility": "public"`) y este documento
  llevaba los números reales de las dos Cuentas NYS, el `system_identifier`
  de la base real y el de la desechable, y rutas con el usuario de Windows.
  Los commits de código (`620cb42..5234494`) se revisaron línea a línea
  (añadidos y mensajes): sin esos datos.
- **Anonimización** (autorizada por el usuario, opción 1):
  - Respaldo: rama local `rescate/build024-registro-original` → `c9ed89b`.
    Conserva la historia anterior y los valores reales. **No publicar.**
  - Cambios en este documento: números de Cuenta y `system_identifier` →
    descripción genérica; `C:\Users\<usuario>\` → `%USERPROFILE%\` (en el
    bloque PowerShell de §10, `$env:USERPROFILE`). Ningún hecho técnico cambia.
  - Se mantienen: el nombre del repositorio (es el propio remoto), el puerto
    estándar `127.0.0.1:54322` (ya público en `620cb42`) y los nombres de
    ficheros de diagnóstico y de la copia de seguridad.
  - Historia: los 4 commits del registro (`fda1199`, `2d3e74e`, `4e3e5d0`,
    `c9ed89b`) se sustituyen por **un único commit** sobre `5234494`. Hecho con
    `commit-tree` + `update-ref` (sin `reset`, `rebase` ni `checkout`).
- **Siguiente acción** (cada paso con autorización explícita y separada):
  §9.3 push de la rama de rescate (pendiente de que el usuario revise la
  versión anonimizada); después Fase B (§9.4): copia de seguridad →
  (opcional) prueba de la copia → `Actualizar_TradePilot.bat` → diagnóstico
  final (esperado: LISTA, 0 pendientes). Siguen abiertas §6.1–§6.6.

## 12. Sesión 3 · 2026-10-24

### 12.1 Hechos comprobados

- **Estado al empezar**: coincide con §1, §2 y §10 de la sesión 2 (rama,
  árbol limpio, sin upstream ni stash, HEAD `1252d18`, 7 commits sobre
  `620cb42`). `ls-remote` vacío: la rama no estaba en origin.
- **Revisión previa al push**: en `git log -p 620cb42..HEAD` (ficheros y
  mensajes) no aparecen los números reales de las Cuentas, ninguno de los dos
  `system_identifier` ni rutas con el usuario de Windows. Tampoco hay `.env`
  ni copias de seguridad en el rango. `620cb42` ya estaba en origin.
- **Push completado** (autorizado por el usuario): `git push -u origin
  claude/tradepilot-r-build024-rescate`, una sola vez, sin `--force`, sin
  `--all` ni `--mirror`. Se quedó esperando a Git Credential Manager hasta que
  el usuario inició sesión; después, exit 0. `git ls-remote` devuelve
  `1252d184bfb527616f13b6c699973185aad7c858` para esa rama. Upstream
  configurado; local y remoto sincronizados (0/0) antes del commit de esta
  sesión.
- `rescate/build024-registro-original` y `rescate/build024-sobre-3961c27`
  siguen **solo en local** (no están en origin). **No publicarlas.**
- No se ha creado ningún pull request ni se ha hecho merge.
- **Compilación limpia SUPERADA**: `git archive 1252d18` en una carpeta
  temporal fuera del clon, Node 24.21.0, npm 11.19.0. `npm ci` (504 paquetes;
  el `postinstall` de `esbuild` sigue sin aprobar, como en §5) y `npm run
  build` (seis paquetes y la web): exit 0, 19 rutas y el middleware. Las dos
  variables `NEXT_PUBLIC_SUPABASE_*` llevaban **valores ficticios** de prueba
  (`placeholder`), no credenciales. Demuestra que una instalación limpia
  compila sin secretos y sin `dist/` previos si el build compila antes los
  paquetes.
- **Inspección del código** (solo lectura):
  - Variables de entorno: solo `NEXT_PUBLIC_SUPABASE_URL` y
    `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ninguna referencia a la `service_role`
    (lo vigila `fronteras.test.ts`).
  - No hay `localhost`, `127.0.0.1` ni puertos en el código de la app y los
    paquetes. `actions/auth.ts` calcula el origen del enlace de acceso a
    partir de `x-forwarded-host`/`host`.
  - Auth: solo enlace mágico (`signInWithOtp`). `/auth/confirm` solo acepta
    `token_hash`, que da la plantilla propia
    `supabase/templates/magic-link.html` (no la de Supabase por defecto).
  - `supabase/config.toml`: `enable_signup = true` y `site_url`/redirecciones
    con `localhost:3000`. Solo se aplica a la base local.
  - Las funciones de `supabase/functions/sql/` (`funding.sql`,
    `operations.sql`, `management_intent.sql`, `imports.sql`) se cargan como
    **seed** (`[db.seed] sql_paths`), no como migraciones. Localmente las
    aplica `actualizar.ps1` con `psql`.
  - `next.config.mjs`: `bodySizeLimit` de 3 MB (por debajo de los 4,5 MB de
    Vercel) y `exceljs` como paquete externo. No hay `vercel.json`, ni
    `engines`/`.nvmrc`, ni `apps/web/public` (sin manifiesto web ni iconos).
- **Base local original**: en esta sesión **no** se ha conectado nadie. El
  último diagnóstico autorizado (sesión 2, §11) dio LISTA PARA ACTUALIZAR, 0
  bloqueos, 0 avisos, 18 migraciones aplicadas y 1 pendiente
  (`20261018120000_trade_file_imports`). Ese diagnóstico **no autoriza** la
  actualización. El último recuento de filas (§11): 2 Cuentas NYS, 2 eventos
  de capital, 0 operaciones. **Revalidarlo** antes de usarlo para una
  migración.
- La copia `.sql` de §3 sigue **sin restauración validada**.
- No se han creado recursos externos, no se ha desplegado ninguna web y no se
  han migrado datos.

### 12.2 Objetivo actual

Alojar TradePilot R en una URL HTTPS externa, accesible desde ordenador y móvil
sin tener que arrancar Claude, Docker ni la aplicación en el PC.

### 12.3 Propuesta (NO implantada)

- **Web**: Vercel (Hobby). Directorio raíz `tradepilot-r/apps/web`, los
  paquetes se compilan antes que `next build`, la versión de Node queda fija y
  las funciones van a una región de la UE.
- **Auth y PostgreSQL**: Supabase alojado en la UE. Proyecto propio, con RLS
  como protección y solo la anon key en Vercel.
- **Coste inicial estimado: 0 €** con los planes gratuitos. **Pendiente de
  confirmar** las condiciones y límites vigentes antes de contratar (en Free,
  la pausa por inactividad y la falta de copias descargables; Pro como
  alternativa de pago).
- **Traslado de las dos Cuentas NYS**: en la base nueva el usuario tendrá otro
  UUID, así que no sirve restaurar el `pg_dumpall`. Opciones:
  - **A** (preferida): recrearlas desde la web, ya que hay 0 operaciones.
  - **B**: copiar solo las tablas `public` cambiando el `user_id`.

  No elegida ni verificada.

### 12.4 Bloqueos de despliegue (pendientes)

1. Configurar el monorepo y la compilación automática en Vercel.
2. Aplicar a la base alojada las migraciones y los cuatro ficheros SQL de
   funciones, en el orden de `config.toml`.
3. Configurar Auth en el proyecto alojado: URL del sitio, redirecciones y
   plantilla de email. Con la plantilla por defecto, el login falla.
4. Desactivar el registro público después de configurar y comprobar el acceso.
5. Preparar y probar copias de seguridad remotas.
6. Elegir y verificar el procedimiento para trasladar las dos Cuentas NYS.

### 12.5 Siguiente paso

**Recomendado: Fase B local** (§9.4). Consiste en una copia de seguridad
reciente, la validación aislada de esa copia, una actualización controlada y el
diagnóstico posterior. **Todavía NO autorizada** en el momento de este
registro (10:53). *Después se autorizó y se completó: ver §13.*

Cada una de estas operaciones requiere **autorización explícita** antes de
ejecutarse:

- `Actualizar_TradePilot.bat`;
- migraciones o SQL de escritura;
- `supabase start`, `db reset` o seed sobre la base original;
- cambios en contenedores o volúmenes;
- crear recursos externos, desplegar o transferir datos;
- hacer push del commit de esta sesión o de cualquier otra rama.

## 13. Sesión 3 (continuación) · 2026-10-24 · Fase B completada

Cada paso tuvo una autorización expresa y separada del usuario: copia → prueba
aislada → actualización con diagnóstico posterior. Los hechos son comprobados
salvo donde se indique otra cosa.

### 13.1 Copia de seguridad y prueba aislada de restauración

- **Docker Desktop** estaba cerrado. Lo lanzó Claude (autorizado) con
  `Start-Process` a las 16:50:05 y el motor respondió a las 16:50:25 (29.8.2).
  `supabase_db_tradepilot-r` se levantó solo (`unless-stopped`) y quedó
  `healthy`. Montaje único: el volumen `supabase_db_tradepilot-r` (creado el
  2026-10-18) en `/var/lib/postgresql/data`. Su `system_identifier` coincide
  con el de la base original registrado en la sesión 2 (comparado sin
  mostrarlo).
- **Copia**: `scripts\windows\respaldo.ps1` (el `.bat` acaba en `pause`),
  exit 0. Hace `pg_dump -Fc` de la base `postgres` en solo lectura y la verifica
  sobre el fichero del disco.
  - `respaldos\tradepilot-20261024-165054.dump`: 585 085 bytes, SHA-256
    `3D9F0D108F7DA6E2B53F6A8D2A52AA16F4A3DB7D2BD38E024356E9B59CA5335B`.
  - Recuentos base frente a copia: las 21 tablas de `public` OK.
  - `pg_restore --list` (con el fichero pasado por la entrada estándar): exit
    0, formato CUSTOM con gzip, pg_dump 17.11, 917 entradas.
- **Prueba de restauración en una instancia aislada**. No se usó
  `probar-restauracion.ps1` porque no es aislado (§6.7).
  - Contenedor y volumen nuevos, ambos `tp-prueba-restauracion-20261024`.
    Imagen `supabase/postgres:17.11.0.004`, la misma que la original.
    `--network none`, sin puertos, sin el volumen original y con un
    `system_identifier` distinto. El SHA-256 de la copia dentro del contenedor
    coincide.
  - **Primer intento** (`tp_restaurada`): `pg_restore` exit 1 con **5 errores**,
    todos `role "supabase_functions_admin" does not exist`. Eran cambios de
    propietario o permisos en `supabase_functions` (http_request, hooks,
    hooks_id_seq, migrations, GRANT USAGE).
  - El rol se creó **solo en el entorno temporal**. **Segundo intento**
    (`tp_restaurada2`, `--exit-on-error`): **exit 0, 0 errores, 0 avisos**.
  - **Integridad, original frente a restaurada**: idénticas en todo lo medido.
    - Migraciones (18), objetos, tablas, funciones, RLS, políticas, triggers,
      los 11 esquemas y las extensiones con sus versiones.
    - Auth (users, identities, 27 tablas, `on_auth_user_created`) y Storage.
    - Recuentos de las 21 tablas de `public`.
    - Huella MD5 de todas las filas de 10 tablas críticas: `accounts`,
      `account_capital_events`, `account_risk_state`, `domain_events`,
      `profiles`, `prop_firms`, `trades`, `auth.users`, `auth.identities` y
      `schema_migrations`.
  - Sin probar: los servicios de Auth, Storage y la API sobre la base
    restaurada (sin red). Se validó la base, no la aplicación sobre ella.
  - **Limpieza**: se eliminaron solo ese contenedor y ese volumen, tras
    comprobar su id, su etiqueta `tradepilot.prueba=restauracion` y su fecha de
    creación.
  - La original, antes y después de la prueba: misma foto (migraciones,
    objetos, bases, recuentos, mismo arranque, 0 reinicios).
- ⚠️ La copia contiene datos de autenticación (usuarios, sesiones, refresh
  tokens) y `vault.secrets`. **Es privada**: no se sube a git ni se comparte.

### 13.2 Actualización de la base original

- Revisión previa del código (`Actualizar_TradePilot.bat` →
  `actualizar.ps1` + `comun.ps1`):
  - La migración pendiente solo añade: 2 tablas nuevas con índices, RLS,
    políticas y triggers, y 1 función. No toca tablas existentes.
  - Los 4 ficheros de funciones, a nivel superior, solo tienen
    `create or replace function`, 2 `drop function if exists` de firmas
    antiguas, `comment` y `grant`/`revoke execute`. Sus `insert`, `update` y
    `delete` están dentro de cuerpos de función.
  - `127.0.0.1:54322` lo sirven `com.docker.backend` y `wslrelay` (Docker).
    En Windows no hay otro PostgreSQL. `supabase migration list --local` (solo
    lectura) vio 18 aplicadas y 1 pendiente.
- Antes de ejecutar: la copia 165054 existía y su hash coincidía; la base era
  la original y estaba sin cambios desde la copia.
- **`Actualizar_TradePilot.bat`: exit 0.** Se ejecutó con `TP_NO_PREGUNTAR=1`
  (opción del script para la confirmación ya dada) y la entrada desde `nul`
  (para el `pause`). Supabase CLI 2.121.0.
  - Migración aplicada: **`20261018120000_trade_file_imports`** (y solo esa).
  - Funciones aplicadas, cada una en su transacción y todas OK: `funding.sql`,
    `operations.sql`, `management_intent.sql`, `imports.sql`.
  - Comprobación del script: mismas filas que antes, más `import_batches` e
    `imported_trade_rows` nuevas y vacías. Funciones clave disponibles.
- **Diagnóstico posterior** (`diagnostico.ps1`, solo lectura, exit 0): **19
  migraciones aplicadas, 0 pendientes, 435/435 objetos, 0 bloqueos, 0
  avisos**. Informe: `diagnosticos\diagnostico-20261024-172124.txt`.
  - Su veredicto literal es «LISTA PARA ACTUALIZAR», un texto fijo del script
    cuando no hay bloqueos. Con 0 pendientes, la base está **al día**: no queda
    ninguna migración por aplicar.
- Comprobaciones de solo lectura adicionales:
  - Importación: 2 tablas, RLS en las 2, 2 políticas, 2 triggers de
    inmutabilidad, 6 índices, y las funciones `confirmar_importacion`,
    `listar_lotes_importacion` y `reject_import_mutation`.
  - Permisos: `anon` no puede ejecutar `confirmar_importacion`,
    `authenticated` sí, y `authenticated` no inserta directamente en
    `import_batches`.
  - Recuentos: `accounts` 2, `account_capital_events` 2, `account_risk_state`
    2, `domain_events` 2, `profiles` 1, `prop_firms` 1, `trades` 0,
    `import_batches` 0, `imported_trade_rows` 0.
  - Las 2 Cuentas: prefijo NYS, `live`, USD, con 1 evento de capital y 1
    estado de riesgo cada una.
  - Huellas de `accounts`, `account_capital_events` y `trades`: **idénticas**
    a las de antes de actualizar.
- Efecto secundario conocido: el actualizador deja en `/tmp` del contenedor
  los 4 `.sql` y las 2 copias de verificación. No se han tocado.

### 13.3 Copias disponibles

| Copia | Bytes | SHA-256 | Estado |
|---|---|---|---|
| `respaldos\tradepilot-20261024-165054.dump` | 585 085 | `3D9F0D108F7DA6E2B53F6A8D2A52AA16F4A3DB7D2BD38E024356E9B59CA5335B` | Verificada por recuentos **y restauración probada en una instancia aislada** (§13.1) |
| `respaldos\tradepilot-20261024-172104.dump` | 585 085 | `AB3070B46CC6F7CABA8AAA4787879195A477F1A7D19665877A9E25940E25E8F5` | La hizo el actualizador justo antes de cambiar nada. Verificada por el procedimiento oficial (recuentos). **Sin prueba de restauración** |
| `%USERPROFILE%\Backups\TradePilot\tradepilot_pg_dumpall_2026-10-18_213427.sql` | 624 750 | — | Intacta. **Sin restauración validada** |

Las tres son anteriores a la migración `20261018120000`.

### 13.4 Estado al cerrar

- Base original: contenedor `supabase_db_tradepilot-r`, volumen original, al
  día con esta rama. Docker Desktop **sigue abierto**.
- Git: este commit es local. No se ha hecho push, ni merge, ni pull request.
- No se ha desplegado la web, ni creado recursos externos, ni transferido
  datos.
- Siguen abiertos: §6.1 (el lanzador no compila los paquetes), §6.2
  (`fronteras.test.ts` en Windows), §6.3 (dos suites 16, opcional), §6.5
  (`.env.local`), §6.6 (etiquetas `workdir` y `edge_runtime` con código 255),
  §6.7 y §6.8. *Situación posterior: ver §14.*

### 13.5 Siguiente paso recomendado: Fase C (NO autorizada todavía)

Validar la aplicación web **local** antes de abordar el alojamiento externo
(§12, Fase D).

### 13.6 Objetivos de la Fase C (preparados, sin ejecutar)

1. **Revisar `Abrir_TradePilot.bat` y sus scripts** antes de ejecutarlos.
   Qué arranca (`supabase start`, sobre qué volumen y desde qué carpeta, por
   §6.6), qué escribe en `.env.local`, y que no ejecuta `migration up` ni
   seed.
2. **§6.1**: proponer, y aplicar si se autoriza, `npm run build:packages`
   antes de la web en el lanzador, sin `migration up`.
3. **§6.5**: comprobar si existe `apps/web/.env.local` sin abrirlo ni
   mostrarlo, y cómo lo genera el lanzador (solo URL local y anon key).
4. **§6.6**: entender por qué los contenedores llevan la etiqueta `workdir`
   de Descargas y por qué `edge_runtime` sale con 255, y decidir si afecta al
   arranque.
5. **Recorrido en el navegador**: login con enlace mágico (correo local de
   Supabase), ver las 2 Cuentas, pantallas de BUILD 024 (fecha y hora en la
   apertura, el parcial y el cierre; aviso de registro a posteriori), la
   navegación móvil y la importación.
6. **Decisión necesaria antes del paso 5**: el recorrido completo **escribe en
   la base real**, y Operaciones, eventos de capital y `audit_log` no se
   pueden borrar. Opciones:
   - **(a)** solo navegación y lectura sobre la base real;
   - **(b)** pruebas de escritura en un entorno restaurado y aislado (por
     ejemplo, la copia 165054);
   - **(c)** aceptar operaciones de prueba permanentes en las Cuentas reales
     (no recomendado).
7. Antes de cualquier escritura en la base real, una copia nueva con
   `respaldo.ps1`.
8. Opcional, con autorización: corregir §6.2 y §6.7.

> Avance (§14): los objetivos 1, 3 y 4 se han **auditado en solo lectura**,
> sin corregir nada. Los objetivos 2, 5, 6, 7 y 8 siguen pendientes.

## 14. Sesión 3 (continuación) · 2026-10-24 · Auditoría local de la Fase C

Solo lectura, con cada bloque autorizado expresamente. **No se ha ejecutado
`Abrir_TradePilot.bat` ni se ha modificado**, y no se ha arrancado, parado ni
reiniciado ningún servicio. Tampoco se han cambiado ficheros de configuración
ni reglas de red, ni se ha conectado nadie a PostgreSQL. Las rutas personales
aparecen como `%USERPROFILE%`.

### 14.1 Auditoría estática de `Abrir_TradePilot.bat`

- Trabaja en la carpeta del clon (`cd /d "%~dp0"`, línea 22), así que
  `supabase` lee `supabase/config.toml` → `project_id = "tradepilot-r"`. No
  invoca ningún `.ps1` del proyecto. Solo usa PowerShell en línea para el
  puerto 3000 y se relanza para abrir el navegador (línea 267).
- Línea 157: `call supabase start`, **sin condiciones**. Su código de salida
  se ignora (líneas 158-159).
- Líneas 178-182: `supabase status -o env`; solo lee `API_URL` y `ANON_KEY`.
- Líneas 202-204: si existe `apps/web/.env.local`, lo copia con `copy /y`
  sobre `.env.anterior.local` (**una sola generación** de respaldo) y lo
  reescribe con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Nunca usa la `service_role`. Ambos ficheros están ignorados por git (regla
  `*.local`).
- Líneas 216-244: dos `curl` con la anon key a `listar_empresas` y
  `listar_lotes_importacion`. Son `language sql`, `security invoker` y solo
  hacen `select … where user_id = auth.uid()`: no escriben nada.
- Línea 282: `npm run dev --workspace=@tradepilot/web` (`next dev -H
  127.0.0.1`, puerto 3000) **sin `build:packages`** (§6.1).
- Línea 141: `npm install`, y no `npm ci`, solo si falta `node_modules`.
- Si `status` no devuelve datos, el lanzador **recomienda** `supabase stop` y
  `supabase start` (líneas 324-351). No los ejecuta, pero recrearían
  contenedores.
- `Cerrar_TradePilot.bat:39` ejecuta `supabase stop`.

### 14.2 Contenedores y `supabase status` (observado)

- Docker Desktop en marcha (29.8.2). Hay **9 contenedores**, todos del
  proyecto `tradepilot-r` (`com.supabase.cli.project` y
  `com.docker.compose.project`), en la red `supabase_network_tradepilot-r`,
  creados el 2026-10-18. No hay contenedores duplicados ni de otro proyecto.
- `supabase_db_tradepilot-r`: `running`, `healthy`, 0 reinicios,
  `unless-stopped`. Volumen original `supabase_db_tradepilot-r` montado en
  `/var/lib/postgresql/data`.
- Activos: Auth (healthy; 5 reinicios acumulados al abrir Docker hoy),
  Kong, REST, Storage, Inbucket/Mailpit, pg_meta y Studio.
- `supabase_edge_runtime_tradepilot-r`: **exited (255)**, política `no`.
- El CLI también lista como «stopped» realtime, imgproxy, analytics, vector y
  pooler, que **no tienen contenedor creado**.
- Los 9 llevan `com.supabase.cli.workdir` =
  `%USERPROFILE%\Downloads\TradePilot-R-Windows\tradepilot-r`, que **no es el
  clon actual**.
- **Kong monta `magic-link.html` desde esa carpeta** (como plantilla de magic
  link y de confirmación), y **Studio monta sus `snippets` desde allí**. La
  plantilla antigua y la del clon tienen el mismo contenido; solo cambian los
  saltos de línea (CRLF/LF).
- `supabase status -o json`, ejecutado desde el clon: **exit 0, JSON válido**
  con 17 propiedades. Incluye `API_URL` y `ANON_KEY` (valores no mostrados ni
  guardados). La API declarada es `http://127.0.0.1:54321`. Avisó de
  «Stopped services», `edge_runtime` incluido.
  - **Disponibilidad declarada frente a comprobada**: Kong estaba sano y el
    puerto 54321 publicado y escuchando. **No se hizo ninguna petición HTTP**
    a la API, así que no hay prueba funcional directa.

### 14.3 `edge_runtime` (código 255)

- `docker logs`: solo 2 líneas de arranque del 2026-10-18. **No revelan la
  causa** de la salida 255. `inspect`: `State.Error` vacío y
  `OOMKilled=false`.
- Terminó el 2026-10-21 a las 17:58:56 UTC. El registro de Docker Desktop
  muestra que su backend se relanzó unos 24 s antes (17:58:32 UTC).
- **Hipótesis, no demostrada**: un cierre o reinicio no limpio del backend.
  Con la política `no`, el contenedor no volvió a arrancar. **No hay evidencia
  suficiente para una causa definitiva.**
- La app no usa funciones Edge: `supabase/functions` solo contiene `sql/`.
- No se reinició ni se modificó su configuración.

### 14.4 Código de Supabase CLI v2.121.0

Se leyó el código fuente oficial de esa versión exacta (etiqueta `v2.121.0`,
commit `8a549dff…`) sin ejecutarlo ni instalar otra versión. El paquete npm
instalado lanza el **CLI en TypeScript** (`apps/cli`) con el backend «legacy»:
`config.toml` no tiene `[experimental] stack`, no hay `config.json` ni
`SUPABASE_EXPERIMENTAL_STACK` (`start/SIDE_EFFECTS.md:3-10`). Según el código:

1. **La base existe y está en marcha**: va a `reportAlreadyRunningStatus()`,
   que hace `inspect`, un listado por etiqueta y muestra el estado, y termina
   **sin recrear la pila** (`start.handler.ts` L588, L628-651, L653-706;
   `SIDE_EFFECTS.md` L222).
2. **La base está en marcha pero aún no está sana**: devuelve
   `StatusDbNotReadyError` (exit 1) en vez de recuperar (L671-675).
3. **`edge_runtime` parado con la base en marcha**: solo se lista en
   «Stopped services» y se excluye. Esa rama no intenta arrancarlo
   (L678-691).
4. **Base parada (recuperación)**: `dockerRemoveAll` elimina y recrea los
   contenedores del proyecto que encuentra por la etiqueta
   `com.supabase.cli.project`, **sea cual sea su `workdir`**, con
   `deleteVolumes=false`, de modo que **los volúmenes se conservan** (L642-647,
   L1673-1707; `docker-remove-all.ts` L145-156 y L191-196). Con un volumen
   existente no se aplican migraciones ni seed (`SIDE_EFFECTS.md` L38-58).
5. **El arranque falla**: el rollback elimina por etiqueta los contenedores y
   solo borra el volumen si se acaba de crear en ese arranque. Los volúmenes
   preexistentes se conservan (L1668-1669; `SIDE_EFFECTS.md` L232-244).
6. **La etiqueta `workdir` antigua no cambia la identificación de la base**,
   que se hace por el nombre `supabase_db_<project_id>` (`docker-ids.ts`
   L50-56). La etiqueta solo sirve para limpiar secretos temporales (L66-72;
   handler L1691-1694).

Además, en la rama de «ya en marcha» no se escribe ningún fichero: la carpeta
`snippets` se crea después (L826).

Sigue sin comprobar qué imágenes usaría la 2.121.0 si tuviera que recrear la
pila. **Conclusión operativa**: el código explica por qué un `supabase start`
puede ser inocuo con la base ya en marcha, pero **no justifica ejecutar el
lanzador sin precomprobaciones**.

### 14.5 Cortafuegos y puertos (hallazgo de seguridad)

- Los puertos 54321 (Kong/API), 54322 (PostgreSQL), 54323 (Studio) y 54324
  (Mailpit) están publicados en **todas las interfaces IPv4 e IPv6**
  (`com.docker.backend`), además de las escuchas locales en `127.0.0.1` y
  `::1` (`wslrelay`).
- Red activa: Wi-Fi con perfil Privado. La acción de entrada por defecto es
  `NotConfigured`, que equivale a bloquear.
- Hay una **regla local de entrada habilitada** para
  `com.docker.backend.exe`: Allow, TCP y UDP, **cualquier puerto y cualquier
  dirección remota**, en los perfiles Privado y Público.
- No hay reglas de bloqueo para esos puertos ni reglas de directiva de grupo
  que los afecten.
- El cortafuegos de Hyper-V/WSL (bloqueo de entrada por defecto) es
  independiente de esa regla del proceso de Windows. No deben confundirse.
- **Conclusión**: la configuración **podría permitir conexiones entrantes**
  desde otros equipos si el resto de la ruta de red lo permite. **No se probó
  desde otro equipo**, así que el acceso remoto **no está demostrado**.
  - Riesgo: PostgreSQL local con la contraseña local por defecto y Studio sin
    autenticación.
  - No se ha cambiado el cortafuegos ni los puertos: requiere una
    autorización independiente.

### 14.6 Pendientes, por orden recomendado (ninguno autorizado todavía)

1. Antes de `supabase start`, comprobar que `supabase_db_tradepilot-r` está
   en marcha y sana y que monta el volumen esperado. Si no, detener el
   lanzador en lugar de dejar que el CLI recupere la pila (§14.4.4).
2. Tratar el código de salida de `supabase start` y no continuar como si
   hubiera ido bien.
3. Añadir `npm run build:packages` antes de iniciar Next.js (§6.1).
4. Proteger `.env.local` de sobrescrituras: valorar copias con fecha y una
   comprobación del origen antes de escribirlo.
5. Decidir por separado si se desactiva `edge_runtime` en la configuración
   local. No hacerlo automáticamente.
6. En una fase posterior, eliminar la dependencia de la plantilla y los
   `snippets` montados desde Descargas. No detener ni recrear ahora la pila.
7. Revisar la exposición de los puertos en el cortafuegos (§14.5), en una
   operación independiente y expresamente autorizada.
8. Siguen pendientes §6.2 (`fronteras.test.ts`), §6.7 y el resto de la Fase C
   (§13.6: el recorrido en el navegador y su decisión previa).

> Avance (§15): los puntos 1, 2 y 3 están **implementados en `ae06815`**,
> sin ejecutar el lanzador completo. Los puntos 4 a 8 siguen pendientes.

## 15. Sesión 3 (continuación) · 2026-10-25 · Corrección del lanzador

Registro hecho el 2026-10-25 a las 09:38 (+01:00). No se ha repetido ninguna
prueba en este registro; solo se ha comprobado el estado de git.

### 15.1 Commit

| | |
|---|---|
| Hash | `ae0681585ae425d6f67f86949701a52d49014b43` |
| Mensaje | `fix: proteger arranque local de TradePilot` |
| Autor local | `Claude <noreply@anthropic.com>` |
| Padre | `35bbbe6` (auditoría de la Fase C, §14) |
| Alcance | **Solo** `tradepilot-r/Abrir_TradePilot.bat` (137 líneas añadidas, 18 eliminadas) |
| Publicación | **Local**. No está en el remoto; no se ha hecho push, merge ni pull request |

Tras el commit, el árbol quedó limpio. No es un despliegue: TradePilot R
**sigue sin estar alojado** en ninguna URL externa (Fase D, §12).

### 15.2 Cambios del lanzador

- Define la identidad esperada de la base original: contenedor y volumen
  `supabase_db_tradepilot-r` y proyecto `tradepilot-r` (`TP_DB`, `TP_VOL`,
  `TP_PROY`).
- Nueva subrutina `:verificar_base`, solo de lectura (`docker info`,
  `docker inspect`, `docker volume inspect`). Comprueba que Docker responde,
  que el contenedor existe, está en marcha y `healthy`, que lleva la etiqueta
  de proyecto esperada y que el volumen esperado está montado en
  `/var/lib/postgresql/data`.
- Si cualquier comprobación falla, el lanzador **se detiene** con el motivo.
  No intenta recuperar, arrancar ni reiniciar servicios.
- Ejecuta `npm run build:packages` antes de iniciar la web y se detiene si la
  compilación falla (§6.1).
- Comprueba el código de salida de `supabase start` (se detiene si no es 0)
  y vuelve a ejecutar `:verificar_base` antes de continuar (§6.10).
- Retira la recomendación de ejecutar a mano `supabase stop` y
  `supabase start` cuando falla la lectura de `supabase status`. Ahora avisa
  de que **no** se ejecuten y pide revisarlo a mano.

### 15.3 Validaciones realizadas (antes del commit)

- `:verificar_base` se probó **por separado**, con operaciones de solo
  lectura. Identificó correctamente la base original, rechazó estados e
  identidades incorrectos y verificó el volumen.
- `npm run build:packages`: exit 0; compiló los seis paquetes internos. Los
  ficheros versionados no cambiaron por la compilación.
- Revisión estática de etiquetas, rutas de error y propagación del código de
  salida.
- **El lanzador completo NO se ha ejecutado.** El arranque completo de la
  aplicación **no está validado**.

### 15.4 Riesgos y pendientes (ninguno autorizado todavía)

1. Ejecutar el lanzador de forma controlada y comprobar el resultado real.
2. Recorrido funcional en el navegador, **después** de decidir qué acciones
   pueden escribir de forma permanente en la base original (§13.6.6).
3. Proteger mejor `.env.local`: sigue pudiendo sobrescribirse con una única
   copia previa (§6.5, §14.6.4).
4. Investigar la salida 255 de `edge_runtime`; la causa sigue sin demostrarse
   (§14.3).
5. Resolver la dependencia de los contenedores actuales respecto a los
   ficheros montados desde la carpeta antigua de Descargas (§6.6, §14.6.6).
6. Revisar la exposición de los puertos 54321-54324 y la regla del
   cortafuegos; requiere una autorización independiente (§14.5).
7. Siguen abiertos §6.2 (`fronteras.test.ts` en Windows), §6.3, §6.7 y §6.8.

### 15.5 Estado de git al registrar

- Antes de este registro: rama `claude/tradepilot-r-build024-rescate`, HEAD
  `ae06815`, **4 por delante** y 0 por detrás de `origin` (en `1252d18`).
  Sin stash.
- Esta actualización del documento se confirmó después en un commit local
  aparte (`docs: registrar corrección del lanzador`), autorizado por el
  usuario. Con él, la rama va 5 por delante. Sin push.

> Avance (§16): el punto 1 de §15.4 (ejecutar el lanzador de forma
> controlada) está **hecho**. El punto 2 (recorrido funcional) sigue
> pendiente, y la ejecución añadió riesgos nuevos (§16.6).

## 16. Sesión 3 (continuación) · 2026-10-25 · Primera ejecución controlada del lanzador

Registro hecho el 2026-10-25 a las 11:23 (+01:00). Cada paso tuvo una
autorización expresa: preparar el plan, revalidar la base con Docker abierto
y ejecutar el lanzador una sola vez. Docker Desktop ya estaba abierto (desde
las 10:55); no lo abrió Claude.

### 16.1 Arranque técnico

- **Comprobaciones previas** (11:13, solo lectura), todas satisfactorias:
  - Git en `ef94ce8`, árbol limpio.
  - Docker 29.8.2, contexto `desktop-linux`.
  - `supabase_db_tradepilot-r` `running` y `healthy`, 0 reinicios, etiqueta
    `tradepilot-r`, con el volumen original montado en
    `/var/lib/postgresql/data`. Ningún otro contenedor usa el volumen.
  - Volumen `local`, del proyecto `tradepilot-r`, creado el 2026-10-18.
  - Los 9 contenedores son del proyecto, creados el 2026-10-18, sin
    duplicados.
  - Puerto 3000 libre. No existían ni `.env.local` ni `.env.anterior.local`.
- **`Abrir_TradePilot.bat` se ejecutó una sola vez** (11:15:33), autorizado
  por el usuario, en una consola visible. Su salida pasó por un filtro
  temporal que tapaba secretos (ver §16.6.1).
- Pasos 1-6 del lanzador: «[OK]» (carpeta, puerto 3000, Node v24.21.0,
  Docker, CLI de Supabase y dependencias ya instaladas).
- `npm run build:packages`: **exit 0**, los seis paquetes compilados.
- `:verificar_base`: **satisfactorio** antes y después de `supabase start`.
- `supabase start`: **código 0**. Tomó la rama «ya en marcha» y listó como
  parados realtime, imgproxy, edge_runtime, analytics, vector y pooler.
  **No recreó la pila**: los 9 contenedores conservan su fecha de creación.
- `supabase status -o env`: configuración leída; `.env.local` escrito (§16.4).
- Funciones SQL, comprobadas también por separado con la anon key, sin
  mostrarla y sin guardar los cuerpos de las respuestas:
  - `listar_empresas` → **HTTP 200**;
  - `listar_lotes_importacion` → **HTTP 200**.

  Las dos devolvieron una lista vacía, lo esperado sin usuario
  (`auth.uid()` nulo).
- **Next.js 15.5.28** arrancó (`Ready in 15.3s`) y escuchó **solo** en
  `127.0.0.1:3000`.
- Una petición sin cookies a `/` respondió **307** hacia el login, y
  `/login` respondió **200**: título «TradePilot R», un campo de email y el
  botón «Enviar enlace de acceso». No se pulsó nada.
- Aviso de Next.js: detectó **dos `package-lock.json`** y tomó como raíz del
  workspace el del repositorio padre.

### 16.2 Sesión previa en Chrome

- Chrome ya estaba abierto (desde las 09:21) con una pestaña «TradePilot R» y
  una **sesión anterior**, del 2026-10-18.
- El registro de Next.js mostró **`GET /cuentas` con HTTP 200**. Esa petición
  no la hizo Claude: se deduce que vino de esa pestaña.
- **No se verificó visualmente** la pantalla de esa pestaña ni se interactuó
  con la aplicación. No hubo ninguna petición POST ni acción de servidor.
- Por ser una pantalla inesperada (condición de parada), el servidor local se
  **detuvo con Ctrl+C** en su consola a las 11:17:51. **No se ejecutó
  `Cerrar_TradePilot.bat`.** El puerto 3000 quedó libre.

**Conclusión**: la ejecución técnica funcionó, pero la **validación visual
completa con una sesión limpia sigue pendiente**.

### 16.3 Efectos en la base de datos (comprobaciones posteriores, solo lectura)

Docker y consultas SQL con `default_transaction_read_only=on`, solo
`select`:

- La base original siguió `running` y `healthy`, con el mismo volumen, **0
  reinicios** y la misma hora de arranque.
- 19 migraciones (última `20261018120000`) y 23 tablas en `public` (las 21
  anteriores más las 2 de la importación).
- **Recuentos de dominio sin cambios**: `accounts` 2,
  `account_capital_events` 2, `account_risk_state` 2, `domain_events` 2,
  `profiles` 1, `prop_firms` 1, `trades` 0, `import_batches` 0,
  `imported_trade_rows` 0.
- **Sí hubo escrituras en `auth`** a las 11:16:33, al cargar la pestaña de
  Chrome:
  - renovación de la sesión anterior;
  - creación de un refresh token nuevo y revocación del anterior;
  - entradas nuevas en `auth.audit_log_entries`.

  El último inicio de sesión del usuario sigue siendo el del 2026-10-18.
- No se creó una sesión nueva desde el formulario y no se pidieron enlaces
  mágicos. Tampoco se crearon operaciones, cuentas, eventos de capital ni
  importaciones.

**El arranque no estuvo libre de efectos secundarios**: la renovación de
Auth modificó datos de autenticación de la base original.

### 16.4 Archivos de entorno

- `apps/web/.env.local` se **creó** durante el arranque (11:16:02), con 2
  líneas: la URL local `http://127.0.0.1:54321` y una anon key (rol `anon`).
  No contiene la `service_role`.
- La comprobación fue privada: **no se revelaron los valores** de las claves
  ni se incluyeron en ningún registro.
- `.env.anterior.local` **no se creó**.
- `.env.local` es **confidencial**: está ignorado por git y no debe
  publicarse ni copiarse.
- El lanzador también dejó `supabase-status.err` (ignorado por git).

### 16.5 Estado final

- El lanzador completo **se ejecutó una vez**.
- El servidor web local **está detenido**.
- **Docker y Supabase siguen en marcha.** No se han parado ni reiniciado.
- **No se crearon datos de dominio** de prueba.
- Hubo una **renovación de Auth no prevista** (§16.3).
- No se ha desplegado la aplicación ni se han transferido datos a servicios
  externos.
- Git: ningún cambio de código. Solo este registro, en un commit local.

### 16.6 Riesgos descubiertos, por prioridad (ninguno autorizado todavía)

1. **`supabase start` imprime secretos en la consola.** Con la pila ya en
   marcha, muestra un JSON de estado que incluye `SERVICE_ROLE_KEY`,
   `JWT_SECRET`, claves S3 y la URL de la base con credenciales. En esta
   ejecución los tapó un filtro **temporal y externo al lanzador**, que no
   protege una apertura normal con doble clic.
2. **Origen `localhost` frente a `127.0.0.1`.** La redirección fue a
   `localhost:3000`, mientras que Next.js escucha en `127.0.0.1:3000`, y las
   cookies de los dos orígenes son distintas. Revisar el origen que usa el
   middleware y la configuración de URL (incluido `site_url`, §12.1) antes de
   repetir la prueba.
3. **Comprobación de funciones SQL débil** (`Abrir_TradePilot.bat`, paso
   10): solo trata el 404 como fallo. Un 401, un 500 o una respuesta vacía
   se dan por buenos, si falta `curl` se salta la comprobación y, tras el
   aviso «[!]», el `pause` deja continuar hasta la web. Esta vez las dos
   devolvieron 200, pero el código necesita mejorarse.
4. **Sesión anterior en Chrome.** Provocó la renovación de Auth contra la
   base real. Antes de una nueva prueba, usar un **perfil de navegador
   limpio** y no interactuar con la sesión anterior.
5. Aviso de Next.js por los **dos lockfiles**.
6. Siguen pendientes: `edge_runtime` con código 255 (§14.3), los montajes
   desde Descargas (§14.2) y la exposición de los puertos 54321-54324
   (§14.5; el acceso desde otro equipo sigue sin demostrarse). También
   `.env.local` con una sola copia (§6.5), `fronteras.test.ts` (§6.2) y el
   recorrido funcional, con su decisión previa (§13.6.6).

> Avance (§17): los riesgos 1 a 4 están corregidos en el código y probados
> en aislamiento. El 5 y el 6 siguen pendientes.

## 17. Sesión 3 (continuación) · 2026-10-25 · Protección del lanzador (fases A1 + B)

Registro hecho el 2026-10-25 a las 16:19 (+01:00). Cambios autorizados:
modificar el lanzador, crear scripts auxiliares, probarlos en aislamiento y
actualizar la documentación. **No se ha ejecutado el lanzador completo**, no
se ha tocado Docker, Supabase, PostgreSQL ni el cortafuegos, y ninguna prueba
ha llamado a las funciones SQL reales.

### 17.1 Cambios

| Fichero | Cambio |
|---|---|
| `Abrir_TradePilot.bat` | `supabase start >nul 2>&1`: su salida (con `SERVICE_ROLE_KEY`, `JWT_SECRET`, claves S3 y la URL de la base) no se ve ni se guarda; se conserva su código de salida y, si no es 0, se para con el código y un resumen de nombre y estado de los contenedores (`:resumen_contenedores`). `supabase status -o env` se lee en memoria con la salida de error a `nul`; ya no se crea ni se muestra `supabase-status.err` (se borra el antiguo). Los pasos 9 y 10 llaman a los dos scripts nuevos y paran si fallan, sin pausa que deje seguir; sin PowerShell, se para. `TP_ANON` se quita del entorno antes de la web. Origen local único `http://localhost:3000` (mensajes, incluido el de puerto ocupado, comprobación y navegador). `TP_NO_ABRIR_NAVEGADOR=1` no abre el navegador |
| `scripts/windows/escribir-env-local.ps1` (nuevo) | `.env.local`: lo crea si no existe; no lo toca si es local y con la misma clave; respaldo fechado `.env.respaldo-AAAAMMDD-HHMMSS.local` y reescritura si solo cambia la clave; se niega (sin tocar nada) si apunta a otro Supabase, tiene variables de más, repetidas, comentarios o comillas, o no se puede leer. Escritura atómica. Lee la URL y la clave del entorno; no las muestra |
| `scripts/windows/comprobar-funciones.ps1` (nuevo) | `listar_empresas` (POST `{}`) y `listar_lotes_importacion` (GET), los mismos métodos y cabeceras que el `curl` anterior. Solo vale HTTP 200 con JSON de tipo array; tiempo de espera de 10 s. No muestra la clave, la URL ni los cuerpos |
| `COMO-EMPEZAR.md` | `127.0.0.1:3000` → `localhost:3000`, con el motivo; la nota que invitaba a «elegir uno» ahora recomienda `localhost`. El buzón local sigue en `127.0.0.1:54324` |
| `docs/context/10_CURRENT_STATUS.md` | Descripción del lanzador al día |
| `.gitignore` | Solo el comentario de `supabase-status.err` (la regla se mantiene) |

No se ha cambiado el middleware: con un único origen `localhost` basta para la
prueba local, y en Vercel `request.url` ya es el dominio real.

Además, se corrigió un aviso de `fin_base_no_valida` introducido en `ae06815`
que hacía fallar `lanzadores.test.ts` («db reset» en una línea sin la
negación). Ese test no se ejecutó en §15.

### 17.2 Decisión sobre el origen local

`COMO-EMPEZAR.md` pedía usar `127.0.0.1` porque `localhost` podía resolverse
primero a `::1`. Se cambia a `localhost` porque Next.js 15.5.28 reescribe
`127.0.0.1` a `localhost` al redirigir (§16.6.2), así que `127.0.0.1` nunca
era un origen estable. Next.js sigue escuchando solo en `127.0.0.1` (lo vigila
`lanzadores.test.ts`); en §16 una petición a `localhost:3000` llegó al
servidor y respondió 200.

### 17.3 Pruebas (aisladas, en el directorio temporal de la sesión)

- **Bloques reales del `.bat`**, extraídos del fichero, con `supabase.cmd` y
  `docker.exe` ficticios por delante en el `PATH` (secretos inventados):
  **23/23**. `start` con códigos 0, 1 y 7: sin secretos en pantalla, el código
  se conserva, con un código distinto de 0 se para sin llegar a Next.js y
  muestra el resumen. `status`: lee URL y clave, no muestra nada, borra el
  `.err` antiguo y no deja ficheros. Navegador: con `=1` no abre; sin
  definir o con `=0`, abre.
- **`comprobar-funciones.ps1`** contra un servidor HTTP ficticio en
  `127.0.0.1` (puerto elegido por el sistema): **65/65**, dos veces seguidas,
  unos 50 s. Pasan solo 200 con `[]` y 200 con un array no vacío. Se rechazan,
  cada uno por su motivo: `{}`, cuerpo vacío, texto, `[` roto, 401, 404, 500,
  uno bien y otro 404, y el tiempo de espera agotado. Mismos métodos, rutas y
  cabeceras que antes. Faltar la URL o la clave, una URL con credenciales o
  que no sea http, y que nadie escuche: todo da error. El bloque real del
  paso 10: con 200 sigue y vacía `TP_ANON`; con 404 va a `fin_funciones`.
- **`escribir-env-local.ps1`** sobre carpetas temporales con claves
  ficticias: **29/29** (inexistente, idéntico, otra clave con dos respaldos
  sucesivos y `.env.anterior.local` intacto, URL alojada, variables de más,
  falta una clave, repetida, comentario, comillas, espacios, binario,
  bloqueado por otro proceso, y entrada de Supabase mala). Las pruebas
  encontraron un fallo real que se corrigió: `[IO.File]::Replace` con `$null`.
- `git check-ignore`: `.env.respaldo-*.local` ignorado (regla `*.local`).
- `lanzadores.test.ts`: **8/8**.

Incidencia del arnés: una primera versión del servidor ficticio se bloqueó.
Elegía un puerto al azar que podía coincidir con servicios de Windows
(49664-49669), no esperaba al cuerpo del POST y no tenía límite de duración.
Se detuvieron solo sus dos procesos, por PID. Los resultados de esa versión
no cuentan.

### 17.4 Sin verificar

- El lanzador completo con estos cambios.
- Que el `.env.local` real se clasifique como «sin cambios»: lo creó el
  lanzador anterior con el mismo formato, pero no se ha leído.
- El comportamiento con la salida real de Supabase CLI 2.121.0 (el formato
  de `status -o env` es el que ya se leía en §16).

### 17.5 Siguiente paso (NO autorizado)

La fase D del plan: cerrar la pestaña antigua de Chrome; ejecutar el lanzador
con `TP_NO_ABRIR_NAVEGADOR=1`; abrir un Chrome con un perfil temporal en
`http://localhost:3000`; y hacer, en solo lectura, una foto de `auth` y de
los recuentos antes y después.

### 17.6 Riesgos pendientes

1. **Validación con un navegador limpio** (§17.5): el lanzador completo
   **no se ha vuelto a ejecutar** después de estos cambios.
2. **Exposición de los puertos 54321-54324** (§14.5): la regla del
   cortafuegos requiere una autorización aparte. El acceso desde otro equipo
   sigue sin demostrarse.
3. **Aviso de los dos lockfiles** de Next.js (§16.6.5): el siguiente cambio
   previsto (`outputFileTracingRoot`). No se borra el lockfile de la raíz:
   pertenece a otra aplicación.
4. **`edge_runtime`** con código 255 (§14.3): no bloquea; se puede aplazar.
5. **Montajes desde Descargas** (§14.2): se pueden aplazar. **No borrar
   `%USERPROFILE%\Downloads\TradePilot-R-Windows`** mientras existan los
   contenedores actuales.
6. Siguen abiertos `fronteras.test.ts` (§6.2), el recorrido funcional con su
   decisión previa (§13.6.6) y la tabla de problemas de `COMO-EMPEZAR.md`,
   que aún recomienda `supabase stop && supabase start` para la plantilla de
   correo (fuera del alcance de este cambio).

> Avance (§18): el punto 3 (aviso de los dos lockfiles) está **resuelto**.

## 18. Sesión 3 (continuación) · 2026-10-25 · Raíz de trazado de Next.js

Registro hecho el 2026-10-25 a las 17:34 (+01:00). Sin lanzador, sin
Supabase, sin Docker, sin PostgreSQL y sin peticiones HTTP a la aplicación.

### 18.1 Causa

La raíz de git (`%USERPROFILE%\Proyectos\tradepilot-r`) contiene **otra
aplicación** (NutriPlan: Vite y React, con despliegue en GitHub Pages) con su
`package.json` y su `package-lock.json`, ambos versionados y en uso. El
monorepo de TradePilot R está en la subcarpeta `tradepilot-r\`, con su propio
`package-lock.json` y los workspaces `apps/*` y `packages/*`. Sin indicarle la
raíz, Next.js toma el lockfile más alto y avisa («inferred your workspace
root»). **Ninguno de los dos lockfiles sobra.**

### 18.2 Cambio

Solo `apps/web/next.config.mjs`: se importa `fileURLToPath` de `node:url` y se
añade `outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url))`.
Las demás opciones (`serverActions.bodySizeLimit`, `serverExternalPackages`)
no cambian.

- **Ruta efectiva** (comprobada con Node desde un directorio de trabajo
  ajeno al proyecto): `%USERPROFILE%\Proyectos\tradepilot-r\tradepilot-r\`.
  Tiene `package.json`, `apps` y `packages`; no es la raíz de git ni
  `apps/web`, y no está en Descargas.

### 18.3 Pruebas

- `npm run build` desde la raíz del monorepo: compila los seis paquetes con
  `tsc` y después `next build` (el script no toca Docker, Supabase ni SQL).
  **Exit 0** en 166 s; 12 páginas estáticas generadas y middleware. **Sin el
  aviso** de raíz ni de lockfiles. Las dos variables `NEXT_PUBLIC_SUPABASE_*`
  llevaban valores **ficticios** en el proceso (Next.js les da prioridad
  sobre `.env.local`), así que la compilación no usó la clave real ni pudo
  contactar con Supabase.
- `next dev -H 127.0.0.1 -p 3187`, con los mismos valores ficticios y un
  límite de 90 s: `Ready in 6.4s`, escuchando **solo** en `127.0.0.1:3187`,
  **sin el aviso**. No se hizo ninguna petición HTTP. Se detuvo solo su árbol
  de procesos (por PID); el puerto quedó libre.
- **Lockfiles intactos**: el SHA-256 de los dos es el mismo antes y después,
  y git no los marca como modificados.
- No se repitieron las pruebas del lanzador, las de `.env.local` ni las HTTP
  ficticias: este cambio no las afecta.

### 18.4 Pendiente y siguiente paso

- Siguen los riesgos 1, 2, 4, 5 y 6 de §17.6. El lanzador completo **no se ha
  vuelto a ejecutar**, y la aplicación **no está desplegada**.
- En Vercel, `outputFileTracingRoot` coincide con la raíz del workspace
  prevista (§12, fase F). Se comprobará al configurar el proyecto.
- **Siguiente paso recomendado** (NO autorizado): la validación controlada
  con un perfil de navegador limpio (§17.5).

---

## PROMPT PARA REANUDAR MAÑANA

```text
Continuamos el rescate de BUILD 024 de TradePilot R en Windows, en una sesión
nueva de Claude Code. No tienes acceso a la conversación anterior.

Repositorio: %USERPROFILE%\Proyectos\tradepilot-r
Aplicación:  %USERPROFILE%\Proyectos\tradepilot-r\tradepilot-r
Rama:        claude/tradepilot-r-build024-rescate (en origin hasta 1252d18;
             commits posteriores solo locales)

1. Lee primero tradepilot-r/docs/context/12_BUILD024_RESCUE_HANDOFF.md
   completo. Después tradepilot-r/AGENTS.md y los documentos de contexto que
   el registro señale (10_CURRENT_STATUS.md, 03_DATABASE.md).
2. Verifica la rama, `git status --short --branch` y
   `git log --oneline 620cb42..HEAD`, y compáralos con las secciones 1, 2 y 10
   del registro. Comprueba si ha habido commits o cambios posteriores a los
   registrados.
3. Si el estado coincide, continúa directamente desde la sección 9
   («Siguiente acción»). No vuelvas a hacer auditorías, comparaciones de
   carpetas, npm ci, typecheck, lint, tests, builds, regeneración del esquema
   ni suites SQL ya documentados como hechos, salvo que hayan cambiado los
   ficheros relevantes, haya un motivo técnico concreto o un resultado sea
   dudoso; si repites algo, di por qué.
4. Si encuentras discrepancias (commits nuevos, cambios sin confirmar, otra
   rama, ficheros distintos), para, explícalas y resuélvelas sin descartar
   cambios: nada de reset, checkout de ficheros, clean ni stash drop.
5. Antes de cualquier paso de la sección 9, pídeme autorización explícita
   para ESE paso. Lo que diga el registro no es una autorización.

Restricciones (las mismas de la sesión anterior; el registro no las relaja):
- No arranques, pares ni reinicies contenedores de Supabase; no ejecutes
  supabase start, supabase db reset, supabase migration up, supabase migration
  repair ni SQL manual de escritura contra la base original
  (volumen/contenedor supabase_db_tradepilot-r).
- No conectes pruebas a la base original. Para SQL usa solo una base
  desechable cuyo aislamiento demuestres (sin montajes del volumen original,
  sin red, system_identifier distinto); si no puedes, no lo hagas y documéntalo.
- No restaures copias. No toques el backup
  %USERPROFILE%\Backups\TradePilot\tradepilot_pg_dumpall_2026-10-18_213427.sql.
- No abras ni muestres .env.local; no metas en git secretos, .env.local,
  next-env.d.ts ni artefactos de diagnóstico.
- No hagas push, merge ni cambios en otras ramas. No abras la web.
- No modifiques %USERPROFILE%\Downloads\TradePilot-R-Windows ni
  %USERPROFILE%\Downloads\TradePilot-R-Windows_1 (solo lectura).
- No recuperes el Abrir_TradePilot.bat antiguo (migration up automático) ni
  el postinstall de package.json.
- No digas que una prueba ha pasado si no la has ejecutado.

Al terminar, actualiza 12_BUILD024_RESCUE_HANDOFF.md con el estado real
(fecha y hora, último commit, pruebas, decisiones, siguiente acción),
confírmalo con un commit local en la misma rama y dame un informe breve.
```
