# 10 — Investigación de reglas: NYS Markets y Lucid Trading (D15)

> Fecha de consulta: **2026-11-21**.
> Estado global: **NINGUNA regla está verificada todavía.** Ver §1 para entender por qué y qué falta.

## 1. Método y limitación de la consulta

| Paso | Resultado |
|------|-----------|
| Lectura directa de `nysmarkets.com`, `terms.nysmarkets.com`, `lucidtrading.com`, `support.lucidtrading.com` | **Bloqueada**: la política de red del entorno de trabajo en la nube no permite esas webs (fallo DNS/proxy). No es un error de las webs |
| Búsqueda web restringida a los dominios oficiales | Funciona. Devuelve **URL oficiales** y **fragmentos indexados** de esas páginas |
| Webs de terceros (reviews, comparadores) | **Descartadas como fuente**: se contradicen entre sí |

Por tanto, cada dato de este documento es un **candidato**: procede de un fragmento indexado de una URL oficial,
pero nadie lo ha leído en la página tal como está hoy. Los buscadores pueden tener versiones antiguas en caché.

### Niveles de verificación (se incorporan al modelo de datos, doc 02 §4.2)

| Nivel | Significado | ¿Se puede usar en cálculos/alertas? |
|-------|-------------|--------------------------------------|
| `pending` | Sin dato | No |
| `candidate` | Dato localizado en URL oficial mediante índice/buscador, sin lectura directa | No. Solo informativo, con aviso visible |
| `verified` | Leído directamente en la página oficial (o en el panel/contrato del usuario), con URL, fecha de consulta y captura guardada | Sí |
| `outdated` | Estaba verificado, pero ha pasado el plazo de revisión o la empresa anunció cambios | Con aviso |
| `disputed` | Dos fuentes oficiales se contradicen | No, hasta resolverlo |

**Para pasar de `candidate` a `verified`** hay dos opciones (tú decides cuál, ver D15b en doc 09):
- a) Permitir esos 4 dominios en la red del entorno de trabajo; en ese caso leo las páginas y guardo una captura de cada una.
- b) Lo verificas tú desde el navegador con la casilla "He comprobado esta regla", la URL y una captura. PropPilot lo deja registrado.

## 2. Hallazgos que afectan al diseño (ya incorporados)

1. **NYS Markets tiene dos líneas de negocio distintas: CFDs y Futuros**, con programas y reglas diferentes, y además
   expresadas en **porcentaje** del saldo inicial (no en importes fijos). → El modelo admite `unit = 'percent_of_initial_balance'` y
   **cada regla cuelga de un producto concreto**; no hay reglas genéricas de empresa que se hereden entre modalidades.
2. **Lucid diferencia productos por plataforma** (p. ej., "LucidFlex 25K Rithmic" vs "LucidFlex 25K NT/TDV") y por
   **opciones elegidas en la compra** (con o sin límite de pérdida diaria, complemento de consistencia del 50 %). → Nueva
   entidad `product_options` y la cuenta guarda las opciones elegidas.
3. **Lucid tiene reglas distintas según la fecha de compra** (p. ej., LucidPro: cuentas compradas/reseteadas antes del
   28/11/2025 15:00 EST mantienen condiciones anteriores). → `rule_sets.applies_to_purchases_from/to`; la cuenta queda
   anclada a la versión vigente en su fecha de compra/reset.
4. **Los resets son productos con precio propio** (p. ej., "LucidFlex 50K Reset"). → Se registran como movimiento `reset_fee`
   vinculado al producto de reset y abren un nuevo intento.
5. **Lucid limita el número de cuentas por hogar/familia** (candidato: 10 de evaluación, 5 funded, 10 en total).
   ⚠️ **Riesgo de negocio para ti y tu mujer:** si comparten domicilio, sus cuentas podrían contar juntas para ese límite.
   PropPilot **no puede avisar de esto** sin romper la privacidad entre usuarios (cada uno solo ve lo suyo). Ver riesgo R-N1 en doc 09.
6. Las fuentes oficiales **se contradicen entre sí** en varios puntos (ver §3.4 y §4.6). → Nivel `disputed`.

## 3. NYS Markets

### 3.1 Programas identificados en fuentes oficiales

