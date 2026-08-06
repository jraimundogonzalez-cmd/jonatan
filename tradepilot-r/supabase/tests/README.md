# Validación de RLS/concurrencia contra Postgres real

Estos scripts no son parte de la suite de tests de TypeScript (`npm test`) —
son validación SQL directa, pensada para ejecutarse contra un Postgres real
(local o un proyecto Supabase de pruebas) cuando se toca RLS, triggers o
funciones atómicas. Ningún test de TypeScript de este monorepo ejecuta RLS de
verdad (los repositorios en memoria de `packages/risk-engine/test` y los
dobles de `apps/web/test` no hablan con Postgres) — esta es la única capa que
lo hace.

**Por qué existen**: al escribir la migración de Risk Engine (BUILD 003), la
primera ejecución contra un Postgres real como superusuario "pasó" dos
comprobaciones de aislamiento que en realidad eran un fallo total de RLS — los
superusuarios (y el propietario de una tabla) están exentos de RLS en
Postgres, sin excepción. Conectar como el rol `authenticated` (no
superusuario, no propietario) reveló el fallo real de inmediato: faltaban las
políticas de INSERT en dos tablas nuevas. Ver el comentario completo en
`00_local_test_setup.sql`.

## Cómo ejecutar

```bash
createdb tradepilot_test
psql -d tradepilot_test -f 00_local_test_setup.sql
for f in ../migrations/*.sql; do psql -d tradepilot_test -f "$f"; done
psql -d tradepilot_test -f ../functions/sql/funding.sql
psql -d tradepilot_test -f ../functions/sql/operations.sql
psql -d tradepilot_test -f 01_funding_management_rls.sql
psql -d tradepilot_test -f 02_risk_engine.sql
psql -d tradepilot_test -f 03_operations_engine.sql
psql -d tradepilot_test -f 04_event_backbone.sql
psql -d tradepilot_test -f 05_rule_engine.sql
psql -d tradepilot_test -f 06_management_intent.sql
```

Cada script imprime lo que espera junto al resultado real (`\echo`) — se lee
a mano, no hay corredor de aserciones automatizado todavía (deuda aceptada,
bajo impacto: son 91 comprobaciones en total, revisables en unos minutos).

Los seis scripts corren contra la **misma** base de datos, uno
detrás del otro — por eso usan usuarios de prueba con UUIDs distintos entre
sí (`1111.../2222...` en el primero, `3333.../4444...` en el segundo,
`7777.../8888...` en el tercero, `9999.../aaaa...` en el cuarto,
`bbbb.../cccc...` en el quinto, `dddd.../eeee...` en el sexto): si compartieran
UUID, dos scripts llamarían a `crear_empresa('Personal', true)` para el mismo
usuario y el `\gset` de `crear_cuenta` del segundo fallaría con "more than one
row returned by a subquery" al encontrar dos empresas "Personal" para el mismo
`user_id`. Ninguno de los seis scripts es idempotente por sí mismo (todos
insertan datos sin `on conflict`), así que repetir uno solo requiere volver
a crear la base de datos desde cero, no solo relanzar el script.

`01_funding_management_rls.sql` reconfirma las afirmaciones de aislamiento de
BUILD 001 (`prop_firms`/`accounts`/`account_capital_events`) — nunca se
habían ejecutado contra un Postgres real con RLS realmente vigente hasta
BUILD 003.

`03_operations_engine.sql` (BUILD 004) valida, además del aislamiento RLS
habitual: la resolución de Plan de Gestión (guardado vs. anónimo, I11),
idempotencia de `registrar_operacion`, la máquina de estados y la
inmutabilidad de `account_id` aplicadas por trigger (no solo por convención
de la capa de aplicación), la cascada completa de capital (abrir es neutral,
cerrar mueve capital, editar mueve el delta, la reversión "fantasma"
revierte exactamente lo revertido) y que `audit_log` capture toda edición.
No ejercita `packages/operations-engine` (TypeScript) — eso lo cubre
`npm test` en ese paquete con dobles en memoria; aquí se llama directamente
a `aplicar_cierre_operacion`/`aplicar_edicion_operacion` con los valores que
Risk Engine ya habría calculado, para aislar la capa SQL de la capa de
orquestación.

`04_event_backbone.sql` (BUILD 006A) valida el modelo único de eventos: que
los seis eventos del contrato se emitan desde el productor correcto, que
`event_sequence` sea estrictamente creciente y refleje el orden causal real,
que el payload no contenga copias del estado de otro módulo, que el
reintento idempotente de `registrar_operacion` no emita un segundo evento, y
que RLS aísle el outbox entre usuarios — incluida la función de lectura
`listar_eventos_pendientes`. Comprueba además la compatibilidad hacia atrás
con BUILD 003 (`AcumuladorActualizado` se sigue emitiendo, ahora con
secuencia) y la inmutabilidad del outbox (ninguna función del esquema
escribe un UPDATE sobre `domain_events`).

`05_rule_engine.sql` (BUILD 006B) valida el motor de evaluación: que
`rule_evaluations` sea append-only y `rule_profile_snapshots` inmutable, que
reprocesar el mismo `event_id` no inserte nada (idempotencia), que
`ReglaIncumplida` se emita **solo** con veredicto `violated` en modo
`enforced` (nunca en `shadow`), y el aislamiento RLS completo — con la
Library (`rule_definitions`) legible por cualquier autenticado por ser
catálogo global.

Valida además la **frontera de propiedad** aprobada en BUILD 006B: Rule
Engine no escribe jamás en `accounts`; es un trigger de Funding Management
sobre `domain_events` quien actualiza el caché `compliance_flag`, y lo hace
con *compare-and-set* sobre `compliance_flag_event_sequence`, de modo que un
evento que llega tarde (secuencia 5 después de la 10) no puede pisar un
estado más reciente.

Las comprobaciones de inmutabilidad se hacen en **dos capas**, aplicando el
hallazgo metodológico de BUILD 003: la capa 1 corre como `authenticated` y
verifica que RLS bloquee la mutación antes de llegar al trigger (`UPDATE 0` /
`DELETE 0`, sin error); la capa 2 (`[10b]`) hace `reset role` para saltarse
RLS como superusuario y verifica que el trigger `append-only` levante el
error igualmente. Una sola capa no bastaría: RLS no protege frente a un
superusuario ni a un `service_role`.

`06_management_intent.sql` (BUILD 010, B1) valida **únicamente el esquema
base** de Management Intent — sin triggers, funciones ni eventos, que
pertenecen a B2 y posteriores. Cubre las restricciones CHECK y UNIQUE
declarativas, el comportamiento de las claves foráneas y el aislamiento RLS.

Su punto central: ambas tablas son de **solo lectura** para `authenticated`
por diseño, sin política de INSERT/UPDATE/DELETE — mismo criterio que
`audit_log` y `rule_definitions`. Es la capa 1 de la inmutabilidad de una
Intención y lo que impide añadir un destino después de la emisión; toda
escritura llegará por una única vía `SECURITY DEFINER` en B5/B8/B9. Por eso
todo el sembrado se hace como superusuario.

**Hallazgo del script, ajeno a este build**: la comprobación `[23]` documenta
que **borrar una Cuenta es imposible en el sistema actual** — el trigger
append-only de `account_capital_events` (BUILD 001, `20260803120300`) rechaza
la cascada antes de que ninguna otra llegue a correr, y no existe ninguna
función que borre Cuentas. Las cascadas realmente alcanzables se verifican en
`[24]` (por Operación) y `[26]` (por Intención).
