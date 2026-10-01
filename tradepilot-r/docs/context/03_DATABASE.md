# 03 · BASE DE DATOS

> Verificado reconstruyendo el esquema desde cero a partir de las migraciones:
> **21 tablas · 100 funciones · 26 triggers · 27 políticas RLS**.
> Fuente: `supabase/migrations/` (17 ficheros) + `supabase/functions/sql/` (3).

---

## 1. Las 21 tablas

### Identidad y fondeo
| Tabla | Qué guarda |
|---|---|
| `profiles` | Perfil del usuario. Se crea sola por trigger al alta en `auth.users` |
| `prop_firms` | Empresas de fondeo del usuario (incluida la "personal") |
| `accounts` | Cuentas de trading: capital, moneda, profit split, tope de riesgo, bandera de cumplimiento |
| `account_capital_events` | **Inmutable.** Depósitos, retiradas, ajustes y desenlaces. El capital se deriva de aquí |

### Planes y operaciones
| Tabla | Qué guarda |
|---|---|
| `management_plans` | Plan de Gestión reutilizable: `rr_objective`, `be_trigger` |
| `management_plan_partials` | Parciales planificados del Plan |
| `trades` | La Operación. Entidad central |
| `trade_partials_planned` | **Inmutable.** El plan congelado dentro de la Operación |
| `trade_partials_executed` | **Inmutable.** La evidencia real sobre la que se calcula R |

### Decisión (Management Intent)
| Tabla | Qué guarda |
|---|---|
| `management_intents` | La decisión. **Inmutable desde su emisión** |
| `management_intent_destinations` | Un destino por cuenta: plan congelado, transformación de riesgo, estado |

### Motores
| Tabla | Qué guarda |
|---|---|
| `account_risk_state` | Acumulador de riesgo por cuenta (Welford) |
| `risk_engine_processed_events` | Idempotencia del Risk Engine |
| `rule_definitions`, `rule_instances`, `rule_profiles`, `rule_profile_snapshots`, `rule_evaluations` | Rule Engine. ⚠️ **Esquema completo, sin una sola RPC que lo exponga** |
| `rule_engine_processed_events` | Idempotencia del Rule Engine |

### Transversal
| Tabla | Qué guarda |
|---|---|
| `audit_log` | **Inmutable.** Correcciones, con el valor anterior |
| `domain_events` | Hechos de dominio, `event_sequence` monotónica. ⚠️ Nadie los consume |

> ❌ **No existen `positions` ni `orders`.** No los inventes ni los supongas.

## 2. La tabla central: `trades`

```
id · user_id · account_id
symbol            -- representación con la que se registró
instrument_key    -- forma canónica del instrumento
side · opened_at · closed_at · status
risk_pct · risk_amount        -- riesgo congelado al abrir
management_plan_id            -- FK, linaje; NO se relee para calcular
rr_objective · be_trigger     -- congelados del Plan
r_max · r_final · pnl_amount · closure_reason
cancellation_reason · notes
idempotency_key               -- reintentos de la aplicación
source · external_ref         -- integración externa (ver §5)
```

**`symbol` ≠ `instrument_key`** y no deben colapsarse:
- `instrument_key` = instrumento en forma **canónica** (lo que el trader decidió).
- `symbol` = la representación con la que se registró. El día que exista un
  conector, `symbol` llevará el **símbolo nativo de la plataforma** y
  `instrument_key` seguirá siendo la clave canónica.

## 3. Funciones (RPC) del dominio

Las RPC son la **única puerta de escritura**. 16 son invocadas por el frontend y
las 16 existen (verificado contra `pg_proc`).

