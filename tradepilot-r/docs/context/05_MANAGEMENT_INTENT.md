# 05 · MANAGEMENT INTENT

> La pieza conceptualmente más original del producto, y la que más fácilmente se
> malinterpreta. Léela entera antes de tocar nada que la roce.

---

## 1. Qué es

**Una Management Intent es una decisión del trader, tratada como entidad propia,
anterior e independiente de la Operación.**

> *"Voy a operar EURUSD en largo, con este Plan, en estas tres cuentas,
> arriesgando 1%, y esta decisión vale durante las próximas dos horas."*

Eso es una Intención. Puede materializarse en 0, 1 o N Operaciones —una por
cuenta destino— o no materializarse en ninguna.

**Por qué existe**: separa *lo que decidí* de *lo que ocurrió*. Sin ella, un
trader no puede distinguir una mala decisión de una mala ejecución, que es
exactamente el problema que TradePilot resuelve.

## 2. Anatomía

### `management_intents` — la decisión (INMUTABLE)

| Campo | Qué es |
|---|---|
| `decided_at` | cuándo se decidió |
| `side` | `long` / `short` |
| `instrument_key` | instrumento en forma **canónica**, nunca el símbolo nativo |
| `valid_from` / `valid_until` | ventana de vigencia. Sin ella, una decisión de hace cuatro horas podría materializarse hoy |
| `contract_version` | versión del contrato entre el núcleo y cualquier conector |
| `idempotency_key` | ámbito `(user_id, …)`: una Intención abarca N cuentas |

Restricción: `valid_until > valid_from`, en el CHECK, no en la disciplina de
quien escriba.

### `management_intent_destinations` — un destino por cuenta

| Campo | Qué es |
|---|---|
| `account_id` | la cuenta destino |
| `frozen_plan` | **el Plan congelado** (ver §3) |
| `risk_transformation` | la decisión de riesgo, ya resuelta |
| `risk_cap_applied` / `risk_cap_reason` | si el tope de cuenta recortó el riesgo |
| `state` | la máquina de estados (ver §4) |
| `trade_id` | la Operación resultante, si se materializó |

## 3. El congelado — el corazón del asunto

`frozen_plan` contiene **exactamente**:

```json
{
  "plan_id":      "<uuid>",
  "rr_objective": "3.0000",
  "be_trigger":   "AFTER_NTH_PARTIAL",
  "partials":     [{ "sequence": "1", "rr_level": "1.0000", "pct_close": "50.00" }]
}
```

Se congela **el mismo subconjunto** que una Operación snapshotea de un Plan.
`condiciones_ejecucion` y `etiqueta_riesgo` quedan fuera a propósito: son
metadatos descriptivos que no participan en ningún cálculo de R.

`plan_id` viaja como **referencia trazable, nunca como clave foránea**: borrar
un Plan jamás queda bloqueado por una Intención.

`risk_transformation` lleva `resolved_risk_pct`, escrito **siempre por el
dominio**. Si el llamante intenta aportarlo, la creación se rechaza: de lo
contrario un cliente podría declarar un riesgo resuelto distinto del que el
sistema juzgó.

Todos los números viajan como **cadenas** (I5).

### Verificado atacándolo

```
Plan creado con rr_objective = 3.0000
→ se crea la Intención
→ se MUTA el Plan a rr_objective = 9.9999 con parciales distintos
→ se materializa
→ la Operación conserva 3.0000 y los parciales originales   ✅
```

Esto funciona porque `crear_operacion_nucleo` **no consulta `management_plans`
en ninguna línea**: recibe un contexto ya resuelto. La ruta de Intención es
*estructuralmente incapaz* de leer el Plan vivo.

## 4. Máquina de estados

```
pending ──► sent ──► materialized
   │           └───► rejected
   ├──► expired      (SOLO desde pending)
   └──► discarded    (SOLO desde pending)
```

**Transiciones legales, exhaustivas:**

| Desde | Hacia |
|---|---|
| `pending` | `sent`, `expired`, `discarded` |
| `sent` | `materialized`, `rejected` |
| terminal | **ninguna** |

⚠️ **`pending → rejected` NO existe.** `rejected` sale de `sent`.
⚠️ **No existe el salto directo `pending → materialized`.**

Por eso `abrir_operacion_desde_intencion` hace **dos UPDATE dentro de la misma
transacción**: `pending → sent` y después `sent → materialized` junto con el
`trade_id`. Un CHECK garantiza `(state = 'materialized') = (trade_id is not null)`.

**Por qué la caducidad solo dispara desde `pending`**: un destino ya enviado al
mercado no "caduca" — su desenlace lo decide lo que pasó, no el reloj.

Verificado: `sent → expired` y `sent → pending` se rechazan con
`INTENT_ERROR:INVALID_STATE_TRANSITION`.

## 5. Inmutabilidad (MI-2)

**Una Intención es inmutable desde su emisión. Cambiar de opinión crea una
Intención nueva.** Dos capas independientes:

1. **RLS**: `management_intents` tiene **solo política de lectura**. No existe
   vía de escritura desde la aplicación.
2. **Trigger**: rechaza `UPDATE` con `INTENT_ERROR:IMMUTABLE_INTENT`.

Se rechaza `UPDATE`, **no `DELETE`**: MI-2 gobierna la mutación.

El destino es la **única pieza mutable** del agregado, y solo en un sentido: su
`state`, por las transiciones de §4.

## 6. Materialización

`abrir_operacion_desde_intencion(destination_id, opened_at, idempotency_key?)`

**No acepta cuenta, Plan, riesgo, lado ni instrumento: todo eso lo declara el
destino.** Secuencia:

1. Propiedad y existencia en una sola consulta (mismo mensaje exista o no el
   destino ajeno: distinguirlos filtraría la existencia de Intenciones de otros).
2. Si el destino ya está `materialized`, **devuelve la Operación existente**.
   Un destino materializado *es* su propia respuesta de idempotencia.
3. Si está en estado terminal, rechaza: un desenlace alcanzado no se reabre.
4. Comprueba la **ventana de vigencia** contra `opened_at`.
5. Lee **todo** del congelado.
6. `pending → sent`, crea la Operación por el núcleo común, `sent → materialized`.

Todo en **una transacción**.

## 7. Idempotencia — dos redes

| Red | Cómo funciona |
|---|---|
| Por clave | `idempotency_key` sobre `(account_id, …)` en `trades` |
| Por estado | un destino `materialized` devuelve su `trade_id` sin crear nada |

La segunda no depende de que el llamante recuerde su clave. Verificado: doble
materialización devuelve el mismo trade, total de operaciones = 1.

## 8. Qué NO está construido

- 🔴 **Caducidad programada** (B6): `expired` es una transición legal, pero nada
  la dispara automáticamente. La caducidad se **deriva en lectura** (`pending`
  con ventana vencida), que no pierde información y deja la transición legal
  para el día que se construya.
- 🔴 **Desenlaces `rejected` / `discarded` por contrato** (B9): legales en la
  máquina, sin RPC que los produzca.
- 🔴 **Interfaz de usuario**: no hay pantalla para crear ni ver Intenciones. Hoy
  solo son alcanzables por RPC.
