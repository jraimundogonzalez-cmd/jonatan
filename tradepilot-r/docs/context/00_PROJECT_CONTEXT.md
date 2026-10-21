# 00 · CONTEXTO DEL PROYECTO — leer esto primero

> **Si eres una IA que se incorpora a TradePilot R, este es tu punto de entrada.**
> Leyendo solo este fichero debes poder entender el proyecto a nivel
> arquitectónico. Para trabajar en él, lee además `AGENTS.md` (reglas
> operativas) y `10_CURRENT_STATUS.md` (qué está hecho hoy).

---

## 1. Qué es TradePilot R

Un **diario y gestor de posiciones para traders discrecionales** que mide todo
en **R** (múltiplos de riesgo), nunca en dinero como unidad primaria.

> *Every R Matters.* — TradingView sirve para analizar. TradePilot sirve para gestionar.

**Para quién**: traders discrecionales, con foco en quienes operan cuentas de
empresas de fondeo (*prop firms*), donde una regla incumplida cuesta la cuenta
entera.

**Qué problema resuelve**: un trader discrecional decide bien y ejecuta mal, o
no sabe cuál de las dos cosas le está costando dinero. TradePilot separa la
**decisión** (qué quise hacer y por qué) de la **ejecución** (qué pasó), y las
mide en la única unidad comparable entre instrumentos, tamaños y cuentas: R.

## 2. Qué NO es — límites duros

Esto no es estilo, es arquitectura. Romper cualquiera de estos puntos es
romper el producto:

- ❌ **No es un bot de ejecución.** TradePilot no envía órdenes a ningún mercado.
- ❌ **No mueve dinero.** Nunca toca fondos reales.
- ❌ **No conecta con ejecución de órdenes.** Las integraciones futuras son de
  **lectura**: importan lo que ya ocurrió.
- ❌ **No decide por el trader.** Calcula, muestra y explica; la decisión es humana.
- ❌ **No es agnóstico de explicación.** El sistema debe poder decir siempre
  *qué ocurrió y por qué*.

Dos invariantes permanentes lo blindan:
- **I17 · Evaluate ≠ Execute** — ninguna regla dispara una acción por sí sola.
- **Regla 14 · Calcular ≠ Juzgar** — quien calcula no juzga.

## 3. Arquitectura en una pantalla

```
  Navegador (Next.js 14, App Router, Server Components/Actions)
        │  solo clave anónima; nunca service_role
        ▼
  PostgreSQL + Supabase
        ├── RLS por usuario en todas las tablas
        ├── RPC en plpgsql = única puerta de escritura al dominio
        └── triggers = qué estado es válido
        ▲
        │ los motores TypeScript calculan; la BD decide qué es legal
  packages/  quant · risk · operations · optimizer · rule
```

**Modelo de seguridad de tres capas (congelado en BUILD 016B):**

| Capa | Responde a |
|---|---|
| `GRANT` / `RLS` | quién puede *intentarlo* |
| `SECURITY DEFINER` | la autoridad de las operaciones legítimas |
| `TRIGGER` | qué estado es *válido* |
| `audit_log` | el registro de las correcciones |

## 4. Los cinco motores

| Motor | Qué hace | ¿Conectado? |
|---|---|---|
| **Quant Engine** | Toda la matemática de R: R final, parciales, esperanza, curvas, drawdown. Único sitio con `decimal.js`. | 🟡 parcial |
| **Risk Engine** | Estado de riesgo por cuenta, acumulador de Welford, tope de riesgo. | ✅ sí |
| **Operations Engine** | Orquesta cierre, corrección y cancelación de operaciones. | ✅ sí |
| **Optimizer** | Recomienda planes de gestión. Nunca escribe en otro módulo (I17). | 🔴 **cero consumidores** |
| **Rule Engine** | Evalúa reglas de cuenta y de operación. Produce evaluaciones, no acciones. | 🔴 **cero consumidores** |

