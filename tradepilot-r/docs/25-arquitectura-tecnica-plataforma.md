# 25 · Arquitectura Técnica de Plataforma (end-to-end)

*Voz: CTO de una empresa SaaS de referencia mundial — Challenge Mode obligatorio (19 §1.1). Primer capítulo de Fase 1 (Diseño Técnico). Sin SQL, sin APIs, sin código, sin frameworks — arquitectura técnica pura.*

## 0. Encuadre: "plataforma completa primero" no contradice "no construir antes del disparador"

11 §13 y 21 §0 establecieron un principio que parece, a primera vista, tensionado con la instrucción de este capítulo: no desplegar infraestructura antes de que un disparador real la exija. La resolución es la misma que ya se usó entonces: **diseñar completo y desplegar incremental son cosas distintas**. Este capítulo decide, de una vez, cómo encajan entre sí los 13 módulos de 22.5 a nivel técnico — qué es un servicio desplegado, qué es una librería compartida, qué es un mecanismo de base de datos — para que cada componente, cuando se implemente, nazca en el sitio correcto. Ninguna decisión de este capítulo obliga a desplegar los 13 módulos como 13 unidades separadas desde el primer día; al contrario, es precisamente el hallazgo principal de Challenge Mode aplicado aquí (§1).

## 1. Challenge Mode — el hallazgo principal: 13 módulos conceptuales ≠ 13 servicios técnicos

**Problema detectado**: 22.5 definió 13 módulos como cajas negras con contratos estrictos. Una lectura ingenua de ese capítulo llevaría a desplegar 13 microservicios independientes desde el primer día — es la forma más común en que un buen diseño de dominio se convierte en una mala arquitectura técnica prematura: sobrecoste operativo, latencia de red entre módulos que en realidad se usan juntos en la misma interacción de usuario, y una complejidad de despliegue que ningún equipo pequeño necesita antes de tener usuarios reales.

**Solución propuesta**: separar los 13 módulos en tres categorías técnicas distintas, no una:

1. **Core Service** — un único servicio desplegado (monolito modular), que contiene Identity, Funding Management, Management Plans, Operations, y el núcleo numérico síncrono de Risk Engine. Internamente dividido en los mismos límites de módulo de 22.5 (paquetes/esquemas separados, contratos internos estrictos), pero desplegado como una unidad.
2. **Async Workers** — servicios desplegados por separado, cada uno con su propio ciclo de vida y escalado: Rule Engine Worker, AI Worker, Analytics Worker, Notification Worker, Reporting Worker, Media Worker.
3. **Librerías compartidas** — código sin identidad de servicio propia, usado en proceso por quien lo necesite: el motor de cálculo (`r-engine`), la utilidad de Snapshot.

Más un cuarto grupo que ni siquiera es "código de aplicación": **mecanismos a nivel de base de datos** (triggers) para Audit Engine y para el núcleo numérico de Risk Engine (recomputo de `current_capital`/`peak_capital`, 15 §3.1) — no son servicios, son comportamiento transaccional de la propia base de datos.

**Por qué es mejor que la alternativa (13 microservicios)**: cumple exactamente lo que 22.5 exigía (contratos estrictos, sustituibilidad futura, cero acceso cruzado a almacenamiento) sin pagar el coste de 13 despliegues, 13 superficies de observabilidad y 13 fuentes de latencia de red donde hoy solo hace falta una — y sin violar 19 §6 (coste consciente) ni 11 §13 (no construir antes del disparador). Si en el futuro un módulo concreto necesita escalar o sustituirse de forma independiente (§7), su contrato ya está diseñado para extraerse sin reescribirse — es la misma promesa que 11 §3 ya hizo sobre los bounded contexts, ahora cumplida en la práctica.

**Impacto sobre el blueprint conceptual**: ningún contrato de 22.5 cambia. Lo que cambia es exclusivamente la unidad de despliegue — la distinción que 22.5 nunca llegó a hacer porque, correctamente, no era su trabajo (era un capítulo de dominio, no de infraestructura).

## 2. Mapa completo de la arquitectura técnica

