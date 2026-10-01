# 09 · Product Blueprint

*Voz: CEO / Senior Product Manager*

Este es el documento canónico de producto: consolida y precisa lo desarrollado en 00, 01, 07 y 08 bajo la estructura de referencia del proyecto. Es el documento que se enseña a un inversor, a un nuevo VP de producto o a un candidato en fase de entrevista para explicar qué es TradePilot R en una sola sesión de lectura. Para el detalle técnico de cada apartado, se enlaza al documento profundo correspondiente.

## 1. Visión

Ser el sistema operativo de gestión de riesgo de todo trader discrecional serio del mundo — el lugar donde, sin importar en qué activo, bróker o prop firm opere, una operación abierta se convierte en una decisión medible en R, y donde el historial propio del trader es el asesor de gestión más fiable que jamás ha tenido.

Dentro de 5 años, "gestioné esa posición sin TradePilot" debería sonar, para un trader profesional, tan anticuado como "hice mi análisis técnico sin gráficos".

## 2. Misión

Ayudar, cada día, a que un trader discrecional cierre sus operaciones capturando más de lo que su comportamiento actual le permite capturar — cuantificando en tiempo real el coste real de cada decisión de gestión, sin jamás opinar sobre si la operación en sí era buena o mala.

## 3. Filosofía

Tres reglas no negociables, ya establecidas como principios de arquitectura (01 §2) y que se repiten aquí porque son la columna vertebral de todo el producto:

1. **TradingView analiza. TradePilot gestiona.** Nunca se cruza esa línea, ni siquiera cuando fuera técnicamente fácil hacerlo (p. ej. "puntuar" una entrada). El día que TradePilot opine sobre la entrada, deja de ser una herramienta de gestión objetiva y se convierte en una señal más — y pierde la única cosa que lo hace diferente.
2. **La IA recomienda, el trader decide.** Cero automatización de ejecución, cero bloqueos. Es un espejo estadístico, no un piloto automático.
3. **RR es siempre decimal y personal.** Nunca ratios fijos, nunca comparación entre usuarios distintos — cada trader se mide únicamente contra su propio historial.

## 4. Problemas que resuelve

| Problema real del trader discrecional | Cómo lo resuelve TradePilot |
|---|---|
| No existe forma de cuantificar cuánto cuesta, en €, cerrar parciales por miedo | `%_beneficio_conservado` y `beneficio_sacrificado`, calculados en tiempo real (02 §3) |
| Los journals actuales asumen RR fijo o no modelan parciales de forma granular | Motor de cálculo con R decimal libre y hasta N parciales configurables (02 §1-2) |
| Gestionar cuentas de varias prop firms exige abrir varios dashboards distintos | Vista unificada por cuenta / por empresa / global (01 §1, 04) |
| El trader no sabe si su forma de gestionar parciales es óptima para su propio comportamiento, no para "el trader medio" | Optimizador determinista + estadística bayesiana 100% personal, nunca comparativa entre usuarios (02 §5-6, 06 §5) |
| Registrar operaciones con detalle es tan tedioso que se abandona a las pocas semanas | Flujo de registro <30s, ≤3 pulsaciones de navegación (10-ux-registro-rapido.md) |

## 5. Público objetivo

Ver personas completas en 01 §1. Resumen ejecutivo:

- **P1 — Fondeado multi-cuenta** (mayor LTV, prioridad de diseño): 3-15 cuentas de prop firms simultáneas.
- **P2 — Discrecional de capital propio**: 1-2 cuentas, foco en journaling y autoconocimiento de sesgo.
- **P3 — Migración desde journal genérico**: conversión rápida por el "aha moment" del beneficio sacrificado.

TAM: cualquier trader discrecional activo (no sistemático/algorítmico) en Forex, índices, materias primas, acciones o cripto, fondeado o no. No requiere una estrategia concreta ni un bróker concreto — el único requisito es operar con stop y objetivo definidos.

## 6. Competidores

