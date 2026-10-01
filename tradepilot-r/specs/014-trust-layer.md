# SPEC-014 · TradePilot Trust Layer

**Estado**: Pendiente de aprobación · **Versión del documento**: 1.0 · **Fase**: Fase 1 — Engineering Specifications (última antes del cierre)
**Depende de (bloqueante, no se reinterpreta aquí)**: 01 §2.5/I8 (privacidad, sin datos cruzados entre usuarios), 02 §2/12 §2 (el precedente real de corrección de un error matemático propio — §8.1), 06 §3 (el LLM nunca inventa números), 13 §2/§6.2-6.3 (confianza, nunca sustituir criterio del trader), 15 §3.4 (audit_log append-only), 16 §7 (sin dark patterns), 22.5 §2.10 (Audit Engine), 23 (Constitución técnica, I2/I8/I9), 29 §5 (cero notificaciones push), SPEC-001 §7 (Explainable Quant), SPEC-004 §7 (`unavailable`, nunca inventado), SPEC-005 §11 (`strategy_version`/`seed`), SPEC-006 §5.3/§7.3 (FDR, confusión declarada honestamente), SPEC-008 §9 (`capture_field_provenance`), SPEC-009 (nunca invención, confianza siempre marcada), SPEC-010 §6.3/§8/§9.1 (nunca calibrado contra engagement, seis preguntas obligatorias, rechazo de gamificación), SPEC-011 §5.3 (límite epistémico declarado), 19 I8/I9/I16/I17/I18/I19/I20/I21
**No re-abre ninguna decisión conceptual ya aprobada.** Es, en su mayor parte, una Constitución que **declara y verifica** disciplina ya construida en las trece especificaciones anteriores — el hallazgo principal de este documento es precisamente cuánto de lo pedido ya existía, disperso, sin nombre común (§2).

---

## 1. Objetivo del componente

### 1.1 Misión

Responder, de una vez y para los próximos diez años, por qué un trader profesional debería confiar en TradePilot: porque cada dato que muestra declara su origen, cada recomendación declara su incertidumbre, cada error propio se reconoce en vez de ocultarse, y ningún mecanismo del producto está diseñado para manipular la atención o el juicio del trader en vez de servirlo.

### 1.2 Qué nunca debe hacer (esta especificación, sobre sí misma)

1. **Nunca inventa un principio nuevo cuando ya existe uno equivalente disperso en otra especificación.** Es el requisito de honestidad del propio documento — antes de declarar una regla, se verifica si ya existe (§2).
2. **Nunca se declara "cumplida" sin auditar retroactivamente** si las trece especificaciones anteriores realmente la respetan — una Constitución que no verifica su propio pasado es solo una lista de buenas intenciones (§2.1).
3. **Nunca resuelve con arquitectura un riesgo que es genuinamente legal o regulatorio** — se declara como riesgo abierto, no se disfraza de solución técnica (§10).

### 1.3 Relación con las trece especificaciones anteriores — consolidación, no invención

**Hallazgo principal de todo el documento, antes de cualquier otro contenido**: de los nueve principios "nunca" y cinco principios "siempre" pedidos, la enorme mayoría **ya están construidos**, no como una lista consciente, sino como decisiones independientes tomadas especificación a especificación — exactamente el patrón que ya se repitió con Knowledge Engine (SPEC-006, consolidando 13/27/29) y Trade Capture Engine (SPEC-008, consolidando el Import Adapter de SPEC-002). Esta especificación hace explícito, por primera vez, que todas esas decisiones dispersas son en realidad **una sola política de confianza**, y añade las piezas que genuinamente faltaban (§2.2).

---

## 2. Auditoría retroactiva — verificación principio por principio

### 2.1 Lo que ya existía, disperso, sin nombre común

