# 10 · ESTADO ACTUAL

> **Este documento se actualiza al cerrar cada fase.** Si lo que lees aquí no
> coincide con el código, gana el código — y entonces este fichero está
> desactualizado y hay que corregirlo.

**Última verificación**: 2026-10-01 · commit `c91e3af` · rama
`claude/tradepilot-r-position-manager-mwbovl`

---

## 1. Verificación ejecutada, no supuesta

```
npm install            exit 0
typecheck              PASS
lint                   PASS
tests                  327 verdes  (6 paquetes)
build de producción    PASS

Base reconstruida desde cero desde migraciones:
  21 tablas · 100 funciones · 26 triggers · 27 políticas RLS

Suites SQL contra Postgres real (rol authenticated): 15/15 PASS
Batería adversa (10 ataques):                        10/10 PASS
Contratos frontend↔RPC:                              16/16 existen
```

---

## 2. COMPLETADO ✅

| Área | Nota |
|---|---|
| Base de datos y RLS | Reconstruible desde cero; 27 políticas |
| RPC de dominio | Única puerta de escritura; privilegios auditados |
| Autenticación | Enlace mágico verificado extremo a extremo |
| Usuarios y perfiles | Alta automática por trigger |
| Empresas de fondeo y cuentas | Capital, moneda, profit split, tope de riesgo |
| Gestión de capital | Eventos inmutables + recálculo por trigger |
| Operaciones | Alta, parciales, cierre, corrección, cancelación |
| Management Intent | Agregado inmutable, snapshot, máquina de estados |
| Modelo de R | Fórmula congelada, dataset dorado, property tests |
| Idempotencia | Dos ámbitos + deduplicación de importados |
| Inmutabilidad de evidencia | 7 tablas protegidas por trigger |
| Seguridad | 10 ataques rechazados |
| Manejo de errores | Catálogo tipado, sin fuga de mensajes de PostgreSQL |
| Historial | `audit_log` + `domain_events` con secuencia monotónica |
| Tests | 327 TS + 15 suites SQL + batería adversa |
| **Documentación de contexto** | **Esta carpeta** (fase actual) |

## 3. EN DESARROLLO 🟡

| Área | Qué falta |
|---|---|
| Frontend | 15 páginas; sin panel de control ni métricas |
| Quant Engine | Librería completa; el frontend usa **3 de 18** capacidades |
| P&L | `pnl_amount` se persiste; sin vista agregada |
| Drawdown | Calculado en el motor; **no visible** en la interfaz |
| Eventos de dominio | Se escriben; **nadie los consume** (`published` nunca pasa a `true`) |

## 4. PENDIENTE 🔴

| Área | Estado |
|---|---|
| **Integración con proveedores** | **0 líneas.** Especificado en SPEC-008 |
| API de salida / webhooks / websocket | No existen |
| Proceso servidor de larga duración | **No existe ninguno** — bloquea polling, OAuth y reconexión |
| Almacenamiento de secretos | Vault comentado en `config.toml` |
| `instrument_unit_specs` | No existe; necesaria para normalizar unidades |
| Rule Engine conectado | 5 tablas + motor + tests, **cero consumidores, cero RPC** |
| Optimizer conectado | Motor + tests, **cero consumidores** |
| Panel de control y métricas | No existen |
| Interfaz de Management Intent | Solo alcanzable por RPC |
| Caducidad programada (`expired`) | Transición legal; nada la dispara |
| Desenlaces `rejected` / `discarded` | Legales; sin RPC que los produzca |
| Registro de actividad (logging) | 2 `console.*` en toda la app; sin librería |
| `positions`, `orders`, «multiplicadores» | **No existen como conceptos** |

## 5. BLOQUEADO ⚠️

### B-1 · Arranque de Supabase sin `--ignore-health-check`
**Estado**: sin verificar en Windows.
`analytics` y `realtime` están desactivados en `config.toml` (DEC-011), lo que
debería eliminar la causa, pero **no se ha visto arrancar**. El entorno de
desarrollo donde se audita no tiene Docker ni Windows.
**Desbloquea**: ejecutar en la máquina del usuario, sobre `c91e3af`,
`supabase stop` → `supabase start` sin el flag, y capturar la salida más
`docker ps -a` con el estado de salud.

### B-2 · No se sabe qué plataforma se va a integrar
**Estado**: bloqueante por diseño. No se puede escribir un conector sin saber a
qué traduce. Ver las cuatro preguntas [PRE-COMPRA] de `08_PROVIDER_INTEGRATIONS.md`.

### B-3 · DEC-013, riesgo congelado como % o como importe
**Estado**: pendiente de decisión humana. Afecta a cómo un conector traducirá
operaciones importadas.

---

## 6. Avance por módulo

No se da un porcentaje global: con 15 SPECs y 3 motores conectados, sería
inventado. Por módulo, medido:

| Módulo | Avance | Base de la estimación |
|---|---|---|
| Base de datos + seguridad | **95 %** | 21 tablas, 27 RLS, 10 ataques pasan |
| Operaciones + Management Intent | **90 %** | 1.079 líneas + 1.335 de tests, conectado |
| Risk Engine | **85 %** | conectado; acumulador eventualmente consistente |
| Quant Engine | **100 % librería / 25 % conectado** | 18 exportaciones, 3 usadas |
| Frontend | **55 %** | 15 páginas; falta panel y métricas |
| Rule Engine | **70 % librería / 0 % conectado** | sin RPC ni consumidor |
| Optimizer | **70 % librería / 0 % conectado** | cero consumidores |
| **Integración de proveedores** | **0 %** | especificado, no escrito |
| Observabilidad | **5 %** | 2 `console.*` |

---

## 7. PRÓXIMO PASO

**Inmediato, sin depender de nada externo:**
1. Desbloquear **B-1** (arranque limpio en Windows).
2. Resolver las cuatro preguntas [PRE-COMPRA] antes de contratar nada.
3. Decidir **DEC-013**.

**Cuando se conozca la plataforma:**
4. Rellenar la ficha de `08_PROVIDER_INTEGRATIONS.md`.
5. Conseguir un export real **anonimizado** con cabeceras y formato.
6. Diseñar el primer conector sobre `file_import`, que no necesita credenciales
   ni proceso servidor.

**Lo que NO toca hacer todavía**: panel de control, `positions`, `orders`,
workers, polling, webhooks, websockets, Vault, conectores de proveedor concretos
ni cambios en el modelo de datos.
