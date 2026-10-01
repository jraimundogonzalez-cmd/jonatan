# 06 · CONECTORES — contrato de integración

> **Estado: ESPECIFICADO, no implementado.** Existen 0 líneas de código de
> conectores. Lo que sí existe es la zona de aterrizaje en la base de datos.
> Este documento convierte `specs/008-trade-capture-engine.md` §3.2 en el
> contrato operativo. **No inventes una interfaz distinta de la de abajo.**

---

## 1. La frontera

```
         TradePilot Core
               │     no conoce ninguna plataforma
               ▼
          Connector            ← toda la variación específica vive AQUÍ
               │
               ▼
     Proveedor / Plataforma
```

**El núcleo NO debe conocer jamás**: MT4, MT5, cTrader, DXtrade, MatchTrader,
TradeLocker, Tradovate, Rithmic, TradingView — ni el nombre de ninguna empresa
de fondeo.

Esto no es una preferencia de diseño: es el **invariante I10**, aprobado mucho
antes de esta fase — *«Ninguna empresa de fondeo tiene código específico en el
sistema — el comportamiento depende exclusivamente de configuración de reglas»*.

Ningún componente del núcleo (reconstrucción, inferencia, normalización,
reconciliación, puente de adaptadores) conoce el nombre de una sola plataforma.
Toda la variación vive exclusivamente dentro de `connectors/<id>.ts`.

## 2. El contrato — tal cual está especificado

```ts
interface Connector {
  id: string                       // 'manual', 'mt4', 'mt5', 'ctrader', 'tradovate',
                                   // 'rithmic', 'dxtrade', 'matchtrader', 'tradingview', …
  ingestion_modes: ("webhook" | "api_poll" | "file_import" | "manual_entry")[]
  translate(raw: unknown): RawCaptureEvent[]   // el ÚNICO método que un conector nuevo implementa
}
```

```ts
interface RawCaptureEvent {
  connector_id: string
  external_position_ref: string | null   // id de posición del bróker, cuando exista
  event_type: "open" | "partial_close" | "full_close"
            | "stop_modified" | "commission" | "fee"
  instrument_native: string              // símbolo NATIVO, sin normalizar todavía
  price: number                          // precio nativo; la normalización va después
  quantity_native: number
  timestamp: Timestamp
  raw_payload: unknown                   // el payload original COMPLETO, para auditoría
}
```

**Un conector nuevo implementa un solo método: `translate`.** Nada más.

## 3. El hallazgo que lo hace coherente

**El registro manual ya es, estructuralmente, un Connector**:

```
id: 'manual'
ingestion_modes: ['manual_entry']
translate: el formulario de registro rápido
```

Produce el mismo `RawCaptureEvent` que produciría un webhook de MetaTrader. Por
eso la reconstrucción, la inferencia, la normalización y la reconciliación
aplican igual a una operación tecleada que a una importada, **sin dos motores
paralelos**.

Consecuencia práctica: **el camino manual que ya funciona es la implementación
de referencia.** Un conector nuevo no añade un camino: añade una traducción.

## 4. Lo que SÍ está implementado hoy

Solo la persistencia y la deduplicación:

```sql
trades.source       text not null default 'manual'
trades.external_ref text

create unique index trades_external_ref_idx
  on public.trades(account_id, source, external_ref)
  where external_ref is not null;
```

- `source` = el `id` del conector.
- `external_ref` = identificador de la operación en el sistema de origen.
- **La clave única por `(cuenta, conector, referencia externa)` es la protección
  contra importar dos veces la misma operación.** Ya existe y está probada.
- Dos conectores distintos pueden reportar la misma operación sin colisionar: la
  reconciliación entre fuentes es un problema de dominio, no de la clave.

## 5. Las etapas que hay que construir

