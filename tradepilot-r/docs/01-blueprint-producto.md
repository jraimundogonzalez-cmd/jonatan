# 01 · Blueprint de producto

*Voz: Senior PM + CTO + Arquitecto de software*

## 1. Personas

No diseñamos para un trader (tú). Diseñamos para tres arquetipos que cubren la mayoría del mercado direccionable:

### P1 — "El fondeado multi-cuenta" (core, mayor LTV)
Opera 3-15 cuentas de prop firms simultáneamente (FTMO, Topstep, Apex, 5%ers, FundedNext...). Su problema no es solo gestionar una posición, es no perder de vista las reglas de drawdown de cada cuenta mientras gestiona parciales en varias a la vez. Es el usuario que paga suscripciones sin pestañear porque TradePilot le ahorra pasar un challenge fallido por gestión emocional.

### P2 — "El discrecional de capital propio"
Una o dos cuentas, capital propio o broker retail. Menor urgencia de reglas de riesgo externas, mayor foco en journaling y en entender su propio sesgo de cierre anticipado.

### P3 — "El que viene de un journal genérico"
Ya usa Edgewonk/Tradervue/una hoja de Excel. Sabe lo que es el profit factor pero nunca ha visto cuantificado el "beneficio sacrificado" por cerrar parciales pronto. Es el usuario de conversión más rápida porque el "aha moment" (ver en € cuánto le cuesta su patrón de cierre) es inmediato.

**Implicación de diseño**: el onboarding y el dashboard global deben estar organizados por **empresa de fondeo / cuenta** como eje principal (no por "activo" ni por "fecha"), porque P1 es el segmento de mayor valor y es el que necesita esa vista con más urgencia.

## 2. Principios de diseño (no negociables)

1. **Cero fricción de registro.** Si registrar una operación tarda más de 30s, el usuario deja de usar el producto en la tercera semana. Cada campo opcional debe tener un default inteligente.
2. **RR es siempre decimal, nunca categórico.** Ningún selector de "1:2 / 1:3 / 1:4". Input numérico libre con hasta 2 decimales en todo el sistema.
3. **La IA recomienda, nunca ejecuta ni bloquea.** El usuario siempre puede ir en contra de la recomendación sin fricción ni "modo experto" que desbloquear. Es una herramienta de un adulto responsable, no un guardarraíl.
4. **Todo cálculo es reactivo, no hay botón "calcular".** Ver sección de arquitectura: esto es una decisión de motor de cálculo, no solo de UI.
5. **El dato del usuario nunca se usa para entrenar modelos compartidos entre usuarios** (ver 06-sistema-ia.md). Es un compromiso de producto y de negocio: el foso de TradePilot es que el aprendizaje es 100% privado y personal.
6. **Nunca evaluamos la calidad de la entrada.** Ni "esta operación tenía buena pinta", ni scoring de setups. Es la línea que separa TradePilot de TradingView y de los cientos de "trade journals con IA" genéricos que sí cruzan esa línea y confunden al usuario sobre qué está midiendo el producto.
7. **Cada clic debe generar valor; cada dato introducido debe convertirse en una decisión mejor** (19 §5.2). Es el criterio de corte por defecto para "¿qué funcionalidades sobran?" en la auditoría obligatoria de cada capítulo (19 §5.1).

## 3. Decisiones donde cambiamos el brief original (y por qué)

El brief inicial es muy sólido, pero como equipo señalamos 6 puntos donde proponemos una alternativa mejor:

### 3.1 "Recalcular en tiempo real sin pulsar botones"
**De acuerdo, pero con matiz de arquitectura.** Esto no puede ni debe implicar una llamada a backend en cada tecla. La calculadora de parciales es matemática pura (sin IA, sin base de datos) y debe ejecutarse **100% en el cliente**, en memoria, con un motor de cálculo compartido (ver 05-arquitectura.md §2). Si esto se implementase con round-trips a Supabase por cada cambio de input, a 50 req/s por usuario activo el coste de infraestructura y la latencia percibida matarían la promesa de "tiempo real". Es la decisión más importante de todo el blueprint técnico.

### 3.2 "La IA debe aprender del usuario" desde el día 1
**Downgrade deliberado y justificado.** Un modelo de ML (red neuronal, fine-tuning) necesita cientos de muestras por usuario para no sobreajustar. Un trader activo genera ~15-40 operaciones al mes. Proponemos: **motor estadístico bayesiano** (actualización de distribuciones Beta/Normal por patrón, ver 02 y 06) desde el MVP, que funciona con 20-30 operaciones y es 100% explicable ("con 34 operaciones registradas, cuando tu objetivo es >3R llegas a TP el 24% de las veces, IC 95% [14%–38%]"). Un LLM se usa solo para **generar el lenguaje natural de la explicación**, nunca para el cálculo numérico. Esto es más rápido de construir, más barato de operar, y — crítico — es auditable: un trader profesional no va a confiar decisiones de riesgo a una caja negra neuronal.

