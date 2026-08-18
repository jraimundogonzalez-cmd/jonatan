# 11 · Arquitectura a escala — visión a 10 años

*Voz: Principal Software Architect*

## 0. Cómo se relaciona este documento con 05-arquitectura.md

05 describe el stack de ejecución del V1 (Next.js + Supabase + OpenAI, pragmático, optimizado para time-to-market). Este documento no lo contradice — lo profundiza con la pregunta que un Principal Architect debe hacerse antes de aprobar cualquier decisión de 05: *"¿esta decisión nos obliga a reescribir algo dentro de 3 años si tenemos éxito?"*

La aparente tensión entre "muévete rápido" (contexto CEO/PM) y "nunca sacrifiques arquitectura por rapidez" (este documento) se resuelve así: **el trabajo de un arquitecto principal no es elegir entre velocidad y durabilidad, es diseñar las costuras (contratos, esquema, límites de dominio) para que ambas sean la misma decisión.** Concretamente: seguimos lanzando sobre Supabase monolítico en una sola región desde el día 1 (rápido, barato) — pero el esquema, las particiones, los contratos de API y los límites de dominio se diseñan ya mismo como si fueran a soportar millones de operaciones, para que escalar sea *marcar un dial de infraestructura*, no *reescribir el producto*.

No se sobreconstruye nada que no se necesite hoy (multi-región, microservicios, colas complejas) — se documenta el camino de subida (§13) para no tener que improvisarlo bajo presión.

## 1. Modelo de dominio: la jerarquía de propiedad

```
Usuario
  └─ Empresa de fondeo (incluye "Personal / capital propio")
       └─ Cuenta
            └─ Operación
                 ├─ Parciales planificados
                 ├─ Parciales ejecutados
                 ├─ Capturas
                 └─ Resultados (campos derivados: R_final, PnL, %_conservado)
```

Esto es el **árbol de propiedad de escritura** (write path) y es exactamente lo que ya modelamos en RLS (04): cada nivel hereda el aislamiento del nivel superior, siempre anclado a `user_id`.

Dos capas **no** forman parte de este árbol porque no son de escritura directa del usuario, son capas derivadas que lo atraviesan transversalmente (patrón CQRS: modelo de escritura ≠ modelo de lectura):

- **IA**: lee Operaciones + Resultados de todas las cuentas de un usuario, escribe Recomendaciones y Perfil IA (`user_stat_buckets`, 04 §3) — vive a nivel de Usuario, no de Cuenta ni de Empresa, porque el aprendizaje personal es del trader, no de una cuenta concreta (coherente con 02 §6).
- **Dashboard**: es una vista de lectura agregada sobre todo el árbol (por Cuenta, por Empresa, o Global) — nunca escribe, solo proyecta. Se implementa como vistas materializadas (04 §5), no como cálculo on-the-fly, precisamente para que esta capa transversal no compita por recursos con el camino de escritura crítico (registrar una operación en <30s, 10).

## 2. Frontend

- Next.js App Router como hoy (05), pero con disciplina de **versionado del design system** (`packages/ui`, 05 §5) como paquete independiente — el frontend debe poder evolucionar de versión sin coordinar un despliegue monolítico con el backend.
- **Feature flags desde el día 1** (tabla simple en Postgres, no un servicio externo de pago al principio): permite lanzar features a subconjuntos de usuarios y hacer rollback instantáneo sin desplegar — imprescindible en una vida de producto de 10 años, donde "revertir con un deploy" deja de ser aceptable en cuanto hay miles de usuarios activos a media tarde de mercado.
- **Observabilidad de cliente**: tracking de errores (Sentry o equivalente) y Core Web Vitals desde el V1 — no se añade "cuando haya problemas", se instrumenta antes de que hagan falta, porque diagnosticar un bug de hace 2 años sin telemetría histórica es prácticamente imposible.
- Cada request de cliente lleva un **ID de correlación** propagado al backend, para poder seguir una operación de usuario de principio a fin en los logs (§11).

## 3. Backend y API

