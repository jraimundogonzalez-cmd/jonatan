# ADR-0001 · Separación entre Core Domain y Plataforma SaaS

**Estado**: **Accepted** · **Fecha**: 2026-08-05 · **Decide**: Fundador (aprobación explícita tras la auditoría arquitectónica posterior a BUILD 005)
**Alcance**: decisión de arquitectura permanente. No implementa nada — ninguna línea de código, ninguna tabla, ninguna política RLS, ninguna interfaz nueva se crea por esta ADR.
**Primera ADR del proyecto**: establece también el formato (Contexto / Decisión / Consecuencias / Riesgos futuros / Estado) para las siguientes.

---

## 1. Contexto

### 1.1 Por qué TradePilot se diseña como producto SaaS

El modelo de negocio está fijado desde 08 y desarrollado en 16: suscripción por niveles (Gratis / PRO / Elite / Team-Enterprise), con márgenes brutos del orden del 88-93% propios de un SaaS de software puro. El tier Gratis es una inversión de adquisición deliberada, no un descuido (16 §51). La comercialización por suscripción no es una posibilidad futura que se evalúa: es el modelo aprobado del producto.

### 1.2 Por qué el dominio de trading debe permanecer independiente de la plataforma comercial

Tres razones, ninguna de conveniencia:

1. **Precisión matemática es la prioridad #1 del producto** (19 §6). Un motor cuyo resultado pudiera depender del plan contratado dejaría de ser determinista y reproducible — rompería la garantía que SPEC-001 §4.4 y el patrón Snapshot (19 regla 13) existen para sostener. Dos traders con los mismos datos deben obtener exactamente el mismo número, siempre, con independencia de lo que paguen.

2. **La confianza es el producto** (SPEC-014, Trust Layer). Un sistema que degradase silenciosamente la calidad de un cálculo según el tier sería indistinguible, desde fuera, de un sistema que manipula estadísticas — exactamente lo que SPEC-014 §4.3 prohíbe.

3. **Reutilización sin reescritura**. El mismo motor debe poder ejecutarse desde la web, una futura app móvil, una API, procesos batch y herramientas internas. Cualquier conocimiento comercial dentro de un motor lo ataría al contexto de una sesión web autenticada.

### 1.3 Estado real verificado en el momento de aceptar esta ADR

La auditoría posterior a BUILD 005 (BUILD 001-005 ya implementados) comprobó por inspección del código, no por intención declarada:

- **Ningún motor conoce nada comercial.** Cero apariciones de `auth`, `tier`, `plan`, `subscription`, `stripe`, `billing`, `quota` o nombres de tier en `packages/*/src`.
- `@tradepilot/quant-engine` y `@tradepilot/optimizer` no tienen ninguna dependencia de infraestructura — son portables hoy, sin cambios.
- `@tradepilot/risk-engine` y `@tradepilot/operations-engine` acceden a datos exclusivamente a través de puertos (Ports & Adapters); `@supabase/supabase-js` es `peerDependency`, nunca `dependency`. Su capa de servicio depende de interfaces, no de Supabase.
- `OptimizationProblem.evaluation_budget` (SPEC-005 §5.2) ya es un parámetro aportado por el llamador.

Esta ADR **registra y protege** ese estado; no lo corrige, porque no hay nada que corregir en los motores.

---

## 2. Decisión

Se adoptan como reglas permanentes de arquitectura:

### D1 — Los motores nunca conocerán planes, suscripciones ni licencias

Quant Engine, Risk Engine, Optimizer, y los futuros Simulation Engine, Analytics, Knowledge Engine y AI Decision Center **nunca** sabrán si el usuario es Gratis, PRO, Elite o Enterprise. Su única responsabilidad es resolver un problema de dominio. Un motor jamás recibe un identificador de plan como parámetro, ni lo consulta, ni altera su resultado en función de él.

### D2 — La plataforma decide únicamente el acceso, nunca el comportamiento

