# 14 · Pantallas, wireframes, flujos y navegación

*Voz: UX/UI Designer Senior*

## 0. Metodología (por qué esto no son 30 wireframes redundantes)

Diseñar cada pantalla tres veces de forma independiente para móvil, tablet y desktop produciría 30 wireframes, la mayoría de ellos idénticos en contenido y distintos solo en cuánto respiran los márgenes — puro trabajo redundante que además dificulta mantener la consistencia (03 §6 ya estableció mobile-first como eje). Este documento dibuja **el wireframe completo en móvil** (la superficie diseñada primero, por ser donde ocurre el uso de mayor frecuencia, 03 §6) y define **un sistema de transformación por breakpoint** (§4) que se aplica de forma sistemática a todas las pantallas — con las excepciones explícitas donde el layout cambia de *forma*, no solo de tamaño.

## 1. Sistema de breakpoints y navegación

| Breakpoint | Rango | Navegación primaria | Patrón dominante |
|---|---|---|---|
| Móvil | < 768px | Tab bar inferior (5 ítems) + FAB flotante | 1 columna, pantallas completas, bottom sheets |
| Tablet | 768–1279px | Rail lateral de iconos | Vistas maestro-detalle (lista + detalle en split, sin navegar) donde aplica |
| Desktop | ≥ 1280px | Sidebar persistente con etiquetas + paleta de comandos (Cmd/Ctrl+K, inspirado en Raycast) | Multi-columna, modales centrados (no bottom sheets) |

**Tab bar móvil (5 ítems, límite duro por alcance del pulgar, 10 §3)**: **Cuentas · Operaciones · Calculadora · Dashboard · Ajustes** (revisado en 17-tradepilot-os.md §4 — "Hoy" ya no es una pestaña propia, se fusiona como tarjeta-resumen dentro de Cuentas, que pasa a ser el home). El FAB de registro flota centrado, superpuesto a la tab bar, y no ocupa uno de los 5 slots — es la acción más frecuente del producto (10) y no compite por espacio con la navegación.

**Paleta de comandos de desktop** (Cmd/Ctrl+K): "Registrar operación", "Buscar operación", "Cambiar de cuenta", "Ir a Calculadora" — accesible sin soltar el teclado, coherente con la inspiración Raycast del proyecto (03 §8).

## 2. Inventario maestro de pantallas

| # | Pantalla | Objetivo único | Disparada desde |
|---|---|---|---|
| 0a | Login | Autenticar | Apertura de la app sin sesión |
| 0b | Onboarding (3 pasos) | Crear la primera empresa + cuenta | Primer login |
| 1 | **Cuentas (Home)** | Ver la salud de cada cuenta de un vistazo, con el resumen del día arriba | Tab bar — pantalla de entrada (17 §4) |
| 2 | Registrar operación | Guardar una operación en <30s (10) | FAB (cuenta precargada si se abre desde el Dashboard de una cuenta) |
| 3 | Operaciones (todas) | Buscar y filtrar histórico entre cuentas — vista secundaria, no de entrada | Tab bar |
| 4 | Detalle de operación | Ver y completar la gestión de una operación concreta | Tap en una fila de Operaciones/Dashboard de cuenta |
| 5 | Calculadora / Optimizador | Simular parciales, ver recomendación de IA | Tab bar |
| 6 | Dashboard de cuenta | Estadísticas, reglas y operaciones de una cuenta concreta | Tap en una tarjeta de cuenta (pantalla 1) |
| 7 | Dashboard global | Panorama agregado de todo el usuario | Tab bar / CTA desde Cuentas |
| 8 | Ajustes (incl. TradeVault, 17 §3.4) | Perfil, empresas, preferencias, suscripción, exportación de datos | Tab bar |

## 3. Wireframes (móvil)

### 0a · Login
```
┌─────────────────────────┐
│                          │
│       TradePilot R       │
│      Every R Matters     │
│                          │
│  [ Continuar con Apple ] │
│  [ Continuar con Google ]│
│  [ Enlace mágico (email)]│
│                          │
└─────────────────────────┘
```
Sin campo de contraseña (01 §3.6, 11 §9). Un único objetivo: entrar.