```
┌──────────────────────────────────────────────────────────────┐
│ CLIENTE (PWA — 05 §6)                                          │
│   r-engine (librería compartida, ejecución local para           │
│   recálculo instantáneo de la calculadora, 05 §2)               │
└───────────────────────────┬──────────────────────────────────┘
                             │ HTTP (PostgREST + Edge Functions)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ CORE SERVICE (monolito modular, un único despliegue)            │
│                                                                  │
│  ┌───────────┐ ┌───────────────────┐ ┌──────────────────────┐ │
│  │ Identity  │ │ Funding Management │ │ Management Plans     │ │
│  └───────────┘ └───────────────────┘ └──────────────────────┘ │
│  ┌───────────────────────┐ ┌──────────────────────────────┐   │
│  │ Operations              │ │ Risk Engine (núcleo síncrono) │   │
│  └───────────────────────┘ └──────────────────────────────┘   │
│                                                                  │
│  Mecanismos de base de datos (triggers, no servicios):          │
│   - Recompute capital/peak_capital (15 §3.1)                    │
│   - Audit Engine (append-only, 15 §3.4)                         │
│                                                                  │
│  Usa la librería compartida r-engine y la utilidad Snapshot      │
│  en proceso (sin llamada de red)                                │
└───────────────────────────┬──────────────────────────────────┘
                             │ eventos de dominio (21.5 §7), cola asíncrona
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ ASYNC WORKERS (servicios independientes, escalado propio)       │
│                                                                  │
│  Rule Engine Worker   │  AI Worker   │  Analytics Worker         │
│  Notification Worker  │  Reporting Worker │  Media Worker         │
└──────────────────────────────────────────────────────────────┘
```

## 3. Respuestas a las 13 preguntas

**1. ¿Cuáles son todos los servicios internos del sistema?** Core Service (uno) + 6 Async Workers (Rule Engine, AI, Analytics, Notification, Reporting, Media) = 7 unidades de despliegue. Más 2 librerías compartidas sin identidad de servicio (r-engine, Snapshot) y los mecanismos de trigger de base de datos.

**2. ¿Cómo se comunican entre ellos?** Cliente → Core Service: HTTP síncrono (PostgREST para CRUD simple bajo RLS, Edge Functions para lógica con secretos). Core Service → Async Workers: publicación de eventos de dominio (21.5 §7) en una cola (05 §3). Workers → Core Service: escritura de vuelta a través de su propio rol de servicio con alcance mínimo (11 §5), nunca acceso directo a tablas fuera de su contrato (22.5 §4).

**3-4. Qué información posee / nunca debe poseer cada servicio.** Ya especificado por completo en 22.5 §2 (columnas "Recibe" y "Nunca debe conocer") — este capítulo no lo repite, lo hereda y le añade el mecanismo técnico de cumplimiento: cada Async Worker tiene su propia credencial de servicio, scoped exactamente al conjunto de tablas que su contrato permite leer/escribir (11 §5) — el "nunca debe conocer" de 22.5 deja de ser una promesa de diseño y pasa a ser una imposibilidad técnica.

**5. ¿Cuáles son las fronteras técnicas?** Entre Cliente y Core Service: red (HTTP). Entre Core Service y cada Worker: red + cola de eventos + credenciales de servicio distintas. Dentro de Core Service, entre sus módulos internos (Identity/Funding/Plans/Operations/Risk): frontera de código (paquete/esquema), no de red — se pueden extraer a servicios propios en el futuro sin rediseño (§0), pero hoy la frontera es disciplina de código, reforzada en revisión, no en infraestructura.

**6. ¿Qué partes deberán poder escalar independientemente?** AI Worker (limitado por la tasa de OpenAI, 06 §7, necesita su propio control de concurrencia), Analytics Worker (lectura pesada, candidato a réplicas de lectura antes que nadie, 11 §6), Media Worker (almacenamiento/CDN es un perfil de escalado completamente distinto al resto). Core Service escala como unidad (vertical primero, réplicas de lectura después, 11 §6) — no se subdivide todavía, coherente con §0.