### 3.3 Capturas de TradingView con detección automática de entrada/stop/TP
**De acuerdo como V2, no como MVP.** La visión por computador para leer niveles de precio de un screenshot (con líneas, anotaciones, distintos temas de gráfico) es un problema de ingeniería no trivial con tasa de error no despreciable. Meterlo en el MVP retrasa el time-to-market del núcleo del producto (la calculadora + el registro) sin el cual no hay negocio. Proponemos: en el MVP, el usuario adjunta la captura como adjunto simple (como ya pide el brief) y **rellena los 3-4 campos manualmente** (10 segundos extra); la detección automática por IA llega en V2 una vez haya volumen de capturas reales para calibrar el prompt/modelo de visión. Se documenta igualmente el diseño completo en 06-sistema-ia.md para no perder la visión de producto.

### 3.4 Dinero como número flotante
**Decisión técnica que cambiamos sin preguntar: nunca.** Todo importe monetario se almacena como `numeric(18,4)` en Postgres (nunca `float`/`double`) y se opera con librerías de precisión decimal en el cliente (nunca JS `Number` para sumas de céntimos). Es un error clásico y silencioso en fintech: sumar floats produce descuadres de céntimos que, agregados sobre miles de operaciones y cientos de cuentas, generan un dashboard que no cuadra con el broker — y eso destruye la confianza del usuario en el producto de un plumazo.

### 3.5 "Debe soportar cientos de cuentas por usuario"
**De acuerdo, pero el modelo de aislamiento correcto es RLS multi-tenant, no schema-per-tenant.** Ver 04-base-de-datos.md. Un esquema por cuenta o por empresa de fondeo no escala operacionalmente (miles de usuarios × cientos de cuentas = decenas de miles de schemas, imposible de migrar/mantener). Row-Level Security de Postgres sobre un esquema único da el mismo aislamiento lógico sin ese coste operativo.

### 3.6 Login únicamente con contraseña (implícito, no roto)
Añadimos algo que el brief no menciona pero un CTO no puede omitir: **passwordless por defecto** (magic link / OAuth Google/Apple vía Supabase Auth), con 2FA opcional. Un trader que gestiona cuentas de fondeo reales es un objetivo de phishing; reducir la superficie de contraseñas reutilizadas es higiene de seguridad básica y además reduce fricción de onboarding (menos abandono en el registro).

## 4. Roadmap como startup (orden de diseño, no de construcción de código)

Tal y como se pidió: **nunca empezar programando**. Este es el orden de diseño que hemos seguido y que debe seguir cualquier persona que se incorpore al proyecto:

```
1. Blueprint       →  este documento + 00
2. UX              →  03-ux-ui.md
3. Base de datos   →  04-base-de-datos.md
4. Arquitectura    →  05-arquitectura.md
5. MVP             →  07-mvp-roadmap.md
6. IA              →  06-sistema-ia.md
7. Escalabilidad   →  05-arquitectura.md §4 + 08-modelo-negocio.md
```

Nota de orden: el **modelo matemático (02)** no aparece como una fase separada en el roadmap del usuario porque no lo es — es la **capa cero** de la que dependen UX, base de datos, arquitectura y IA por igual. Se documenta primero en la práctica aunque no tenga "fase" propia.

## 5. Qué NO es TradePilot R (alcance negativo, igual de importante)

- No es un broker ni ejecuta órdenes. Cero integración con APIs de trading en el MVP (posible integración de solo lectura en fases avanzadas, ver 07).
- No es una señal de trading ni un indicador técnico.
- No es un backtester de estrategias.
- No es una red social de trading (sin copy-trading, sin leaderboard público en el MVP — puede evaluarse como feature de comunidad en fases avanzadas, siempre opt-in).

## 6. Métrica norte (North Star Metric)

**Operaciones gestionadas con recomendación de la IA revisada por el usuario, por semana activa.**

No elegimos "operaciones registradas" (vanity metric, no mide si el producto cambia comportamiento) ni "ingresos" (metric de negocio, no de producto). Elegimos una métrica que solo sube si (a) el usuario registra operaciones con frecuencia real y (b) usa el optimizador como herramienta de decisión, que es exactamente la promesa de valor del producto.

**Nota de reconciliación (tras 17-tradepilot-os.md §4)**: la reorientación de la navegación a "cuenta como centro de gravedad" no cambia esta métrica, y es importante explicar por qué no. La cuenta es el objeto que el usuario **navega y vigila** (dónde entra, qué mira primero); la operación gestionada con recomendación de IA sigue siendo el evento que **crea valor real** (mueve la esperanza matemática del trader). Confundir ambas llevaría a optimizar la métrica equivocada — por ejemplo, "cuentas visitadas por semana" subiría con solo abrir la app, sin que el trader mejorara nada. La cuenta organiza la experiencia; la operación sigue siendo la unidad que se mide.

## 7. Empresas/Cuentas como eje de navegación (ver desarrollo completo en 17 §4)

El §1 de este documento ya apuntaba que "el onboarding y el dashboard global deben estar organizados por empresa de fondeo/cuenta como eje principal" por ser el contexto en el que vive la persona P1. 17-tradepilot-os.md §4 completa esa idea hasta la navegación misma: **Cuentas pasa a ser la pantalla de entrada de la aplicación** (antes lo era "Hoy", un log plano de operaciones del día), con el estado de salud de cada cuenta visible de un vistazo. Cambios de pantalla y flujo aplicados en 03-ux-ui.md §2 y 14-pantallas-wireframes.md §1-3.
