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
psql -d tradepilot_test -f 01_funding_management_rls.sql
psql -d tradepilot_test -f 02_risk_engine.sql
```

Cada script imprime lo que espera junto al resultado real (`\echo`) — se lee
a mano, no hay corredor de aserciones automatizado todavía (deuda aceptada,
bajo impacto: son 15 comprobaciones en total, revisables en segundos).

`01_funding_management_rls.sql` y `02_risk_engine.sql` corren contra la
**misma** base de datos, uno detrás del otro — por eso usan usuarios de
prueba con UUIDs distintos entre sí (`1111.../2222...` en el primero,
`3333.../4444...` en el segundo): si compartieran UUID, ambos scripts
llaman a `crear_empresa('Personal', true)` para el mismo usuario y el
segundo `\gset` de `crear_cuenta` fallaría con "more than one row returned
by a subquery" al encontrar dos empresas "Personal" para el mismo
`user_id`. Ninguno de los dos scripts es idempotente por sí mismo (ambos
insertan datos sin `on conflict`), así que repetir uno solo requiere volver
a crear la base de datos desde cero, no solo relanzar el script.

`01_funding_management_rls.sql` reconfirma las afirmaciones de aislamiento de
BUILD 001 (`prop_firms`/`accounts`/`account_capital_events`) — nunca se
habían ejecutado contra un Postgres real con RLS realmente vigente hasta
BUILD 003.
