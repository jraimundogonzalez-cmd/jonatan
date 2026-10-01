# 04 · MODELO DE TRADING

> Las matemáticas del producto. Implementadas en `packages/quant-engine`,
> con dataset dorado y property tests. La fórmula de R está **congelada**: no se
> cambia sin una auditoría que lo demuestre necesario.

---

## 1. R — la unidad

**R = múltiplo de riesgo.** Una operación que gana el doble de lo que arriesgaba
cierra en `+2.0000 R`, da igual el instrumento, el tamaño o la cuenta.

- Unidad **decimal libre**, nunca un ratio fijo (ni 1:2, ni 1:3).
- Es **relativa y comparable** entre cuentas de distinto capital (I4).
- Su valor en euros se deriva del capital y el riesgo% **de cada operación en su
  propio momento**, nunca de una cifra global.

## 2. Riesgo en euros — congelado una sola vez

```
risk_amount = capital_en_ese_instante × risk_pct / 100
```

- Se calcula **al abrir** y se persiste. **Nunca se recalcula.**
- Vive en un único sitio: `crear_operacion_nucleo`.
- Que el capital suba o baje después **no altera** el riesgo de una operación ya
  abierta.

> **Decisión arquitectónica abierta (DEC-008)**: una Management Intent congela
> el **porcentaje** de riesgo, no el importe. Si el capital cambia entre decidir
> y materializar, el importe en euros cambia proporcionalmente. Medido: 10.000 €
> al decidir → 100.000 € al materializar → `risk_amount` de 1.000 € en vez de
> 100 €. No es retroactividad (nada se recalcula tras abrir), pero una decisión
> de ayer se dimensiona con el capital de hoy. **Pendiente de decisión humana.**

## 3. La fórmula de R final — CONGELADA

```
R_final = Σ pᵢ · RRᵢ  +  (100% − Σ pᵢ) · R_cierre_resto
```

donde `pᵢ` es el porcentaje cerrado en el parcial *i* y `RRᵢ` su nivel de R.

`R_cierre_resto` se resuelve **por orden de prioridad**:

| # | Condición | Valor |
|---|---|---|
| 1 | existe `cierre_manual_rr` | ese valor |
| 2 | `r_max ≥ rr_objetivo` | `rr_objetivo` |
| 3 | hubo al menos un parcial (`k ≥ 1`) | `0` |
| 4 | no hubo ninguno (`k = 0`) | `−1` |

Esta prioridad es deliberada: el cierre manual declarado por el trader gana
siempre; a falta de él, alcanzar el objetivo lo da por bueno; si hubo parciales
el resto se asume a break-even; si no hubo nada, se asume stop completo.

## 4. RR — objetivo de la operación

- `rr_objective` vive en el Plan de Gestión y se **congela** en la Operación.
- `r_max` es el máximo R alcanzado, registrado como hecho observado.
- Cambiar el Plan después **no** cambia el `rr_objective` de una Operación ya
  abierta (I3, patrón Snapshot).

## 5. Parciales

**Planificados** (`trade_partials_planned`) — lo que el trader pensaba hacer.
Congelados desde el Plan al abrir. Inmutables.

**Ejecutados** (`trade_partials_executed`) — lo que realmente hizo. Son **la
evidencia** sobre la que se calcula R final. Inmutables: ni `UPDATE` ni `DELETE`.

Validación (compartida por las tres vías de alta, para que no diverja):
- Máximo **5** parciales.
- `Σ pct_close ≤ 100`.
- `sequence` entre 1 y 5, sin duplicados.
- `rr_level` **estrictamente creciente** por `sequence`.

### R realizado (capacidad autorizada en BUILD 022)

Mientras la Operación sigue abierta se puede mostrar:

| Magnitud | Qué es |
|---|---|
| `r_realizado` | lo ya materializado por los parciales |
| `pct_cerrado` / `pct_abierto` | reparto de la posición |
| `r_maximo_evidenciado` | el mayor R observado |

> **No es R final y no sustituye a R máximo alcanzado.** Es una lectura
> intermedia; comparten una única descomposición para que no existan dos
> representaciones del mismo hecho.

## 6. Break-even

`be_trigger` admite tres valores: `NONE`, `AFTER_NTH_PARTIAL`, `CUSTOM_LEVEL`.
Se congela en la Operación como el resto del Plan.

## 7. Capital de la cuenta

- Se **deriva** de `account_capital_events`, nunca se edita directamente.
- Un trigger recalcula `accounts.current_capital` tras cada evento.
- Abrir una posición es **capital-neutral**: no mueve nada. Solo el desenlace
  mueve capital.
- Existe un **tope de riesgo por cuenta** (`max_risk_pct`).

## 8. Precisión decimal — regla dura (I5)

- Solo `packages/quant-engine/src/decimal/kernel.ts` puede importar `decimal.js`.
- Redondeo global `ROUND_HALF_EVEN`, precisión de kernel 30.
- **Los decimales viajan como cadenas** en las fronteras jsonb y de API.
- Presentación monetaria a 2 decimales, decidido **en el kernel**: la interfaz
  no elige por su cuenta cómo redondear.

⚠️ **Trampa conocida**: PostgREST serializa `numeric` como **número JSON**, no
como cadena, y `to_jsonb()` pierde los ceros a la derecha (`1.0000` llega como
`1`). Se normaliza en la frontera de lectura (`apps/web/lib/api/decimales.ts`).
Esta fue la causa raíz de varios fallos reales.

## 9. Drawdown y métricas — implementadas, no visibles

El Quant Engine tiene implementado y testeado: esperanza matemática, desviación,
ratio, profit factor, win rate, recovery factor, rachas, distribución por tiempo,
curvas de equity, drawdown histórico y estado de drawdown.

🔴 **Nada de esto está expuesto en la interfaz.** De 18 exportaciones del motor,
el frontend usa 3. No está roto: está desconectado.

## 10. Agregación por cuenta

El **R acumulado** de una cuenta es la suma directa de los R finales de sus
operaciones cerradas vigentes.

⚠️ **No se usa el acumulador de Welford** (`account_risk_state`) para esto: es
*eventualmente consistente* por diseño y serviría para otra pregunta. Usar dos
representaciones del mismo hecho fue descartado explícitamente.
