# 10 · ESTADO ACTUAL

> **Este documento se actualiza al cerrar cada fase.** Si lo que lees aquí no
> coincide con el código, gana el código — y entonces este fichero está
> desactualizado y hay que corregirlo.

**Última verificación**: 2026-10-18 · importador de ficheros, fase 1, sobre
`3961c27` (rama de trabajo `claude/ecstatic-planck-tg10r0`). La verificación
anterior (2026-10-01, `c91e3af`) se conserva abajo donde no ha cambiado.

### Seguridad local y uso diario en Windows (2026-10-18, segunda tanda)

- `Actualizar_TradePilot.bat` → `scripts/windows/actualizar.ps1`: comprueba el
  historial de migraciones (se niega si la base tiene migraciones que el código
  no conoce o le faltan antiguas), copia de seguridad verificada (SHA-256 +
  recuento por tabla), `supabase migration up`, reinstala funciones en una
  transacción por fichero y vuelve a contar filas. Nunca `db reset`.
- `Copia_de_seguridad_TradePilot.bat`, `Crear_accesos_directos.bat`.
- `Abrir_TradePilot.bat` ya no propone `supabase db reset`: detecta una base
  desactualizada (también la del importador) y remite al actualizador. Guarda
  el `.env.local` anterior en `.env.anterior.local` antes de reescribirlo.
- `Cerrar_TradePilot.bat` solo para los procesos Next.js de su propia carpeta.
- Importador endurecido: inspección del ZIP antes de descomprimir (bomba ZIP,
  cifrado, ZIP64), límite de columnas y de longitud de celda, `__proto__`
  conservado como dato, límites de tamaño en `confirmar_importacion`.

```
Tests TypeScript 405 verdes · suite SQL 16: 37/37 · suites 01–15 sin cambios
Actualizador probado en Linux (PowerShell 7.4, PostgreSQL 16, docker y CLI de
Supabase SIMULADOS) sobre una base con el esquema de 3961c27 y datos: caso
normal (23 tablas idénticas byte a byte) y 9 escenarios de fallo sin tocar datos.
NO probado en Windows: ni PowerShell 5.1, ni Docker Desktop, ni la CLI real,
ni los .bat (no hay cmd.exe en el entorno de pruebas).
```

### Importación de ficheros — fase 1 (2026-10-18)

```
typecheck / lint / build      PASS
tests TypeScript              396 verdes (7 paquetes; 327 antes de la fase)
  · @tradepilot/connectors     45 nuevos
  · @tradepilot/web            24 nuevos (114 en total)
Suite SQL 16 (Postgres 16, rol authenticated)   35/35 OK, autoverificada
Suites SQL 01–15: misma salida que antes del cambio (solo difieren anchos de
columna por marcas de tiempo)
Flujo completo conector → servicio → RPC → Postgres: verificado con un
adaptador temporal sobre psql (no versionado). Sin PostgREST ni navegador.
```

**Probado solo con ficheros generados** que imitan el esquema conocido de la
«Lista de comercio». **No se ha probado con una exportación real**: ver
`IMPORTAR-OPERACIONES.md` §4.

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
| Documentación de contexto | Esta carpeta |
| **Importación de ficheros, fase 1** | `.xlsx` «Lista de comercio» → evidencia en `imported_trade_rows`; vista previa, revisión, idempotencia, lotes auditables. **No crea Operaciones** |

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
| **Integración con proveedores** | Solo **importación de fichero** (fase 1, un conector). Nada de API, webhooks ni sincronización |
| Reconstrucción de Operaciones desde filas importadas | No existe. Exige una regla validada para agrupar filas y decidir qué hacer con R, riesgo y Plan, que el fichero no trae |
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
**Estado**: parcialmente desbloqueado. Existe un primer conector de **fichero**
(`packages/connectors/src/nys-markets/`) sobre el esquema de columnas conocido.
Sigue sin verificarse con una exportación real, y no hay integración en vivo.

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
