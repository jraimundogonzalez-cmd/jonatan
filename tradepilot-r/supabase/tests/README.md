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
```

Cada script imprime lo que espera junto al resultado real (`\echo`) — se lee
a mano, no hay corredor de aserciones automatizado todavía (deuda aceptada,
bajo impacto: son 34 comprobaciones en total, revisables en unos minutos).

`01_funding_management_rls.sql`, `02_risk_engine.sql` y
`03_operations_engine.sql` corren contra la **misma** base de datos, uno
detrás del otro — por eso usan usuarios de prueba con UUIDs distintos entre
sí (`1111.../2222...` en el primero, `3333.../4444...` en el segundo,
`7777.../8888...` en el tercero): si compartieran UUID, dos scripts
llamarían a `crear_empresa('Personal', true)` para el mismo usuario y el
`\gset` de `crear_cuenta` del segundo fallaría con "more than one row
returned by a subquery" al encontrar dos empresas "Personal" para el mismo
`user_id`. Ninguno de los tres scripts es idempotente por sí mismo (todos
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