### 0b · Onboarding (3 pasos, un objetivo por paso)
```
Paso 1/3            Paso 2/3            Paso 3/3
┌───────────┐        ┌───────────┐       ┌───────────┐
│ ¿Con qué   │        │ Tu primera │       │ Todo listo │
│ empresa    │  ───▶  │ cuenta     │  ──▶  │            │
│ operas?    │        │            │       │ [Registrar │
│            │        │ Nombre     │       │  mi primera│
│ FTMO       │        │ Capital    │       │  operación]│
│ Topstep    │        │ Riesgo% def│       │            │
│ Capital    │        │            │       │            │
│  propio    │        │            │       │            │
│ + Otra     │        │            │       │            │
└───────────┘        └───────────┘       └───────────┘
```
Cada paso es una única decisión — nunca dos preguntas en la misma pantalla (mismo principio de 03 aplicado también al onboarding, no solo a las pantallas post-registro).

### 1 · Cuentas (Home) — revisado en 17-tradepilot-os.md §4
```
┌─────────────────────────┐
│ TradePilot R        ⚙    │  zona fría (lectura, ajustes)
│──────────────────────────│
│ Hoy, todas las cuentas:   │  tarjeta-resumen agregada (antes era
│ +2.05R · +2.050 €          │  la pantalla "Hoy" completa — ahora
│──────────────────────────│  es solo la cabecera de esta)
│ FTMO 100k #1         🟢   │  tarjeta de cuenta: capital, DD vs.
│  104.200€ · DD −1.8%/−5%  │  límite, semáforo (17 §4)
│──────────────────────────│
│ Apex 50k #2           🟡  │
│  48.100€ · DD −3.6%/−4%   │
│──────────────────────────│
│ Capital propio          🟢│
│  Personal · +8.5R          │
│──────────────────────────│
│ [   Ver dashboard global  ]│
│                      ( + )│  zona caliente, FAB (pide cuenta si
├────┬────┬────┬────┬───────┤  se abre desde aquí, 10 §2)
│Ctas│ Ops│Calc│Dash│Ajustes│
└────┴────┴────┴────┴───────┘
```
Agrupación por empresa de fondeo dentro de cada bloque cuando el usuario tiene varias cuentas en la misma firma (decisión clave de 01 §1). Estado vacío: "Aún no tienes cuentas — crea la primera" (enlaza a onboarding-lite).

**Semáforo de estado, derivado sin tabla nueva** (de `account_rules`, 04): 🟢 drawdown usado < 70% del límite · 🟡 70-90% · 🔴 > 90% — el mismo dato que ya vive en `account_rules`/`accounts`, mostrado como color en vez de como número que hay que interpretar.

### 2 · Registrar operación (bottom sheet)
```
┌─────────────────────────┐
│          ═══              │  deslizar abajo para cerrar (10 §3)
│ Nueva operación            │
│──────────────────────────│
│ Cuenta: FTMO 100k #1       │  zona fría, ya preseleccionada
│ Símbolo: [EURUSD][XAU][+] │  chips recientes, zona templada
│                            │
│   ( LONG )    ( SHORT )   │  zona caliente
│                            │
│ Riesgo %:  1.0  ◀────▶     │  stepper, zona caliente
│ RR objetivo: [ 5.0 ]       │  teclado numérico
│                            │
│ + Añadir parcial (opcional)│
│                            │
│       [    Guardar    ]   │  fijo abajo, zona caliente
└─────────────────────────┘
```
Detalle completo pulsación a pulsación y presupuesto de tiempo en 10-ux-registro-rapido.md.

### 3 · Operaciones
```
┌─────────────────────────┐
│ Operaciones      🔍  ▤    │  búsqueda + filtro (activo, cuenta, fecha)
│──────────────────────────│
│ EURUSD  Long    +1.05R    │
│ FTMO 100k · hace 2h       │
│──────────────────────────│
│ XAUUSD  Short   −1.00R    │
│ Apex 50k · ayer           │
│──────────────────────────│
│ …                          │
│                      ( + )│
├────┴────┴────┴────┴───────┤
```

### 4 · Detalle de operación
```
┌─────────────────────────┐
│ ←  EURUSD · Long           │
│──────────────────────────│
│ R final: +1.05R · +1.050€ │
│ % conservado: 25%          │
│──────────────────────────│
│ Parciales                  │
│  P1  1.0R  30%   ✓         │
│  P2  2.5R  30%   ✓         │
│  Resto 40%  BE   ✓         │
│──────────────────────────│
│ Impacto por parcial        │  (12 §3, tabla → barras)
│ ▓▓▓░░░░░░░  P1  28.6%      │
│ ▓▓▓▓▓▓▓░░░  P2  71.4%      │
│──────────────────────────│
│ Capturas · Notas · Tiempo  │
│   en mercado                │
│──────────────────────────│
│ [  Duplicar operación  ]  │  (10 §6.1)
└─────────────────────────┘
```

