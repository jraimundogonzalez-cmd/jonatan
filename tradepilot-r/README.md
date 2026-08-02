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

## Nota sobre este repositorio

Este proyecto convive con la aplicación de fitness/nutrición existente en la raíz del repo. Es un producto independiente, con su propio stack, base de datos y ciclo de vida — la carpeta `tradepilot-r/` no depende de ningún código de la app de fitness ni lo modifica. Cuando el proyecto avance a fase de implementación (post-blueprint), se evaluará si conviene un repositorio dedicado o mantener el monorepo.
