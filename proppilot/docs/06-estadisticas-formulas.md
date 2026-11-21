# 06 — Estadísticas: definiciones matemáticas

## 0. Convenciones

- Todas las métricas se calculan **por usuario** (`owner_id = auth.uid()`), dentro de los filtros activos.
- Periodo `[d₀, d₁]` aplicado sobre la **fecha contable** del registro (`occurred_on`, `requested_on`, `paid_on`, `opened_on`, `closed_at`, según la métrica — se indica en cada una).
- Finanzas en **EUR** usando `amount_eur` (instantánea guardada). Nunca se reconvierte con tipos actuales.
- Se excluyen siempre los movimientos anulados (`voided_at is not null`) y los `pending` salvo donde se diga.
- **Criterio de caja** (recomendado, D6): un gasto cuenta cuando se paga y un ingreso cuando se cobra.
- Si un denominador es 0, el indicador se muestra como **"—"** (no 0 %, no ∞), con tooltip "sin datos suficientes".
- Porcentajes con 1 decimal; importes con 2.

Notación: `T` = conjunto de movimientos válidos del periodo; `Σ_k` = suma de `amount_eur` de los movimientos de tipo `k`.

## 1. Finanzas

| Indicador | Fórmula | Notas |
|-----------|---------|-------|
| **Inversión bruta en cuentas** `I_b` | `Σ purchase + Σ reset_fee + Σ activation_fee + Σ renewal_fee` | Dinero gastado en obtener y mantener cuentas |
| **Reembolsos** `R` | `Σ refund` | |
| **Total invertido** `I` | `I_b − R` | Inversión neta en cuentas |
| **Otros gastos** `O` | `Σ data_fee + Σ platform_fee + Σ tool_subscription + Σ bank_fee + Σ other_expense` | Incluye comisiones de cobro si se registran separadas |
| **Total gastado** `G` | `I + O` | Coste total de la actividad |
| **Payouts solicitados** `P_s` | `Σ requested_amount × fx(requested_on)` de payouts con `requested_on ∈ periodo`, estado ≠ `cancelled` | **Estimación** (EUR al tipo BCE de la fecha de solicitud). Informativo, no es ingreso |
| **Payouts aprobados** `P_a` | `Σ approved_amount × fx(approved_on)` de payouts en estado `approved` o `paid`, `approved_on ∈ periodo` | Estimación. Informativo |
| **Payouts cobrados (bruto recibido)** `P_c` | `Σ payout_receipt` con `occurred_on ∈ periodo` | **Ingreso real**. Importe que llegó, en EUR |
| **Ingresos totales** `In` | `P_c + Σ other_income` | |
| **Beneficio neto** `B` | `In − G` | |
| **ROI** | `B / G × 100` | Denominador = **total gastado** `G`. "—" si `G = 0` |
| **Múltiplo de recuperación** | `In / G` | 1,0× = punto de equilibrio. Más intuitivo que el ROI para no técnicos |
| **Gastos pendientes** | `Σ amount_eur` de movimientos de salida con `status = 'pending'` (suscripciones/renovaciones programadas aún no cargadas) | No entra en `G` hasta que se liquida |
| **Pendiente de cobro** | `Σ approved_amount × fx` de payouts `approved` aún no `paid` | Informativo, no es ingreso |
| **Resultado mensual** `B_m` | `In_m − G_m` para cada mes natural `m` (Europe/Madrid) | |
| **ROI mensual** | `B_m / G_m × 100` | Muy volátil (meses sin gasto → "—"). Por eso se muestra también el **ROI acumulado** `Σ_{≤m} B / Σ_{≤m} G` |

**Comisiones del payout:** si la plataforma de pago descuenta comisiones antes del ingreso, `payout_receipt` ya es neto
y no se registra `bank_fee`. Si se cobran aparte, se registra `payout_receipt` bruto + `bank_fee`. El formulario lo guía
para no restar dos veces. Prueba automática específica (doc 07).

**¿Por qué el ROI usa `G` y no `I`?** Porque los gastos en datos, plataformas y herramientas son coste real de obtener
los payouts. Se ofrece también "ROI sobre cuentas" `= (In − I) / I` como métrica secundaria, claramente etiquetada.

## 2. Cuentas

Recuentos sobre el estado **actual** (no dependen del periodo salvo "compradas"):

| Indicador | Fórmula |
|-----------|---------|
| **Total compradas** | `count(transactions)` con `kind = 'purchase'`, `occurred_on ∈ periodo` |
| **Evaluaciones activas** | `count(accounts)` con `phase = 'evaluation'`, `status = 'evaluation_active'` |
| **Evaluaciones superadas** | `count(evaluation_attempts)` con `outcome = 'passed'`, `ended_on ∈ periodo` |
| **Funded activas** | `count(accounts)` con `phase = 'funded'`, `status = 'funded_active'` |
| **Quemadas** | `count(accounts)` con `status = 'burned'` (desglosado: en evaluación / en funded, según `phase`) |
| **Cerradas** | `count(accounts)` con `status = 'closed'` (excluye las cerradas por "convertida a funded", que se muestran aparte para no inflar) |

## 3. Conversión