| Etapa | Qué hace | Estado |
|---|---|---|
| **Autenticación** | credenciales de **solo lectura** hacia el proveedor | 🔴 |
| **Captura** | webhook / polling / importación de fichero / manual | 🔴 (salvo manual ✅) |
| **Traducción** | `translate()` → `RawCaptureEvent[]` | 🔴 |
| **Reconstrucción** | agrupar eventos crudos en una Operación | 🔴 |
| **Inferencia** | derivar lo derivable, con confianza marcada | 🔴 |
| **Normalización** | unidades, símbolo, moneda, zona horaria | 🔴 |
| **Deduplicación** | `(account_id, source, external_ref)` | ✅ |
| **Persistencia** | `crear_operacion_nucleo` vía RPC | ✅ |
| **Reconciliación** | duplicados entre fuentes, sin perder datos subjetivos | 🔴 |

### Reconstrucción
Camino normal: agrupar por `external_position_ref`. Si no existe, hay un
fallback heurístico **con límite explícito**: ante una agrupación ambigua, nunca
se adivina — cae a interacción manual.

### Inferencia
Tres categorías, y la distinción importa:
- **Siempre inferible**: aritmética determinista sobre datos ya capturados.
- **A veces inferible**: se marca con nivel de confianza, nunca al mismo nivel
  que un hecho observado.
- **Nunca inferible**: cae a interacción manual **por diseño**, no por
  limitación técnica.

### Normalización de unidades
Es el hallazgo central de fidelidad de SPEC-008 §6. Requiere una tabla
`instrument_unit_specs` que **todavía no existe**. Será necesaria cuando haya un
conector real; antes no.

### Comisiones y deslizamiento
**Nunca asumir cero.** Son costes reales que afectan al R efectivo y se tratan
con el mismo criterio que el Profit Split.

### Trazabilidad de procedencia
Cada campo debe poder decir de dónde salió: observado, inferido o introducido a
mano. Es lo que permite al sistema explicar *qué ocurrió y por qué*.

## 6. Qué debe aportar una plataforma nueva para integrarse

Esta es la lista mínima. Si falta algo de aquí, el conector no se puede escribir
con fidelidad:

| Requisito | Por qué |
|---|---|
| Identificador de cuenta estable | mapear a `accounts.id` |
| Identificador de operación/posición estable | es el `external_ref`; sin él no hay deduplicación |
| Eventos o histórico con marca de tiempo | `opened_at` / `closed_at` son `timestamptz` |
| Zona horaria del servidor, declarada | sin ella los timestamps son adivinanzas |
| Símbolo nativo + especificación de contrato/unidad | para normalizar a `instrument_key` |
| Moneda de la cuenta | `accounts.currency` |
| Precio y cantidad por evento | base de todo el cálculo |
| Comisiones y tasas, si existen | nunca asumir cero |
| Credenciales de **solo lectura** | ver `07_SECURITY.md` |
| Entorno declarado (demo / real) | un diario mezclado no vale nada |

> ❌ **Permisos de ejecución de órdenes: NUNCA.** TradePilot no ejecuta (I17).
> Si un proveedor solo ofrece credenciales con permiso de trading, eso es un
> riesgo a declarar explícitamente, no a aceptar en silencio.

## 7. Modo de ingesta recomendado para el primero

`file_import` es el camino más corto y seguro:
- no necesita credenciales,
- no necesita proceso de larga duración (hoy **no existe ninguno**),
- es reproducible y auditable,
- y ejercita exactamente las mismas etapas que un conector en vivo.

`api_poll` y `webhook` exigen infraestructura que todavía no está construida.

## 8. Reglas que un conector no puede romper

1. No escribe en `trades` directamente. Pasa por las RPC del dominio.
2. No calcula R. Eso es del Quant Engine.
3. No decide nada. Captura y traduce (I17).
4. No conoce el resto del sistema: solo produce `RawCaptureEvent[]`.
5. Conserva siempre el `raw_payload` original para auditoría.
6. Nunca sobrescribe datos subjetivos introducidos por el trader (notas,
   intención, motivo de cierre declarado).
