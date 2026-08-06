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
psql -d tradepilot_test -f 07_management_intent_invariants.sql
psql -d tradepilot_test -f 08_domain_events_user_ownership.sql
psql -d tradepilot_test -f 09_management_intent_event.sql
```

Cada script imprime lo que espera junto al resultado real (`\echo`) — se lee
a mano, no hay corredor de aserciones automatizado todavía (deuda aceptada,
bajo impacto: son 148 comprobaciones en total, revisables en unos minutos).

Los nueve scripts corren contra la **misma** base de datos, uno
detrás del otro — por eso usan usuarios de prueba con UUIDs distintos entre
sí (`1111.../2222...` en el primero, `3333.../4444...` en el segundo,
`7777.../8888...` en el tercero, `9999.../aaaa...` en el cuarto,
`bbbb.../cccc...` en el quinto, `dddd.../eeee...` en el sexto, `ffff...` en el séptimo, `1a1a.../2b2b.../3c3c...` en el octavo, `4d4d.../5e5e...` en el noveno): si compartieran
UUID, dos scripts llamarían a `crear_empresa('Personal', true)` para el mismo
usuario y el `\gset` de `crear_cuenta` del segundo fallaría con "more than one
row returned by a subquery" al encontrar dos empresas "Personal" para el mismo
`user_id`. Ninguno de los nueve scripts es idempotente por sí mismo (todos
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

`07_management_intent_invariants.sql` (BUILD 011, B2) valida la capa 2 de las
mismas invariantes: la inmutabilidad de una Intención emitida (MI-2), la
inmutabilidad de la declaración de un destino, y la máquina de estados
completa — todas las transiciones válidas aceptadas y todas las inválidas
rechazadas, incluida la regla central de que **`sent` no puede caducar**: un
destino cuya orden ya salió no admite caducidad, porque un fill tardío
llegaría a una Operación real —que I14 obliga a registrar igualmente— sin
ningún destino al que vincularla.

Repite la estructura de dos capas de `05`: primero como `authenticated`,
donde RLS bloquea antes de que el trigger llegue a evaluarse (`UPDATE 0`,
sin error); después tras `reset role`, donde el trigger es la única defensa.
La comprobación `[28]` cierra verificando que la Intención sigue intacta tras
todos los intentos de mutación.

`08_domain_events_user_ownership.sql` (BUILD 012B) valida la adaptación del
backbone de eventos: `domain_events` separa ahora **propiedad** (`user_id`,
siempre presente, único ancla de RLS) de **sujeto de dominio** (`account_id`,
nulo cuando el hecho pertenece al Usuario y no a una Cuenta concreta).

Ejecuta la revisión que BUILD 003 había dejado programada por escrito junto a
sus políticas: *"se revisita si en el futuro existe un evento genuinamente sin
Cuenta asociada"*. Una Management Intent es ese evento.

Su comprobación decisiva es `[4]`: un emisor existente (`registrar_operacion`)
publica **sin haber sido modificado** — sigue insertando
`(event_type, account_id, payload)` y un trigger `BEFORE INSERT` deriva el
propietario. `[5]` extiende la prueba a la cadena completa (parcial + cierre).

`[9]` demuestra que la fuga latente queda cerrada: la política anterior trataba
`account_id is null` como visible para **todos** los usuarios autenticados, y
ahora un evento de Usuario solo lo ve su dueño — incluido a través de
`listar_eventos_pendientes` (`[11]`/`[12]`). `[14]` verifica que propiedad y
sujeto no puedan divergir, y `[15]` que un evento sin ninguno de los dos falle
de forma ruidosa, nunca silenciosa.

Las sondas que inserta se borran en `[16]` para no contaminar suites
posteriores.

`09_management_intent_event.sql` (BUILD 013, B3) valida la emisión del evento
`IntencionDeGestionEmitida`: exactamente uno por Intención, con `user_id` del
propietario y `account_id` **nulo** —una decisión pertenece al Usuario y
concierne a N Cuentas—, tomando su posición del mismo contador global
`event_sequence` que el resto del backbone.

`[6]` demuestra la atomicidad con un `ROLLBACK` real: dentro de la transacción
existen la Intención y su evento; después del rollback, ninguno de los dos. Es
la propiedad que se obtiene gratis por emitir desde un trigger `AFTER` sobre la
tabla fuente de verdad en vez de desde una RPC.

`[9]` y `[10]` verifican lo contrario de lo habitual — que **no** se emita
nada: ni las transiciones de un destino (`pending → sent → materialized`) ni el
borrado de una Intención generan eventos nuevos. Y `[11]`-`[13]` confirman que
el aislamiento por `user_id` de BUILD 012B alcanza también a este evento, que
es el primero del sistema sin Cuenta.
