# 02 · REGLAS DE DOMINIO E INVARIANTES

> Reglas de negocio **que existen realmente en el código**. Donde una regla está
> solo documentada y no aplicada, se dice.

---

## ⚠️ Corrección importante sobre la numeración

**No existe ningún concepto llamado «axiomas A1–A10» en este proyecto.** El
término «axioma» no aparece en ningún fichero. Si lo lees en una conversación
o en un resumen heredado, está equivocado.

Lo que existe son **invariantes, y van de I1 a I21**, repartidos en dos
documentos:

| Rango | Dónde se define | Qué son |
|---|---|---|
| **I1 – I15** | `docs/23-invariantes-y-principios.md` | Constitución técnica |
| **I16 – I21** | `docs/19-metodologia-y-reglas-del-proyecto.md` §8.1–8.6 | Añadidos al aprobar SPECs posteriores |

**Citados explícitamente en código** (10 de 21):
`I5 · I9 · I11 · I13 · I14 · I15 · I16 · I17 · I18 · I21`

---

## 1. Los invariantes

### I1 – I15 · Constitución técnica

| # | Invariante | ¿Aplicado en código? |
|---|---|---|
| I1 | Ninguna Operación se modifica sin dejar rastro auditable | ✅ `audit_log` + trigger inmutable |
| I2 | Todo cálculo de R, esperanza o drawdown es reproducible de forma determinista | ✅ kernel decimal, dataset dorado |
| I3 | **El historial nunca se altera retroactivamente por editar un Plan o un Perfil de Reglas** | ✅ patrón Snapshot, probado atacándolo |
| I4 | R es una unidad relativa; su valor en euros se deriva del capital y riesgo% de cada operación en su momento | ✅ `risk_amount` congelado al abrir |
| I5 | Dinero y R se operan con precisión decimal exacta, nunca coma flotante | ✅ `decimal.js` aislado en el kernel |
| I6 | Toda recomendación de IA se justifica con datos verificables | 📄 sin IA implementada |
| I7 | Ninguna recomendación depende de datos que el usuario no pueda consultar | 📄 ídem |
| I8 | El aprendizaje de IA es privado por usuario | 📄 ídem |
| I9 | **TradePilot nunca opina sobre la calidad de una entrada** — solo sobre la gestión posterior | ✅ citado en el esquema de Management Intent |
| I10 | **Ninguna empresa de fondeo tiene código específico** — todo por configuración | ✅ ninguna prop firm aparece en el código |
| I11 | Toda Operación ejecuta exactamente un Plan, con o sin nombre — nunca cero | ✅ plan anónimo si no se da uno |
| I12 | Ningún módulo accede al almacenamiento interno de otro | ✅ puertos y adaptadores |
| I13 | **Quien calcula una magnitud de riesgo no es quien la juzga** | ✅ Risk Engine ≠ Rule Engine |
| I14 | El sistema nunca bloquea el registro de la realidad del mercado | ✅ las reglas advierten, no impiden |
| I15 | Toda mutación de una entidad que participe en R, capital o reglas es auditable | ✅ |

### I16 – I21 · Añadidos posteriores

| # | Invariante | Nota |
|---|---|---|
| I16 | **Zero Friction** — nunca dos formularios para entrar y darse de alta | ✅ login = registro |
| I17 | **Evaluate ≠ Execute** — ninguna regla dispara una acción por sí sola | ✅ límite duro del producto |
| I18 | **Automation Before Interaction** — lo que se puede inferir no se pregunta | ✅ empresa personal automática |
| I19 | Attention Is the Most Valuable Currency | 📄 criterio de diseño |
| I20 | Professional Calm | 📄 criterio de diseño |
| I21 | One Thought Rule | ✅ citado en onboarding |

Leyenda: ✅ aplicado en código · 📄 documentado, aún sin código que lo ejerza.

---

## 2. Reglas de Operación