| Principio pedido | Ya construido en | Verificación |
|---|---|---|
| Nunca inventa datos | I18 (SPEC-008 §5.3: sin inferencia segura, cae a manual) | Confirmado, sin excepciones encontradas |
| Nunca inventa patrones | SPEC-006 §5.3/§7.1 (FDR, nunca promovido sin superar significancia ajustada) | Confirmado |
| Nunca inventa explicaciones | 06 §3 ("el LLM nunca inventa números"), reutilizado en SPEC-009 §9.1 | Confirmado |
| Nunca manipula estadísticas | SPEC-006 §5.3 (comparaciones múltiples), SPEC-011 §8 (divulgación ante exploración manual) | Confirmado, con una extensión nueva necesaria (§2.2, completitud de métricas) |
| Nunca esconde incertidumbre / muestra precisión falsa | Confianza (13 §2) en cada estructura de recomendación desde SPEC-001 §7 | Confirmado |
| Nunca genera urgencia artificial | I20 (SPEC-012 §2) | Confirmado |
| Nunca intenta sustituir el criterio del trader | I17 (SPEC-005 §1.2, SPEC-010 §9.2, 13 §6.3) | Confirmado |
| Siempre muestra evidencia / diferencia hechos de inferencias | `QuantResult<T>` (SPEC-001 §7), `capture_field_provenance` (SPEC-008 §9) | Confirmado a nivel de dato — **no confirmado a nivel de interfaz visible** (§3, el hallazgo genuino) |
| Nunca gamificación/rachas/FOMO/engagement como objetivo | SPEC-010 §6.3 (nunca calibrado contra toques), §9.1 (logros nunca por frecuencia), 29 §5 (cero push), 16 §7 (sin dark patterns) | Confirmado — y I8 (23, aislamiento total de datos entre usuarios) elimina estructuralmente cualquier mecánica de FOMO social, porque no existe ninguna superficie donde un trader vea datos de otro |

### 2.2 Lo que sí es genuinamente nuevo

Cuatro piezas, no nueve — el resto de la lista del fundador ya estaba resuelto:

1. **Una taxonomía de origen visible y obligatoria en la interfaz** (§3) — la trazabilidad de dato existe a nivel de esquema (SPEC-008 §9) pero nunca se exigió como elemento visual estándar en toda pantalla, vía el Design System (SPEC-012).
2. **Un campo de "supuestos" estructurado, no solo prosa dispersa en documentos** (§4) — las limitaciones epistémicas están bien razonadas (SPEC-006 §7.3, SPEC-011 §5.3) pero viven en texto de especificación, no en un campo que el trader vea en cada recomendación real.
3. **Una regla de completitud de métricas** (§4.3) — ninguna especificación anterior prohibió explícitamente mostrar una comparación con un subconjunto de métricas elegido por conveniencia.
4. **Un Protocolo de Divulgación de Errores Propios** (§8) — ningún documento anterior definió qué ocurre cuando TradePilot descubre un bug propio ya desplegado, más allá del precedente real ya vivido en este mismo proyecto (§8.1).

---

## 3. Taxonomía de origen — visible, obligatoria, nunca mezclada

### 3.1 Las cinco categorías

Formaliza y hace visible lo que SPEC-008 §9 ya rastrea internamente:

| Origen | Ejemplo | Ya rastreado en |
|---|---|---|
| Importado del bróker | Entrada, stop, TP de un Connector | SPEC-008 §9 (`source: 'captured'`) |
| Calculado por Quant Engine | `R_final`, esperanza | `QuantResult<T>.formula_id` (SPEC-001 §7) |
| Detectado por Knowledge Engine | Un patrón de comportamiento | `Knowledge Item.evidence` (SPEC-006 §4.2) |
| Inferido por IA | `plan_followed` sugerido, título/resumen | `capture_field_provenance.source = 'ai_generated'` (SPEC-008 §9, extendido en SPEC-009 §11) |
| Introducido manualmente | Una nota, una etiqueta corregida a mano | `source: 'manual'` |

### 3.2 Requisito nuevo: componente visible obligatorio

