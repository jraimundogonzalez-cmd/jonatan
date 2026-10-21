# 18 · Cuentas completas y Dashboard Maestro

*Voz: Quant Trader (gestión de riesgo) + Database Architect Senior + UX/UI Designer Senior + CEO*

## 0. Por qué esto es lo que hace que un trader quiera tener este producto

Un trader con varias cuentas fondeadas vive con una pregunta de fondo, todo el tiempo, en todas las firmas a la vez: *"¿estoy a salvo o estoy a un mal día de perder alguna cuenta?"*. Ninguna prop firm responde a esa pregunta de forma agregada — cada una tiene su propio panel, su propia forma de calcular el drawdown, y ninguna conecta ese dato con si el trader está gestionando bien o mal en términos de esperanza matemática. Responder a esa pregunta, para todas las cuentas y todas las firmas a la vez, en una pantalla, con datos correctos, es exactamente el tipo de valor que hace que una suscripción se sienta imprescindible en vez de opcional (16 §7.1) — no porque el producto lo diga, porque cada vez que el trader la abre confirma que sigue vivo en sus 12 cuentas de un vistazo.

## 1. Campos completos de una cuenta — qué ya existía, qué es nuevo

| Campo pedido | Origen | Estado |
|---|---|---|
| Balance inicial | `accounts.initial_capital` | Ya existía (04) |
| Balance actual | `accounts.current_capital` | Ya existía, cache mantenido por trigger (15 §3.1) |
| Objetivo | `account_rules.profit_target_pct` × `initial_capital` | Ya existía como %, se expone también en € (derivado, sin columna nueva) |
| Drawdown permitido | `account_rules.max_total_drawdown_pct` | Ya existía como %, se expone también en € (derivado) |
| Drawdown restante | — | **Nuevo** — requiere resolver primero un matiz que no estaba modelado (§2) |
| Profit Split | — | **Nuevo campo** (§3) |
| Estado (Challenge/Funded/Live/Pausada) | — | **Nuevo campo** (§4), con una quinta adición justificada |
| Historial de operaciones | `trades` filtrado por `account_id` | Ya existía (04, mostrado en Dashboard de cuenta desde 17 §4) |
| Estadísticas individuales | Vistas materializadas por cuenta (04 §5) | Ya existían |

Dos de los nueve campos pedidos ya estaban completamente resueltos; los otros dos (Drawdown restante, Profit Split) obligan a una decisión de dominio que no puede resolverse con una fórmula ingenua — se desarrolla a continuación.

## 2. Drawdown restante — el matiz que no se puede ignorar

**Problema detectado antes de escribir una sola fórmula**: "drawdown permitido" no significa lo mismo en todas las prop firms, y una fórmula única produciría un número incorrecto para una parte relevante de los usuarios (exactamente el tipo de error que un Quant Trader no puede dejar pasar en un producto de gestión de riesgo):

- **Drawdown estático**: el límite se mide siempre desde el capital inicial. Si la cuenta sube, el suelo no se mueve.
- **Drawdown trailing (dinámico)**: el límite se mide desde el **máximo histórico de capital alcanzado**. Si la cuenta sube, el suelo sube con ella — es más estricto y es el que usan varias prop firms conocidas, al menos en la fase de evaluación.

Tratar ambas como si fueran lo mismo daría a un trader con drawdown trailing una falsa sensación de margen que no tiene — el escenario de daño más serio que puede producir este documento si se hace mal.

**Modelo adoptado**:

```sql
alter table public.account_rules
  add column drawdown_type text not null default 'static'
    check (drawdown_type in ('static','trailing'));

alter table public.accounts
  add column peak_capital numeric(18,4);  -- máximo histórico de current_capital, cache mantenido por trigger
```

`peak_capital` se inicializa en `initial_capital` al crear la cuenta y se actualiza en la misma función que ya mantiene `current_capital` (15 §3.1):

```sql
-- dentro de recompute_account_capital(p_account_id), tras calcular el nuevo current_capital:
update public.accounts
set peak_capital = greatest(peak_capital, current_capital)
where id = p_account_id;
```

Fórmulas (todas derivadas, sin tabla nueva, coherente con la disciplina de 15 §1):