| Línea | Programa | URL oficial localizada | Estado |
|-------|----------|------------------------|--------|
| Futuros | **The Thunder** (evaluación corta → funded) | https://terms.nysmarkets.com/terms/fut-welcome | candidate |
| Futuros | **The Bee** | https://terms.nysmarkets.com/terms/fut-welcome | candidate (sin reglas detalladas) |
| Futuros | **NYS Flex** (una fase, sin límite de pérdida diaria) | https://terms.nysmarkets.com/terms/fut-payout-methods | candidate (sin reglas detalladas) |
| Futuros | Fondeo instantáneo | https://terms.nysmarkets.com/terms/fut-welcome | candidate |
| CFDs | **One Rule / One Step** | https://terms.nysmarkets.com/terms/cfds-ch-one-rule | candidate |
| CFDs | **One Rule Instant** | https://terms.nysmarkets.com/terms/cfds-ch-one-rule-instant | candidate (sin reglas detalladas) |
| CFDs | **One Trade** | https://terms.nysmarkets.com/terms/cfds-ch-one-trade | candidate |
| CFDs | **2-Step Classic** | https://terms.nysmarkets.com/terms/cfds-ch-2step-classic | candidate |
| CFDs | **Flash** | https://terms.nysmarkets.com/terms/cfds-ch-flash | candidate |
| General | Precios | https://nysmarkets.com/pricing | **no se obtuvieron precios** |
| General | Objetivos de trading / cómo funciona | https://nysmarkets.com/trading-objectives · https://www.nysmarkets.com/how-it-works | candidate |
| CFDs | Política de pagos | https://terms.nysmarkets.com/terms/cfds-payout-policy | candidate |

**Pregunta abierta (D16):** ¿qué línea y qué programas de NYS usáis vosotros? Si solo operáis futuros, los programas de CFDs
se pueden dar de alta más adelante.

### 3.2 NYS — Futuros (candidatos)

| Programa | Regla | Valor candidato | Fuente |
|----------|-------|-----------------|--------|
| General futuros | Tamaños de cuenta | 25K, 50K, 100K, 150K (The Bee solo hasta 100K) | fut-welcome |
| General futuros | Instrumentos | Solo productos de CME Group | fut-welcome |
| The Thunder | Objetivo evaluación | 6 % | fut-welcome |
| The Thunder | Objetivo en funded (hasta primer payout) | 3 % | fut-welcome |
| The Thunder | Reparto | 85 % trader | fut-welcome |
| The Bee | Reparto | 80 % trader | fut-welcome |
| Instantáneo | Objetivo hasta primer payout | 8 % | fut-welcome |
| NYS Flex | Fases / límite diario / reparto | 1 fase · sin límite de pérdida diaria · 80/20 | fut-payout-methods |
| Payouts futuros | Mínimo | 50 $ | fut-payout-methods |
| Payouts futuros | Comisión de retirada | Mayor de 15 $ o 2,5 % del payout | fut-payout-methods |
| Payouts futuros | Durante el procesamiento | Trading desactivado | fut-payout-methods |
| Todos | Pérdida máxima, límite diario, días mínimos, consistencia, contratos máx., precios | **pending: no encontrados** | — |

### 3.3 NYS — CFDs (candidatos)

| Programa | Objetivo | Pérdida diaria | Pérdida máxima | Otros | Fuente |
|----------|----------|----------------|----------------|-------|--------|
| One Rule | 8 % (operaciones cerradas) | — | 4 % trailing intradía en challenge; 4 % estática en funded (fijada al 96 % del saldo inicial) | Payout diario, mínimo 50 $, reparto inicial 50/50 escalando hasta 90 % | cfds-ch-one-rule · trading-objectives |
| One Trade | 10 % | 3 % | 6 % fija | Payout máx. por solicitud 2 % del saldo inicial; consistencia 30 % | cfds-ch-one-trade |
| 2-Step Classic | F1 8 % · F2 5 % | 5 % | 10 % fija | ≥5 días rentables antes de payout | cfds-ch-2step-classic |
| Flash | 6 % | — | 4 % trailing al cierre del día | ≥5 días rentables antes de payout | cfds-ch-flash |
| General CFDs | — | — | — | Reparto 80/20 (salvo programas con escala propia); día rentable = beneficio neto ≥ 0,25 % del saldo inicial, solo operaciones cerradas | cfds-payout-policy |

### 3.4 NYS — Contradicciones detectadas (`disputed`)

