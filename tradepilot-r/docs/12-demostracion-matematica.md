# 12 · Demostración matemática — el cerebro de TradePilot R

*Voz: Matemático especializado en esperanza matemática aplicada al trading*

Este documento no opina. Cada afirmación se demuestra con la fórmula de origen (02-modelo-matematico.md, ya corregida en su §2) y con datos numéricos concretos, verificables por cualquiera con una calculadora. Ninguna recomendación del optimizador se presenta sin la comparación numérica que la sostiene.

## 0. Datos de partida (usados en todo el documento)

```
Capital     = 100.000 €
Riesgo%     = 1%              → Riesgo€ = 1.000 € (= 1R para estas operaciones)
RR_obj      = 5R
Parciales planificados (Config A):  P1 = 1R / 30%   ·   P2 = 2.5R / 30%   ·   resto = 40% en RR_obj
```

## 1. Caso 1 — el precio no llega al objetivo (`R_max = 4.2R`)

```
triggered_1 (4.2 ≥ 1)   = 1
triggered_2 (4.2 ≥ 2.5) = 1
k = 2 (último parcial disparado)
R_max = 4.2 < RR_obj = 5  y  k ≥ 1  →  R_cierre_resto = 0 (breakeven)

R_final = (0.30 × 1) + (0.30 × 2.5) + (1 − 0.30 − 0.30) × 0
        = 0.30 + 0.75 + 0.40 × 0
        = 1.05 R
```

| Métrica | Fórmula (02 §3) | Cálculo | Resultado |
|---|---|---|---|
| Beneficio máximo | `Riesgo€ × RR_obj` | 1.000 × 5 | **5.000 €** |
| Beneficio real | `Riesgo€ × R_final` | 1.000 × 1.05 | **1.050 €** |
| Beneficio máximo alcanzable (según lo que el mercado ofreció de verdad) | `Riesgo€ × R_max` | 1.000 × 4.2 | **4.200 €** |
| Beneficio sacrificado (respecto al recorrido real) | `Beneficio_máx_alcanzable − Beneficio_real` | 4.200 − 1.050 | **3.150 €** |
| % beneficio conservado | `R_final / R_max` | 1.05 / 4.2 | **25,0 %** |

**Lectura de datos, no opinión**: el precio recorrió 4.2R a favor; la configuración capturó 1.05R, el 25,0% de ese recorrido. El resto (75,0%, o 3.150 €) quedó sobre la mesa porque el 40% de la posición cerró en breakeven al no alcanzar `RR_obj`.

## 2. Caso 2 — el precio supera el objetivo (`R_max = 6.0R`), y el caso que expuso el error de la fórmula original

### 2a. `R_max = 6.0R`

```
triggered_1 = 1, triggered_2 = 1, k = 2
R_max = 6.0 ≥ RR_obj = 5  →  R_cierre_resto = RR_obj = 5

R_final = (0.30 × 1) + (0.30 × 2.5) + (0.40 × 5) = 0.30 + 0.75 + 2.00 = 3.05 R
```

| Métrica | Cálculo | Resultado |
|---|---|---|
| Beneficio máximo (en el objetivo) | 1.000 × 5 | **5.000 €** |
| Beneficio real | 1.000 × 3.05 | **3.050 €** |
| Beneficio máximo alcanzable (R_max real = 6R) | 1.000 × 6 | **6.000 €** |
| Beneficio sacrificado (respecto al objetivo planificado) | 5.000 − 3.050 | **1.950 €** |
| Beneficio sacrificado (respecto al recorrido real de 6R) | 6.000 − 3.050 | **2.950 €** |
| % beneficio conservado (sobre el recorrido real) | 3.05 / 6 | **50,8 %** |

Aquí sí aplica, por primera vez en este documento, la métrica de "beneficio sacrificado respecto al objetivo" del brief original — porque solo tiene sentido cuando `R_max ≥ RR_obj` (02 §3). En el caso 1 no aplicaba: no puede sacrificarse un objetivo que el mercado nunca ofreció.

### 2b. `R_max = 0.8R` — el caso que un parcial intermedio no disparado expone