### 5 · Calculadora / Optimizador
```
┌─────────────────────────┐
│ Calculadora                │
│──────────────────────────│
│ Capital · Riesgo · RR obj  │  inputs, recálculo instantáneo
│ Parciales (hasta 5)        │
│──────────────────────────│
│ Beneficio real:   1.050 €  │  resultados (scroll en móvil,
│ Sacrificado:      3.150 €  │  1 columna — 03 §4)
│ % conservado:       25%    │
│──────────────────────────│
│ Optimizador                 │
│ Config. recomendada: …      │
│ Por qué: …                   │
│ [ Aplicar a la calculadora ]│  nunca "aplicar y guardar" (13 §6.3)
└─────────────────────────┘
```

### 6 · Dashboard de cuenta (ahora incluye operaciones de esa cuenta + FAB en contexto)
```
┌─────────────────────────┐
│ ←  FTMO 100k #1        🟢  │
│──────────────────────────│
│ Capital: 104.200 €          │
│ Drawdown: −1.8% / −5% máx   │  regla de la prop firm visible (04 §2)
│──────────────────────────│
│ Profit Factor:    1.8       │
│ Expectativa:    +1.29R      │
│ Sacrificado:    1.200 €     │
│──────────────────────────│
│ Operaciones de esta cuenta  │  nuevo: antes solo vivían en la
│  EURUSD  Long   +1.05R      │  pantalla global "Operaciones"
│  XAUUSD  Short  +1.00R      │
│──────────────────────────│
│ [ Curva de equity ]         │
│ [ Calendario ] [ Heatmap ]  │
│                      ( + )│  FAB con esta cuenta ya precargada:
└─────────────────────────┘  0 pulsaciones de selección (17 §4)
```

### 7 · Dashboard global
Misma estructura que 6, con un selector superior "Todas las cuentas / Por empresa" y un desglose adicional por empresa de fondeo (tabla, no gráfico, para comparar cifras exactas entre firmas).

### 8 · Ajustes
```
┌─────────────────────────┐
│ Ajustes                     │
│──────────────────────────│
│ Perfil                      │
│ Empresas de fondeo          │
│ Preferencias del             │
│   optimizador (λ)            │
│ Suscripción                  │
│ TradeVault (exportar datos)  │  17 §3.4 — pantalla nueva sobre una
│ Sesiones activas (V2, 11 §9) │  promesa ya diseñada (11 §12, 16 §7)
│ Cerrar sesión                │
└─────────────────────────┘
```

### Estados transversales (no se redibujan por pantalla)

Cada pantalla con datos (1, 3, 4, 6, 7) comparte tres estados estándar del sistema de diseño (03 §5): **vacío** (mensaje + CTA hacia la acción que lo resuelve, nunca una pantalla en blanco sin explicación), **cargando** (skeleton del layout real, nunca un spinner genérico que oculte la estructura) y **error** (mensaje + reintento, nunca un código técnico crudo).

## 4. Transformación a tablet y desktop

Regla general aplicada a todas las pantallas del §3, salvo excepciones explícitas:

- **Tablet**: la tab bar inferior se sustituye por un rail lateral de iconos; el contenido gana márgenes pero mantiene 1 columna salvo en las excepciones de abajo.
- **Desktop**: el rail se convierte en sidebar con etiquetas de texto; se activa la paleta de comandos (§1); los bottom sheets de móvil pasan a ser **modales centrados** (nunca ocupan toda la pantalla — en desktop no existe la restricción de "zona de pulgar" que los justificaba, 10 §3).

**Excepciones donde el layout cambia de forma, no solo de tamaño:**

