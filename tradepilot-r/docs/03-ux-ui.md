# 03 · UX/UI y sistema de diseño

*Voz: UX/UI Designer Senior*

## 1. Principio rector

> Un trader que acaba de cerrar una operación tiene el móvil en una mano y el mercado en la otra pantalla. Si registrar le cuesta más de 30 segundos o más de una mano, no lo hará — y un journal con huecos no sirve para nada.

Todo el diseño se subordina a ese principio. No es un dashboard "bonito" que además registra operaciones; es un **registro ultrarrápido** que además tiene un dashboard excelente.

## 2. Arquitectura de la información

```
├── Hoy (Home)                    → calculadora rápida + últimas operaciones + alerta IA del día
├── Registrar operación           → flujo de <30s (modal / full screen en móvil)
├── Operaciones                   → tabla/lista filtrable (activo, cuenta, empresa, fecha, resultado)
│   └── Detalle de operación      → gestión, parciales, capturas, notas, R_max, breakdown de €
├── Optimizador                   → simulador de parciales + recomendaciones IA explicadas
├── Cuentas                       → lista de cuentas agrupadas por empresa de fondeo
│   └── Dashboard de cuenta       → capital, drawdown, reglas de la prop firm, estadísticas propias
├── Dashboard global              → agregado de todas las cuentas/empresas
└── Ajustes                       → perfil, empresas de fondeo, preferencias del optimizador (λ, buckets)
```

**Decisión clave**: "Empresas de fondeo" y "Cuentas" son ciudadanos de primer nivel en la navegación (no un filtro escondido en ajustes), porque la persona P1 (01 §1) vive en ese contexto — necesita cambiar de cuenta tan rápido como cambia de pestaña en el bróker.

## 3. El flujo de registro en 30 segundos

Este es el flujo más importante de todo el producto. Diseño paso a paso:

1. **Botón flotante "+"** siempre visible (patrón Linear/Raycast: acción primaria a un tap, no enterrada en un menú).
2. **Paso único, no wizard multi-pantalla.** Un solo formulario con agrupación visual, no 5 pantallas secuenciales — cada pantalla adicional en un wizard es fricción y abandono medido.
3. **Defaults inteligentes que eliminan tecleo:**
   - Cuenta: se preselecciona la última usada.
   - Fecha/hora: ahora, editable con un tap.
   - Riesgo%: se preselecciona el % configurado por defecto para esa cuenta.
   - Activo: autocompletado con los últimos 5 usados arriba del todo.
4. **Campos mínimos obligatorios**: Activo, Compra/Venta, Riesgo%, RR objetivo. Todo lo demás (parciales, notas, capturas, comentarios, tiempo en mercado) es **opcional y diferible** — se puede completar después desde el detalle de la operación sin penalizar el registro inicial.
5. **Parciales con un input tipo "chip" repetible**: `[RR] [%]` con botón "+ parcial" (hasta 5), pero el registro inicial puede guardarse con 0 parciales definidos (se rellenan al cerrar la operación).
6. **Confirmación instantánea sin pantalla de éxito bloqueante** (toast, no modal) — el usuario vuelve inmediatamente a lo que estaba haciendo.

Objetivo de producto medible: **mediana de tiempo de registro < 30s**, instrumentado desde el día 1 (ver 07-mvp-roadmap.md, métricas del MVP).

## 4. Calculadora (pantalla "Hoy")

Layout de dos columnas en desktop / apilado en móvil:

**Columna de inputs** (todo con recálculo instantáneo, sin botón):
Capital · Empresa de fondeo · Cuenta · Riesgo % ⇄ Riesgo € (bidireccional, cambiar uno actualiza el otro) · RR objetivo · hasta 5 filas de parcial (RR, %).

**Columna de resultados** (se actualiza en cada pulsación de tecla, con animación sutil de valor — patrón "número que cambia" de Linear, nunca parpadeo brusco):
Beneficio máximo · Beneficio real proyectado · Beneficio sacrificado · R finales · € · Esperanza matemática de esta configuración · % beneficio conservado · Impacto de cada parcial (mini barra horizontal por parcial, visualizando qué % del beneficio total aporta cada tramo).

