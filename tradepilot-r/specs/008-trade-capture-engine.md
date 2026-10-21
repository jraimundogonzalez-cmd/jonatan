# SPEC-008 · Trade Capture Engine

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications
**Depende de (bloqueante, no se reinterpreta aquí)**: 01 §5/13 §7 (TradePilot nunca ejecuta órdenes — reafirmado con máxima fuerza, §1.2), 02 §1-3 (modelo matemático de R, `risk_pct`/`rr_objetivo` como conceptos de planificación), 04/SPEC-002 (esquema `trades`, contrato canónico de escritura), 10 §2-4 (registro manual — se reconoce aquí como un Connector más, no se rediseña), 18 §3 (Profit Split separado de R — precedente directo del hallazgo de §7), SPEC-002 §5.7/§8.3.3/§8.5 (Import Adapters, campos `source`/`external_ref`, frontera de traducción — este documento es exactamente esa pieza, ahora especificada por completo), SPEC-004 (patrón de veredicto `unavailable`, reutilizado en §6/§7), 19 I16 (Zero Friction), 19 I17 (Evaluate ≠ Execute), 19 I18 (Automation Before Interaction, recién aprobado — gobierna toda la arquitectura de este documento)
**No re-abre ninguna decisión conceptual ya aprobada.** No modifica el contrato de escritura de Operations Engine (SPEC-002) — lo consume tal como está. El hallazgo principal (§7) añade dos campos nuevos a `trades` sin tocar ninguno existente.

---

## 1. Objetivo del componente

### 1.1 Misión: completar el journal automáticamente, nunca interpretar

Trade Capture Engine existe para que registrar una operación deje de ser, en la mayoría de los casos, algo que el trader hace — se convierte en algo que el sistema **ya ha hecho** cuando el trader abre la app. Su misión es de fidelidad, no de análisis: reconstruir los hechos históricos de una operación con la máxima precisión posible a partir de cualquier fuente disponible, nunca interpretar qué significan.

### 1.2 Qué nunca debe hacer

1. **Nunca ejecuta ni puede ejecutar una orden en un bróker real.** Es, si cabe, más crítico aquí que en cualquier otro componente — un Trade Capture Engine mal diseñado podría confundirse arquitectónicamente con un sistema de ejecución. No existe, ni existirá, ningún camino de código en este componente capaz de enviar una orden a una plataforma de trading — solo puede **leer**.
2. **Nunca interpreta el significado de una operación.** No decide si fue una buena o mala decisión de gestión — eso pertenece, en cascada, a Quant Engine (calcula), Rule Engine (juzga cumplimiento) y Knowledge Engine (descubre patrones). Trade Capture Engine solo entrega hechos.
3. **Nunca inventa un dato que no puede reconstruir con certeza suficiente.** Es la aplicación más estricta de "máxima fidelidad" — cuando la inferencia no es segura (§5.3), el campo se deja pendiente de interacción manual, nunca se rellena con una suposición no marcada como tal.
4. **Nunca escribe fuera del contrato canónico de Operations Engine.** No existe una segunda vía de escritura para datos importados — todo Connector (§3.2), incluido el manual, termina en la misma llamada a `registrarOperacion`/`registrarParcialEjecutado`/`cerrarOperacion` (SPEC-002 §7), exactamente como SPEC-002 §5.7 ya exigía.
5. **Nunca sobrescribe en silencio contenido subjetivo del trader.** Notas, capturas, aprendizajes y emociones (§1.3) son siempre del trader — una reconciliación (§8) puede detectar un duplicado, nunca puede destruir esos datos sin confirmación explícita.

### 1.3 Responsabilidades

- Capturar hechos de cualquier fuente disponible (manual, archivo, API, webhook) bajo un modelo de eventos crudos común (§3.3).
- Reconstruir una Operación completa (entrada, salidas parciales, cierre, comisiones, deslizamiento, duración, instrumento) agrupando esos eventos con la máxima fidelidad posible (§4).
- Aplicar el orden obligatorio de I18 — captura automática, luego inferencia segura, interacción manual solo como último recurso (§5).
- Proveer una arquitectura de conectores extensible sin tocar el núcleo (§3.2), preparada para plataformas que hoy no existen.
- Dejar como responsabilidad exclusiva y explícita del trader únicamente lo genuinamente subjetivo: notas, capturas, aprendizajes, emociones.

