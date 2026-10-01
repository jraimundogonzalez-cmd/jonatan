# 02 · Modelo matemático de R y esperanza

*Voz: Quant trader (gestión de riesgo) + Matemático (esperanza matemática)*

Este documento es la **fuente de verdad** de todo cálculo del producto. UI, base de datos, motor de cálculo y IA implementan estas fórmulas — nunca al revés.

## 1. Notación y unidades base

| Símbolo | Significado |
|---|---|
| `Capital` | Capital de la cuenta (€) |
| `Riesgo%` | Riesgo asumido en la operación, en % del capital |
| `Riesgo€` | `Capital × Riesgo%` — esto define **1R** en euros para esa operación concreta |
| `RR_obj` | RR objetivo planificado de la operación (decimal libre, ej. 5.72) |
| `n` | Número de parciales, `0 ≤ n ≤ 5` |
| `RR_i` | RR al que se ejecuta el parcial `i` (decimal libre, `0 < RR_1 < RR_2 < ... < RR_n ≤ RR_obj`) |
| `p_i` | Porcentaje de posición cerrado en el parcial `i`, `Σ p_i ≤ 100%` |
| `p_r` | Porcentaje remanente sin parcial, `p_r = 100% − Σ p_i`, cierra en `RR_obj` o en el nivel donde termine realmente la operación |
| `R_max` | Recorrido máximo a favor alcanzado por el precio en esa operación concreta, medido en R (**dato observado a posteriori**, no planificado) |

**Regla de oro**: 1R siempre se define en euros por operación (`Riesgo€`), no de forma global. Dos operaciones con el mismo `RR_obj` pueden tener `Riesgo€` distintos porque el capital o el `Riesgo%` cambió. Todo el sistema debe evitar mezclar "R" como si fuera una unidad absoluta entre operaciones — es relativa a cada trade.

## 2. Resultado de una operación con parciales

Dado que el usuario define libremente sus parciales, el resultado real depende de si el precio alcanzó o no cada nivel `RR_i` antes de cerrar la operación (por stop, por breakeven, o por agotar el remanente en `RR_obj`).

Para cada parcial `i`:

```
triggered_i = 1  si R_max ≥ RR_i
            = 0  en caso contrario
```

**Corrección de rigor (revisión matemática, ver 12-demostracion-matematica.md)**: una versión anterior de esta fórmula sumaba `p_r · R_cierre_remanente` como si solo el remanente originalmente sin asignar compartiera el desenlace final. Es incorrecto: si un parcial intermedio `i` **no** se dispara (`triggered_i = 0`), su porcentaje `p_i` no desaparece ni contribuye 0 — permanece abierto y comparte el mismo desenlace final que el remanente, porque los parciales se ejecutan en orden creciente de `RR_i` a medida que el precio avanza. La fórmula correcta agrupa todos los tramos no disparados (parciales intermedios + remanente) en un único "resto":

```
k = máx{ i : triggered_i = 1 }         (índice del último parcial realmente disparado; k = 0 si ninguno se disparó)

R_final = Σ_{i=1..k} p_i · RR_i
        + (100% − Σ_{i=1..k} p_i) · R_cierre_resto
```

donde `R_cierre_resto` (el desenlace del tramo no cerrado en parciales, incluidos los parciales intermedios nunca disparados) depende del estado del stop en el momento en que se resuelve:

- Si `R_max ≥ RR_obj` → el resto cierra en `RR_obj` (o donde el usuario indique que cerró manualmente, campo libre).
- Si no se alcanzó `RR_obj` pero `k ≥ 1` (se movió el stop a breakeven tras el último parcial disparado) → `R_cierre_resto = 0`.
- Si `k = 0` (no se disparó ningún parcial, el precio nunca alcanzó ni el primer nivel) → `R_cierre_resto = -1` (stop original, pérdida total del riesgo asumido).