- "Cómo funciona" habla de **payouts semanales** y reparto **80 % → 100 %**; la página de One Rule habla de **payouts diarios** y **50 % → 90 %**.
- La página de precios en inglés menciona un 2 fases con objetivos **6 % / 4 %** y pérdida máxima trailing **4 %**, que no coincide con el "2-Step Classic" (8 % / 5 %, 10 % fija). Podría ser otro programa no identificado.

## 4. Lucid Trading (solo futuros)

### 4.1 Programas identificados

| Programa | Tipo | URL oficial localizada |
|----------|------|------------------------|
| **LucidFlex** | Evaluación → funded | https://support.lucidtrading.com/en/articles/12945790-lucidflex-evaluation-account · …/12945795-lucidflex-funded-account · …/12945796-lucidflex-payouts · …/12945805-lucidflex-consistency-percentage |
| **LucidPro** | Evaluación → funded | https://support.lucidtrading.com/en/articles/12890029-lucidpro-evaluation-account · …/12890069-lucidpro-funded-account · …/12890092-lucidpro-payouts · …/12890122-lucidpro-daily-loss-limit |
| **LucidDaily** | Evaluación → funded con payouts diarios | https://support.lucidtrading.com/en/articles/15996664-luciddaily-evaluation · …/15997244-luciddaily-funded-account · …/15997266-luciddaily-payouts · …/16085900-luciddaily-daily-loss-limit · …/16010520-luciddaily-live |
| **LucidDirect** | Directo a funded (sin evaluación) | https://support.lucidtrading.com/en/articles/12890148-luciddirect-funded-account |
| **LucidMaxx** | Solo por invitación según rendimiento; versión nueva y "legacy" | https://support.lucidtrading.com/en/articles/17327076-new-lucidmaxx-program · …/14315460-legacy-lucidmaxx-eval-rules · …/13891785-lucidmaxx |
| General | FAQ, número máximo de cuentas, estructura live | https://lucidtrading.com/general-faq/ · https://support.lucidtrading.com/en/articles/11404617-maximum-number-of-accounts · …/16558826-new-live-structure |

Tamaños: 25K, 50K, 100K, 150K en Flex, Pro, Daily y Direct (candidato).

### 4.2 LucidFlex (candidatos)

| Regla | 25K | 50K | 100K | 150K | Fuente |
|-------|-----|-----|------|------|--------|
| Precio evaluación | 110 $ (Rithmic) | 130 $ | 225 $ | 315 $ (Rithmic y NT/TDV) | lucidtrading.com/product-category/lucidflex/ · /product/lucidflex-25k-rithmic · /product/lucidflex-150k-nt_tdv/ |
| Precio reset | pending | 80,75 $ | 140 $ | 175 $ | product-category/lucidflex/ |
| Objetivo | 1.250 $ | pending | 6.000 $ | 9.000 $ | product pages · help center |
| Pérdida máxima | 1.000 $ | pending | 3.000 $ | 4.500 $ | ídem |
| Tipo de drawdown (funded) | EOD trailing | ← | ← | ← | lucidflex-funded-account |
| Límite diario | Opcional según opción de compra (la ficha 150K NT/TDV muestra 2.700 $; la 25K Rithmic, "ninguno") | | | | product pages |
| Tamaño máx. | pending | pending | pending | 10 minis / 100 micros | lucidflex-150k-nt_tdv |
| Consistencia evaluación | 40 % (50 % con complemento de pago) | ← | ← | ← | lucidflex-evaluation-account |
| Consistencia funded | Ninguna | ← | ← | ← | lucidflex-funded-account |
| Reparto | 90/10 | ← | ← | ← | lucidflex-payouts |
| Payout: días con beneficio mínimo | 5 días ≥ 100 $ | pending | pending | 5 días ≥ 250 $ | lucidflex-payouts |
| Payout: mínimo solicitud | 500 $ | ← | ← | ← | lucidflex-payouts |
| Payout: máximo | 50 % del beneficio hasta 1.000 $ | pending | pending | hasta 3.000 $ | lucidflex-payouts |
| Payouts antes de pasar a live | Hasta 5 | ← | ← | ← | lucidflex-payouts |
| Colchón (buffer) | Ninguno | ← | ← | ← | lucidflex-funded-account |