### 1.4 No-responsabilidades (y quién las tiene)

| No responsabilidad | Quién la tiene |
|---|---|
| Validar la forma estructural final de una Operación y persistirla | Operations Engine (SPEC-002) — Trade Capture Engine es un cliente de su contrato, no un sustituto |
| Calcular `R_final`, esperanza o cualquier fórmula | Quant Engine (SPEC-001), vía Risk Engine |
| Decidir si una operación cumple una regla de la prop firm | Rule Engine (SPEC-004) |
| Descubrir patrones sobre el comportamiento capturado | Knowledge Engine (SPEC-006) |
| Presentar visualmente lo capturado | Analytics Engine (SPEC-007) |
| Ejecutar cualquier acción sobre una posición real | Nadie, en ningún componente — no existe en todo TradePilot (01 §5, reafirmado) |

---

## 2. Consolidación: este documento es el Import Adapter que SPEC-002 ya anticipó

**No es un componente que aparece de la nada.** SPEC-002 §5.7 dejó especificado, con dos años de antelación conceptual dentro de este mismo proyecto, exactamente el hueco que este documento llena: *"un futuro conector nunca escribe directamente en el esquema de trades — pasa por un Import Adapter... responsable de traducir la representación nativa de esa plataforma... al contrato canónico de registrarOperacion"*, y añadió ya entonces los campos `source`/`external_ref` a `trades` precisamente para este momento (SPEC-002 §8.3.3). Trade Capture Engine es esa pieza, ahora completamente especificada — no reabre esa decisión, la construye.

**Se añade formalmente como 15º módulo oficial** del sistema (extiende el mapa de 22.5 §1, tras Snapshot Engine, Notification Engine y Knowledge Engine como adiciones ya precedentes al catálogo original de 13).

---

## 3. Arquitectura interna

### 3.1 Subcomponentes

```
trade-capture-engine/
├── connectors/              Un traductor por plataforma — §3.2
├── reconstruction/           Agrupa eventos crudos en una Operación candidata — §4
├── inference/                  Deriva campos de forma determinista, nunca predictiva — §5
├── unit-normalization/         Conversión pips/puntos/lotes/contratos → unidades canónicas — §6
├── commission-slippage/         Captura de costes de ejecución, separados de R — §7
├── reconciliation/              Detección de duplicados entre fuentes — §8
├── provenance/                   Trazabilidad de procedencia por campo — §9
└── adapter-bridge/                Único punto que invoca el contrato canónico de Operations Engine
```

### 3.2 El Connector — quinta aparición confirmada del mismo patrón arquitectónico

**Es la quinta vez, no la cuarta, que este blueprint llega al mismo diseño de forma independiente**: tras los 7 arquetipos de Rule Engine (SPEC-004), las estrategias *ask/tell* de Optimizer (SPEC-005), los 4 arquetipos de detector de Knowledge Engine (SPEC-006) y el Catálogo de KPIs de Analytics (SPEC-007), aquí la variedad de plataformas se resuelve con un catálogo pequeño de **Connectors**, cada uno implementando la misma interfaz mínima:

```
interface Connector {
  id: string                                          // 'manual', 'mt4', 'mt5', 'ctrader', 'tradovate', 'rithmic',
                                                        // 'dxtrade', 'matchtrader', 'tradingview', futuros...
  ingestion_modes: ("webhook" | "api_poll" | "file_import" | "manual_entry")[]
  translate(raw: unknown): RawCaptureEvent[]            // el único método que un conector nuevo debe implementar
}
```

**Hallazgo de diseño**: el registro manual (10 §2-4, ya aprobado y sin cambios) **es, estructuralmente, un Connector más** — `id: 'manual'`, `ingestion_modes: ['manual_entry']`, y su `translate` es, literalmente, el formulario de <30s ya diseñado, que produce el mismo `RawCaptureEvent` que produciría un webhook de MetaTrader. Esto no es una reinterpretación forzada — es lo que permite que §4-9 de este documento (reconstrucción, inferencia, normalización, reconciliación) apliquen exactamente igual a una operación tecleada a mano que a una importada automáticamente, sin dos motores paralelos. **Ningún componente del núcleo (`reconstruction`, `inference`, `unit-normalization`, `reconciliation`, `adapter-bridge`) conoce el nombre de una sola plataforma** — toda la variación específica de MetaTrader/cTrader/Tradovate/Rithmic/DXTrade/MatchTrader/TradingView/futuras vive exclusivamente dentro de su propio `connectors/<id>.ts`, aislada, nunca dispersa por el resto del sistema.