**Nacimiento.** Una Operación nace por **exactamente dos vías**, y no hay una
tercera: `registrar_operacion` (manual) y `abrir_operacion_desde_intencion`
(desde una decisión). Ambas delegan en `crear_operacion_nucleo`, que es la
**única implementación** del alta. El INSERT directo sobre `trades` y la llamada
directa al núcleo están **revocados** para `authenticated` (verificado).

**Capital-neutral.** Abrir una posición **no mueve capital**. Solo el desenlace
lo hace.

**Riesgo congelado.** Al abrir se calcula y persiste una sola vez:

```
risk_amount = capital_en_ese_instante × risk_pct / 100
```

Es el **único sitio del sistema** donde vive esta fórmula. Nunca se recalcula.

**Desenlace.** Cuatro motivos de cierre, exactamente cuatro:

| `closure_reason` | Exige |
|---|---|
| `MANUAL_CLOSE` | `cierre_manual_rr` presente |
| `TAKE_PROFIT_FULL` | `r_max ≥ rr_objetivo` y sin cierre manual |
| `BREAK_EVEN` | ≥1 parcial ejecutado y sin cierre manual |
| `STOP_LOSS` | sin restricción |

**Cancelación ≠ cierre a 0R.** Cancelar exige un motivo, **no mueve capital** y
**no produce desenlace**. El trigger de estado prohíbe `open → cancelled` si
existe algún parcial ejecutado.

**Corrección.** Un desenlace se corrige con previsualización previa (R antes, R
después, diferencia e impacto en capital) y queda registrado en `audit_log`.

## 3. Reglas de evidencia — inmutabilidad

**Los parciales son la evidencia sobre la que se calcula R final.** No se
reescriben ni se borran:

- `trade_partials_executed` — `UPDATE` y `DELETE` denegados por trigger.
- `trade_partials_planned` — ídem.
- `audit_log` — ídem.
- `account_capital_events` — ídem.
- `rule_profile_snapshots`, `rule_evaluations` — ídem.

Verificado: el trigger salta **incluso ejecutando como propietario**, no solo
por RLS. Son dos capas independientes.

## 4. Reglas de capital

- El capital **se deriva** de `account_capital_events`, que son inmutables.
- Un trigger recalcula `accounts.current_capital` tras cada evento.
- `initial` está reservado a la creación de la cuenta: no puede duplicarse.
- Existe un **tope de riesgo por cuenta** (`accounts.max_risk_pct`).

## 5. Idempotencia

Dos claves, con **ámbitos deliberadamente distintos**:

| Entidad | Ámbito | Índice |
|---|---|---|
| `management_intents` | `(user_id, idempotency_key)` | una decisión abarca N cuentas |
| `trades` | `(account_id, idempotency_key)` | una operación vive en una cuenta |

Ambos son índices únicos parciales (`where idempotency_key is not null`).
Comportamiento: **la misma petición dos veces devuelve la fila existente**, no
crea una segunda. Verificado, incluido el camino de carrera por
`unique_violation`.

Para datos importados existe un tercer mecanismo:
`trades(account_id, source, external_ref)`. Ver `06_CONNECTORS.md`.

## 6. Historial

- `audit_log` — correcciones de operaciones, inmutable, con el valor anterior.
- `domain_events` — hechos de dominio con `event_sequence` monotónica y
  propiedad por usuario. ⚠️ **Nadie los consume todavía.**

## 7. La fórmula de R (congelada)

```
R_final = Σ pᵢ·RRᵢ + (100% − Σ pᵢ) · R_cierre_resto
```

`R_cierre_resto` por orden de prioridad:
1. `cierre_manual_rr` si existe
2. `rr_objetivo` si `r_max ≥ rr_objetivo`
3. `0` si hubo al menos un parcial
4. `−1` si no hubo ninguno

Detalle en `04_TRADING_MODEL.md`.

---

## 8. Qué NO es una regla de este sistema

Para evitar que una IA las invente:

- ❌ No hay reglas de ejecución de órdenes.
- ❌ No hay entidad `position` ni `order`.
- ❌ No hay «multiplicadores» (el término no existe en el repositorio).
- ❌ No hay reglas específicas de ninguna empresa de fondeo (I10).
