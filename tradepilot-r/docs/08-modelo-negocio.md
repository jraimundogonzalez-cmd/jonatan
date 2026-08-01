# 08 · Modelo de negocio SaaS

*Voz: CTO + Senior Product Manager*

## 1. Modelo de precios (propuesta)

Suscripción mensual (con descuento anual), tiers por **número de cuentas activas gestionadas**, no por features — porque el valor percibido escala directamente con cuántas cuentas de fondeo gestiona el trader (persona P1, 01 §1), y es una métrica que el propio usuario entiende sin esfuerzo:

| Plan | Cuentas activas | Precio orientativo/mes | Público |
|---|---|---|---|
| Starter | 1 cuenta | Precio de entrada bajo | P2/P3 — conversión desde journals genéricos |
| Trader | Hasta 5 cuentas | Precio medio | P1 con pocas cuentas fondeadas |
| Pro | Cuentas ilimitadas | Precio alto | P1 multi-cuenta intensivo |

**Por qué no por "features" (ej. bloquear el optimizador en el plan bajo)**: el optimizador es el corazón del producto (brief original) — bloquearlo en el tier de entrada contradice la propuesta de valor y generaría una primera experiencia deslucida justo cuando el usuario más necesita ver el "aha moment" del producto. El eje de pricing correcto es el que ya existe de forma natural en el comportamiento del usuario (cuentas), no una discriminación artificial de funcionalidad core.

Todos los planes incluyen: registro ilimitado de operaciones, dashboard completo, optimizador. Los tiers superiores desbloquean, más adelante: mayor volumen de llamadas de IA (visión de capturas en V3), soporte prioritario, exportación avanzada.

## 2. Por qué suscripción mensual (no pago único, no freemium puro)

- **Pago único** no financia el coste variable recurrente de IA (06 §7) ni el desarrollo continuo de un producto que compite en un mercado de mejora constante.
- **Freemium puro** (gratis indefinido + upsell) diluye la señal de validación temprana — se prefiere una prueba gratuita corta y limitada en el tiempo, con conversión a pago explícita, para medir disposición real a pagar desde el V1 (07 §3).
- El patrón de uso (registro diario/semanal) genera el tipo de hábito recurrente que sostiene retención de suscripción alta — a diferencia de herramientas de uso esporádico, aquí el propio flujo de trabajo del usuario re-engancha el producto constantemente.

## 3. Unit economics (marco, no cifras cerradas — se validan con datos reales del MVP)

```
LTV ≈ ARPU_mensual × Retención_media_meses
CAC objetivo ≤ LTV / 3   (heurística estándar SaaS)
Coste marginal por usuario activo ≈ infraestructura (Supabase/Vercel, escala con uso)
                                    + IA (OpenAI, acotado por diseño en 06 §7)
```

El diseño técnico (05, 06) está deliberadamente optimizado para mantener el coste marginal por usuario bajo y predecible (cálculo determinista sin ML pesado, IA acotada a explicación de texto corto) — esto no es casualidad, es una restricción de negocio que informó las decisiones técnicas desde el principio, no un ajuste posterior.

## 4. Panorama competitivo y posicionamiento

| Categoría | Ejemplos | Qué hacen | Qué no hacen (hueco de TradePilot) |
|---|---|---|---|
| Análisis de mercado | TradingView | Gráficos, indicadores, ideas | No gestionan la posición una vez abierta |
| Trade journals | Tradervue, Edgewonk, TraderSync | Registro post-mortem, estadísticas generales | RR fijo/categórico, sin optimizador de parciales, sin modelo de aprendizaje personalizado por patrón de gestión |
| Gestión de prop firms | Dashboards propios de cada prop firm | Reglas y límites de esa firma concreta | Ninguna vista unificada multi-empresa, cero inteligencia de gestión |

**Posicionamiento**: TradePilot R no compite por "mejor journal" (categoría ya ocupada) ni por "mejor análisis" (TradingView). Crea y lidera la categoría de **gestión activa de posición basada en R**, con el aprendizaje personalizado como foso defendible (01 §1, "foso de datos, no de features").

## 5. Growth loops

1. **Loop de hábito de producto**: cada operación registrada mejora la precisión del optimizador personal (02 §6) → mejor recomendación → más confianza en el producto → más registro consistente → mejor dato. Es un loop de valor compuesto, no un growth loop viral clásico, pero es el más defendible a largo plazo.
2. **Loop de comunidad de prop trading** (fase avanzada, opt-in): comparables agregados y anonimizados entre usuarios de una misma prop firm ("traders de FTMO con objetivos >3R llegan a TP el X% de media") pueden ofrecerse como benchmark opcional sin romper el principio de privacidad de datos (01 §2.5) — se anonimiza y agrega, nunca se expone ni se entrena el modelo personal de nadie con datos de otro usuario.
3. **Contenido educativo basado en datos agregados anonimizados** (blog/redes: "el coste real de cerrar parciales pronto, con datos de miles de operaciones") como canal de adquisición orgánica coherente con el propio producto — el gancho de marketing es literalmente la métrica estrella del producto (`%_beneficio_conservado`, 02 §3).

## 6. Riesgo de negocio explícito a vigilar

- **Coste de IA por usuario en V3** (visión de capturas) puede escalar más rápido que ARPU si no se acota el volumen por tier — se diseña con límites de uso mensual por plan desde que se lance esa fase, no después de ver una factura inesperada.
- **Dependencia de OpenAI** como proveedor único de IA — la separación clara entre "cálculo determinista" (nunca depende de terceros, 06 §1) y "generación de texto/visión" (sí depende) limita el radio de impacto de una caída o cambio de precios del proveedor: el producto sigue siendo 100% funcional (calculadora, dashboard, optimizador) incluso si OpenAI no está disponible, solo se degradan las explicaciones en lenguaje natural.