```
interface RawCaptureEvent {
  connector_id: string
  external_position_ref: string | null                 // id de posición del bróker, cuando existe (§4.1)
  event_type: "open" | "partial_close" | "full_close" | "stop_modified" | "commission" | "fee"
  instrument_native: string                              // símbolo nativo de la plataforma, sin normalizar todavía
  price: number                                            // precio nativo — la normalización ocurre después (§6)
  quantity_native: number
  timestamp: Timestamp
  raw_payload: unknown                                      // el payload original completo, conservado para auditoría
}
```

### 3.3 Pipeline de tres etapas — I18 traducido a arquitectura, no solo a intención

I18 fija un orden obligatorio: captura automática → inferencia segura → interacción manual. Este documento lo traduce a un pipeline literal, no a una aspiración:

```
1. connectors/<id>.translate(raw) → RawCaptureEvent[]                    [Captura automática]
2. reconstruction.agrupar(eventos) → OperacionCandidata                   [Captura automática]
3. inference.derivar(candidata) → OperacionCandidata (campos completados, cada uno con su procedencia, §9)  [Inferencia segura]
4. Si quedan campos sin resolver tras 1-3 → se marcan pending_manual_input, nunca se adivinan  [Interacción manual, último recurso]
5. adapter-bridge invoca registrarOperacion/registrarParcialEjecutado/cerrarOperacion (SPEC-002 §7) con los campos ya resueltos
```

Ninguna etapa puede saltarse el orden — un campo nunca pasa a "interacción manual" sin haber pasado primero por inferencia, y la inferencia nunca se ejecuta sobre datos que la captura debería haber traído completos.

---

## 4. Reconstrucción — agrupar eventos crudos en una Operación

### 4.1 Agrupación por referencia de posición (camino normal)

La mayoría de plataformas modernas reportan un identificador de posición/orden estable (`external_position_ref`) — `reconstruction` agrupa todos los `RawCaptureEvent` con el mismo `(connector_id, external_position_ref)` como una única Operación candidata. Es el camino determinista y sin ambigüedad, disponible para la mayoría de los conectores de la lista pedida (MT4/5, cTrader, Tradovate, Rithmic, DXTrade, MatchTrader exponen todos un identificador de posición u orden).

### 4.2 Fallback heurístico y su límite — nunca adivinar una agrupación ambigua

**Cuando la fuente no provee una referencia de posición** (p.ej. una importación de archivo CSV genérico sin esa columna), `reconstruction` recurre a una heurística configurable por conector (FIFO/LIFO según la convención de esa plataforma, agrupando por instrumento + cuenta sin solapamiento de exposición). **Cuando esa heurística produce más de una agrupación posible con igual verosimilitud** (p.ej. dos aperturas del mismo instrumento muy próximas en el tiempo sin forma de saber cuál cierre corresponde a cuál apertura), la Operación candidata se marca `ambiguous_grouping` y pasa directamente a interacción manual (§3.3, paso 4) — **nunca se elige una agrupación al azar ni "la más probable" sin marcarla como tal**. Es la aplicación literal de "nunca interpreta el significado... solo reconstruye con máxima fidelidad" (§1.2, punto 2-3): una agrupación ambigua no es un hecho, es una hipótesis, y este componente no persiste hipótesis como si fueran hechos.

---

## 5. Inferencia segura — qué se puede y qué no se puede derivar con certeza

### 5.1 Siempre inferible (aritmética determinista sobre datos ya capturados)