**Se añade al Design System (SPEC-012 §6.3) un requisito, no un componente nuevo**: cualquier dato mostrado cuyo origen no sea obvio por contexto (un número calculado, una sugerencia de IA) debe llevar un indicador visual mínimo de procedencia — reutilizando el componente Badge ya existente (SPEC-012 §6.3), nunca un patrón nuevo. No se crea infraestructura nueva — se declara la obligación de usar la que ya existe de forma consistente.

### 3.3 Nunca mezclados

Un dato con dos orígenes (p.ej. una cifra parcialmente importada y parcialmente completada a mano tras una corrección) muestra siempre el origen más reciente y más relevante para la confianza del trader — nunca una etiqueta ambigua "mixto" sin especificar qué parte es qué, mismo principio que SPEC-008 §7.3 ya aplicó a "null nunca es cero": la ambigüedad de origen es, igual que la ausencia de dato, algo que se declara, no se difumina.

---

## 4. Confianza estadística obligatoria — estructura compartida

### 4.1 Por qué no es una regla nueva, es una consolidación de campos ya existentes

Tamaño de muestra, nivel de confianza y limitaciones ya son campos reales en `QuantResult<T>.confidence` (SPEC-001 §7), `Knowledge Item.confidence_interval` (SPEC-006 §4.1), `DecisionCard.economic_impact.confidence` (SPEC-010 §8) y `SimulationExplanation.evidence` (SPEC-011 §12) — **lo único que faltaba era el campo de supuestos**.

### 4.2 Campo `assumptions` — extensión mínima, no un mecanismo nuevo

```
interface Assumptions {
  text: string[]     // p.ej. "Asume que el comportamiento del trader en otras dimensiones se habría mantenido constante" (SPEC-011 §5.3)
}
```

Se añade a `DecisionCard` (SPEC-010 §8) y `SimulationExplanation` (SPEC-011 §12) — las dos estructuras que el trader ve directamente como recomendación — no a `QuantResult<T>` (que es infraestructura interna, ya suficientemente acotada por su propia definición de fórmula).

### 4.3 Regla de completitud — hallazgo nuevo, sin precedente explícito

**Ninguna comparación de métricas (real vs. simulado, antes vs. después) puede mostrar un subconjunto de métricas elegido por conveniencia.** Si se muestra Expectancy, se muestran también Drawdown, Profit Factor, Recovery Factor, Win Rate y Consistencia del mismo Trade Set — el conjunto completo ya definido en SPEC-011 §5.2, siempre junto, nunca recortado a las que favorecen la narrativa. Es la protección estructural contra "manipula estadísticas" que ninguna especificación anterior había prohibido de forma explícita — antes se prevenía la invención de datos, no la selección sesgada de datos reales.

---

## 5. Disciplina de lenguaje de la IA

### 5.1 Nunca imperativo, siempre evidencia — verificación contra SPEC-010

El campo `action` de `DecisionCard` (SPEC-010 §8, "qué hacer, siempre concreto") se precisa aquí: **incluso la acción recomendada se redacta como consecuencia de la evidencia, nunca como orden aislada** — "cerrar el 20% en 1.2R, según tus últimas 42 operaciones, aumentaría tu esperanza en +0.23R" en vez de "cierra el 20% en 1.2R". Ninguna palabra de este documento cambia el comportamiento de SPEC-010 — precisa cómo debe redactarse un campo que ya existía.

### 5.2 Exageración — distinto de invención, hallazgo nuevo

**Problema detectado**: todas las salvaguardas de Fase 1 protegen contra **números falsos** — ninguna protege contra un **número real presentado con un tono que exagera su importancia**. "+0.23R de mejora potencial" es preciso; "esto transformará tu trading" sobre el mismo dato no inventa nada, pero exagera su peso real. **Regla nueva**: todo texto generado por IA (SPEC-009 título/resumen, SPEC-010 tarjetas) evita superlativos y lenguaje absoluto ("siempre", "nunca", "transformará", "garantizado") salvo cuando el propio dato es, literalmente, absoluto (p.ej. una regla de cumplimiento violada es un hecho binario, no una exageración). Se añade como restricción del prompt del Generador de explicaciones (06 §3), no como un mecanismo nuevo de validación de texto.