**7. ¿Qué componentes son stateless?** `r-engine` (función pura), los arquetipos de evaluador de Rule Engine (22 §4, funciones puras sobre datos recibidos), la utilidad Snapshot (sin estado propio entre invocaciones), la llamada de generación de explicaciones (06 §3).

**8. ¿Qué componentes necesitan persistencia?** Core Service (toda la base de datos operativa), el perfil de aprendizaje bayesiano (13, proceso con estado incremental, técnicamente parte de la persistencia de Core Service aunque el Worker de IA lo lea), `audit_log`, `account_capital_events`, las vistas materializadas de Analytics, el almacenamiento de capturas (Media).

**9. ¿Qué componentes deberán ser síncronos?** El camino de guardado de Operaciones/Cuentas/Planes que el usuario espera activamente (presupuesto de 10, <30s); el recomputo de `current_capital`/`peak_capital` (15 §3.1) — **debe** ser síncrono/transaccional porque tolerar una lectura obsoleta de capital violaría la prioridad #1 del producto (precisión matemática, 19 §6); la escritura en `audit_log` — por la misma razón que no puede perderse ni retrasarse, se implementa como trigger dentro de la misma transacción, no como evento asíncrono.

**10. ¿Qué componentes podrán ejecutarse de forma asíncrona?** Rule Engine Worker (I14, 19 regla 14 obliga técnicamente a esto: si evaluara de forma síncrona y bloqueante, no podría garantizar "nunca bloquea el registro" bajo una regla compuesta lenta, 22 §5), AI Worker (05 §3, ya establecido), Notification Worker (por naturaleza, un aviso siempre ocurre después del hecho), Analytics Worker, Reporting Worker, Media Worker (detección por visión, 06 §4).

**11. ¿Qué eventos existirán en el sistema?** El catálogo canónico ya está cerrado en 21.5 §7 — `OperacionRegistrada`, `ParcialEjecutado`, `OperacionCerrada`, `OperacionEditada`, `CuentaCreada`, `CuentaEstadoCambiado`, `CapitalEventoRegistrado`, `PlanCreado`/`PlanEditado`, `RecomendacionGenerada`, `ReglaIncumplida`. Este capítulo no añade eventos nuevos, les asigna transporte técnico (cola de eventos) y suscriptores (§12).

**12. ¿Qué componentes reaccionarán a esos eventos?**

| Evento | Worker(s) que reaccionan |
|---|---|
| `OperacionRegistrada` | Rule Engine Worker (reglas `operation_event`, 22 §3.4) |
| `OperacionCerrada` | Rule Engine Worker, AI Worker, Analytics Worker |
| `OperacionEditada` | Rule Engine Worker, Analytics Worker |
| `CapitalEventoRegistrado` | Rule Engine Worker, Analytics Worker |
| `CuentaEstadoCambiado` | Notification Worker, Analytics Worker |
| `ReglaIncumplida` | Notification Worker, Analytics Worker (semáforo, 17 §4) |
| `RecomendacionGenerada` | Analytics Worker (auditoría de recomendaciones, 04 §3) |
| `PlanCreado`/`PlanEditado` | Ninguno (21.5 §7 — el Snapshot ya desacopla esto, confirmado a nivel técnico) |

**13. ¿Qué componentes deberán poder sustituirse en el futuro sin romper el resto?** AI Worker (proveedor de IA sustituible, ya un principio de 06 §1), Notification Worker (proveedor de push/email), Media Worker (backend de almacenamiento). **Explícitamente no intercambiable sin rediseño**: Core Service — es el núcleo por definición (21 §2.1), y pretender que fuera sustituible sin coste sería contradecir por qué es "core". No todo tiene que ser igual de sustituible, y decirlo con esa claridad es más honesto que una lista donde todo parece igual de reemplazable.

## 4. Clasificación de criticidad

