# 16 · Modelo SaaS — visión de fundador

*Voz: CEO / Fundador de una empresa SaaS*

No pienso en features. Pienso en si dentro de tres años esta empresa factura lo suficiente para seguir contratando al mejor equipo, con un producto que los traders defenderían si alguien intentara quitárselo.

## 1. Por qué ahora sí hay un tier gratuito (evolución razonada, no contradicción)

08 §2 rechazó el "freemium puro" durante la fase de validación del MVP, con un argumento correcto en ese contexto: un gratuito indefinido y completo diluye la señal de disposición a pagar cuando lo que hace falta es validar rápido. Ese argumento sigue siendo válido — **para la fase de validación**. Este documento diseña el modelo de negocio a régimen (decenas de miles de usuarios), y a esa escala la pregunta cambia: ya no es "¿pagará alguien por esto?" (ya se sabe que sí, MVP validado), es "¿cómo entra el mayor número de traders posible al hábito de registrar, para que el foso de datos personal (01 §1) empiece a compuestos antes de que decidan pagar?".

La resolución no es freemium clásico (todo gratis, algo de más se paga) — es un **tier gratuito funcionalmente honesto y permanentemente limitado**, no un truco de marketing con fecha de caducidad oculta:

- **Gratis** resuelve el problema de *registrar* (10) y de *ver* sus propios números (dashboard de una cuenta). Es un valor real, no un cebo.
- **PRO** resuelve el problema de *gestionar mejor* (el optimizador, 02 §5, con su explicación completa, 06 §3) — sin diluir, exactamente como 08 §1 argumentaba: el núcleo del producto nunca se trocea a medias, se activa entero al pasar a PRO.

Este es el motivo por el que no hay contradicción: 08 §1 decía "no bloquees el optimizador en el tier de entrada" en un mundo de un único tier de pago. En un mundo con un tier gratuito por debajo de todos los tiers de pago, ese principio se traslada intacto: **el gratuito nunca es un tier de pago degradado, es una categoría distinta con un objetivo distinto** (adopción del hábito, no monetización).

## 2. Estructura de tiers

| | **Gratis** | **PRO** | **Elite** | **Team / Enterprise** |
|---|---|---|---|---|
| Cuentas | 1 | Hasta 5 | Ilimitadas | Ilimitadas, multi-usuario |
| Registro de operaciones | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Calculadora de parciales | ✓ (básica, sin recomendación) | ✓ completa | ✓ completa | ✓ completa |
| Optimizador con IA + explicación | — | ✓ | ✓ | ✓ |
| Estadísticas bayesianas personalizadas (V2) | — | ✓ | ✓ | ✓ |
| Lectura de capturas por visión (V3) | — | Cuota mensual limitada | Cuota ampliada | Cuota ampliada por asiento |
| Historial | Completo, sin límite de tiempo | Completo | Completo | Completo |
| Dashboard multi-empresa | — | ✓ | ✓ | ✓ + vista de equipo |
| Permisos compartidos (11 §10) | — | — | — | ✓ (admin, roles, solo lectura para mentor/gestor) |
| Soporte | Comunidad | Estándar | Prioritario | Dedicado + SLA |
| Precio orientativo* | 0 € | ~29 €/mes | ~79 €/mes | ~25 €/asiento/mes (mín. 5 asientos) |

*Cifras orientativas, mismo estándar de 08 §3: se validan con datos reales de conversión y disposición a pagar, no se fijan a priori como compromiso.

**Por qué el límite de Gratis es "1 cuenta" y no "N operaciones/mes"**: un límite de cuentas es honesto y predecible (el usuario sabe exactamente qué pierde al quedarse gratis: gestión multi-cuenta) y no penaliza el comportamiento que más queremos fomentar (registrar todas las operaciones, sin excepción, 10). Un límite de operaciones/mes haría lo contrario: castigaría precisamente el hábito de registro que es la base del foso de datos (01 §1) — sería optimizar el negocio en contra del propio producto.

## 3. Costes y margen por tier (modelo ilustrativo)

```
Coste marginal / usuario / mes ≈ infraestructura (11 §6-7) + IA acotada (06 §7) + procesamiento de pago (~3%)
```

| Tier | Infra | IA | Coste total aprox. | Precio | Margen bruto aprox. |
|---|---|---|---|---|---|
| Gratis | ~0,30 € | 0 € (sin optimizador) | ~0,30 € | 0 € | — (coste de adquisición, no de servicio) |
| PRO | ~0,50 € | ~1,50 € (explicaciones acotadas) | ~2,00 € | ~29 € | ~93% |
| Elite | ~0,80 € | ~6,00 € (incluye visión, V3) | ~6,80 € | ~79 € | ~91% |
| Team/asiento | ~0,60 € | ~2,50 € (blend PRO/Elite) | ~3,10 € | ~25 € | ~88% |

