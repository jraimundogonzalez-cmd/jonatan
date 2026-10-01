# 09 · REGISTRO DE DECISIONES

> Decisiones **ya tomadas**, con su origen verificable. No se registra aquí nada
> que no esté decidido: lo abierto va en §3.
>
> Donde no consta una fecha exacta, se ancla al **BUILD o commit** que la
> implementó, que es trazable. Las fechas no se inventan.
>
> **No duplica `decisions/`**: el ADR `decisions/0001-…` sigue siendo el
> documento extenso. Aquí está el índice operativo.

---

## 1. Formato

```
DEC-ID · Fecha u origen · Decisión · Motivo · Estado · Impacto
```

Estados: **VIGENTE** · **SUPERADA** · **ABIERTA** (decidida pero sin implementar)
· **PENDIENTE DE DECISIÓN HUMANA**

---

## 2. Decisiones vigentes

### DEC-001 · Separación Core Domain vs. plataforma SaaS
**Origen**: `decisions/0001-separacion-core-domain-vs-plataforma-saas.md`
**Decisión**: el dominio no sabe nada de tiers, facturación ni límites comerciales.
**Motivo**: diferenciar por producto no debe exigir que el motor conozca el plan.
**Estado**: VIGENTE · **Impacto**: ningún motor consulta suscripciones.

### DEC-002 · TradePilot no ejecuta operaciones
**Origen**: invariante **I17 · Evaluate ≠ Execute** (`docs/19` §8.3)
**Decisión**: ninguna regla, por clara que sea, dispara una acción por sí sola.
Las integraciones futuras son de **lectura**.
**Motivo**: evita que el producto derive en un bot automático, que es otro
producto, con otro riesgo y otro marco regulatorio.
**Estado**: VIGENTE · **Impacto**: ningún conector pedirá permisos de ejecución.

### DEC-003 · El núcleo no conoce ninguna empresa de fondeo ni plataforma
**Origen**: invariante **I10** (`docs/23`)
**Decisión**: cero código específico de prop firm; todo por configuración.
**Motivo**: acoplarse a una firma obliga a reescribir el núcleo con cada cambio
comercial ajeno.
**Estado**: VIGENTE · **Impacto**: verificado — ninguna prop firm aparece en el
código. **La arquitectura desacoplada no es una decisión nueva de esta fase: ya
era un invariante aprobado.**

### DEC-004 · Los conectores traducen; el núcleo no se entera
**Origen**: `specs/008-trade-capture-engine.md` §3.2
**Decisión**: un conector implementa **un solo método**, `translate()`, y produce
`RawCaptureEvent[]`. Toda la variación de plataforma vive en `connectors/<id>.ts`.
**Motivo**: añadir una plataforma no puede tocar reconstrucción, inferencia,
normalización ni reconciliación.
**Estado**: VIGENTE (ESPECIFICADO, sin implementar) · **Impacto**: el registro
manual **ya es** estructuralmente un conector (`id: 'manual'`).

### DEC-005 · Las operaciones importadas deben poder deduplicarse
**Origen**: migración `…_operations_engine.sql` — implementado
**Decisión**: clave única `(account_id, source, external_ref)`.
**Motivo**: una reimportación o un webhook repetido no puede crear una segunda
operación.
**Estado**: VIGENTE e **implementado** · **Impacto**: la zona de aterrizaje de
integración existe antes que la integración.

### DEC-006 · Patrón Snapshot — el pasado no se reescribe
**Origen**: invariante **I3**; BUILD 010 y BUILD 017
**Decisión**: una decisión congela lo que el Plan decía en ese instante; la
materialización lee el congelado, nunca el Plan vivo.
**Motivo**: editar un Plan no puede cambiar el significado de operaciones ya
registradas.
**Estado**: VIGENTE · **Impacto**: `crear_operacion_nucleo` **no consulta**
`management_plans`. Verificado atacándolo.

### DEC-007 · Un único núcleo de creación de Operaciones
**Origen**: BUILD 017 (`crear_operacion_nucleo`) + BUILD 016B (revocación)
**Decisión**: las dos vías de alta delegan en una sola implementación; el INSERT
directo y la llamada al núcleo quedan revocados para `authenticated`.
**Motivo**: dos fórmulas de riesgo iguales hoy son dos fórmulas distintas dentro
de un año.
**Estado**: VIGENTE · **Impacto**: no se añade una tercera vía de alta. Un
conector **no** inserta en `trades`: pasa por las RPC.