| Pantalla | Móvil | Tablet / Desktop |
|---|---|---|
| Operaciones (3) + Detalle (4) | Dos pantallas separadas, navegación con "←" | **Vista maestro-detalle**: lista a la izquierda, detalle a la derecha, sin navegar — seleccionar una fila actualiza el panel derecho in situ |
| Calculadora (5) | 1 columna, inputs arriba / resultados abajo con scroll | **2 columnas** lado a lado, tal como se especifica en 03 §4 — a este ancho no hace falta elegir entre ver inputs o resultados |
| Cuentas/Home (1) | Tarjetas de cuenta apiladas, una por fila | Grid de tarjetas (2-3 columnas) — más cuentas visibles sin scroll, relevante para P1 con muchas cuentas (01 §1) |
| Dashboard global (7) | Tarjetas apiladas + tabla de desglose con scroll horizontal | Tarjetas en grid + tabla de desglose completa visible sin scroll |
| Registrar operación (2) | Bottom sheet, ancho completo | Modal centrado, ancho fijo (~480px), fondo con overlay — el formulario no necesita ancho completo cuando no compite con el pulgar |

Todo lo que no está en esta tabla es **reflow puro**: mismo contenido, mismo orden lógico, más aire y columnas de soporte (ej. una barra lateral de filtros en Operaciones a partir de tablet) — no una redefinición del propósito de la pantalla.

## 5. Flujos principales

### 5.1 Onboarding
```
Login → ¿usuario nuevo? → Paso 1 (Empresa) → Paso 2 (Cuenta) → Paso 3 (Confirmación)
      → Cuentas/Home (con la cuenta recién creada) → CTA "Registrar mi primera operación" → Pantalla 2
```

### 5.2 Registro de operación
```
FAB (cualquier pantalla con tab bar) → Sheet "Registrar" → Guardar
   → Toast de confirmación (no modal bloqueante, 03 §3.6) → vuelve a la pantalla de origen, ya actualizada
```
Desglose pulsación a pulsación y presupuesto de tiempo: 10-ux-registro-rapido.md §4.

### 5.3 Aplicar una recomendación del optimizador
```
Calculadora → ver recomendación (Score, explicación, 12 §6) → toca "Aplicar a la calculadora"
   → los inputs de la calculadora se sobrescriben con la config. recomendada
   → el usuario decide, en una acción explícita y separada, si registra/actualiza una operación real (13 §6.3)
```
El paso final nunca se fusiona con "Aplicar" — es el único punto de todo el producto donde se acepta fricción deliberada en lugar de eliminarla (10 §2, 13 §6.3).

### 5.4 Entrar a gestionar una cuenta (reemplaza al antiguo "cambiar cuenta activa" como flujo principal)
```
Cuentas/Home → tap en una tarjeta de cuenta → Dashboard de esa cuenta
   → FAB → Sheet "Registrar" con la cuenta ya precargada (0 pulsaciones de selección, 17 §4)
```
El selector de cuenta dentro del sheet "Registrar" (10 §2) sigue existiendo para el caso en que el usuario dispare el FAB desde una pantalla sin contexto de cuenta (Operaciones, Calculadora) — en ese caso, 1 toque con cuentas recientes agrupadas por empresa, igual que antes.

## 6. Mapa de navegación

```
                         ┌────────────┐
                         │   Login     │
                         └──────┬─────┘
                                │ (primera vez)
                         ┌──────▼─────┐
                         │ Onboarding │
                         └──────┬─────┘
                                ▼
   ┌──────┬──────────┬───────────┬─────────┬──────────┐
   │Cuentas│Operaciones│Calculadora│ Dashboard│ Ajustes │   ← tab bar / sidebar
   │(Home) │           │           │  global  │          │
   └──┬────┴─────┬────┴─────┬─────┴────┬─────┴──────────┘
      │          │           │           │
      ▼          ▼           │           │
  Dashboard   Detalle de     │           │
  de cuenta   operación      │           │
      │          │           │           │
      ▼          │           │           │
   Sheet:         │           │           │
   Registrar ◀────┴───────────┘           │
   (cuenta precargada si se abre                       │
   desde Dashboard de cuenta, 17 §4)                    │
```

Toda pantalla de segundo nivel (Detalle, Dashboards) mantiene visible el camino de vuelta al nivel de navegación primaria en 1 toque (`←` en móvil, la selección de sidebar sigue resaltada en desktop) — nunca hay una pantalla en el producto a más de 2 niveles de profundidad desde la navegación principal, salvo Ajustes → sub-secciones (perfil, empresas, suscripción), que por su naturaleza de configuración infrecuente sí se permite un nivel adicional.