Debajo, siempre visible sin scroll adicional: **tarjeta del optimizador** ("Con tu historial, esta configuración conserva un 12% menos de beneficio que la recomendada — ver por qué").

## 5. Sistema de diseño (tokens)

### 5.1 Filosofía visual

Oscuro por defecto (no es un "modo oscuro" secundario, es la identidad de marca — como TradingView/Linear), denso en información pero nunca ruidoso: jerarquía tipográfica y espaciado hacen el trabajo que otros productos hacen con color y bordes.

### 5.2 Paleta (valores de referencia, ajustables en fase de branding real)

```
--bg-base:        #0A0B0D   (casi negro, no negro puro — evita fatiga visual en sesiones largas)
--bg-surface:      #131417   (tarjetas)
--bg-surface-2:    #1B1D21   (tarjetas elevadas / modales)
--border:          #2A2C31
--text-primary:    #F2F3F5
--text-secondary:  #8B8F98
--accent:          #5B8DEF   (acción primaria — azul frío, nunca verde/rojo para no chocar con semántica P&L)
--positive:        #2ECC71   (R+ / beneficio)
--negative:        #F5484B   (R− / pérdida)
--warning:         #F5A623   (alertas de regla de prop firm / drawdown)
```

**Nota de diseño importante**: el color de acento de marca (`--accent`) se elige deliberadamente **fuera** del eje verde/rojo. Es un error común en apps de trading usar verde como color de marca/CTA — genera ambigüedad constante con "ganancia". Un azul frío (mismo principio que usa Linear con su morado, o TradingView con su azul de UI) deja verde/rojo exclusivamente para semántica de P&L, sin excepciones en toda la app.

### 5.3 Tipografía

Fuente monoespaciada para todo dato numérico (R, €, %) — inspirado en TradingView/terminal financiero: alinea decimales visualmente y comunica precisión. Fuente sans-serif geométrica (tipo Inter) para texto de interfaz. Nunca mezclar ambas dentro del mismo dato.

### 5.4 Componentes clave reutilizables

- **StatTile**: número grande monoespaciado + label + delta opcional (▲/▼ con color semántico). Usado en dashboard, detalle de operación y calculadora.
- **RChip**: pastilla que muestra un valor en R con color semántico automático (verde si ≥0, rojo si <0), usado en toda la tabla de operaciones.
- **ExplainCard**: tarjeta de recomendación de IA — siempre con estructura fija (Recomendación → Por qué → Impacto en €/R → CTA "aplicar a la calculadora"), nunca solo texto libre, para que el usuario aprenda a escanear la explicación en segundos.

## 6. Mobile-first, no mobile-adapted

Todo se diseña primero para viewport móvil y se expande a desktop, no al revés — decisión justificada porque el momento de mayor uso (registro justo tras cerrar una operación) ocurre mayoritariamente en móvil. El desktop existe para las sesiones de análisis profundo (dashboard, optimizador), donde sí se aprovecha el espacio extra con vistas multi-columna.

## 7. Accesibilidad y confianza visual

Contraste mínimo AA (WCAG) incluso en modo oscuro denso — un trader tomando decisiones de riesgo bajo estrés no puede depender de leer números con bajo contraste. Nunca comunicar estado (ganó/perdió, regla de riesgo violada) solo por color — siempre acompañado de icono o texto, para daltonismo (relevante: rojo/verde es la combinación más común de daltonismo, y este producto la usa constantemente para P&L).

## 8. Referencias de inspiración → qué tomamos de cada una

| Referencia | Qué tomamos concretamente |
|---|---|
| TradingView | Densidad de datos numéricos, tipografía monoespaciada, paleta oscura como identidad no como opción |
| Linear | Velocidad percibida (transiciones <150ms), botón de acción primaria siempre a mano, "cero clics perdidos" |
| Apple | Jerarquía tipográfica, espaciado generoso en pantallas de foco (calculadora), micro-animaciones con propósito (nunca decorativas) |
| Notion | Flexibilidad de campos opcionales sin que la pantalla se sienta vacía o sobrecargada |
| Raycast | Patrón de acción rápida (Cmd+K / botón flotante), teclado-first en desktop para power users |