La capa comercial resuelve exactamente tres preguntas: **quién puede acceder**, **qué módulos puede utilizar** y **cuánto uso tiene permitido**. Nunca modifica el comportamiento matemático de un motor. La distinción operativa es literal: la plataforma puede **no invocar** un motor, o invocarlo con un presupuesto distinto que el propio contrato del motor ya expone públicamente (el caso de `evaluation_budget`); nunca puede hacer que el mismo motor, con la misma entrada, devuelva algo distinto.

### D3 — Toda la lógica comercial vive fuera del dominio

Ninguna tabla de dominio incorporará columnas comerciales. En particular, y por ser la tentación más evidente, `public.profiles` **no** recibirá un campo `plan`, `tier` ni equivalente: sus columnas actuales (`default_risk_pct`, `optimizer_lambda`) son parámetros de dominio legítimos, y esa naturaleza no debe diluirse. Cualquier entidad comercial futura vivirá en un espacio propio y referenciará al usuario, nunca al revés.

### D4 — Un único punto de aplicación de límites

Cuando exista la capa comercial, la aplicación de límites se hará en un único lugar. Hoy esa costura ya existe y es la frontera natural: `apps/web/actions/*` (Server Actions) es el único punto por el que un cliente entra al dominio. Queda prohibido introducir una comprobación de plan dentro de un motor o dentro de una función SQL de dominio.

### D5 — Portabilidad de ejecución

Todo motor debe poder ejecutarse desde web, móvil, API, batch y herramientas internas sin modificaciones. Los puertos existentes son el mecanismo aprobado: un contexto de ejecución nuevo se soporta escribiendo un adaptador nuevo, jamás tocando la capa de servicio de un motor.

---

## 3. Consecuencias

### 3.1 Ventajas

- **El determinismo queda protegido por construcción**: ningún cambio de precios, de empaquetado comercial o de proveedor de pagos puede alterar un resultado matemático ni invalidar un histórico ya calculado.
- **Los motores son vendibles por sí mismos**: la misma pieza sirve para el producto SaaS, una futura API para prop firms, o una herramienta interna, sin fork ni reescritura.
- **El coste de introducir la capa comercial es bajo**: el trabajo pendiente es aditivo (una capa nueva por encima), no invasivo (reescribir motores existentes).
- **El límite del tier Gratis ya elegido es estructuralmente barato**: 16 §36 fija "1 cuenta", no "N operaciones/mes" — se aplica al crear una Cuenta, sin tocar ningún motor, y no penaliza el hábito de registro que alimenta el foso de datos del producto.
- **Optimizer ya cumple D2 sin trabajo pendiente**: diferenciar tiers mediante `evaluation_budget` (p. ej. sin acceso / `K=500` / `K=3000`) no requiere que el motor sepa nada.

### 3.2 Limitaciones aceptadas

- **La capa de persistencia sí conoce a su proveedor de identidad.** El esquema usa `auth.uid()` en 46 puntos y mantiene 6 claves foráneas directas a `auth.users` (`profiles`, `prop_firms`, `accounts`, `trades`, `management_plans`, `audit_log`). Los motores son independientes; el esquema no. Se acepta conscientemente: es lo que hace que el aislamiento multi-tenant lo garantice Postgres y no la capa de aplicación (04 §4), una propiedad que no se quiere perder.
- **Los RPC de dominio solo sirven a un contexto con sesión.** Filtran por `auth.uid()`, de modo que un proceso batch o una llamada servidor-a-servidor con *service role* obtiene cero filas (silencio, no error). D5 se cumple hoy en los motores TypeScript, no en la capa de acceso a datos. No se resuelve ahora: hacerlo sería construir contra un consumidor batch que todavía no existe ni se ha evaluado.
- **Fricción menor de empaquetado**: `risk-engine` y `operations-engine` re-exportan sus adaptadores Supabase desde el barrel, así que un consumidor que solo quiera la capa de servicio arrastra igualmente ese módulo. Es un detalle de empaquetado, no de arquitectura.