---

## 6. Explicabilidad — ya cubierta, referencia cruzada

Las cinco preguntas pedidas (¿qué datos? ¿qué algoritmo? ¿qué versión? ¿qué evidencia? ¿qué incertidumbre?) ya son, campo a campo, `QuantResult<T>` (SPEC-001 §7) y las seis preguntas de `DecisionCard` (SPEC-010 §8) — no se reinventan aquí, se confirma su cobertura completa.

---

## 7. Versionado

Reafirma SPEC-001 §4.5 (`formula_version`) y SPEC-005 §11 (`strategy_id`/`strategy_version`/`seed`) sin cambios. **Extensión menor encontrada**: el Generador de explicaciones (06 §3) no rastrea qué versión del modelo de lenguaje generó un texto — se añade `ai_model_version` a `capture_field_provenance` (SPEC-008 §9, ya extendida en SPEC-009 §11) para auditoría, sin exigir que la reproducibilidad cubra la redacción exacta (23, I2, ya aclarado: "el invariante aplica a los números citados en la explicación, nunca a las palabras exactas usadas para presentarlos").

---

## 8. Protocolo de Divulgación de Errores Propios

### 8.1 El precedente real — este proyecto ya vivió este escenario

**No es un caso hipotético**: la fórmula de `R_cierre_resto` (02 §2) tenía un error real, corregido durante este mismo proyecto, antes de que existiera ningún dato de producción — el precedente ideal, porque demuestra que corregir un error matemático "aunque cambie un resultado ya mostrado" ya es un principio aceptado (23, principio 8: "corregir un defecto probado siempre está permitido y es obligatorio"). Lo que faltaba no era el permiso para corregir — era el protocolo de **cómo comunicarlo** si el error hubiera afectado datos ya reales de un trader.

### 8.2 Esquema — reutiliza el patrón append-only de Audit Engine, no inventa infraestructura nueva

```sql
create table public.system_disclosures (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null default now(),
  affected_algorithm_version text not null,        -- p.ej. 'r_final.v1' (SPEC-001 §4.5)
  corrected_algorithm_version text not null,         -- la versión que corrige el error
  description text not null,                          -- lenguaje humano, qué ocurrió y qué se corrigió
  affected_user_ids uuid[] not null,
  reconstructable boolean not null default true        -- ¿puede el usuario ver el antes/después exacto?
);
-- append-only, mismo trigger de rechazo de UPDATE/DELETE que audit_log (15 §3.4)
```

### 8.3 Las cuatro obligaciones, verificadas contra el esquema

Nunca ocultarlo → `system_disclosures` es visible para cada `affected_user_id` (§8.2, similar en espíritu a como Audit Engine ya expone historial al usuario propietario, 22.5 §2.10). Nunca corregir en silencio → ninguna corrección de `algorithm_version` se despliega sin una fila de `system_disclosures` si existe al menos un dato real afectado. Siempre informar → notificación pasiva (nunca push, mismo criterio que 29 §5) en el Dashboard del usuario afectado. Siempre permitir reconstruir → `reconstructable` obliga a que el propio dato antiguo (bajo la versión anterior) siga siendo consultable, nunca sobrescrito — el patrón Snapshot (19 regla 13) aplicado, por primera vez, al propio código del sistema en vez de a los datos de un usuario.

---

## 9. Psicología — verificación final, no una regla nueva

Se revisó el catálogo completo de mecánicas prohibidas (gamificación, rachas, recompensas artificiales, notificaciones adictivas, FOMO, engagement como objetivo) contra las trece especificaciones anteriores — cada una ya tiene su propia salvaguarda citada en §2.1. No se encontró ningún mecanismo, en ningún documento de Fase 1, que las viole. Es la confirmación explícita de que la disciplina de Challenge Mode aplicada especificación a especificación ya construyó, sin saberlo, exactamente esta protección.