| Componente | Clasificación | Justificación |
|---|---|---|
| Core Service | **MISSION CRITICAL** | Si cae, el bucle de valor central (registrar, calcular, guardar) se detiene por completo; todo lo demás depende de él |
| `r-engine` (librería) | **MISSION CRITICAL** | Un error aquí corrompe silenciosamente todos los números derivados, en cliente y servidor a la vez — prioridad #1 del producto |
| Utilidad Snapshot | **MISSION CRITICAL, pese a ser pequeña** | Su fallo no se nota inmediatamente (no rompe una pantalla), pero rompe en silencio el invariante I3/I8 (integridad histórica) — la criticidad no es proporcional al tamaño del componente, es proporcional a qué invariante protege |
| Mecanismo de trigger de capital (15 §3.1) | **MISSION CRITICAL** | Mismo motivo que `r-engine` — es precisión matemática en estado puro |
| Rule Engine Worker | **HIGH** | Diferenciador central del producto (multi-empresa, 17), pero su indisponibilidad temporal no impide registrar ni calcular — por diseño (I14) |
| AI Worker | **HIGH** | El "AI Coach" es un pilar de la propuesta de valor (24 §1), pero el producto es 100% funcional sin él (06 §1, 11 §12) |
| Analytics Worker | **MEDIUM** | Un dashboard con datos ligeramente obsoletos es una molestia, no un fallo de integridad — la fuente de verdad (Core Service) permanece correcta |
| Notification Worker | **MEDIUM** | Ninguna ruta de valor central depende de una notificación llegando a tiempo |
| Media Worker | **MEDIUM** | Las capturas siempre fueron un dato opcional (04) |
| Reporting Worker | **LOW-MEDIUM** | Uso poco frecuente, fuera del bucle diario — pero su disponibilidad a largo plazo es un compromiso de confianza (TradeVault, 16 §7), no solo una cuestión operativa del día a día |

## 5. Riesgos técnicos

