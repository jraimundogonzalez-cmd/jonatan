# 01 · ARQUITECTURA REAL

> Este documento describe **lo que existe hoy**, verificado sobre el código, no
> la arquitectura objetivo. Cada bloque lleva su estado:
> **IMPLEMENTADO** · **ESPECIFICADO** (diseñado, sin código) · **PENDIENTE** (ni una cosa ni otra).

---

## 1. Monorepo — IMPLEMENTADO

El repositorio contiene **dos proyectos**. TradePilot vive en `tradepilot-r/`.

```
tradepilot-r/
├── apps/web/            Next.js 14 (App Router)         ~5.800 líneas
├── packages/
│   ├── quant-engine/    matemática de R        src 1.428 · test 1.345
│   ├── risk-engine/     estado de riesgo        src   633 · test   603
│   ├── operations-engine/ orquestación          src 1.079 · test 1.335
│   ├── optimizer/       recomendación           src 1.023 · test   348
│   └── rule-engine/     evaluación de reglas    src   756 · test   507
├── supabase/
│   ├── migrations/      17 ficheros — esquema
│   ├── functions/sql/   3 ficheros — las RPC del dominio
│   ├── tests/           15 suites contra Postgres real
│   └── templates/       plantilla del correo de acceso
├── docs/                blueprint de diseño (00–32) + context/ (esta carpeta)
├── specs/               SPEC-001 … SPEC-015
└── scripts/alpha/       stack nativo sin Docker (desarrollo)
```

## 2. Frontend — IMPLEMENTADO (parcial)

Next.js 14, App Router, Server Components y Server Actions. **15 páginas**:

```
/login · /onboarding/{empresa,cuenta}
/cuentas · /cuentas/nueva · /cuentas/[id]
/cuentas/[id]/eventos/nuevo
/cuentas/[id]/operaciones · /cuentas/[id]/operaciones/nueva
/operaciones/[id] · /operaciones/[id]/{cerrar,corregir,cancelar}
/auth/auth-code-error
```

**No existen**: panel de control, pantallas de métricas, estadísticas ni gráficas.

**Frontera de serialización**: las Server Actions son una frontera real. Los
objetos marcados del kernel decimal **no sobreviven** a ella — por eso los
decimales cruzan como cadenas (I5).

### Qué motores consume realmente el frontend

```
@tradepilot/operations-engine   11 importaciones   ✅
@tradepilot/risk-engine          6 importaciones   ✅
@tradepilot/quant-engine         2 importaciones   🟡  (3 capacidades de 18)
@tradepilot/optimizer            0                 🔴
@tradepilot/rule-engine          0                 🔴
```

## 3. Backend — IMPLEMENTADO

**No hay servidor de aplicación propio.** El backend es PostgreSQL con RPC en
plpgsql, más las Server Actions de Next.js como capa de orquestación.

Consecuencia importante para integraciones futuras: **no existe ningún proceso
de larga duración** donde ejecutar polling, colas o reconexiones.

### Las RPC son la única puerta

Agrupadas por fichero:

- `funding.sql` — empresas, cuentas, eventos de capital.
- `operations.sql` — planes de gestión, operaciones, parciales, cierre,
  corrección, cancelación, lecturas.
- `management_intent.sql` — crear intención, abrir operación desde intención,
  lecturas.

**16 RPC distintas son invocadas por el frontend, y las 16 existen en la base**
(verificado comparando las llamadas `.rpc()` contra `pg_proc`).

### Privilegios

De las 12 funciones `SECURITY DEFINER` ejecutables por `authenticated`:
- **9 validan `auth.uid()`** explícitamente.
- **3 son funciones de trigger** y no pueden invocarse de otra forma
  (comprobado: *«trigger functions can only be called as triggers»*).

## 4. Base de datos — IMPLEMENTADO

Reconstruible desde cero a partir de las migraciones. Objetos resultantes:

```
21 tablas · 100 funciones · 26 triggers · 27 políticas RLS
```

Detalle completo en `03_DATABASE.md`.

## 5. Eventos — IMPLEMENTADO a medias

- ✅ `domain_events` con `event_sequence` monotónica y propiedad por usuario.
- ✅ Triggers emisores: alta de operación, actualización, parcial ejecutado,
  recálculo de capital.
- 🔴 **No existe ningún despachador** que consuma esos eventos. Se escriben y
  se quedan ahí. El campo `published` existe y nunca pasa a `true`.

## 6. Flujo de datos real

```
Usuario
  └─ Server Component / Server Action        (apps/web)
       ├─ valida con el motor correspondiente (packages/*)
       └─ llama a una RPC                     (supabase/functions/sql)
            ├─ RLS decide si puede intentarlo
            ├─ la función comprueba propiedad
            ├─ los triggers deciden si el estado es válido
            └─ se emite un evento de dominio
  └─ lectura: RPC → normalización de decimales → presentación
```

**Frontera crítica (I5)**: PostgREST serializa `numeric` como **número JSON**,
no como cadena. `apps/web/lib/api/decimales.ts` normaliza en la frontera de
lectura. Fue la causa raíz de varios fallos en producción local.

## 7. Límites entre módulos

| Módulo | Nunca debe conocer |
|---|---|
| Quant Engine | cuentas, usuarios, persistencia |
| Risk Engine | cómo se calcula R |
| Operations Engine | reglas de negocio de fondeo |
| Rule Engine | cómo ejecutar nada (I17) |
| Optimizer | cómo escribir en otro módulo |
| **Núcleo entero** | **el nombre de ninguna plataforma de trading** |

## 8. Capa de integración externa — PENDIENTE

Verificado por búsqueda directa:

```
Proveedores (MT4/MT5/cTrader/DXtrade/MatchTrader/TradeLocker/…):  0 ficheros
Rutas de API                 : 1  (y es /auth/confirm, el login)
Webhooks                     : 0
WebSocket                    : 0
Clientes HTTP a terceros     : 0
Workers / schedulers         : 0
```

**ESPECIFICADO** en `specs/008-trade-capture-engine.md` (contrato `Connector`).
**IMPLEMENTADO**: solo la zona de aterrizaje en la base de datos
(`trades.source`, `trades.external_ref` y su índice único). Ver `06_CONNECTORS.md`.

## 9. Entorno local

- **Camino normal**: Supabase CLI sobre Docker. `supabase/config.toml` tiene
  `analytics` y `realtime` desactivados a propósito (no se usan y rompían el
  arranque en Windows).
- **Camino alternativo**: `scripts/alpha/` levanta PostgreSQL, PostgREST y
  GoTrue como procesos nativos, sin Docker. Se usa para validación en entornos
  donde Docker no está disponible. Es el **mismo software**, sin contenedores.
- ⚠️ **Pendiente de verificar**: que `supabase start` funcione sin
  `--ignore-health-check` en Windows.

## 10. Estado por bloque

| Bloque | Estado |
|---|---|
| Monorepo, paquetes, build | IMPLEMENTADO |
| Base de datos y RLS | IMPLEMENTADO |
| RPC de dominio | IMPLEMENTADO |
| Autenticación | IMPLEMENTADO |
| Frontend de cuentas y operaciones | IMPLEMENTADO |
| Eventos de dominio (escritura) | IMPLEMENTADO |
| Eventos de dominio (consumo) | PENDIENTE |
| Rule Engine / Optimizer (librerías) | IMPLEMENTADO, sin conectar |
| Panel de control y métricas | PENDIENTE |
| Contrato de conectores | ESPECIFICADO |
| Integración con proveedores | PENDIENTE |
| Almacenamiento de secretos | PENDIENTE |