> ⚠️ Optimizer y Rule Engine están **implementados y con tests, pero nadie los
> llama**. No están rotos: están desconectados. No los des por activos.

## 5. Conceptos de dominio que debes entender

- **Cuenta** — el centro de gravedad. Capital, moneda, empresa de fondeo, tope
  de riesgo. El capital se deriva de eventos inmutables, nunca se edita.
- **Plan de Gestión** — una receta reutilizable: objetivo RR, disparador de
  break-even y parciales planificados. **Puede cambiar con el tiempo.**
- **Operación (`trades`)** — una ejecución concreta de un Plan. Al abrirse
  **congela** el riesgo en euros y el plan; cambiar el Plan después no la altera.
- **Management Intent** — la **decisión** del trader, como entidad propia e
  inmutable, anterior y separada de la operación. Ver `05_MANAGEMENT_INTENT.md`.
- **R** — unidad decimal libre. Nunca ratios fijos.

## 6. El patrón que lo sostiene todo: Snapshot

> **Cambiar un Plan no puede reescribir el pasado.**

Cuando se toma una decisión, se **congela** lo que el Plan decía en ese
instante. La materialización posterior lee el congelado, nunca el Plan vivo.
Está verificado atacándolo: se muta el Plan tras decidir y la operación
conserva los valores originales.

## 7. Estado actual, en una frase

**Núcleo sólido y usable a mano; cero integración con el exterior.**

- ✅ Base de datos, autenticación, cuentas, operaciones, R, Management Intent,
  seguridad (auditada con 10 ataques), 327 tests.
- 🟡 Frontend sin panel de control ni métricas; Quant Engine infrautilizado.
- 🔴 **Ninguna integración con proveedores**: 0 líneas. Sin API de salida, sin
  webhooks, sin websocket, sin sincronización, sin workers.
- 🔴 No existen las entidades `positions` ni `orders`. No existe el concepto de
  "multiplicadores".
- ⚠️ El arranque local sin `--ignore-health-check` sigue **sin verificar**.

Detalle vivo y verificable en `10_CURRENT_STATUS.md`.

## 8. Principios que no debes romper

1. **El código es la fuente de verdad de lo implementado**; los documentos de
   diseño (`docs/00-…` a `docs/32-…`) son *contexto*, no prueba de que algo exista.
2. **No confundas IMPLEMENTADO con ESPECIFICADO.** Mucho de este proyecto está
   brillantemente especificado y no escrito.
3. **El snapshot es sagrado.** Nada puede reescribir retroactivamente una decisión.
4. **La idempotencia es obligatoria.** La misma petición dos veces no crea dos hechos.
5. **Los decimales viajan como cadenas** en las fronteras jsonb/API (I5).
6. **Nunca `service_role` en el cliente.** Nunca secretos en el frontend.
7. **El núcleo no conoce ninguna plataforma concreta.** Ver `06_CONNECTORS.md`.

---

## Mapa del resto de esta carpeta

| Fichero | Para qué |
|---|---|
| `01_ARCHITECTURE.md` | Arquitectura real, separando implementado de especificado |
| `02_DOMAIN_RULES.md` | Reglas de negocio e invariantes I1–I21 |
| `03_DATABASE.md` | Tablas, RPC, triggers, RLS, deduplicación |
| `04_TRADING_MODEL.md` | R, RR, riesgo, capital, parciales |
| `05_MANAGEMENT_INTENT.md` | La decisión como entidad inmutable |
| `06_CONNECTORS.md` | Contrato de integración con plataformas |
| `07_SECURITY.md` | Seguridad, credenciales y qué puede saber una IA |
| `08_PROVIDER_INTEGRATIONS.md` | Plantilla por proveedor (a rellenar) |
| `09_DECISIONS.md` | Registro de decisiones técnicas |
| `10_CURRENT_STATUS.md` | Estado por fases, actualizable |