```
piso_estático   = initial_capital × (1 − max_total_drawdown_pct / 100)
piso_trailing   = peak_capital    × (1 − max_total_drawdown_pct / 100)
piso_vigente    = drawdown_type = 'static' ? piso_estático : piso_trailing

Drawdown_restante_€ = current_capital − piso_vigente
Drawdown_restante_% = Drawdown_restante_€ / current_capital
```

`Drawdown_restante_%` se expresa sobre `current_capital` (no sobre `initial_capital`) deliberadamente: es la pregunta que el trader realmente hace — *"desde donde estoy ahora, cuánto puedo perder todavía"* — no una fracción abstracta del capital con el que empezó.

## 3. Profit Split — por qué se mantiene fuera del modelo matemático de R

```sql
alter table public.accounts
  add column profit_split_pct numeric(5,2);  -- null si no aplica (challenge, o capital propio)
```

**Decisión de arquitectura que hay que defender explícitamente**: el Profit Split **nunca** entra en el cálculo de `R_final`, esperanza matemática o el Score del optimizador (02, 12). Son magnitudes de naturaleza distinta — R mide la calidad de la decisión de gestión de riesgo, Profit Split mide el reparto económico contractual con la prop firm. Mezclarlas rompería la propiedad más valiosa del modelo matemático (12): que 1.29R signifique exactamente lo mismo en cualquier cuenta, sea cual sea su contrato de reparto — si no fuera así, comparar la esperanza de dos cuentas con distinto Profit Split dejaría de ser una comparación válida, y todo el dashboard agregado (§6) perdería sentido.

Se expone en cambio como una métrica derivada y claramente separada, **Beneficio neto estimado**, calculada solo para cuentas `Funded` con `profit_split_pct` definido:

```
Beneficio_bruto_periodo = Σ pnl_amount de operaciones cerradas desde el último evento
                           'payout' (o 'initial'/'reset' si no ha habido payout aún) en
                           account_capital_events (15 §3.1)
Beneficio_neto_estimado = max(0, Beneficio_bruto_periodo) × (profit_split_pct / 100)
```

`max(0, ...)` porque las prop firms no reparten pérdidas — un periodo en negativo no genera reparto negativo, simplemente no hay payout. Se añade `'payout'` como tipo de evento válido en el ledger de capital (15 §3.1), para poder marcar el inicio de cada nuevo periodo de reparto sin ambigüedad:

```sql
alter table public.account_capital_events
  drop constraint account_capital_events_event_type_check,
  add constraint account_capital_events_event_type_check
    check (event_type in ('initial','deposit','withdrawal','payout','reset','adjustment'));
```

## 4. Estado de la cuenta — máquina de estados, no solo una columna

```sql
alter table public.accounts
  drop column is_active,   -- se solapa con status (5-question filter: mantener ambos duplica
                            -- la fuente de verdad de "¿está viva esta cuenta?" sin necesidad)
  add column status text not null default 'live'
    check (status in ('challenge','funded','live','paused','terminated'));
```

**Quinta adición sobre lo pedido, justificada**: el enunciado pedía Challenge/Funded/Live/Pausada. Falta un estado para una cuenta que **termina de forma definitiva** — challenge fallido, o cuenta funded cerrada por incumplimiento de regla. Confundir eso con "Pausada" (que implica una decisión reversible del propio trader, "hago un descanso") corrompería las estadísticas agregadas de la empresa (08, 16): una cuenta terminada por blow-up contada como simplemente "pausada" inflaría artificialmente el profit factor y la expectativa agregada de esa prop firm, porque seguiría contando sus operaciones como si la cuenta siguiera activa cuando en realidad ya no genera ni puede generar más resultado. Se añade `terminated` como estado final, sin retorno.

**Transiciones válidas**:

```
Cuenta de prop firm:
  Challenge ──(supera evaluación)──▶ Funded ──(pausa)──▶ Pausada ──(reanuda)──▶ Funded
      │                                 │
      └──(falla el challenge)──▶ Terminada    └──(incumple regla / cierre)──▶ Terminada

Cuenta de capital propio (prop_firms.is_personal = true, 04 §1.3):
  Live ──(pausa)──▶ Pausada ──(reanuda)──▶ Live
  (nunca pasa por Challenge/Funded — no aplica; Profit Split tampoco aplica, permanece null)
```