Se miden sobre **cohortes** para que numerador y denominador se refieran a las mismas cuentas:
la cohorte del periodo = cuentas/intentos **iniciados** en el periodo.

| Indicador | Numerador | Denominador |
|-----------|-----------|-------------|
| **Tasa de superación** | intentos de la cohorte con `outcome = 'passed'` | intentos de la cohorte **concluidos** (`passed + failed + abandoned`). Los `ongoing` se excluyen y se muestra su número aparte |
| **Tasa de quema (evaluación)** | intentos de la cohorte `failed` | intentos concluidos de la cohorte |
| **Tasa de quema (funded)** | cuentas funded de la cohorte en `burned` | cuentas funded de la cohorte en estado terminal (`burned + closed`) |
| **Conversión evaluación → funded** | cuentas de evaluación de la cohorte que originaron ≥1 cuenta funded (o pasaron a `funded_active`) | cuentas de evaluación de la cohorte con algún desenlace final |
| **Intentos por funded** | nº de intentos de la cohorte | nº de cuentas funded obtenidas por la cohorte |
| **Coste medio por cuenta funded** | `I` (inversión neta en cuentas) atribuida a la cohorte — compras, resets y activaciones vinculadas a sus cuentas/intentos | nº de cuentas funded obtenidas por la cohorte |
| **Coste por payout conseguido** | `G` del periodo | nº de payouts con `paid_on ∈ periodo` |
| **Funded con ≥1 payout** | cuentas funded con algún payout `paid` | cuentas funded totales |

Ejemplo: compras 4 evaluaciones (4 × 150 € = 600 €), haces 2 resets (2 × 80 € = 160 €), superas 2 y te activan ambas
(2 × 120 € = 240 €). Intentos concluidos = 6, superados = 2 → tasa de superación 33,3 %. Coste por funded = (600+160+240)/2 = **500 €**.

## 4. Trading (capital nominal, en divisa de la cuenta)

Universo: `trades` cerradas (`closed_at ∈ periodo`) de las cuentas filtradas. Si se mezclan divisas, se agrupa por divisa
(no se suman USD y EUR de trading).

| Indicador | Fórmula |
|-----------|---------|
| **Nº de operaciones** `N` | `count` de operaciones cerradas |
| Ganadoras / perdedoras / break-even | `net_pnl > 0` / `< 0` / `= 0` |
| **Win rate** | `ganadoras / (ganadoras + perdedoras)`. Break-even fuera del denominador, mostrado aparte |
| **Beneficio bruto** `GP` | `Σ net_pnl` de ganadoras |
| **Pérdida bruta** `GL` | `|Σ net_pnl|` de perdedoras |
| **Resultado neto** | `GP − GL` = `Σ net_pnl` |
| **Profit factor** | `GP / GL`; "—" si `GL = 0` |
| **Riesgo inicial** de una operación | `|entry − stop| × quantity × point_value` |
| **R múltiple** de una operación | `net_pnl / riesgo inicial` (solo si hay stop y `point_value`) |
| **R medio** | media de `r_multiple` de las operaciones con R definido; se muestra "basado en n de N operaciones" |
| **Expectativa** | `Σ net_pnl / N` |
| **Evolución mensual** | `Σ net_pnl` por mes de `closed_at`, y curva acumulada |

## 5. Por empresa

Las mismas fórmulas de §1–§3 con el filtro adicional `firm_id = f`:

| Indicador | Fórmula |
|-----------|---------|
| Inversión por empresa | `I_f` |
| Payouts cobrados por empresa | `P_c,f` |
| ROI por empresa | `(In_f − G_f) / G_f`, donde `G_f` solo incluye gastos con `firm_id = f` |
| Tasa de aprobación por empresa | tasa de superación con cohorte filtrada por `f` |
| Coste por funded por empresa | coste medio por cuenta funded con cohorte filtrada por `f` |

**Gastos no atribuibles a una empresa** (herramientas, suscripciones de datos genéricas): no entran en `G_f`. Por ello
`Σ_f B_f ≠ B` en general; la tabla por empresa muestra una fila final "No atribuido" para que cuadre con el total.

## 6. Reglas anti-duplicidad contable

1. El dinero solo se suma desde `transactions`. `payouts` y `accounts` nunca aportan importes a las finanzas reales.
2. Un payout tiene como máximo un `payout_receipt` válido (índice único).
3. `dedupe_key` único por (usuario, tipo) bloquea registrar dos veces la misma factura o pedido.
4. Un documento confirmado no puede volver a confirmarse (estado + transacción SQL).
5. Las cuentas funded nacidas de una evaluación no son "compras".
6. Anulaciones en lugar de borrados → siempre se puede reconstruir y auditar el total.
7. **Invariante de cuadre** (probada en CI y comprobable en la app): `B = Σ (amount_eur × direction)` sobre `T`.

## 7. Implementación

- Funciones SQL `SECURITY INVOKER` (`stats_finance(d0, d1, filters)`, `stats_accounts(...)`, …) que devuelven agregados ya calculados → una sola consulta por bloque.
- La misma lógica se implementa como **función de referencia en TypeScript** usada solo en pruebas: ambos cálculos deben coincidir sobre los conjuntos de datos de prueba ("dos implementaciones, un resultado").
