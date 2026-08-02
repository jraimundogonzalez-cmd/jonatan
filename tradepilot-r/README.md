# TradePilot R

**Every R Matters.**

Software premium de gestión de posiciones para traders discrecionales (Forex, índices, materias primas, acciones, cripto). Agnóstico de estrategia y agnóstico de ratio riesgo/beneficio: todo el producto se basa en R como unidad decimal libre, nunca en ratios fijos.

> TradingView sirve para analizar. TradePilot sirve para gestionar.

Este directorio contiene el **blueprint completo** del producto, diseñado antes de escribir una sola línea de código de la aplicación, siguiendo el orden: Blueprint → UX → Base de datos → Arquitectura → MVP → IA → Escalabilidad.

## Índice del blueprint

| Doc | Contenido |
|---|---|
| [00 · Resumen ejecutivo](./docs/00-resumen-ejecutivo.md) | Visión, problema, propuesta de valor, filosofía del producto |
| [01 · Blueprint de producto](./docs/01-blueprint-producto.md) | Personas, principios, decisiones donde se mejora el brief original (con justificación), alcance negativo |
| [02 · Modelo matemático](./docs/02-modelo-matematico.md) | Fórmulas de R, parciales, esperanza matemática, algoritmo del optimizador, aprendizaje bayesiano personalizado |
| [03 · UX/UI](./docs/03-ux-ui.md) | Arquitectura de la información, flujo de registro <30s, sistema de diseño (tokens, componentes) |
| [04 · Base de datos](./docs/04-base-de-datos.md) | Esquema PostgreSQL/Supabase completo, RLS multi-tenant, DDL |
| [05 · Arquitectura](./docs/05-arquitectura.md) | Stack técnico, motor de cálculo client-side, escalabilidad, seguridad |
| [06 · Sistema de IA](./docs/06-sistema-ia.md) | Optimizador determinista vs. LLM para explicación/visión, roadmap de IA |
| [07 · MVP y roadmap](./docs/07-mvp-roadmap.md) | Matriz RICE, fases V1-V4, métricas de instrumentación |
| [08 · Modelo de negocio](./docs/08-modelo-negocio.md) | Pricing, unit economics, competencia, growth loops |
| [09 · Product Blueprint](./docs/09-product-blueprint.md) | Documento canónico: visión, misión, filosofía, problemas, público, competidores, casos de uso, roadmap, MVP, versiones futuras |
| [10 · UX de registro rápido](./docs/10-ux-registro-rapido.md) | Flujo de registro ≤3 pulsaciones / una mano / <30s: mapa de pulsaciones, zona de pulgar, auditoría de botones, vías más rápidas |
| [11 · Arquitectura a escala](./docs/11-arquitectura-a-escala.md) | Visión a 10 años (Principal Architect): jerarquía de dominio, frontend, backend/API, Supabase, BD a escala, costes, seguridad, autenticación, permisos, logs, backups |
| [12 · Demostración matemática](./docs/12-demostracion-matematica.md) | El "cerebro": R final, €, beneficio sacrificado/conservado, esperanza matemática, impacto de cada parcial y prueba numérica de dominancia del optimizador — solo datos |
| [13 · IA de aprendizaje continuo](./docs/13-ia-aprendizaje-continuo.md) | Aprendizaje 100% personal y continuo: cold start honesto, decaimiento temporal, pipeline de actualización incremental, guardarraíles de que la IA nunca sustituye al trader |
| [14 · Pantallas, wireframes y navegación](./docs/14-pantallas-wireframes.md) | Inventario completo de pantallas con wireframes (móvil) y reglas de transformación a tablet/desktop, flujos principales y mapa de navegación |
| [15 · Base de datos completa](./docs/15-base-de-datos-completa.md) | Normalización (1FN/2FN/3FN) explicada tabla a tabla, versionado (esquema/capital/IA), logs de auditoría append-only, configuración y feature flags — extiende 04 |
| [16 · Modelo SaaS (fundador)](./docs/16-modelo-saas-fundador.md) | Tiers Gratis/PRO/Elite/Team, costes y margen, canal B2B2C con prop firms, roadmap de negocio, retención basada en valor (sin dark patterns) y la IA contada como historia de negocio |
| [17 · TradePilot OS](./docs/17-tradepilot-os.md) | Visión de plataforma: 6 de 9 módulos ya existen (mapeados a los bounded contexts de 11), los 4 nuevos (Replay, Psychology, Tax Report, TradeVault) acotados con el filtro de producto, y la reorientación de TradePilot R a cuenta como centro de gravedad |
| [18 · Cuentas completas y Dashboard Maestro](./docs/18-cuentas-completas-dashboard-maestro.md) | Estado (Challenge/Funded/Live/Pausada/Terminada), drawdown estático vs. trailing, Profit Split separado del modelo matemático puro, y el Dashboard Maestro con prioridad "cuentas en riesgo" |
| [19 · Metodología y reglas del proyecto](./docs/19-metodologia-y-reglas-del-proyecto.md) | Capítulo de proceso: Challenge Mode, formato obligatorio de decisiones, Auditoría del Capítulo (Apple/Linear/TradingView/hedge fund + puntuación 0-100), principio anti-hardcoding (Rule Engine), pie de capítulo obligatorio, principio rector "cada clic debe generar valor" |
| [20 · Flujo funcional del usuario](./docs/20-flujo-funcional-usuario.md) | Recorrido completo desde la instalación hasta cientos de operaciones y consulta de estadísticas — sin pantallas, solo funcional. Auditado (92/100), madurez 95% — **aprobado** |
| [21 · Core vs. Módulos y Plan de Gestión](./docs/21-arquitectura-core-vs-modulos.md) | Revisión arquitectónica bajo Challenge Mode: CORE oficial (8 conceptos), el Plan de Gestión como unidad reutilizable de la que una Operación es una ejecución, Rule Engine como "core por dependencia, módulo por construcción". **Aprobado** |
| [21.5 · Domain Model (DDD)](./docs/21.5-domain-model-ddd.md) | Modelo de dominio profesional: Entities/Value Objects/Aggregates/Domain Services/Domain Events/Bounded Contexts. Hallazgo principal: patrón Snapshot — Plan y Perfil de Reglas no pueden referenciarse en vivo desde Operación/Cuenta sin corromper el histórico matemático. Puntuación 95/100, madurez 95%, dominio validado para 10 años. **Aprobado**, patrón Snapshot elevado a regla permanente (19 regla 13) |
| [22 · Rule Engine (diseño conceptual)](./docs/22-rule-engine.md) | Motor declarativo Library→Definition→Instance→Evaluation. Responde la pregunta Stripe/Shopify/Linear/Notion, descarta explícitamente un motor de expresiones genérico, distingue reglas de estado de cuenta vs. de evento de operación, resuelve dependencias entre reglas (Consistency Rule) y cataloga las 15 reglas pedidas en 7 arquetipos + 1 categoría de cálculo. Puntuación 93/100, madurez 90%. **Aprobado** |
| [22.5 · System Contracts](./docs/22.5-system-contracts.md) | 13 módulos oficiales como cajas negras, cada uno con contrato de 8 campos (responsabilidad/entradas/salidas/lo que nunca debe conocer/eventos/invariantes/errores). Hallazgo principal: Rule Engine y Risk Engine se separan explícitamente (calcula vs. juzga) para evitar responsabilidad duplicada. Dependencias permitidas y prohibidas trazadas, 5 principios SOLID/DDD demostrados con ejemplos concretos de esta misma arquitectura. Puntuación 94/100, madurez 92%. **Aprobado**, "Calcular ≠ Juzgar" elevado a regla permanente (19 regla 14) |
| [23 · Invariantes y Principios (Constitución técnica)](./docs/23-invariantes-y-principios.md) | 15 invariantes y 11 principios de ingeniería, analizados críticamente — 5 ejemplos del fundador corregidos de redacción (incl. uno que contradecía la propia edición auditada de operaciones ya aprobada en 20) y el orden de los principios corregido por contradecir la prioridad #1 ya aprobada (precisión matemática, 19 §6). Cada punto con justificación, riesgo de incumplimiento y caso de excepción razonable (o "ninguno encontrado"). Puntuación 96/100, la más alta del blueprint. **Aprobada como Constitución Técnica permanente** |
| [24 · Ventaja Competitiva](./docs/24-ventaja-competitiva.md) | Estrategia pura, cero tecnología. Honesto sobre los límites reales (TradePilot no tiene efecto de red clásico, el arranque en frío es una vulnerabilidad real frente a un competidor con estadísticas agregadas). El verdadero foso: calibración bayesiana personal acumulada con el tiempo, no replicable con financiación. Amenaza más creíble identificada: una prop firm grande construyendo una versión interna gratuita, no otro startup. 10 ventajas, 10 riesgos, 10 activos estratégicos, ADN permanente. Puntuación 91/100. **Aprobado — Fase 0 (Blueprint) oficialmente finalizada** |

### Fase 1 — Diseño Técnico

| Doc | Contenido |
|---|---|
| [25 · Arquitectura Técnica de Plataforma](./docs/25-arquitectura-tecnica-plataforma.md) | Diseño end-to-end antes de módulo por módulo. Hallazgo principal: los 13 módulos de 22.5 no son 13 microservicios — se organizan en Core Service (monolito modular síncrono), 6 Async Workers, 2 librerías compartidas y mecanismos a nivel de trigger de BD. Responde las 13 preguntas del CTO, clasifica criticidad (incl. un caso "pequeño pero mission critical"), riesgos, cuellos de botella y estrategia de escalabilidad. Puntuación 93/100, madurez 90%. Pendiente de aprobación antes del diseño individual de cada componente |

## Nota sobre este repositorio

Este proyecto convive con la aplicación de fitness/nutrición existente en la raíz del repo. Es un producto independiente, con su propio stack, base de datos y ciclo de vida — la carpeta `tradepilot-r/` no depende de ningún código de la app de fitness ni lo modifica. Cuando el proyecto avance a fase de implementación (post-blueprint), se evaluará si conviene un repositorio dedicado o mantener el monorepo.