Cada transición de `status` se registra en `audit_log` (15 §3.4) — no se crea una tabla `account_status_events` propia, porque `audit_log` ya está diseñado exactamente para esto (quién cambió qué, cuándo, sobre qué entidad sensible) y crear una segunda tabla de log duplicaría esa responsabilidad sin ganar nada (mismo criterio de 15 §1 aplicado aquí).

## 5. Historial de operaciones y estadísticas individuales

Sin trabajo nuevo que hacer: el historial ya se filtra por `account_id` sobre `trades` (04) y ya se muestra en el Dashboard de cuenta (14 §3, pantalla 6, revisada en 17 §4); las estadísticas individuales ya son las vistas materializadas por cuenta (04 §5). Se listan aquí solo para confirmar que la lista de nueve campos del prompt queda cerrada al 100%, no para repetir diseño ya hecho.

## 6. Dashboard Maestro (renombrado desde "Dashboard global")

Se renombra **Dashboard global → Dashboard Maestro** en todo el blueprint (03 §2, 14 §2-3, 17 §2) — es el nombre correcto para la pantalla que un trader multi-cuenta debe sentir como el centro de mando de todo su capital, no como una vista de "totales" secundaria.

### Objetivo único
Responder, en una sola pantalla, "¿estoy a salvo, y estoy mejorando?" — para todas las cuentas y todas las empresas a la vez.

### Wireframe (móvil, extiende 14 §3 pantalla 7)

```
┌─────────────────────────┐
│ ← Dashboard Maestro        │
│──────────────────────────│
│ Capital total: 312.400 €    │  KPIs agregados, todas las cuentas
│ R acumuladas: +42.6R         │
│ Profit Factor: 1.7           │
│ Expectativa: +1.18R           │
│ Beneficio sacrificado: 8.4k€ │
│──────────────────────────│
│ ⚠ Cuentas en riesgo (2)      │  solo aparece si hay alguna cuenta
│  Apex 50k #2   🔴 DD −92%    │  con drawdown restante < 20%
│  FTMO 25k #1   🟡 DD −74%    │  (umbral de 17 §4, reutilizado)
│──────────────────────────│
│ Por empresa                   │  tabla, no gráfico — cifras exactas
│  FTMO      +18.2R  2/3 🟢     │  (24 §... — cuentas sanas/total)
│  Apex      +6.1R   1/2 🟡     │
│  Personal  +18.3R  1/1 🟢     │
│──────────────────────────│
│ [ Ver todas las cuentas ]    │  vuelve a Cuentas/Home (17 §4)
└─────────────────────────┘
```

### Por qué la sección "Cuentas en riesgo" existe (auditoría de botón/sección, 10 §5)
- *¿Qué problema resuelve?* Que un trader con 12 cuentas tenga que leer 12 tarjetas para encontrar la única que de verdad necesita su atención hoy.
- *¿Es necesaria?* Sí — es la respuesta directa a la pregunta de §0.
- *¿Puede hacerse más simple?* No hace falta gráfico ni configuración: un umbral fijo (drawdown restante < 20%, mismo criterio que el semáforo de 17 §4) y una lista ordenada por severidad.
- *¿Escala a 100.000 usuarios?* Sí — es una consulta indexada sobre columnas ya cacheadas (`current_capital`, `peak_capital`), no un cálculo pesado.
- *¿Puede automatizarse?* Completamente — cero intervención manual, se deriva de datos que ya se mantienen por trigger.

### Tabla de desglose (tablet/desktop, sin scroll — 14 §4)

| Cuenta | Empresa | Estado | Balance | Objetivo | DD permitido | DD restante | Profit Split | R | Expectativa |
|---|---|---|---|---|---|---|---|---|---|
| 100k #1 | FTMO | Funded | 104.200 € | 10.000 € (96% ✓) | 5% | 3,2% | 80% | +12.4R | +1.31R |
| 50k #2 | Apex | Challenge | 48.100 € | 4.000 € (40%) | 4% (trailing) | 0,8% | — | +2.1R | +0.94R |
| Personal | Personal | Live | 128.300 € | — | — | — | — | +18.3R | +1.42R |

Esta tabla es, en una fila por cuenta, la síntesis completa de este documento: todos los campos pedidos, más los dos que había que resolver primero (Drawdown restante con su tipo estático/trailing correcto, Profit Split separado de la esperanza matemática) — nada de esto era posible mostrar con honestidad antes de las decisiones de los §2-4.