```
triggered_1 (0.8 ≥ 1) = 0   →  k = 0  (ningún parcial se disparó)
R_max = 0.8 < RR_obj = 5  y  k = 0  →  R_cierre_resto = −1

R_final = (suma vacía, i = 1..0) + (100%) × (−1) = −1 R
```

**Por qué esto es la demostración de la corrección aplicada en 02 §2**: con la fórmula original (que solo aplicaba el desenlace final al `p_r` de 40% predefinido), el 60% correspondiente a los parciales P1 y P2 no disparados habría quedado sin resolver o, peor, se le habría asignado 0 por el término `triggered_i · p_i · RR_i = 0`, produciendo `R_final = 0.6 × (−1) [solo el remanente] = −0.6R` — un resultado **matemáticamente falso**, porque en la realidad, si el precio nunca llegó ni al primer parcial, el 100% de la posición está sujeto al mismo stop original, no solo el 40% nominal de "remanente". La fórmula corregida (`k = 0` → todo el 100% cierra en `−1R`) es la que coincide con lo que ocurre físicamente en el mercado. Dato, no opinión: **R_final = −1.00R, pérdida de 1.000 €**, exactamente el riesgo asumido — ni más ni menos.

## 3. Impacto de cada parcial (descomposición aditiva)

La fórmula `R_final = Σ p_i·RR_i + resto` es una suma — cada sumando es, por construcción, la contribución exacta de ese tramo. No hace falta estimarla, se lee directamente:

**Caso 1 (`R_final = 1.05R`)**

| Tramo | Contribución en R | % del resultado final |
|---|---|---|
| Parcial 1 (1R, 30%) | 0.30 R | 28,6 % |
| Parcial 2 (2.5R, 30%) | 0.75 R | 71,4 % |
| Resto (40%, breakeven) | 0.00 R | 0,0 % |

**Caso 2a (`R_final = 3.05R`)**

| Tramo | Contribución en R | % del resultado final |
|---|---|---|
| Parcial 1 (1R, 30%) | 0.30 R | 9,8 % |
| Parcial 2 (2.5R, 30%) | 0.75 R | 24,6 % |
| Resto (40%, cierre en 5R) | 2.00 R | 65,6 % |

Dato verificable en ambos casos: la suma de las columnas "Contribución en R" es exactamente `R_final` (0.30+0.75+0.00=1.05; 0.30+0.75+2.00=3.05). Esta tabla es la base de la visualización "Impacto de cada parcial" de 03 §4 — no hay ningún cálculo adicional que la UI deba inventar, solo renderizar estos números.

## 4. Esperanza matemática (con histórico de 5 operaciones)

Histórico observado, mismo bucket (`RR_obj = 5R`), Config A, con `R_max` real de cada operación pasada: `4.2, 6.0, 0.8, 1.0, 5.5`.

`R_final` resultante de cada una (aplicando la fórmula corregida, §1-2, y el caso `R_max=1.0` desarrollado abajo):

```
R_max = 1.0:  triggered_1 (1.0 ≥ 1) = 1, triggered_2 (1.0 ≥ 2.5) = 0, k = 1
              R_max < 5, k ≥ 1 → resto = 0
              R_final = 0.30×1 + 0.70×0 = 0.30 R

R_max = 5.5:  triggered_1 = 1, triggered_2 = 1, k = 2
              R_max ≥ 5 → resto = 5
              R_final = 0.30×1 + 0.30×2.5 + 0.40×5 = 3.05 R
```

Muestra completa de `R_final`: **1.05, 3.05, −1.00, 0.30, 3.05**

```
E[R] = (1.05 + 3.05 − 1.00 + 0.30 + 3.05) / 5 = 6.45 / 5 = 1.29 R
E[€] = 1.29 × 1.000 € = 1.290 €
```

**Verificación con la fórmula clásica** (02 §4.2, `E[R] = WinRate·R̄_ganador − LossRate·R̄_perdedor`):

```
Ganadoras (R_final > 0): 1.05, 3.05, 0.30, 3.05  →  WinRate = 4/5 = 80%,  R̄_ganador = 7.45/4 = 1.8625
Perdedoras (R_final < 0): −1.00                    →  LossRate = 1/5 = 20%, R̄_perdedor = 1.00

E[R] = 0.80 × 1.8625 − 0.20 × 1.00 = 1.49 − 0.20 = 1.29 R
```