1. **La cola de eventos como punto de contención único** para todo el abanico de Workers — un pico de cierres de operaciones simultáneo (apertura de mercado) podría generar una cola de eventos más rápido de lo que los Workers procesan. Mitigación: cada tipo de evento con su propia partición/canal lógico, para que un atasco en AI Worker (limitado por OpenAI) no retrase a Analytics Worker.
2. **Disciplina de frontera interna en Core Service**: al ser un monolito modular, nada impide técnicamente que un desarrollador bajo presión llame directamente a una función interna de otro módulo saltándose su contrato — el riesgo ya identificado en 22.5 (Riesgo #3, regresión por conveniencia) se traslada aquí sin resolverse por arquitectura sola; requiere disciplina de revisión de código.
3. **Doble ejecución de `r-engine` (cliente y servidor) como fuente de descoordinación**: si la versión desplegada en el cliente y en el servidor diverge (un despliegue a medias), el usuario podría ver un número en la calculadora y otro distinto al guardar — mitigación: versionado estricto y sincronizado del paquete `r-engine` entre cliente y Core Service, nunca desplegados de forma independiente.

## 6. Posibles cuellos de botella

- Postgres de Core Service bajo escritura concentrada (apertura de mercado, muchos registros simultáneos) — ya anticipado y mitigado en 11 §5-6 (índices, particionado futuro, connection pooling).
- Tasa de límite de OpenAI en AI Worker bajo un pico de cierres simultáneos — mitigado por el propio diseño asíncrono (encolado, no bloqueante) más límites de uso por tier (16 §3).
- Refresco de vistas materializadas de Analytics a gran volumen de escritura — ya anticipado en 04 §5 (refresco incremental, no total, cuando el volumen lo exija).

## 7. Estrategia de escalabilidad

Confirma y ata directamente a servicios concretos lo que 11 ya trazó en abstracto: Core Service sigue la ruta de 11 §6 (vertical → réplicas de lectura → particionado); AI Worker y Analytics Worker son los primeros candidatos a escalado horizontal independiente por tener los perfiles de carga más distintos entre sí y respecto a Core Service; Media Worker escala con el propio proveedor de almacenamiento/CDN, sin relación con el resto. Ningún Worker escala antes de que su disparador de uso real lo exija (11 §13) — este capítulo define **cómo** escalaría cada uno cuando llegue el momento, no **cuándo**.

---

## Auditoría del capítulo (19 §5.1)

**¿Qué problemas reales del trader resuelve este capítulo?** Ninguno directamente — es arquitectura técnica pura. Su éxito se mide en que el sistema pueda crecer diez años (19 regla 10) sin que nadie tenga que rediseñar cómo encajan sus piezas.

**¿Qué funcionalidades sobran?** Ninguna — no introduce funcionalidad, organiza la ya definida.

**¿Qué funcionalidades faltan?** La asignación explícita de transporte técnico a los eventos de 21.5 §7 (§3, pregunta 11-12) no existía hasta este capítulo — sin ella, "qué componentes reaccionan a qué evento" habría quedado sin respuesta operativa.

**¿Qué haría Apple para simplificar este capítulo?** Insistiría en que "7 servicios" es ya más de lo que un equipo pequeño necesita gestionar el primer año — validado: solo Core Service es imprescindible desde el día 1; los 6 Workers se activan uno a uno según el disparador real de cada función (Rule Engine y AI Worker desde el MVP, el resto según 07/17 lo vayan requiriendo).

**¿Qué haría Linear para hacerlo más rápido?** Confirmaría que la decisión más importante para la velocidad percibida por el usuario (10, <30s) ya está tomada correctamente: todo lo que el usuario espera activamente es síncrono y vive en Core Service; todo lo demás es asíncrono por diseño, no por optimización posterior.

**¿Qué haría TradingView para hacerlo más intuitivo?** No aplica a un documento sin usuario final — la pregunta con sentido es si un ingeniero nuevo entiende en una lectura por qué algo es Worker y no Core, y el criterio explícito de §1 (síncrono-esperado-por-el-usuario vs. asíncrono-por-naturaleza) responde a eso sin ambigüedad.

**¿Qué haría un hedge fund profesional para hacerlo más robusto?** Confirmaría exactamente la decisión de §3 (pregunta 9): que el recomputo de capital y el log de auditoría sean transaccionales y síncronos, nunca eventualmente consistentes — es la misma exigencia de segregación de funciones y de "el libro de posiciones nunca miente, ni por un segundo" que ya motivó el hallazgo de 22.5.

**Puntuación del capítulo**: **93/100**. Los 7 puntos que faltan son los 3 riesgos técnicos de §5, todos con mitigación anotada pero ninguno resuelto por completo sin datos reales de carga en producción — que este capítulo, por definición, no puede tener todavía.

**Nivel de madurez del capítulo**: 90%. La arquitectura de plataforma está completa y coherente con todo lo decidido en el blueprint conceptual; falta la validación empírica de las cargas de trabajo reales, que corresponde a la implementación, no a este documento.

---

## Cierre de capítulo

**Riesgos pendientes**: los 3 de "Riesgos técnicos" — ninguno bloquea aprobar la arquitectura, los 3 son disciplina de implementación y observabilidad a vigilar.

**Decisiones abiertas**:
1. Tecnología concreta de la cola de eventos (Supabase + `pg_boss`, Inngest, Trigger.dev — ya apuntadas como opciones en 05 §3) — se decide en el capítulo de diseño técnico de infraestructura, no aquí.
2. Orden exacto de activación de los 6 Async Workers según el roadmap de 07 — Rule Engine y AI Worker desde el MVP parecen evidentes; Media/Reporting/Notification se posicionan según se implementen V2-V3.

**Recomendación profesional**: aprobar esta arquitectura de plataforma. Es la base sobre la que se diseñará cada componente individual a partir de ahora — Core Service primero (contiene Risk Engine y Rule Engine, los dos módulos más precisados durante todo el blueprint), después los Workers en el orden que el roadmap de producto (07) ya establece. Con este capítulo, la instrucción del fundador de "diseñar la plataforma completa antes que módulo por módulo" queda cumplida: cada componente que se diseñe a partir de ahora ya sabe dónde vive, con quién habla, y bajo qué reglas — no se improvisa nada de eso pieza a pieza.