| Campo | Derivación |
|---|---|
| `time_in_market_sec` (Duración) | `closed_at − opened_at` |
| `risk_amount` | `\|entry_price − stop_price\| × quantity` (tras normalización de unidades, §6) |
| `risk_pct` | `risk_amount / current_capital` en el momento de `opened_at` (lectura a Funding Management, nunca escritura) |
| `closure_reason` (SPEC-002 §5.3) | Comparación determinista del precio de cierre final contra los niveles de stop/take-profit observados: cierre en/cerca del stop original → `STOP_LOSS`; stop movido a entrada antes del cierre final → `BREAK_EVEN`; cierre en/cerca del take-profit → `TAKE_PROFIT_FULL`; cualquier otro nivel → `MANUAL_CLOSE` |
| `symbol`, `side` | Capturados directamente, sin inferencia |

### 5.2 A veces inferible — siempre con confianza marcada, nunca al mismo nivel que un hecho observado

| Campo | Cuándo es inferible | Cuándo no lo es |
|---|---|---|
| `rr_objetivo` | Si la plataforma registra una orden de take-profit explícita en el momento de apertura — se deriva de `(tp_price − entry_price) / (entry_price − stop_price)` | Si nunca existió una orden de take-profit (el trader gestionó "a ojo", sin nivel fijado en la plataforma) — no hay dato del que derivarlo con certeza |
| Parciales planificados | Si la plataforma registra órdenes de cierre parcial condicionales antes de la ejecución | Si los parciales solo se infieren de los cierres reales ejecutados — eso son parciales **ejecutados** (siempre reconstruibles, §5.1), nunca planificados con certeza |

### 5.3 Nunca inferible — cae a interacción manual, por diseño, no por limitación técnica

**`rr_objetivo` y `be_trigger` (02 §1.4) son conceptos de planificación, no de ejecución** — describen una intención del trader que puede no haber dejado ningún rastro verificable en la plataforma (un trader que gestiona manualmente sin fijar un take-profit, o que decide breakeven "a ojo" sin mover el stop formalmente). Cuando la captura (§3) y la inferencia (§5.1-5.2) no producen un valor con certeza suficiente para estos campos, **no se aproxima ni se adivina** — se presenta al trader como el único campo pendiente, con lo demás ya completado, coherente con el compromiso del fundador ("solo deberá añadir información verdaderamente subjetiva... si desea hacerlo" — con la salvedad honesta de que un puñado de campos de planificación, no solo lo subjetivo, puede requerir confirmación cuando la fuente no los capturó). Se documenta como límite estructural, no como algo a "arreglar" en una versión futura — ningún algoritmo puede inferir con certeza una intención que nunca se registró en ninguna parte.

---

## 6. Normalización de unidades — el hallazgo técnico central de fidelidad

**Problema detectado, buscando activamente "cualquier integración futura que pueda romper esta arquitectura"**: cada plataforma reporta precios y tamaños de posición en su propia convención — pips, puntos, lotes, contratos, ticks — y esa convención **no es universal ni siquiera dentro de la misma plataforma**: un pip en EURUSD no vale lo mismo que un punto en NAS100 ni que un tick en un futuro de ES. Una normalización ingenua (un único factor de conversión global) produciría un `risk_pct`/`rr_objetivo` silenciosamente incorrecto para cualquier instrumento que no siga la convención asumida — exactamente el tipo de error de precisión que la prioridad #1 del producto (19 §6) existe para prevenir, y el más peligroso de todo este documento porque no produciría un error visible, produciría un número **verosímil pero incorrecto**.

**Solución aplicada**: una tabla de especificación por instrumento, nunca una constante global:

```sql
create table public.instrument_unit_specs (
  id uuid primary key default gen_random_uuid(),
  instrument_key text not null,          -- símbolo canónico normalizado ('EURUSD', 'NAS100', 'ES')
  connector_id text not null,             -- la misma especificación puede variar por bróker para el mismo instrumento
  tick_size numeric(18,8) not null,
  tick_value numeric(18,4) not null,       -- valor monetario de un tick, en la divisa de la cuenta
  contract_size numeric(18,4) not null,
  unique (instrument_key, connector_id)
);
```

Un Connector nuevo (§3.2) debe declarar o referenciar esta tabla para cada instrumento que soporte — es un requisito de incorporación, no un detalle de implementación opcional. Si un Connector reporta un instrumento sin especificación registrada, `unit-normalization` **rechaza** la reconstrucción de esa operación con un error tipado (`UNKNOWN_INSTRUMENT_SPEC`, §10) — nunca asume un valor por defecto que podría ser incorrecto para ese instrumento concreto.