| Fichero | Funciones principales |
|---|---|
| `funding.sql` | `crear_empresa`, `crear_cuenta`, `registrar_evento_capital`, `listar_*`, `obtener_cuenta` |
| `operations.sql` | `crear_plan_gestion`, `editar_plan_gestion`, `archivar_plan_gestion`, **`crear_operacion_nucleo`**, `registrar_operacion`, `registrar_parcial_ejecutado`, `cancelar_operacion`, `cancelar_operacion_fantasma`, `aplicar_cierre_operacion`, `aplicar_edicion_operacion`, lecturas |
| `management_intent.sql` | `crear_intencion_de_gestion`, **`abrir_operacion_desde_intencion`**, `listar_intenciones`, `obtener_intencion`, `listar_destinos_disponibles` |

### `crear_operacion_nucleo` — la pieza que hay que entender

Es la **única implementación del nacimiento de una Operación**. Características
que no deben cambiarse sin una razón explícita:

- **No consulta `management_plans`.** Recibe un contexto ya resuelto. Esto es lo
  que hace estructuralmente imposible que la ruta de Intención lea el Plan vivo.
- Contiene la **única fórmula de `risk_amount`** del sistema.
- Su `EXECUTE` está **revocado** a `public` y `authenticated`. Solo lo alcanzan
  sus dos llamantes, ambos `SECURITY DEFINER`.

## 4. Triggers (26)

Tres familias:

**Inmutabilidad** — rechazan `UPDATE`/`DELETE`:
`audit_log`, `account_capital_events`, `trade_partials_executed`,
`trade_partials_planned`, `rule_profile_snapshots`, `rule_evaluations`,
`management_intents`.

**Máquina de estados** — qué transición es legal:
`management_intent_destinations` (ver `05_MANAGEMENT_INTENT.md`), `trades`.

**Derivación y eventos** — recálculo de capital, provisión de estado de riesgo,
emisión de eventos de dominio, caché de cumplimiento.

## 5. Integración externa — la zona de aterrizaje YA construida

Esto es lo más importante de este documento para el trabajo futuro:

```sql
trades.source      text not null default 'manual'
trades.external_ref text

create unique index trades_external_ref_idx
  on public.trades(account_id, source, external_ref)
  where external_ref is not null;
```

**Ese índice único es la protección contra importar la misma operación dos
veces.** Existe, está probado, y no hace falta tocarlo para construir un
conector.

Semántica acordada:
- `source` = identificador del conector (`'manual'` hoy; `'mt5'`, `'ctrader'`…
  en el futuro).
- `external_ref` = identificador de la operación **en el sistema de origen**.
- La unicidad es por **(cuenta, conector, referencia externa)**: dos conectores
  distintos pueden reportar la misma operación sin colisionar, y la
  reconciliación entre fuentes es un problema de dominio, no de la clave.

> ⚠️ `instrument_unit_specs` **no existe**. SPEC-008 §6 la señala como la pieza
> central para normalizar unidades. Será necesaria cuando haya un conector real;
> no antes.

## 6. RLS — 27 políticas

- Todas las tablas de usuario tienen RLS activo.
- El patrón es `auth.uid() = user_id`, o a través de la cuenta propietaria.
- `management_intents` tiene **solo política de lectura**: no existe vía de
  escritura desde la aplicación (capa 1 de su inmutabilidad).

**Detalle crítico para quien escriba tests**: en PostgreSQL, el **superusuario y
el propietario de la tabla están exentos de RLS**. Una suite que se conecte como
`postgres` "pasará" comprobaciones de aislamiento que en realidad están rotas.
Las suites de `supabase/tests/` se conectan como rol `authenticated` por eso.

**Segundo detalle**: RLS deniega **en silencio** (0 filas afectadas), no con
excepción. Un test que espere una excepción al escribir sin permiso dará un
falso negativo. Hay que comprobar el **valor**, no la excepción.

## 7. Validación disponible

```
supabase/tests/01…15_*.sql    15 suites contra Postgres real, rol authenticated
```

Cubren RLS, concurrencia real con dos sesiones, idempotencia, máquina de
estados, integridad de operaciones y corrección de desenlaces.
Todas en verde sobre una base reconstruida desde cero.