⚠️ Hay un dato que no cuadra: el complemento de consistencia aparece con un precio de 650 $ en la cuenta de 25K, que es muy superior al precio de la propia cuenta (110 $). Queda marcado `disputed` hasta leerlo en la fuente.

### 4.3 LucidPro (candidatos)

| Regla | Valor candidato | Fuente |
|-------|-----------------|--------|
| Precios | **pending: no encontrados** | — |
| Objetivos / pérdida máxima | Iguales que LucidFlex por tamaño (25K: 1.250 $ / 1.000 $) | lucidpro-evaluation-account · lucidpro-funded-account |
| Límite diario evaluación | Fijo por tamaño (importes pending) | lucidpro-evaluation-account |
| Límite diario funded | Opcional al comprar; "escalado" al 60 % del pico de saldo EOD | lucidpro-funded-account · lucidpro-daily-loss-limit |
| Consistencia funded | 40 % del beneficio del ciclo (35 % para cuentas compradas/reseteadas antes del 28/11/2025 15:00 EST) | lucidpro-payouts |
| Beneficio mínimo por ciclo | 250 $ (25K) … 1.000 $ (150K) | lucidpro-payouts |
| Colchón | Pérdida máxima inicial + 100 $ | lucidpro-payouts |
| Reparto | 90/10; las cuentas anteriores al 28/11/2025 mantienen el 100 % de los primeros 10.000 $ | lucidpro-payouts |
| Escalado | Sin plan de escalado; tamaño máximo desde el inicio | lucidpro-funded-account |

### 4.4 LucidDaily (candidatos)

| Regla | Valor candidato | Fuente |
|-------|-----------------|--------|
| 25K | Objetivo 1.250 $ · pérdida máxima 1.000 $ · consistencia 50 % · 2 minis / 20 micros | luciddaily-evaluation |
| Otros tamaños | pending | — |
| Funded | Payouts diarios, sin consistencia, 90/10 | luciddaily-funded-account · luciddaily-payouts |
| Límite diario | Se elige al comprar: fijo en evaluación y funded, o ninguno en ambas fases | luciddaily-daily-loss-limit |

### 4.5 LucidDirect y LucidMaxx (candidatos)

| Programa | Regla | Valor candidato | Fuente |
|----------|-------|-----------------|--------|
| LucidDirect | Estructura | Directo a funded simulado, 25K–150K, límite diario escalado con el saldo | luciddirect-funded-account |
| LucidDirect | Consistencia para el payout | ≤ 20 % según la FAQ general; **el artículo del programa no lo menciona** → `disputed` | general-faq |
| LucidMaxx (nuevo) | Estructura | Solo por estatus ganado; paso 1 evaluación (consistencia 40 %), paso 2 "pre-live"; luego live, payouts diarios, 90/10, hasta 5 cuentas simultáneas | new-lucidmaxx-program · lucidmaxx |
| LucidMaxx (legacy) | Estructura | Evaluación única 25K–150K, 40 %, 5 días → live | legacy-lucidmaxx-eval-rules (puede no aplicar a cuentas actuales) |

### 4.6 Lucid — Reglas generales (candidatos)

| Regla | Valor candidato | Fuente |
|-------|-----------------|--------|
| Cierre obligatorio | Posiciones cerradas a las 16:45 EST, de lunes a viernes; reapertura a las 18:00 EST, de domingo a jueves | general-faq |
| Resets | Disponibles en evaluación, no en funded | general-faq |
| Límite de cuentas por hogar | 10 de evaluación · 5 funded · 10 en total | maximum-number-of-accounts |

## 5. Cómo se cargará en PropPilot (cuando se apruebe la construcción)

- Se crearán las empresas, programas, tamaños y variantes de plataforma de las tablas anteriores.
- Cada regla entra con su **nivel** (`candidate` o `pending`), su **URL**, la **fecha de consulta 2026-11-21** y el texto del fragmento como `source_excerpt`.
- Las reglas `candidate`, `pending` y `disputed` se muestran con una insignia de aviso y **no alimentan ningún cálculo ni alerta**.
- No se crea ninguna regla a nivel de empresa que pueda heredarse a otro programa; las únicas reglas "generales" son las marcadas en `rule_keys.firm_scope_allowed` (horario de cierre, límite de cuentas por hogar).
- La revisión de reglas se repite como mínimo cada 90 días o cuando la empresa anuncie cambios.