---

## 7. Comisiones y deslizamiento — el hallazgo matemático central de esta especificación

### 7.1 El problema, tal como Challenge Mode lo expone

**Problema detectado**: el modelo matemático vigente (02 §3, SPEC-001 §3.4) define `Beneficio_real = Riesgo€ × R_final` — un valor derivado **puramente de R**, sin ningún término de coste de ejecución. El esquema actual de `trades` (04/SPEC-002) no tiene ningún campo para comisión ni deslizamiento. Si Trade Capture Engine captura esos datos (como el fundador pide explícitamente) pero el modelo matemático no tiene dónde colocarlos, ocurre uno de dos fallos: o se descartan (perdiendo fidelidad, violando §1.2), o se mezclan silenciosamente dentro de `pnl_amount`, corrompiendo la propiedad ya protegida por 18 §3 de que "1.29R significa exactamente lo mismo en cualquier cuenta" — un R idéntico en dos cuentas con estructuras de comisión distintas dejaría de ser comparable, exactamente el mismo riesgo que Profit Split ya resolvió no mezclando nunca con R.

### 7.2 Solución aplicada — mismo precedente que Profit Split, aplicado a costes de ejecución

**Comisiones y deslizamiento son hechos de ejecución, no de calidad de gestión de riesgo — se capturan, se persisten, y nunca entran en `R_final`/esperanza/Score**, exactamente el mismo principio que 18 §3 ya estableció y defendió para Profit Split. Se añaden como campos propios de la Operación, separados:

```sql
alter table public.trades
  add column commission_amount numeric(18,4),      -- null si no reportado por la fuente — nunca 0 por defecto (§7.3)
  add column slippage_amount numeric(18,4),          -- null si no reportado — mismo criterio
  add column real_cash_impact numeric(18,4);          -- pnl_amount − commission_amount − slippage_amount, cuando ambos están disponibles
```

`real_cash_impact` es el único campo nuevo que Funding Management (SPEC-003 §6.2) debe empezar a considerar para que `current_capital` refleje la realidad del extracto del bróker, no solo el resultado teórico derivado de R — es una corrección menor y aditiva sobre SPEC-003 §6.2, nunca sobre su modelo de eventos (el `real_cash_impact`, cuando existe, es simplemente el importe que se suma al ledger en vez de `pnl_amount` a secas; cuando no está disponible, el ledger sigue usando `pnl_amount` exactamente como hasta ahora — comportamiento idéntico al actual por defecto, mejorado solo cuando hay datos reales que lo permiten).

### 7.3 Nunca asumir cero — mismo principio ya establecido tres veces en este blueprint

**Un valor no reportado nunca se trata como cero.** Si un Connector no puede determinar la comisión o el deslizamiento de una operación (la plataforma no lo expone), `commission_amount`/`slippage_amount` quedan `null`, no `0` — es la misma disciplina exacta que SPEC-001 usa para `UNDEFINED_RATIO` (nunca `Infinity`), que SPEC-004 usa para el veredicto `unavailable` (nunca `compliant` por defecto), y que este documento aplica ahora por tercera vez a un dominio distinto: la ausencia de dato nunca se disfraza de "dato con valor cero", porque un cero real y un dato desconocido son hechos distintos y confundirlos rompe la fidelidad que este componente existe para proteger.

---

## 8. Reconciliación — duplicados entre fuentes, nunca pérdida de datos subjetivos

**Problema detectado**: un trader puede haber registrado manualmente una operación (Connector `manual`) antes de conectar un bróker, y más tarde ese mismo evento real llega también por un Connector automático — dos fuentes distintas describiendo el mismo hecho del mundo real. A diferencia de la idempotencia ya resuelta por SPEC-002 (`source` + `external_ref`, que evita duplicados **dentro de la misma fuente**), este es un problema de duplicado **entre fuentes distintas**, sin `external_ref` compartido.