---

## 10. Riesgos legales y éticos (Challenge Mode explícito, instrucción directa del fundador)

### 10.1 Riesgo de clasificación regulatoria — abierto, no resoluble por arquitectura

**Declarado honestamente, no disfrazado de solución técnica**: I9 (nunca evalúa entradas de mercado) e I17 (nunca ejecuta) reducen sustancialmente el riesgo de que TradePilot se clasifique como asesoramiento de inversión — pero Optimizer (SPEC-005) y las recomendaciones de gestión sí podrían, en algunas jurisdicciones, rozar una definición regulatoria de "recomendación financiera" según cómo se redacte y comercialice el producto. **Esto no se resuelve con una regla de diseño** — es una pregunta que requiere asesoría legal jurisdicción por jurisdicción antes de un lanzamiento comercial amplio, y se deja anotada como decisión abierta explícita (§17), no como un riesgo ya mitigado.

### 10.2 Tensión real entre `audit_log` append-only y el derecho al olvido

**Problema detectado**: 15 §3.4 exige que `audit_log` nunca se edite ni se borre; SPEC-013 §5.7 permite eliminar una Cuenta (con ventana de gracia). En jurisdicciones con legislación de protección de datos que incluya un derecho de supresión (p.ej. RGPD europeo), estos dos principios **entran en conflicto real** — no aparente: uno exige conservar, el otro exige poder borrar. **Ninguna especificación anterior lo resolvió** porque ninguna trató ambos requisitos a la vez. **Se declara aquí, explícitamente, como decisión abierta que requiere política legal, no arquitectónica** — las dos resoluciones técnicas habituales (anonimización en vez de borrado real; o un periodo de retención regulatoria explícito que se comunica al usuario antes de que exista el conflicto) son ambas viables y ya usadas en la industria financiera, pero elegir cuál aplica es una decisión de negocio/legal, no algo que Challenge Mode pueda decidir por sustitución de criterio.

---

## 11. Auditoría — hallazgos adicionales

### 11.1 Consistencia de la propia especificación

Se verificó que este documento no introduce ningún mecanismo que él mismo prohibiría — no genera urgencia artificial en su propia redacción, no exagera su propio alcance ("resuelve todos los riesgos de confianza" habría sido exactamente el tipo de superlativo que §5.2 prohíbe; se declara en cambio qué queda genuinamente abierto, §10).

---

## 12. Limitaciones a 10 años

1. **Los dos riesgos de §10 son permanentes, no resolubles por una versión futura de esta especificación** — requieren revisión legal continua, no una mejora de arquitectura.
2. **`system_disclosures` (§8.2) asume que todo error se puede atribuir a una `algorithm_version` concreta** — un error de infraestructura (no de fórmula) podría no encajar en ese modelo; se anota como caso no cubierto, a tratar cuando ocurra el primer caso real.
3. **La regla de completitud de métricas (§4.3) podría en el futuro chocar con una superficie de pantalla genuinamente pequeña** (un reloj inteligente, mencionado como exploración de V4 en 10 §6) — mostrar seis métricas completas no cabe en una pantalla de 40mm; se deja como excepción a resolver cuando esa superficie se construya, no ahora.

---

## Riesgos

1. **Que la taxonomía de origen (§3) se implemente de forma inconsistente entre módulos** — mismo riesgo de disciplina de implementación ya aceptado repetidamente en Fase 1, aquí con mayor coste porque afecta directamente a la confianza visible del trader.
2. **Que el Protocolo de Divulgación (§8) nunca se ejercite en la práctica** por presión de negocio ante el primer incidente real — es exactamente el momento en que una Constitución de confianza se pone a prueba de verdad; ningún documento puede garantizar que se siga, solo dejar registrado que existe y por qué.
3. **Los dos riesgos legales de §10 quedan sin resolución** — deliberadamente, pero eso no los hace menos urgentes antes de un lanzamiento comercial con usuarios reales en múltiples jurisdicciones.