- **Dos superficies de API, deliberadamente distintas**:
  1. **CRUD directo vía PostgREST de Supabase**, protegido por RLS, para operaciones simples (crear/leer/editar operación, cuenta, empresa). Cero backend custom para esto — es la decisión que mantiene la velocidad de un equipo pequeño.
  2. **Edge Functions versionadas** (`/v1/...` desde la primera función, aunque solo exista una versión) para todo lo que necesita secretos, lógica de negocio no trivial o cómputo (optimizador a gran escala, orquestación de IA, recálculo de buckets). El versionado desde el día 1 evita el escenario clásico a 3 años: un cliente móvil viejo en producción que rompe porque cambiamos un contrato sin aviso.
- **Límites de dominio ("bounded contexts") ya trazados aunque hoy vivan en el mismo proyecto Supabase**: Identidad, Cartera (empresas/cuentas), Trading (operaciones/parciales/resultados), IA (recomendaciones/perfil), Analítica (dashboard/agregados). Esta separación es lógica (esquemas/carpetas/políticas separadas), no física — pero es la que permite, si dentro de unos años el cómputo de IA satura las Edge Functions, extraerlo a una flota de workers dedicada **sin tocar el resto del sistema**, porque el contrato ya estaba aislado.
- **Trabajo asíncrono vía cola**, no llamadas síncronas bloqueantes: recalcular buckets bayesianos, generar explicaciones de IA, refrescar vistas agregadas — todo se encola (Supabase + `pg_cron`/`pg_boss`, o un runner ligero tipo Inngest/Trigger.dev) para que el camino crítico de guardar una operación (10) nunca espere a un proceso no esencial.

## 4. Supabase: uso disciplinado, no "todo por defecto"

- **Migraciones como código, nunca cambios manuales en producción**: todo cambio de esquema es un archivo SQL versionado en `packages/supabase` (05 §5), revisado como cualquier otro cambio de código, aplicado vía CI. Editar el esquema a mano en el dashboard de Supabase en producción queda prohibido como práctica desde el primer commit — es la causa nº1 de que un sistema se vuelva imposible de auditar o reproducir a los pocos años.
- **Connection pooling** (PgBouncer, incluido en Supabase) activo desde el V1 — con cientos de miles de operaciones y clientes PWA con reconexión, el límite de conexiones directas a Postgres se agota mucho antes que el propio hardware.
- **Realtime usado con moderación**: solo para sincronizar estado entre dispositivos del mismo usuario (ej. lista de operaciones), nunca como mecanismo de alta frecuencia — cada canal realtime abierto tiene coste de conexión persistente, y a escala de miles de usuarios simultáneos es una partida de coste e infraestructura que se dispara si no se acota por diseño.
- **Storage con política de ciclo de vida** para capturas: retención definida (§12), no almacenamiento indefinido por defecto.

## 5. Base de datos a escala de millones de operaciones

- **Particionado de `trades` por rango de `opened_at`** (mensual): el esquema (04) ya usa `opened_at` como eje natural, por lo que activar particionado nativo de Postgres cuando el volumen lo justifique (umbral orientativo: >10M filas o >50GB en la tabla) es un cambio operativo, no una migración de modelo de datos.
- **Índices para el patrón de acceso dominante**: compuestos sobre `(user_id, opened_at)` y `(account_id, opened_at)` desde el V1 (ya en 04). A gran escala se evalúa índice **BRIN** sobre `opened_at` en particiones históricas (mucho más barato que B-tree para datos de series temporales insertados en orden, que es exactamente el patrón de esta tabla).
- **Vistas materializadas con refresco incremental**, no `REFRESH MATERIALIZED VIEW` completo, en cuanto el volumen lo justifique — refresco disparado por trigger a nivel de fila sobre la partición afectada, no recálculo global cada vez.
- **Ciclo de vida del dato**: operaciones recientes (ventana móvil, ej. 24 meses) en el camino caliente; históricas más antiguas siguen accesibles pero no compiten por caché ni por planes de ejecución con las consultas del día a día. No se "borra" nada — el trader necesita su historial completo para la esperanza matemática (02) — se trata como frío, no como descartado.
- Precisión numérica (`numeric`, nunca `float`) se mantiene como regla no negociable a cualquier escala (01 §3.4, 04 §1).

## 6. Escalabilidad de cómputo y tráfico