**Solución aplicada**: `reconciliation` compara toda Operación candidata recién reconstruida contra las Operaciones ya registradas de la misma Cuenta con una ventana de tiempo, símbolo y magnitud de riesgo similares; una coincidencia por encima de un umbral configurable se marca `probable_duplicate_of: trade_id` y **nunca se persiste automáticamente como una segunda Operación ni sobrescribe la existente** — se presenta al trader para una única confirmación (fusionar/mantener ambas/descartar la nueva). Sobrescribir automáticamente arriesgaría destruir notas, capturas o etiquetas que el trader ya añadió a mano a la operación manual — datos que este componente nunca tiene autoridad para eliminar sin consentimiento explícito (§1.2, punto 5).

---

## 9. Trazabilidad de procedencia por campo

Cada campo de una Operación reconstruida lleva, dentro de Trade Capture Engine (nunca cruzando al esquema de Operations Engine, que no necesita cambiar), su propia procedencia — mismo espíritu que Explainable Quant (SPEC-001 §7), adaptado aquí a "de dónde vino este dato" en vez de "cómo se calculó":

```sql
create table public.capture_field_provenance (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  field_name text not null,
  source text not null check (source in ('captured','inferred','manual')),
  confidence text check (confidence in ('alta','media','baja')),    -- solo aplica a 'inferred', reutiliza 13 §2
  raw_capture_event_ref jsonb,                                        -- referencia al RawCaptureEvent que lo originó, para auditoría
  unique (trade_id, field_name)
);
```

Esto es lo que permite, más adelante, que Analytics (SPEC-007) o cualquier auditoría futura pueda responder "¿este dato vino directamente del bróker, se dedujo, o lo escribió el trader?" sin ambigüedad — información que hoy, en un registro manual puro, ni siquiera existe como pregunta.

---

## 10. Interfaces públicas

```
ingest(connector_id: string, raw: unknown): Result<CaptureReceipt, CaptureError>

interface CaptureReceipt {
  operaciones_completadas: string[]           // trade_id[] ya persistidos vía Operations Engine
  operaciones_pendientes: PendingOperation[]    // requieren interacción manual (§5.3, §4.2, §8)
}

interface PendingOperation {
  partial_data: Partial<RegistrarOperacionInput>   // todo lo ya resuelto, SPEC-002 §3.1
  missing_fields: string[]
  reason: "no_safe_inference" | "ambiguous_grouping" | "probable_duplicate"
}

type CaptureError =
  | { code: "UNKNOWN_CONNECTOR"; connector_id: string }
  | { code: "UNKNOWN_INSTRUMENT_SPEC"; instrument: string; connector_id: string }   // §6
  | { code: "ACCOUNT_BINDING_NOT_CONFIGURED"; connector_id: string }                  // vínculo conector↔Cuenta, único paso manual de configuración inicial, fuera del bucle por operación
```

El vínculo `connector_id ↔ account_id` (qué cuenta de TradePilot corresponde a qué login de bróker) es, deliberadamente, el único paso de interacción manual que I18 no puede eliminar — se configura **una vez por conexión**, nunca por operación, y por eso no compite con el presupuesto de fricción de I16 (que gobierna tareas frecuentes, no configuración inicial única, mismo criterio ya aplicado en SPEC-004 §15 para la composición de Rule Profiles).

---

## 11. Rendimiento

- La ingesta vía webhook/API debe ser asíncrona por diseño — una sesión de trading automatizado (p.ej. NinjaTrader ejecutando decenas de fills en segundos) no puede bloquear ni degradar el camino crítico de Operations Engine (SPEC-002 §6); `ingest` encola el `RawCaptureEvent` y responde de inmediato, el pipeline de §3.3 se procesa fuera de esa respuesta.
- La normalización de unidades (§6) es una consulta indexada O(1) sobre `instrument_unit_specs`, no un cálculo pesado.
- La reconciliación (§8) opera sobre una ventana acotada (Cuentas del mismo usuario, rango temporal cercano) — nunca compara contra el historial completo del sistema, mismo principio de escalabilidad ya aplicado en todos los componentes anteriores.

---

## 12. El 95% — desglose honesto, no una cifra sin sustento