### DEC-008 · Decimales exactos, y como cadenas en las fronteras
**Origen**: invariante **I5**
**Decisión**: `decimal.js` solo dentro del kernel; los decimales cruzan jsonb y
API como **cadenas**; el redondeo de presentación se decide en el kernel.
**Motivo**: la coma flotante y los números JSON pierden precisión y ceros.
**Estado**: VIGENTE · **Impacto**: normalización obligatoria en la frontera de
lectura (PostgREST serializa `numeric` como número).

### DEC-009 · Las credenciales no viven en el código ni en el frontend
**Origen**: esta fase (2026-10-01)
**Decisión**: ninguna credencial de proveedor en código fuente, git, frontend,
variables `NEXT_PUBLIC_*`, logs ni ficheros de ejemplo. Destino propuesto:
Supabase Vault, accesible solo por RPC `SECURITY DEFINER`.
**Motivo**: `NEXT_PUBLIC_*` se incrusta en el bundle del navegador; una tabla con
RLS normal es legible por el cliente.
**Estado**: VIGENTE como política · **ABIERTA** en implementación · **Impacto**:
condiciona el diseño de cualquier conector. Ver `07_SECURITY.md`.

### DEC-010 · Ninguna IA recibe credenciales reales
**Origen**: esta fase (2026-10-01)
**Decisión**: una IA puede conocer el **nombre** de la plataforma, la **forma**
de las credenciales y el **formato** de los datos; nunca su valor. Debe poder
escribir un conector completo sin ver un secreto.
**Motivo**: el contexto de una IA no es un canal seguro y puede persistirse.
**Estado**: VIGENTE · **Impacto**: los exports que se compartan van anonimizados;
los identificadores de cuenta, enmascarados.

### DEC-011 · Desactivar los servicios de Supabase que no se usan
**Origen**: commit `c91e3af` (2026)
**Decisión**: `analytics` y `realtime` a `false` en `config.toml`.
**Motivo**: analytics exige en Windows el daemon Docker publicado en
`tcp://localhost:2375` y obligaba a arrancar con `--ignore-health-check`, que
desactiva **todas** las comprobaciones de salud. Verificado que el proyecto no
usa ninguno de los dos (cero suscripciones, cero tablas publicadas).
**Estado**: VIGENTE · **Impacto**: reactivar cualquiera es una línea.

### DEC-012 · Los ficheros `.bat` se versionan con finales de línea CRLF
**Origen**: commit `14b82f1`
**Decisión**: `.gitattributes` con `*.bat text eol=crlf`.
**Motivo**: `cmd.exe` localiza líneas por posición en bytes contando CRLF; con
LF se come caracteres al saltar y el lanzador se rompe.
**Estado**: VIGENTE · **Impacto**: verificado sobre la salida de `git archive`,
que es lo que produce el ZIP de descarga.

---

## 3. Abierto — pendiente de decisión humana

### DEC-013 · ¿Se congela el riesgo como porcentaje o también como importe?
**Planteada**: 2026-10-01 · **Estado**: **PENDIENTE DE DECISIÓN HUMANA**

Una Management Intent congela `resolved_risk_pct`, **no** el importe en euros.
Si el capital cambia entre decidir y materializar, el importe cambia
proporcionalmente.

**Medido**: capital 10.000 € al decidir → 100.000 € al materializar →
`risk_amount` de **1.000 €** en lugar de 100 €.

Las dos lecturas son defendibles:
- *Congelar solo el %*: un trader dimensiona en el momento de ejecutar, contra el
  capital que tiene entonces. No hay retroactividad: tras abrir no se recalcula
  nunca (I4 se cumple).
- *Congelar también el importe*: la decisión incluía un tamaño, y ese tamaño
  formaba parte de lo decidido.

**No se ha modificado nada.** Cambiarlo redefine qué es una decisión de riesgo.
Afecta además a cómo un conector traducirá operaciones importadas.

---

## 4. Decisiones que NO se han tomado

Para que ninguna IA las dé por hechas:

- ❌ Qué plataforma ni qué empresa de fondeo se va a integrar primero.
- ❌ Qué modo de ingesta se usará (aunque `file_import` es el camino recomendado).
- ❌ Si se construirá un worker, una Edge Function o algo distinto para el
  proceso de larga duración que hoy no existe.
- ❌ Si se implementará `instrument_unit_specs` y con qué alcance.
- ❌ Si se conectarán Rule Engine y Optimizer, ni cuándo.
- ❌ Nada sobre el panel de control ni las métricas.