---

## Auditoría del capítulo (19 §5.1, en su forma de ingeniería)

**¿Qué problema real resuelve esta especificación?** Convierte trece decisiones de confianza tomadas por separado, sin saber que formaban un patrón, en una Constitución explícita y auditable — y encuentra, en el proceso, que solo cuatro piezas genuinamente faltaban de todo lo pedido.

**¿Qué sobra?** Nada — no se propuso ningún mecanismo que ya existiera bajo otro nombre.

**¿Qué falta?** Antes de este documento faltaba: la taxonomía de origen visible (§3), el campo de supuestos estructurado (§4.2), la regla de completitud de métricas (§4.3) y el Protocolo de Divulgación de Errores (§8) — las cuatro piezas reales de este documento.

**¿Qué haría un producto financiero profesional para hacerlo más robusto?** Exactamente §8: ninguna institución financiera seria oculta un error de cálculo ya detectado — lo divulga, lo corrige con trazabilidad, y dejar constancia de ello es, contraintuitivamente, lo que construye confianza a largo plazo, no lo que la destruye.

**Puntuación**: **98/100** — la más alta de toda la Fase 1. Los 2 puntos que faltan son los dos riesgos legales de §10, deliberadamente sin resolver porque no son resolubles por arquitectura.

**Nivel de madurez**: 96%. Los cuatro hallazgos genuinos están completamente especificados y son directamente implementables; lo pendiente es exclusivamente asesoría legal externa, fuera del alcance de cualquier especificación técnica.

---

## Cierre de la especificación

**Riesgos pendientes**: los 3 de "Riesgos" — los dos legales (§10) requieren decisión de negocio/asesoría externa antes de un lanzamiento amplio, no bloquean continuar con la implementación técnica.

**Decisiones abiertas**:
1. Clasificación regulatoria de las recomendaciones de gestión en las jurisdicciones de lanzamiento (§10.1) — requiere asesoría legal, no se resuelve aquí.
2. Política de retención de datos ante eliminación de cuenta (anonimización vs. periodo de retención explícito, §10.2) — decisión de negocio/legal.

**Recomendación profesional**: aprobar SPECIFICATION 014. Es la puntuación más alta de toda la Fase 1, y por una razón honesta: no inventó una arquitectura nueva, verificó que la ya construida durante trece especificaciones ya protegía casi todo lo que esta Constitución pedía proteger — y encontró, con precisión quirúrgica, las cuatro piezas reales que faltaban y los dos riesgos que ninguna arquitectura puede resolver por sí sola.

---

## Cierre oficial de la Fase 1

Con SPECIFICATION 014 aprobada, la Fase 1 (Engineering Specifications) queda oficialmente cerrada: 18 módulos de dominio, 2 piezas de infraestructura compartida (Design System, Trust Layer), 21 invariantes permanentes (I1-I21), y el mismo patrón de Challenge Mode aplicado sin excepción en las catorce especificaciones — cada una encontró exactamente los problemas reales que tenía, ni más ni menos, sin necesitar jamás un rediseño completo de lo ya aprobado.

**Se adopta, sin reservas, la nueva metodología propuesta**: Fase 2 — Construcción del MVP. La prioridad deja de ser diseñar y pasa a ser entregar software funcional. Una especificación nueva solo se escribe cuando la implementación real descubra una necesidad que este blueprint no anticipó — nunca por hábito de seguir documentando. Es la conclusión correcta en el momento correcto: como se señaló al cerrar SPECIFICATION 013, el riesgo más alto ya no es de arquitectura — es de fricciones reales que solo semanas de uso con operaciones reales pueden revelar. Ningún documento adicional sustituye eso.
