# 12 · Rescate de BUILD 024 — registro de continuidad

> Documento de traspaso entre sesiones. Describe el **estado real**, no el
> esperado. Si no coincide con `git log` / `git status`, gana git: para y
> aclara la diferencia antes de seguir.
>
> Este documento **no autoriza nada**. Las operaciones permitidas las fija el
> mensaje del usuario de cada sesión.

**Último registro**: 2026-10-22 19:14 (+02:00) · sesión 2 (ver §11)

---

## 1. Dónde

| | |
|---|---|
| Repositorio | `%USERPROFILE%\Proyectos\tradepilot-r` (clon de `github.com/jraimundogonzalez-cmd/jonatan`) |
| Aplicación | `%USERPROFILE%\Proyectos\tradepilot-r\tradepilot-r` |
| Rama de trabajo | `claude/tradepilot-r-build024-rescate` (**solo local, sin push**; historia del registro reescrita en la sesión 2, §11) |
| Respaldo del registro | `rescate/build024-registro-original` (solo local, **no publicar**): la historia anterior del registro, con los identificadores sin anonimizar (`c9ed89b`). No borrar. |
| Partió de | `620cb42` (`claude/tradepilot-r-position-manager-mwbovl`, sin cambios) |
| Último commit de trabajo | `5234494`. El commit que añade **este documento** es el inmediatamente posterior: `git log -1 --format=%h -- tradepilot-r/docs/context/12_BUILD024_RESCUE_HANDOFF.md` |
| Rama auxiliar | `rescate/build024-sobre-3961c27` (solo local): BUILD 024, navegación y lint reconstruidos sobre su base real `3961c27` (`f2a8545`, `ce6fa48`, `a437b0c`). Prueba de procedencia; no trabajar sobre ella. |
| Worktrees | solo la principal (la temporal se eliminó) |

## 2. Estado de git al cerrar

- Rama `claude/tradepilot-r-build024-rescate`, árbol **limpio** tras el commit de este documento.
- Sin upstream (nunca se ha hecho push). Sin stash.
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
| (siguiente) | Este documento, anonimizado (sustituye a `fda1199`, `2d3e74e`, `4e3e5d0` y `c9ed89b`, que siguen en la rama de respaldo) |

## 3. Contexto ya verificado (no repetir)

- Base local real: volumen Docker `supabase_db_tradepilot-r`, montado solo por
  el contenedor `supabase_db_tradepilot-r` (PostgreSQL 17, `unless-stopped`; se
  arranca solo al abrir Docker Desktop). Su `system_identifier` y los números
  de las Cuentas no se publican (ver §11). 2 Cuentas NYS, 0 operaciones, 18 migraciones (última `20261017120000`). Comprobado de nuevo
  en solo lectura a las 22:11: sin cambios.
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
  (624 750 bytes, 18/10/2026 21:34:29).
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
2. `fronteras.test.ts` falla en Windows (separador de rutas). Fuera de alcance; arreglarlo requiere autorización.
3. Dos suites con número 16. Se dejó así a propósito; renumerar es opcional.
4. Push de la rama de rescate a GitHub (para que BUILD 024 no vuelva a existir
   solo en un disco). No autorizado todavía.
5. `.env.local` del clon nuevo: no existe. Según `10_CURRENT_STATUS.md`,
   `Abrir_TradePilot.bat` lo reescribe (guardando el anterior en
   `.env.anterior.local`). No se ha comprobado aquí.
6. Revisar antes de abrir: los contenedores llevan la etiqueta `workdir` de la
   carpeta antigua de Descargas, y `supabase_edge_runtime_tradepilot-r` sale con
   código 255.

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

## 8. Riesgos para la siguiente sesión

- La base real sigue **BLOQUEADA** para el código de `620cb42`. Con esta rama
  está LISTA (verificado en la sesión 2, §11).
- Docker Desktop vuelve a levantar los contenedores de Supabase solo, sobre el
  volumen real. Cualquier herramienta que se conecte a `127.0.0.1:54322` habla
  con la base real: **las pruebas SQL nunca van ahí**.
- `postgres:17` queda descargada; cualquier contenedor desechable nuevo debe
  repetir la demostración de aislamiento (§5).

## 9. Siguiente acción (en orden; cada paso necesita autorización explícita)

1. Revisar esta rama (`git log 620cb42..HEAD`, `git diff 620cb42..HEAD`) y
   decidir sobre §6.1 a §6.4.
2. Si se autoriza: `Diagnosticar_TradePilot.bat` desde esta rama (solo lectura).
   Esperado, sin verificar: LISTA, 0 bloqueos, 1 pendiente (`trade_file_imports`).
3. Si se autoriza: push de `claude/tradepilot-r-build024-rescate`.
4. Fase B (cada paso por separado): `Copia_de_seguridad_TradePilot.bat` →
   (opcional) `Probar_copia_de_seguridad_TradePilot.bat` →
   `Actualizar_TradePilot.bat` → diagnóstico final (LISTA, 0 pendientes).
5. Fase C: resolver §6.1, §6.5 y §6.6; después abrir la web y hacer el recorrido de
   BUILD 024 en el navegador.

## 10. Comprobaciones mínimas para reanudar

```powershell
$r = "$env:USERPROFILE\Proyectos\tradepilot-r"
git -C $r branch --show-current          # claude/tradepilot-r-build024-rescate
git -C $r status --short --branch        # limpio, sin upstream
git -C $r log --oneline 620cb42..HEAD    # 7 commits: a620b51 … 5234494 + este documento
git -C $r show HEAD:tradepilot-r/supabase/migrations/20261017120000_event_times.sql | Out-Null  # existe
git -C $r ls-remote --heads origin claude/tradepilot-r-build024-rescate   # vacío = sin push
# Base real, SOLO LECTURA (solo si el usuario autoriza conectarse):
docker exec -e PGOPTIONS='-c default_transaction_read_only=on' supabase_db_tradepilot-r psql -U postgres -d postgres -X -At -c "select count(*) from supabase_migrations.schema_migrations"   # 18
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

---

## PROMPT PARA REANUDAR MAÑANA

```text
Continuamos el rescate de BUILD 024 de TradePilot R en Windows, en una sesión
nueva de Claude Code. No tienes acceso a la conversación anterior.

Repositorio: %USERPROFILE%\Proyectos\tradepilot-r
Aplicación:  %USERPROFILE%\Proyectos\tradepilot-r\tradepilot-r
Rama:        claude/tradepilot-r-build024-rescate (solo local)

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