Este modelo es genérico: **no asume ratios fijos** ni un número fijo de parciales — con `n = 0` se reduce al caso "todo o nada" clásico (`R_final = R_max ≥ RR_obj ? RR_obj : -1`), con `n = 5` cubre el caso más granular soportado por el producto. La demostración numérica completa, incluyendo el caso que expuso el error de la fórmula original (un parcial intermedio no disparado), está en 12-demostracion-matematica.md §2.

## 3. Métricas derivadas por operación

```
Beneficio_máximo   = Riesgo€ × RR_obj                     (si el 100% hubiese llegado al objetivo)
Beneficio_real     = Riesgo€ × R_final
Beneficio_sacrificado = Beneficio_máximo − Beneficio_real   (solo con sentido si R_max ≥ RR_obj)
%_beneficio_conservado = R_final / R_max                    (si R_max > 0; mide cuánto del recorrido
                                                               a favor realmente capturó el trader)
```

`%_beneficio_conservado` es la métrica más importante del producto a nivel individual: cuantifica, operación a operación, el coste real de cerrar parciales pronto — es el número que convierte una sensación ("cierro pronto por miedo") en un dato ("estás capturando de media el 61% de tu recorrido a favor").

## 4. Esperanza matemática

### 4.1 A nivel de operación individual (ex-ante, para la calculadora)

Antes de conocer `R_max` (es decir, en el momento de planificar la gestión), la esperanza de una configuración de parciales se calcula integrando sobre la distribución de probabilidad de `R_max`, estimada empíricamente del historial del propio usuario (ver §6):

```
E[R_final | config] = Σ_k P(R_max = r_k) · R_final(r_k, config)
```

donde la suma recorre los valores empíricos de `R_max` observados en el historial del usuario (bootstrap no paramétrico), o una distribución suavizada cuando hay suficiente muestra (ver §6.2).

### 4.2 A nivel de cartera de operaciones (ex-post, para el dashboard)

```
E[R] = (1/N) Σ_{j=1..N} R_final_j                    (expectativa muestral en R)
E[€] = (1/N) Σ_{j=1..N} Riesgo€_j × R_final_j         (expectativa muestral en €)
```

Forma equivalente (fórmula clásica de expectativa, útil para explicar al usuario):

```
E[R] = WinRate × R_medio_ganador − LossRate × R_medio_perdedor
```

Ambas formas deben coincidir en el dashboard — se muestra la fórmula clásica en la UI (más intuitiva) pero el cálculo interno siempre usa la suma directa sobre `R_final_j` (más robusta y sin asunciones de distribución).

### 4.3 Profit Factor

```
Profit_Factor = Σ (Beneficio_real_j | Beneficio_real_j > 0) / |Σ (Beneficio_real_j | Beneficio_real_j < 0)|
```

### 4.4 Drawdown

Sobre la curva de equity acumulada (en € y en R en paralelo):

```
Equity_t = Σ_{j≤t} Beneficio_real_j
Drawdown_t = Equity_t − max_{s≤t}(Equity_s)
Max_Drawdown = min_t (Drawdown_t)
```

Se calcula por cuenta, por empresa de fondeo, y agregado — nunca solo un número global, porque el drawdown de una prop firm concreta es lo que dispara sus reglas de riesgo (ver 01 §1, persona P1).

## 5. El optimizador: qué problema resuelve exactamente

**Importante decisión de diseño (ver 01 §3.2 y 06)**: esto es un problema de **optimización combinatoria sobre datos históricos propios**, no un problema de predicción. No se necesita (ni se debe usar) una red neuronal — se necesita búsqueda exhaustiva/grid search bien acotada, que es determinista, rápida y 100% explicable.

### 5.1 Espacio de búsqueda

Para un `RR_obj` dado, el optimizador explora:

```
n ∈ {0, 1, 2, 3, 4, 5}
RR_i ∈ grid de 0.1R desde 0.1 hasta RR_obj, ascendente
p_i ∈ grid de 5% desde 5% hasta 100%, con Σp_i ≤ 100%
```