- **Frontend y Edge Functions escalan horizontalmente por diseño** (Vercel/Supabase Edge son stateless y serverless) — no requieren intervención manual para absorber picos (ej. aperturas de mercado, cuando el volumen de registros se concentra en minutos).
- **Postgres escala primero verticalmente** (instancia mayor) y **luego con réplicas de lectura** para separar el tráfico de lectura pesada (dashboard, agregados) del tráfico de escritura crítica (registrar operación) — las réplicas se activan cuando la proporción lectura/escritura y la latencia observada lo justifiquen, no antes por precaución (coherente con §7, disciplina de coste).
- **Rate limiting por usuario/IP** en la capa de Edge Functions, especialmente en los endpoints que llaman a IA — protege tanto de abuso como de una factura de OpenAI fuera de control (06 §7).
- **Pruebas de carga como práctica recurrente**, no un evento único: se ejecutan antes de cada lanzamiento de feature con impacto de escritura significativo (ej. import masivo de histórico), como puerta de revisión de arquitectura, no como checklist opcional.

## 7. Costes: arquitectura al servicio de la economía del negocio

- **Palancas de coste sublineal frente a crecimiento de usuarios**: caché agresiva de explicaciones de IA (06 §7), archivado/rollup de datos fríos (§5), réplicas de lectura activadas solo cuando el ratio lectura/escritura lo pide (no por defecto).
- **Atribución de coste por usuario activo**, revisada trimestralmente frente al ARPU (08) — no es una métrica de ingeniería aislada, es una entrada directa a la viabilidad del modelo de suscripción. Un arquitecto que no vigila esto puede diseñar un sistema técnicamente perfecto y económicamente inviable.
- Cualquier componente de infraestructura nuevo (réplica adicional, servicio de colas gestionado, warehouse analítico) pasa por el mismo filtro de 5 preguntas del contexto permanente del proyecto antes de aprobarse — la arquitectura no está exenta del filtro de producto, lo aplica también a sí misma.

## 8. Seguridad

- **Defensa en profundidad**: RLS como perímetro de datos (04 §4) + validación de entrada en cada Edge Function + secretos exclusivamente server-side (05 §7) + escaneo de dependencias en CI.
- **Modelo de amenaza específico de este producto**: un trader que gestiona cuentas de fondeo reales es un objetivo de mayor valor que el usuario medio de una app de consumo — se asume esto explícitamente, no como una nota al margen. Implicaciones concretas: MFA disponible desde el V1 (no "cuando haya demanda"), alertas de nuevo dispositivo/ubicación en el login, gestión de sesión con tokens de vida corta y rotación en cada refresh.
- **Clasificación de datos**: PII (email, perfil) vs. datos financieros declarados por el usuario (capital, riesgo, resultados) vs. contenido sensible pero no regulado (notas, capturas). Ninguno de estos datos implica custodia de fondos reales — TradePilot nunca mueve dinero ni se conecta a ejecución de órdenes (01 §5) — esto es una frontera de alcance deliberada que reduce significativamente la carga regulatoria frente a un bróker o gestor de fondos, y se documenta aquí como una decisión de seguridad, no solo de producto.
- Cifrado en tránsito (TLS en todo el sistema, sin excepciones) y en reposo (por defecto en Supabase).

## 9. Autenticación

- Supabase Auth, passwordless por defecto (magic link + OAuth Google/Apple), 2FA (TOTP) opcional desde el V1, coherente con 01 §3.6.
- **Tokens de acceso de vida corta + refresh token con rotación** — un token robado tiene una ventana de explotación mínima.
- Pantalla de **gestión de sesiones activas** (ver/revocar dispositivos) planificada para V2 — no es MVP, pero el modelo de sesión (§9) se diseña desde el V1 para soportarla sin cambios de esquema posteriores.

## 10. Permisos: hoy simple, mañana extensible sin reescritura