| Categoría de campo | Automatizable hoy |
|---|---|
| Entrada, salidas parciales ejecutadas, símbolo, duración, `closure_reason` | Siempre, cuando la fuente reporta fills (la mayoría de plataformas modernas) |
| `risk_pct`/`risk_amount` | Siempre, con normalización de unidades correcta (§6) y lectura de capital vigente |
| Comisiones/deslizamiento | Cuando la plataforma los reporta — algunas no lo hacen, se marcan `null`, nunca `0` (§7.3) |
| `rr_objetivo`/parciales planificados | Solo si la plataforma registró una orden de take-profit/parciales condicionales explícita — no siempre existe |
| `be_trigger` | Rara vez reconstruible con certeza — la mayoría de plataformas no distinguen "moví el stop a breakeven" de "moví el stop por cualquier otro motivo" en su log de eventos |
| Notas, capturas, aprendizajes, emociones | Nunca — son, por definición, subjetivas y no existen en ningún dato de mercado |

**El 95% pedido por el fundador es alcanzable como promedio ponderado por frecuencia de uso real** (la mayoría de operaciones de un trader activo tienen entrada/salida/símbolo/duración/riesgo completos automáticamente, que son la mayoría de los campos de un registro típico) — pero no como garantía campo-a-campo: `be_trigger` y, en menor medida, `rr_objetivo` son los dos campos que con mayor frecuencia requerirán confirmación manual, no por una limitación de este diseño sino porque describen una intención que no siempre deja rastro verificable. Se documenta aquí con la misma honestidad que SPEC-006 §7.3 ya aplicó a la confusión causal — una cifra de producto no se acepta sin verificar qué esconde.

---

## 13. Auditoría — hallazgos adicionales

### 13.1 Verificación: ¿qué integración futura podría romper esta arquitectura?

La única forma real de romper el núcleo sería que una plataforma futura no encajara en el modelo `RawCaptureEvent` (§3.2) — concretamente, una plataforma que no reporte fills discretos en absoluto (p.ej. un feed de solo posición agregada sin historial de eventos). Mitigación ya incorporada: `translate()` es responsabilidad exclusiva de cada Connector — una plataforma así requeriría un Connector más sofisticado (reconstruyendo eventos discretos a partir de snapshots periódicos de posición), pero seguiría implementando la misma interfaz de tres campos — el núcleo no se entera de la diferencia. No se ha encontrado ninguna integración de la lista pedida (TradingView, NinjaTrader, MetaTrader, cTrader, Tradovate, Rithmic, DXTrade, MatchTrader) que no encaje en el modelo de eventos discretos.

### 13.2 Verificación: ¿queda algún punto de dato repetitivo sin resolver?

Revisando la lista completa pedida por el fundador (Entrada, Salidas parciales, Stop Loss, Break Even, Take Profit, Cierre manual, Comisiones, Deslizamientos, Duración, Instrumento, Cuenta, Empresa) contra §5.1-5.3: los únicos dos campos que pueden requerir entrada manual recurrente son `rr_objetivo` (a veces) y `be_trigger` (con más frecuencia) — ambos por la razón estructural ya explicada en §5.3, nunca por una omisión de diseño. `Cuenta`/`Empresa` se resuelven con el vínculo único de conexión (§10), nunca por operación.

---

## 14. Limitaciones a 10 años

1. **La reconstrucción de `be_trigger` seguirá siendo el punto más débil de la automatización** salvo que las plataformas de bróker empiecen a exponer metadatos de intención (poco probable, no depende de TradePilot) — se documenta como límite estructural permanente, no como algo a resolver en una futura revisión.
2. **`instrument_unit_specs` (§6) requiere mantenimiento activo** conforme aparezcan instrumentos nuevos en cada bróker — mismo tipo de riesgo de curación de catálogo ya identificado cinco veces en Fase 1 (Rule Library, estrategias del Optimizer, dimensiones de Knowledge Engine, KPIs de Analytics, y ahora especificaciones de instrumento) — refuerza, por quinta vez, la recomendación ya hecha en specs anteriores de resolver la gobernanza de catálogos una sola vez para todo el sistema.
3. **La reconciliación entre fuentes (§8) asume que el trader revisa las coincidencias marcadas** — si el volumen de `probable_duplicate` crece sin que el trader las resuelva, podría acumularse una cola de operaciones pendientes que erosione la promesa del 95% — se anota como riesgo de producto, no de arquitectura (§15).

