# 07 · MVP y roadmap

*Voz: Senior Product Manager*

## 1. Criterio de corte del MVP

El MVP incluye únicamente lo que es necesario para validar la hipótesis central del producto:

> *Un trader discrecional cambiará su comportamiento de gestión de posiciones si puede ver, en tiempo real y en €, el coste de su patrón de cierre de parciales.*

Todo lo que no sirva directamente a probar esa hipótesis se pospone, aunque esté en el brief original — no por descartarlo, sino por secuenciación (ver 01 §3 para las decisiones concretas ya justificadas).

## 2. Matriz RICE (resumen, no exhaustiva)

| Feature | Reach | Impact | Confidence | Effort | Prioridad |
|---|---|---|---|---|---|
| Registro de operación <30s | Alto | Alto | Alto | Medio | **MVP** |
| Calculadora reactiva (R libre, hasta 5 parciales) | Alto | Alto | Alto | Medio | **MVP** |
| Multi-cuenta / multi-empresa de fondeo | Alto | Alto | Alto | Medio | **MVP** |
| Dashboard por cuenta/empresa/global | Alto | Alto | Alto | Medio | **MVP** |
| Optimizador determinista (sin personalización) | Medio-Alto | Alto | Medio | Medio | **MVP** |
| Explicaciones LLM básicas | Medio | Medio | Medio | Bajo | **MVP** |
| Capturas como adjunto simple (sin IA) | Medio | Bajo | Alto | Bajo | **MVP** |
| Estadísticas bayesianas personalizadas | Alto | Alto | Medio | Medio | **V2** |
| Lectura de capturas por visión IA | Medio | Medio | Bajo (precisión no probada) | Alto | **V2/V3** |
| Heatmaps y calendario avanzado | Medio | Bajo | Alto | Bajo | **V2** |
| Apps nativas iOS/Android | Bajo (PWA cubre el caso) | Medio | Bajo | Muy alto | **V3+** |
| Integración de solo lectura con brokers/prop firms | Medio | Alto | Bajo | Muy alto | **Exploratorio** |

## 3. Fases

### V1 — MVP (validación del core)
- Auth passwordless (magic link + OAuth), onboarding en <2 min.
- CRUD de empresas de fondeo y cuentas.
- Registro de operación (flujo de 30s, 03 §3) con parciales planificados y ejecutados, incluyendo "duplicar última operación" (10-ux-registro-rapido.md §6.1).
- Calculadora reactiva completa (02, `quant-engine`).
- Dashboard por cuenta / empresa / global con métricas de 02 §3-4.
- Optimizador determinista (sin personalización bayesiana todavía — usa el modelo genérico de 02 §5 con datos agregados del propio usuario sin diferenciar buckets pequeños).
- Explicaciones LLM básicas.
- Adjuntar capturas sin procesamiento de IA.
- Suscripción de pago (Stripe) desde el día 1 — no se lanza una versión gratuita indefinida; valida disposición a pagar cuanto antes.

**Criterio de salida del MVP**: cohortes de usuarios early-adopter con mediana de registro <30s, ≥60% de operaciones con al menos 1 parcial definido, retención semana 4 ≥ objetivo definido por el equipo de growth.

### V2 — Personalización e insight
- Estadísticas bayesianas personalizadas por bucket (02 §6, 06 §5).
- Heatmaps, calendario, estadísticas avanzadas del dashboard.
- Modo "aprendizaje visible": notificaciones proactivas cuando el sistema detecta un patrón con suficiente muestra.

### V3 — Visión e input asistido
- Lectura de capturas por IA de visión (06 §4).
- Ampliación de plataformas de captura soportadas (no solo TradingView).

### V4 — Escalabilidad y ecosistema
- Apps nativas si la métrica de uso móvil vía PWA lo justifica (no antes).
- Integraciones de solo lectura con prop firms/brokers relevantes (sincronización automática de operaciones, reduce aún más la fricción de registro — sujeto a disponibilidad de APIs de terceros, fuera del control del equipo).
- Exportación avanzada (informes para prop firms, contabilidad).

## 4. Qué se mide desde el día 1 (instrumentación, no opcional)

- Tiempo de registro de operación (mediana y p90).
- % de operaciones con parciales definidos.
- Uso del optimizador (aperturas, aplicaciones de recomendación — coherente con la North Star Metric de 01 §6).
- Retención semanal por cohorte.
- Coste marginal de IA por usuario activo (06 §7), para no descubrir tarde un problema de unit economics.
