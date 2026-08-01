# 00 · Resumen ejecutivo

## Producto

**TradePilot R** — *Every R Matters.*

Software premium de **gestión de posiciones** para traders discrecionales (Forex, índices, materias primas, acciones, cripto), agnóstico de estrategia, que convierte cada operación en unidades de riesgo (**R**) y ayuda al trader a decidir *cómo gestionar* una posición ya abierta: cuántos parciales tomar, en qué RR, y qué impacto tiene esa decisión en su esperanza matemática a largo plazo.

## El problema real

Existen decenas de herramientas para decidir **cuándo entrar** (TradingView, indicadores, señales). Prácticamente ninguna herramienta seria ayuda a decidir **qué hacer una vez dentro**. Y sin embargo, la gestión de la posición — no la entrada — es la variable que más varianza introduce en la curva de resultados de un trader discrecional:

- Dos traders con el mismo setup y el mismo punto de entrada obtienen resultados radicalmente distintos según cómo gestionen los parciales.
- El cierre emocional anticipado ("cerrar en breakeven+", "asegurar algo") es la fuga de esperanza matemática más común y menos medida en trading discrecional.
- Ningún journal de trading actual (Tradervue, Edgewonk, TraderSync) modela el RR como **variable continua por operación** ni cuantifica el **beneficio sacrificado** por cerrar parciales antes del objetivo.

## La propuesta de valor

TradePilot R no analiza gráficos ni predice mercado. Analiza **decisiones de gestión** con las mismas herramientas que un quant usaría para evaluar un sistema: esperanza matemática, distribución de R, sensibilidad a los parciales. Y lo hace en tiempo real, sin fricción, en menos de 30 segundos por operación.

Tres pilares diferenciales:

1. **RR nunca es un ratio fijo.** Cada operación puede ser 1.47R, 2.63R, 5.72R... Todo el motor de cálculo trabaja con decimales arbitrarios, nunca con presets como "1:2" o "1:3".
2. **El optimizador no impone, explica.** La IA prueba miles de combinaciones de parciales y siempre responde primero a *por qué*, no solo a *qué*. Es una herramienta de espejo estadístico, no de piloto automático.
3. **Aprendizaje 100% personal.** El modelo no compara al usuario contra "traders medios". Aprende el patrón de comportamiento de ese trader concreto (p.ej. "cuando tu objetivo es >3R, sueles llegar a 1R en el 82% de los casos pero solo alcanzas el TP en el 24%") y adapta sus recomendaciones a ese patrón.

## Filosofía (regla de oro del producto)

> **TradingView sirve para analizar. TradePilot sirve para gestionar.**

Esto no es una frase de marketing, es una restricción de arquitectura: TradePilot **nunca** evalúa si una entrada es buena o mala, nunca sugiere activos, nunca da señales. Todo el dominio del producto empieza en el momento en que el trader ya decidió su entrada, su stop y su take profit. A partir de ahí, todo es matemática de gestión.

## Por qué esto puede ser el software de referencia

- **Mercado desatendido**: existe una categoría completa (position management) sin un líder claro. Los journals actuales son "post-mortem" (registran lo que pasó); TradePilot es "in-the-moment" (ayuda a decidir mientras la operación está viva) + "post-mortem" combinados.
- **Foso defendible**: el valor compuesto de TradePilot crece con el histórico personal de cada usuario (aprendizaje personalizado). Cuantas más operaciones registra un trader, más preciso es su asesor, más caro le sale migrar a la competencia. Es un foso de datos, no de features.
- **Modelo de negocio probado**: SaaS de suscripción mensual, mismo modelo que TradingView/Edgewonk, con métricas de retención muy altas porque el producto se usa en cada operación (uso diario, no esporádico).

## Cómo se organiza este blueprint

| Documento | Responde a |
|---|---|
| [01 · Blueprint de producto](./01-blueprint-producto.md) | Qué construimos, para quién, y qué decisiones de diseño cambiamos y por qué |
| [02 · Modelo matemático](./02-modelo-matematico.md) | Cómo se calcula la esperanza, los parciales y el optimizador |
| [03 · UX/UI](./03-ux-ui.md) | Cómo se siente usar el producto, pantalla a pantalla |
| [04 · Base de datos](./04-base-de-datos.md) | Cómo se modelan los datos para escalar a miles de cuentas |
| [05 · Arquitectura](./05-arquitectura.md) | Cómo se construye técnicamente y cómo escala |
| [06 · Sistema de IA](./06-sistema-ia.md) | Cómo funciona el optimizador y el aprendizaje personalizado |
| [07 · MVP y roadmap](./07-mvp-roadmap.md) | Qué se construye primero y en qué orden |
| [08 · Modelo de negocio](./08-modelo-negocio.md) | Cómo se monetiza y cómo crece |