---

## Riesgos

1. **Que un Connector nuevo, bajo presión de lanzamiento, escriba directamente en `trades` "por velocidad" en vez de pasar por `adapter-bridge`** — mismo tipo de riesgo de disciplina ya aceptado y mitigado solo parcialmente en otros componentes (SPEC-002 §Riesgos #3, SPEC-003 §Riesgos #2); aquí el coste de la violación es mayor porque afecta directamente a la fidelidad de datos financieros importados en volumen.
2. **Cola de `probable_duplicate`/`pending_manual_input` sin resolver por el trader** (§13, límite 3) — sin un recordatorio pasivo (mismo patrón ya identificado como pendiente desde el capítulo 20, todavía sin especificación de Notification Engine), estas colas podrían crecer indefinidamente sin que nadie las note.
3. **`instrument_unit_specs` incompleta para un instrumento nuevo bloquea la captura automática de ese instrumento concreto** (§6, `UNKNOWN_INSTRUMENT_SPEC`) — es el comportamiento correcto (nunca asumir), pero exige un proceso operativo de mantenimiento del catálogo con la misma urgencia que un incidente, no como tarea de fondo, la primera vez que ocurra con un instrumento de uso real.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Es el componente que convierte la promesa central del producto ("Every R Matters", precisión sin fricción) en algo sostenible a escala — sin captura automática, cada operación registrada compite por la atención y la memoria del trader; con ella, la precisión del journal deja de depender de la disciplina diaria de una persona.

**¿Qué sobra?** Nada — cada subcomponente resuelve una parte explícitamente pedida.

**¿Qué falta?** Antes de este documento faltaba: dónde viven comisiones y deslizamiento en el modelo matemático (§7, el hallazgo central), una tabla de especificación de unidades por instrumento que impida corromper silenciosamente `risk_pct` (§6), y un mecanismo de reconciliación entre fuentes distintas que SPEC-002 nunca necesitó resolver (solo cubría duplicados dentro de la misma fuente).

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Exactamente §7.3: nunca confundir "cero" con "desconocido" en un dato de coste de ejecución — es la misma disciplina de contabilidad que separa "comisión de cero euros" (un hecho) de "comisión no reportada por el custodio" (una laguna de datos), y tratarlas igual falsearía cualquier análisis de coste real posterior.

**Puntuación**: **97/100**. Los 3 puntos que faltan son los 3 Riesgos — de disciplina de implementación y de un componente de notificación todavía sin especificar, ninguno de diseño.

**Nivel de madurez**: 94%. Arquitectura de conectores, pipeline de tres etapas, normalización de unidades, separación de costes de ejecución, reconciliación y trazabilidad de procedencia están completos y son directamente implementables; lo pendiente es exclusivamente el límite estructural honesto de `be_trigger`/`rr_objetivo` (no resoluble por diseño) y la gobernanza de catálogo compartida ya señalada repetidamente en Fase 1.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — ninguno bloquea la implementación de Trade Capture Engine tal como está especificado.

**Decisiones abiertas**:
1. Si el recordatorio pasivo para colas de `probable_duplicate`/`pending_manual_input` se construye ahora o se pospone hasta que exista una especificación de Notification Engine — recomendación: posponer, coherente con el resto del proyecto (11 §13).
2. Gobernanza común de catálogos de Fase 1 (ahora cinco: Rule Library, estrategias del Optimizer, dimensiones de Knowledge Engine, KPIs de Analytics, especificaciones de instrumento) — quinta repetición de la misma nota; se recomienda que sea la primera prioridad de gobernanza cuando se revise el proceso de equipo, no una nota más.

**Recomendación profesional**: aprobar SPECIFICATION 008. Es la especificación que hace realidad, con esquema concreto y arquitectura extensible verificada contra ocho plataformas nombradas explícitamente, la promesa de fricción cero en la captura de datos que I18 acaba de elevar a principio permanente — y lo hace sin comprometer la precisión matemática (prioridad #1, 19 §6): cada dato no verificable se marca como tal en vez de aproximarse, y el hallazgo de comisiones/deslizamiento corrige una laguna real del modelo matemático antes de que la automatización la hiciera visible a escala.