| Categoría | Quién | Qué cubren | Hueco que deja para TradePilot |
|---|---|---|---|
| Análisis de mercado | TradingView | Gráficos, indicadores, ideas | Cero gestión de posición abierta |
| Trade journals | Tradervue, Edgewonk, TraderSync | Registro post-mortem, estadísticas generales de P&L | RR fijo, sin optimizador de parciales, sin aprendizaje personalizado de patrón de gestión |
| Dashboards de prop firm | Paneles propios de cada firma | Reglas y límites de esa firma concreta | Sin vista unificada multi-firma, cero inteligencia de gestión |

**Ningún competidor directo existe hoy en la categoría "gestión activa de posición basada en R".** Es un espacio en blanco, no una guerra de precios contra un incumbente — la prioridad estratégica es definir la categoría antes de que alguien más lo haga, no competir en features contra un jugador establecido. Detalle de posicionamiento y growth en 08 §4-5.

## 7. Casos de uso

Escenarios concretos que el producto debe resolver sin fricción, usados como criterio de aceptación de diseño:

1. *"Acabo de cerrar una operación en el semáforo antes de que abra el mercado europeo — quiero registrarla en menos de lo que tarda en cambiar a verde."* → flujo de 30s (10-ux-registro-rapido.md).
2. *"Tengo 4 cuentas en 3 prop firms distintas y quiero ver mi drawdown consolidado sin cambiar de app ni de pestaña."* → dashboard global (04 §2, 03 §2).
3. *"Sé que suelo cerrar en 1R cuando mi objetivo es de 5R — quiero saber cuánto me ha costado eso este mes en euros."* → estadística bayesiana personal + `beneficio_sacrificado` agregado (02 §3, 06 §5).
4. *"Antes de que el precio llegue a mi primer parcial, quiero simular tres configuraciones distintas y ver cuál conserva más esperanza matemática."* → Calculadora/Optimizador como pantalla propia (03 §4, 02 §5).
5. *"Es fin de mes y quiero auditar, por cuenta y por empresa de fondeo, cuánto beneficio sacrifiqué en total."* → dashboard con desglose (01 §6, 04 §5).
6. *"Quiero repetir la configuración de parciales de mi última operación en el mismo símbolo sin volver a teclear nada."* → "Duplicar última operación", propuesta de aceleración (10-ux-registro-rapido.md §6).

## 8. Roadmap

Resumen (detalle completo, matriz RICE y criterios de salida en 07-mvp-roadmap.md):

```
V1 (MVP)  →  Registro <30s · Calculadora reactiva · Multi-cuenta/empresa · Dashboard ·
              Optimizador determinista (sin personalización) · Explicaciones LLM básicas
V2        →  Estadísticas bayesianas personalizadas · Heatmaps/calendario avanzado
V3        →  Lectura de capturas por visión IA
V4        →  Apps nativas (si el uso vía PWA lo justifica) · Integraciones de solo lectura
```

## 9. MVP

Criterio de corte (07 §1): el MVP incluye únicamente lo necesario para validar que *"un trader cambia su comportamiento de gestión si ve, en tiempo real y en €, el coste de su patrón de cierre de parciales."* Todo lo demás se pospone explícitamente, no por descarte sino por secuenciación. Alcance detallado y criterio de salida de cohorte en 07-mvp-roadmap.md §3.

## 10. Versiones futuras

- **V2 — Personalización e insight**: el producto pasa de "calculadora inteligente" a "asesor que conoce tu patrón", con intervalos de credibilidad visibles (02 §6.2) para que la confianza crezca con el dato, no con una promesa vacía de IA.
- **V3 — Input asistido por visión**: solo se construye si el volumen de capturas reales confirma que el ahorro de tiempo justifica el coste de precisión (06 §4) — no se lanza por moda de "IA que lee pantallas".
- **V4 — Ecosistema**: apps nativas e integraciones de solo lectura con brokers/prop firms, condicionadas a validación de uso real vía PWA y a disponibilidad de APIs de terceros (07 §3, 05 §6).
- **Exploratorio (sin fecha)**: benchmarking anonimizado opt-in entre traders de una misma prop firm (08 §5.2) — nunca compromete el principio de aprendizaje 100% privado por usuario.