- **Modelo actual (V1-V2)**: propietario único. Cada fila pertenece a un `user_id`, sin excepciones, sin comparticiones — coherente con el principio de aprendizaje 100% privado (01 §2.5).
- **Punto de extensión reservado, no construido**: se documenta (sin implementar aún) el patrón `account_grants(account_id, granted_to_user_id, role, scope)` para el día en que el producto necesite, por ejemplo, que un mentor tenga acceso de solo lectura a la cuenta de un alumno, o un rol de administrador dentro de una futura oferta de equipo/prop firm. Documentarlo ahora, aunque no se construya, evita que esa futura necesidad obligue a rediseñar RLS desde cero — las políticas actuales de "solo el propietario" se pueden extender de forma aditiva (`OR exists (grant válido)`) sin romper nada existente.
- **Mínimo privilegio en claves de servicio**: cada Edge Function usa una clave de servicio con el alcance mínimo necesario, nunca una clave maestra compartida entre todas las funciones.

## 11. Logs y observabilidad

Tres dominios de log, deliberadamente separados porque tienen dueños y retenciones distintas:

1. **Logs de infraestructura** (Vercel + Supabase, JSON estructurado, con el ID de correlación de §2) — para depuración técnica, retención corta (semanas).
2. **Log de auditoría de dominio** (tabla `audit_log`, append-only, nunca editable): quién hizo qué y cuándo sobre entidades sensibles (creación/edición de cuentas, cambios de capital, borrado de operaciones). Ya existe el equivalente para IA (`ai_recommendations`, 04 §3) — se generaliza el patrón a toda mutación sensible. Retención larga (años), porque es el registro que un usuario podría necesitar para reconstruir qué pasó con su cuenta en una disputa o auditoría propia.
3. **Analítica de producto** (eventos agregados: tiempo de registro, uso del optimizador — las métricas de 07 §4) — con cuidado explícito de no enviar contenido crudo de operaciones a herramientas de terceros sin necesidad; se envían eventos y agregados, no el detalle financiero completo.

Alertas de tasa de error y guardia mínima definidas desde el V1 — no se improvisa un proceso de respuesta a incidentes la primera vez que ocurre uno real.

## 12. Backups y continuidad

- **Backups automáticos diarios + Point-In-Time Recovery (PITR) activados desde el V1**, no "cuando haya más usuarios" — son datos financieros declarados por el usuario, y perder incluso un día de registro de operaciones destruiría la confianza en el producto de forma irreversible.
- **Objetivos formales a definir con el primer cliente de pago real** (orientativos hasta entonces): RPO ≤ 15 min vía PITR, RTO ≤ 4h.
- **Simulacros de restauración trimestrales** contra un entorno de staging — un backup nunca probado no es un backup, es una suposición.
- **Política de retención de capturas** en Storage independiente de la política de backup de base de datos (ciclo de vida propio, §4).
- **Multi-región: decisión consciente de NO hacerlo todavía.** A la escala de los próximos años, una región única con backups sólidos y PITR cubre el riesgo real con un coste operativo razonable — desplegar activo-activo multi-región ahora sería sobre-ingeniería que ningún usuario notaría y que sí encarecería cada mes de operación. Se documenta la vía de subida (réplica en región secundaria vía replicación lógica) para el día en que un cliente enterprise o una exigencia regulatoria concreta lo justifique — no antes.

## 13. Camino de evolución (sin fechas, por hitos de escala)

| Etapa | Disparador | Cambio de infraestructura |
|---|---|---|
| 1 — Actual | Lanzamiento | Supabase monolítico, región única, Next.js en Vercel |
| 2 — Crecimiento | Miles de usuarios activos, dashboard empieza a notarse lento | Réplicas de lectura, particionado de `trades`, refresco incremental de vistas materializadas, trabajo de IA totalmente asíncrono vía cola |
| 3 — Escala | Millones de operaciones, picos de cómputo del optimizador para históricos muy grandes | Extracción del cómputo de IA/optimizador a workers dedicados (el límite lógico ya existía en el diseño, §3); introducción de un almacén analítico columnar para BI cruzado sin sobrecargar la base operativa |
| 4 — Madurez | Demanda enterprise o regulatoria concreta | Multi-región; activación del modelo de permisos extendido (§10) si la demanda de equipos/coaching lo valida |

Ninguna etapa de esta tabla se construye antes de que su disparador ocurra. El valor de este documento no es adelantar la infraestructura, es garantizar que, cuando el disparador llegue, el cambio sea una ampliación planificada y no una reescritura de emergencia.