Márgenes brutos del orden del 88-93% son coherentes con el estándar de un SaaS de software puro (sin coste de servicio humano intensivo) — la partida que de verdad exige vigilancia activa es la de IA (06 §7, 11 §7), porque es la única que crece con el uso real y no con el número de usuarios en abstracto. **El tier Gratis no es gratis para la empresa** — cuesta infraestructura sin generar ingreso. Es una inversión de adquisición deliberada (equivalente a CAC), no un descuido: se acepta porque el coste por usuario gratuito (~0,30 €/mes) es bajo por diseño (sin IA, 04-15 ya lo garantizan estructuralmente) y porque el propio comportamiento en Gratis (¿registra con constancia? ¿cuántas operaciones acumula?) es la mejor señal de cualificación de a quién vale la pena convertir a PRO — más barato y más fiable que cualquier campaña de marketing a ciegas.

## 4. Escalabilidad del negocio (no solo de la infraestructura)

11 ya resuelve la escalabilidad técnica. Un fundador tiene que resolver, además, la escalabilidad **operativa**:

- **Soporte**: autoservicio (documentación, comunidad) para Gratis y PRO; soporte humano prioritario solo desde Elite — el coste de soporte debe crecer con el ingreso, no con el número total de usuarios.
- **Ventas**: Gratis/PRO/Elite son 100% autoservicio (sin fricción de venta, coherente con 10, registro <30s aplicado también al *checkout*). Team/Enterprise es el único tier que admite venta asistida (conversación con prop firms, §5) — y solo ese tier, para no cargar de coste comercial a un producto que se vende solo en el resto de la base.
- **Onboarding de prop firms como partner**: un playbook repetible (no una negociación custom cada vez) desde el primer acuerdo — de lo contrario el canal B2B2C (§5) no escala más rápido que la disponibilidad del propio fundador para negociar cada contrato.

## 5. Canal B2B2C: empresas de fondeo como distribuidor natural

Insight de fundador que no aparece en ningún documento anterior: **las prop firms y TradePilot R tienen el mismo incentivo económico** — que sus traders gestionen mejor el riesgo. Un trader que blow-uea una cuenta fondeada por cerrar mal sus parciales es un coste para la prop firm (challenge fallido, soporte, reputación) tanto como es una operación perdida para el propio trader.

Esto abre un canal que ningún competidor de la categoría de journals genéricos puede replicar con la misma lógica (porque ninguno se especializa en *gestión* de la forma en que TradePilot lo hace, 09 §6):

- **Oferta a prop firms**: licencias Team con descuento por volumen, o incluso subvencionadas parcialmente por la propia firma como beneficio a sus traders fondeados — la prop firm paga una fracción porque reduce su propia tasa de blow-up.
- **Integración de marca conjunta** (fase madura, condicionada a demanda real — mismo principio de "no construir antes del disparador" de 11 §13): dashboard cobrandeado para una prop firm concreta.
- **Riesgo a vigilar, dicho sin rodeos**: este canal crea dependencia de la relación comercial con un número reducido de prop firms grandes — se trata como canal adicional de crecimiento, nunca como sustituto de la adquisición directa de traders individuales, precisamente para no concentrar el riesgo de negocio en unos pocos acuerdos.

## 6. Roadmap de negocio (atado a disparadores de producto, no a fechas)

| Tier | Se activa cuando... |
|---|---|
| Gratis + PRO | Desde el lanzamiento (V1/MVP, 07) — son el motor de adopción y de validación de disposición a pagar |
| Elite | Cuando V3 (visión de capturas, 06 §4, 07 §3) esté disponible — antes de eso, Elite y PRO no tendrían diferencia real de producto que justifique el salto de precio |
| Team/Enterprise | Cuando el modelo de permisos compartidos (11 §10) se active — activarlo antes obligaría a vender una promesa ("en breve tendrás vista de equipo") en vez de un producto, mala práctica de fundador |

Ningún tier se lanza antes de que el producto que lo justifica exista de verdad — vender por adelantado una diferenciación que aún no existe es la forma más rápida de quemar confianza con los primeros clientes de pago.

## 7. Retención basada en valor — sin técnicas oscuras

Compromiso explícito, verificable por cualquier usuario:

| Técnica oscura (rechazada, por nombre) | Qué hacemos en su lugar |
|---|---|
| Ocultar o dificultar el botón de cancelar | Cancelar es una acción tan simple como registrar una operación: un flujo corto y directo, sin pantallas de re-retención en bucle |
| Cargos ocultos o renovación silenciosa sin aviso | Aviso previo a cada renovación; cambios de precio nunca aplican con efecto retroactivo a suscriptores existentes sin aviso con antelación razonable |
| Bloquear la exportación de datos al cancelar | Exportación completa del historial disponible **siempre**, incluso después de cancelar (periodo de gracia de acceso de solo lectura) — un usuario que sabe que puede irse con sus datos en cualquier momento confía más en quedarse, no menos |
| Descuentos-trampa que solo aparecen al intentar cancelar | Ningún descuento condicionado a la intención de cancelar — el precio es el precio, igual para todos en el mismo tier |
| Notificaciones de re-enganche artificial (rachas falsas, urgencia fabricada) | Ninguna notificación que no aporte un dato real (10-14, ningún patrón de "no pierdas tu racha" vacío de contenido) |

**Lo que sí genera retención, porque es valor real, no fricción de salida**:

1. **El foso de datos personal compone con el tiempo** (01 §1, 13 §1): cada operación registrada hace que el optimizador conozca mejor a ese trader concreto. Cancelar no es "dejar de pagar por una app", es renunciar a un asesor que llevaba meses aprendiendo su comportamiento — es la única palanca de retención que crece sola, sin que el producto tenga que hacer nada activamente para reforzarla.
2. **Recordatorio mensual de valor entregado, no de urgencia**: un resumen mensual objetivo ("tu % de beneficio conservado ha subido del 31% al 48% desde que usas el optimizador — equivalente a 2.400 € adicionales este trimestre") — dato real extraído de 12, nunca un mensaje de ansiedad.
3. **Hábito genuino de flujo de trabajo**: el producto se usa porque está en el camino natural de cerrar una operación (10), no porque una notificación empuje a abrir la app sin motivo.
4. **Transparencia total de precio y cambios**: sin sorpresas, es la base de la confianza que sostiene una suscripción a largo plazo en cualquier categoría profesional.

## 8. La IA contada como historia de negocio

Cuatro preguntas que cualquier inversor o cliente de pago hará, respondidas en una frase cada una, con el mecanismo real detrás:

- **¿Cómo aprende?** Continuamente y en privado — cada operación cerrada actualiza al instante el modelo estadístico de ese trader, con memoria que se renueva sola (decaimiento temporal, 13 §4) para seguir reflejando quién es el trader hoy, no quién era hace dos años. Nunca aprende de otro usuario.
- **¿Cómo recomienda?** Nunca con una opinión aislada — toda recomendación llega con su explicación numérica (06 §3, 12): qué se gana, qué se sacrifica, con qué base estadística personal.
- **¿Cómo compara?** Con matemática determinista y reproducible, no con una caja negra — cada recomendación es la ganadora de una comparación explícita entre configuraciones alternativas, con esperanza y varianza mostradas una junto a la otra (12 §6), nunca una respuesta sin las opciones que descartó.
- **¿Cómo optimiza?** Buscando, entre miles de combinaciones posibles de parciales, la que mejor equilibra esperanza y consistencia para ese trader concreto (02 §5) — no la que maximiza el beneficio medio a cualquier coste de varianza, porque un trader de cuenta fondeada no sobrevive a la varianza que no puede permitirse.

Esta es, en una página, la razón de negocio por la que TradePilot R no es "un journal con IA" — es un sistema cuyo valor por usuario crece con el tiempo de uso de ese usuario concreto, lo cual es, en términos de fundador, la definición exacta de un producto con retención estructural.

## 9. Métricas de negocio a vigilar (más allá de las de producto de 07 §4)

- **Churn mensual por tier** (se espera menor en Elite/Team que en PRO — mayor compromiso, mayor cambio de coste de sustitución).
- **Net Revenue Retention (NRR)**: si es sano, los usuarios existentes generan más ingreso con el tiempo (upgrades Gratis→PRO→Elite) incluso antes de captar un solo cliente nuevo — la métrica que mejor resume si el modelo de tiers está bien diseñado.
- **Conversión Gratis→PRO por cohorte de operaciones registradas** (no por tiempo transcurrido): la hipótesis de fundador es que la conversión correlaciona con *cuántas operaciones ha registrado* el usuario, no con cuántos días lleva registrado — si es así, confirma que el gancho de conversión es el foso de datos (§7.1), no la urgencia de un plazo.
- **LTV/CAC por canal**, con el canal B2B2C (§5) medido por separado del canal directo — son economías de adquisición distintas y mezclarlas esconde cuál está funcionando de verdad.