**Las dos vías coinciden exactamente: 1.29R.** Esto no es casualidad, es la identidad algebraica que 02 §4.2 exige que se cumpla siempre — se demuestra aquí con datos, no se asume.

## 5. Comparación con el máximo posible (agregada sobre el histórico)

| Operación | R_max | Beneficio máx. alcanzable (`Riesgo€×R_max`) | Beneficio real (`Riesgo€×R_final`) | % conservado |
|---|---|---|---|---|
| 1 | 4.2 | 4.200 € | 1.050 € | 25,0 % |
| 2 | 6.0 | 6.000 € | 3.050 € | 50,8 % |
| 3 | 0.8 | 800 € | −1.000 € | n/a (pérdida) |
| 4 | 1.0 | 1.000 € | 300 € | 30,0 % |
| 5 | 5.5 | 5.500 € | 3.050 € | 55,5 % |
| **Total** | — | **17.500 €** | **6.450 €** | **36,9 %** |

`36,9%` es un dato agregado, no una opinión sobre si es "bueno" o "malo" — es lo que el optimizador (§6) usa como línea base para evaluar si otra configuración habría conservado más.

## 6. Demostración de dominancia del optimizador (por qué se recomienda A sobre B, con datos)

Config B candidata (alternativa evaluada por el grid search, 02 §5): un único parcial en **2R al 50%**, resto 50% en `RR_obj`.

`R_final` de Config B para el mismo histórico (`R_max`: 4.2, 6.0, 0.8, 1.0, 5.5):

```
R_max=4.2: triggered(2R)=1, k=1, R_max<5 → resto=0.  R_final = 0.50×2 + 0.50×0 = 1.00
R_max=6.0: triggered=1, k=1, R_max≥5 → resto=5.       R_final = 0.50×2 + 0.50×5 = 3.50
R_max=0.8: triggered(0.8≥2)=0, k=0 → resto=−1.        R_final = 1.00×(−1) = −1.00
R_max=1.0: triggered(1.0≥2)=0, k=0 → resto=−1.        R_final = 1.00×(−1) = −1.00
R_max=5.5: triggered=1, k=1, R_max≥5 → resto=5.       R_final = 0.50×2 + 0.50×5 = 3.50
```

Muestra de `R_final` para Config B: **1.00, 3.50, −1.00, −1.00, 3.50**

```
E[R]_B = (1.00+3.50−1.00−1.00+3.50)/5 = 6.00/5 = 1.20 R
σ_B: desviaciones (−0.20, 2.30, −2.20, −2.20, 2.30) → Σcuadrados=20.30 → varianza=4.06 → σ_B = 2.015
Score_B = E[R]_B − λ·σ_B = 1.20 − 0.25×2.015 = 1.20 − 0.504 = 0.696
```

Config A sobre la misma muestra (§4):

```
E[R]_A = 1.29 R
σ_A: desviaciones de (1.05,3.05,−1.00,0.30,3.05) respecto a 1.29 → (−0.24, 1.76, −2.29, −0.99, 1.76)
      → Σcuadrados = 12.4770 → varianza = 2.4954 → σ_A = 1.580
Score_A = 1.29 − 0.25×1.580 = 1.29 − 0.395 = 0.895
```

**Resultado, sin opinión, solo comparación numérica**:

| | E[R] | σ | Score (λ=0.25) |
|---|---|---|---|
| Config A (1R/30% + 2.5R/30% + resto) | **1.29 R** | **1.580** | **0.895** |
| Config B (2R/50% + resto) | 1.20 R | 2.015 | 0.696 |

Config A tiene **simultáneamente** mayor esperanza (1.29 > 1.20) y menor dispersión (1.580 < 2.015) que Config B sobre este histórico — es una dominancia estricta en ambos ejes (no hay trade-off que ponderar con λ para llegar a esta conclusión, aunque el score sí lo confirme). El optimizador (02 §5) recomienda Config A y, ante esta muestra, cualquier valor de `λ ≥ 0` produce el mismo veredicto — la recomendación es robusta al parámetro de aversión al riesgo del usuario, dato que también se reporta en la explicación (06 §3) para reforzar la confianza en la recomendación.