Con `RR_obj` típico (2–6R) y grid de 0.1R / 5%, el espacio es del orden de 10⁴–10⁵ combinaciones para `n ≤ 5` — trivialmente evaluable en milisegundos, no requiere aproximación ni heurísticas de ML.

### 5.2 Función objetivo

Para cada configuración candidata `c`, se evalúa contra el historial empírico de `R_max` del usuario (bootstrap: se reutiliza cada operación pasada como una "muestra" de recorrido máximo posible, filtrando por bucket de `RR_obj` similar — ver §6.1):

```
Score(c) = E[R_final | c]  −  λ · σ[R_final | c]
```

`λ` es un parámetro de aversión a la varianza (por defecto bajo, ajustable por el usuario en ajustes avanzados — un trader de cuenta fondeada con reglas de drawdown estrictas querrá `λ` más alto). Esto convierte el optimizador en una versión simplificada de un criterio media-varianza (Markowitz aplicado a gestión de parciales), apropiado porque el trader no solo quiere maximizar la media, quiere evitar configuraciones que maximizan la media a costa de mucha dispersión (riesgo de romper reglas de drawdown de la prop firm).

### 5.3 Salida

El optimizador siempre devuelve:

1. La configuración con mayor `Score`.
2. Las 2 siguientes mejores configuraciones (para que el usuario compare, nunca una única respuesta autoritaria).
3. **La explicación**: qué % de sus operaciones históricas se hubiesen beneficiado de este cambio, cuánto beneficio sacrificado se habría evitado, y cuánta varianza adicional (o menos) introduce. Nunca solo el número — es un requisito explícito del producto (01 §2.3).

## 6. Aprendizaje personalizado (base matemática)

### 6.1 Segmentación por "bucket" de objetivo

El historial se agrupa por rangos de `RR_obj` (ej. 1-2R, 2-4R, 4-6R, >6R) porque el comportamiento de un trader ante un objetivo de 1.5R es distinto al que tiene ante un objetivo de 6R. Todas las estadísticas personalizadas (`P(R_max ≥ x | bucket)`) se calculan por bucket, no de forma agregada.

### 6.2 Estimación bayesiana con muestra pequeña

Con pocas operaciones (`N < 30` por bucket), una frecuencia empírica simple es inestable (ej. "3 de 4 veces llegaste a TP" no es una estadística fiable al 75%). Se usa un modelo **Beta-Binomial**:

```
P(R_max ≥ RR_i | bucket) ~ Beta(α₀ + aciertos, β₀ + fallos)
```

`α₀ = β₀ = 1` (prior de Jeffreys/uniforme no informativo). **Importante**: el prior es matemáticamente no informativo, no se entrena ni se inicializa con datos de otros usuarios — así se cumple el principio de producto de aprendizaje 100% privado (01 §2.5) sin sacrificar estabilidad estadística a bajo N. Según crece `N`, la posterior converge rápidamente hacia la frecuencia empírica real del propio usuario.

La UI siempre muestra el intervalo de credibilidad (ej. "72% [IC 95%: 58%–83%], basado en 34 operaciones"), nunca un número seco — refuerza la confianza y evita sobreinterpretar patrones con poca muestra.

### 6.3 Confianza de la recomendación a bajo N (revisado)

**Corrección de rigor (ver 13-ia-aprendizaje-continuo.md §2)**: una versión anterior de esta sección definía un umbral duro (`N < 8` → "sin personalizar") que resultaba inconsistente con el propio modelo de §6.2, el cual ya produce una estimación válida en cualquier `N`, incluido `N = 0` (posterior uniforme `Beta(1,1)`). Un interruptor duro crea un salto de experiencia injustificado entre 7 y 8 operaciones que no refleja cómo cambia realmente la incertidumbre (de forma gradual, no discreta).

El sistema **siempre** muestra su mejor estimación con su intervalo de credibilidad — nunca la oculta — y deriva una etiqueta cualitativa continua a partir del ancho del intervalo (`Confianza alta/media/baja`, fórmula exacta en 13 §2). Nunca se rellena el vacío de muestra con datos de otros usuarios, en ningún nivel de confianza.
