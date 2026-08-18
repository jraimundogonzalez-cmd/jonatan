# 05 · Arquitectura del sistema

*Voz: Arquitecto de software + Experto en escalabilidad SaaS*

## 1. Stack y por qué

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React + TypeScript | SSR/streaming para el dashboard (carga inicial rápida en móvil con datos), rutas API co-ubicadas para las pocas operaciones que sí necesitan servidor (IA, storage), ecosistema maduro para PWA |
| Estilos | Tailwind CSS + tokens del sistema de diseño (03 §5) | Velocidad de iteración, consistencia de design tokens vía config, cero CSS muerto en producción |
| Estado cliente | Zustand (o Jotai) para estado de la calculadora | Estado local reactivo sin boilerplate de Redux, crítico para el recálculo instantáneo (§2) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) | Time-to-market: auth, RLS, storage y realtime out-of-the-box; evita construir un backend a medida antes de validar el producto — decisión de startup, no solo técnica |
| IA | OpenAI API (visión + generación de lenguaje natural) | Ver 06 — nunca para el cálculo numérico del optimizador, solo para explicación y lectura de capturas |
| Hosting | Vercel (frontend) + Supabase Cloud (datos) | Escalado automático, edge network global (relevante: usuarios de TradePilot operan en zonas horarias de todo el mundo) |

## 2. El motor de cálculo: la decisión arquitectónica más importante

Toda la matemática de 02-modelo-matematico.md (calculadora de parciales, esperanza, % conservado) se implementa como **un módulo TypeScript puro, sin efectos secundarios, que corre en el cliente**:

```
packages/quant-engine/
  ├─ calculate.ts     → R_final, beneficio_max, beneficio_sacrificado, %_conservado
  ├─ expectancy.ts     → E[R], E[€], profit factor, drawdown
  ├─ optimizer.ts      → grid search + score media-varianza (02 §5)
  └─ types.ts
```

**Por qué esto no es un detalle de implementación sino una decisión de arquitectura**: si la calculadora dependiera de una llamada a Supabase o a una Edge Function por cada cambio de input, (a) la latencia de red (100-300ms típico) rompe la promesa de "tiempo real sin botones" del brief, y (b) a escala de miles de usuarios recalculando en cada tecla, el coste de invocaciones de backend sería significativo sin ninguna necesidad — es matemática determinista, no requiere estado de servidor.

`quant-engine` se publica como paquete compartido (monorepo, ver §5) para poder reutilizarse literalmente igual en un futuro cliente nativo (iOS/Android) sin reescribir la lógica de negocio más crítica del producto.

## 3. Qué sí toca backend/red

| Operación | Dónde vive | Por qué no es cliente puro |
|---|---|---|
| Guardar operación / parciales | Supabase (Postgres vía RLS) | Persistencia, multi-dispositivo |
| Lectura de capturas (IA visión) | Edge Function → OpenAI | Requiere clave de API server-side, nunca expuesta al cliente |
| Generación de explicación en lenguaje natural | Edge Function → OpenAI | Idem |
| Estadísticas bayesianas personalizadas (02 §6) | Edge Function o job programado | Se recalculan al cerrar una operación, no en cada tecla — se cachean en `user_stat_buckets` (04 §3) y el cliente las lee, no las recalcula |
| Vistas agregadas del dashboard | Vistas materializadas Postgres (04 §5) | Evita agregación pesada repetida en cada carga |

## 4. Escalabilidad a miles de usuarios / cientos de cuentas por usuario

1. **Aislamiento RLS, no aislamiento físico** (04 §1) — escala horizontalmente sin fragmentar infraestructura.
2. **Índices desde el día 1** sobre `(user_id, opened_at)`, `(account_id, opened_at)` — el patrón de acceso dominante es "operaciones de esta cuenta/usuario ordenadas por fecha", se indexa exactamente para eso.
3. **Particionado por rango de fecha** en `trades` cuando el volumen lo justifique (no en el MVP, pero el modelo de datos ya usa `opened_at` como eje natural de partición — no requiere migración de esquema, solo activar partición nativa de Postgres cuando el volumen lo pida).
4. **Rate limiting y colas para llamadas a OpenAI**: la generación de explicaciones y lectura de capturas se encola (no bloquea el guardado de la operación) — el usuario ve la operación guardada al instante y la explicación de IA "aparece" 1-2s después de forma asíncrona (optimistic UI).
5. **Cacheo agresivo de estadísticas personalizadas**: los buckets bayesianos (04 §3) se recalculan solo al cerrar una operación nueva en ese bucket, no en cada lectura — lectura es O(1) desde `user_stat_buckets`.
6. **CDN para capturas** vía Supabase Storage + transformaciones on-the-fly (miniaturas) para que la tabla de operaciones cargue rápido incluso con cientos de capturas.

## 5. Estructura de repositorio (monorepo)

```
tradepilot-r/
  apps/
    web/                 → Next.js app (PWA, mobile-first)
  packages/
    quant-engine/             → motor de cálculo puro (§2), testeado exhaustivamente (property-based testing)
    ui/                    → design system (03), componentes compartidos
    supabase/              → migraciones SQL (04), policies RLS, funciones
  docs/                    → este blueprint
```

Monorepo (Turborepo/pnpm workspaces) porque `quant-engine` debe ser importado tanto por la web como, en el futuro, por Edge Functions que necesiten validar cálculos server-side (p.ej. verificación de integridad antes de guardar) sin duplicar lógica — una sola fuente de verdad matemática, coherente con 02.

## 6. PWA, no app nativa, en el MVP

Se prioriza **PWA instalable** (Next.js + manifest + service worker) sobre apps nativas iOS/Android en el MVP:

- Un solo código base para móvil y desktop reduce el coste de desarrollo a la mitad en la fase de validación de producto.
- El flujo de registro de 30s (03 §3) funciona perfectamente en una PWA moderna con soporte offline básico (guardar operación sin conexión y sincronizar al recuperarla — relevante porque muchos traders operan con conexión inestable en sesiones fuera de casa).
- Apps nativas se evalúan en fase de escalabilidad avanzada (07 §3) una vez validado el product-market fit, no antes — construir dos apps nativas antes de validar el core del producto sería la clásica sobre-inversión prematura que este equipo debe evitar.

## 7. Seguridad

- Supabase Auth con RLS como perímetro de datos (04 §4).
- Claves de OpenAI y cualquier secreto **solo en Edge Functions**, nunca en el cliente.
- Capturas de pantalla en bucket privado de Storage con URLs firmadas de corta duración, nunca públicas por defecto — pueden contener información de cuenta identificable.
- Auditoría de recomendaciones de IA (`ai_recommendations`, 04 §3) — trazabilidad completa de qué recomendó el sistema y si el usuario la aplicó, necesario tanto para mejorar el producto como para que el usuario pueda revisar el histórico de consejos recibidos.