### 3.3 Impacto en futuras integraciones

- **Import Adapters de brókers** (SPEC-002 §5.7, SPEC-008): no se ven afectados — entran por el mismo contrato canónico de escritura, que no conoce planes. Un límite comercial sobre conectores, si existiera, se aplicaría en la capa de acceso (D4), nunca dentro del adaptador.
- **API pública para prop firms** (16 §67): posible sin tocar motores, pero exigirá resolver antes la limitación de `auth.uid()` descrita en §3.2, porque es un contexto servidor-a-servidor.
- **App móvil**: `quant-engine` y `optimizer` son directamente reutilizables hoy; `risk-engine`/`operations-engine` requieren únicamente un adaptador propio si el transporte no es Supabase.
- **Proveedor de pagos** (Stripe u otro): queda fuera del dominio por D3, de modo que sustituirlo no toca ninguna tabla de trading.

---

## 4. Riesgos futuros

### 4.1 La propiedad de los datos está asociada directamente al usuario (hallazgo de la auditoría)

**Hecho verificado**: no existe ningún concepto de organización, equipo o tenant por encima del usuario. La propiedad es estrictamente `user_id → auth.users`, y **todas** las políticas RLS del sistema se expresan como `user_id = auth.uid()`.

**Consecuencia comercial**: el modelo de negocio aprobado (16 §20) contempla un tier **Team / Enterprise** con precio por asiento y licencias para prop firms (16 §67, incluida la posibilidad de que la propia firma subvencione parcialmente a sus traders fondeados). Con el modelo de propiedad actual **no existe ninguna entidad a la que asignar asientos**: una prop firm no puede poseer, licenciar ni ver nada.

**Alcance real del riesgo**: no afecta a Gratis, PRO ni Elite — los tres son productos de usuario individual y son vendibles hoy tal como está construido. Afecta exclusivamente al cuarto tier.

**Decisión explícita tomada ahora**: **no se implementan organizaciones ni tenants en esta fase.** Introducirlos hoy sería construir contra un producto que aún no está oficialmente en el roadmap, exactamente el tipo de sobreingeniería que 19 y 31 (TPOS) obligan a evitar.

**Condición de revisión, registrada para que no se pierda**: si la edición Team/Enterprise entra oficialmente en el roadmap, **esta decisión debe revisarse antes de que existan clientes en producción**. La razón es de coste, no de diseño: retrofitear propiedad organizacional obliga a tocar las 6 claves foráneas y **todas** las políticas RLS de todas las tablas de dominio. Hacerlo sin datos de producción es una migración ordinaria; hacerlo con clientes reales es una migración de datos multi-tenant con riesgo de exposición cruzada — la clase de error más cara que puede cometer un producto financiero multi-usuario.

### 4.2 Erosión silenciosa de la separación

El riesgo más probable no es una violación deliberada, sino una comprobación de plan añadida "solo esta vez" dentro de un motor o de una función SQL de dominio bajo presión de plazo. Mitigación disponible sin construir nada: la separación es **verificable con un único `grep`** sobre `packages/*/src`, tal como se comprobó en esta auditoría — cualquier aparición de vocabulario comercial ahí es, por sí sola, evidencia de violación de D1.

### 4.3 Acoplamiento al proveedor de identidad

Un cambio futuro de proveedor de identidad, o el soporte de un IdP corporativo (previsible junto con Enterprise), tocaría las 6 FKs a `auth.users`. Está acotado y es conocido; se registra aquí para que no se descubra como sorpresa.

---

## 5. Estado

**Accepted.**

No modifica código, base de datos, RLS, tablas, interfaces, autenticación ni introduce ningún proveedor de pagos. Es una decisión de arquitectura registrada para fases futuras del producto.

El trabajo continúa en el Core Domain, con el siguiente motor.
