# 09 — Decisiones y riesgos

> Última revisión: 2026-11-21 (revisión 2, tras tu respuesta a la Fase 1).
> Leyenda: ✅ **Aprobada** (confirmada por ti) · ⏳ **Pendiente** (propuesta, sin confirmar) · 🆕 Nueva en esta revisión.
> Ninguna decisión pendiente se trata como aprobada en el diseño: donde dependen de ella, el documento lo indica.

## 1. Registro de decisiones

### 1.1 Aprobadas

| ID | Decisión | Detalle | Dónde se refleja |
|----|----------|---------|------------------|
| **D1** ✅ | Repositorio independiente y privado `proppilot` | Sin mezclar con FitPro ni con TradePilot R. Aún **no creado** (es infraestructura y se hará en la Fase 0) | 00 §2 · 01 §6 · 08 |
| **D2** ✅ | Supabase **Pro** en producción | Condicionada a la estimación de costes completa (doc 11 §2). Copias de seguridad y procedimiento de restauración probado (doc 11 §4) | 01 §7 · 11 |
| **D4** ✅ | Acceso administrativo del propietario técnico a Supabase | Aceptado. La app garantiza el aislamiento entre usuarios; la limitación se documenta y se comunica a cada usuario | 03 §7 |
| **D9** ✅ | Dominio propio para la plataforma y el correo | Registrador y nombre por elegir (D9b) | 01 §6 · 04 §6 · 11 |
| **D10** ✅ | Payouts como entidades independientes de los estados de la cuenta | En la cuenta se muestran solo como insignias derivadas | 02 §4.3 · 05 M3/M5 |
| **D15** ✅ | Investigar las condiciones oficiales de NYS y Lucid por programa, tamaño y modalidad | Investigación hecha (doc 10). **Resultado: nada verificado todavía**, por el bloqueo de red (ver D15b) | 10 |

### 1.2 Pendientes

| ID | Decisión | Propuesta (sin aprobar) | Alternativas | ¿Bloquea? |
|----|----------|-------------------------|--------------|-----------|
| **D3** ⏳ | Proveedor de OCR/IA | **No se elige todavía.** Evaluación comparativa con capturas reales (doc 11 §3.3) | Ver doc 11 §3.2 | Fase 7 |
| **D3b** ⏳ | Consentimiento de envío de capturas a un tercero | Casilla en el alta + opción de desactivar la IA por usuario | — | Fase 7 |
| **D5** ⏳ | Catálogo de empresas | Híbrido: global mantenido por ti + empresas privadas por usuario | Solo privado / solo global | Fase 2 |
| **D6** ⏳ | Criterio contable | Caja | Devengo | Fase 4 |
| **D7** ⏳ | Gastos generales en el ROI | Incluidos en `G`; fila "No atribuido" en la vista por empresa | Excluidos | Fase 9 |
| **D8** ⏳ | GPS/EXIF de las fotos | Eliminar la ubicación y conservar el resto | Original byte a byte | Fase 6 |
| **D11** ⏳ | Borrado | Sin borrado físico de datos financieros (anular o rectificar). Baja de usuario: exportación + borrado total explícito y auditado | Permitir borrar | Fase 4 / 10 |
| **D12** ⏳ | Privacidad entre los tres usuarios | Aislamiento total, sin "vista hogar" | Compartición voluntaria futura | — |
| **D13** ⏳ | MFA | Obligatoria para el propietario, opcional para el resto | Opcional para todos | Fase 1 |
| **D14** ⏳ | Invitaciones | 72 h, uso único, vinculadas al email | Sin email vinculado | Fase 1 |
| **D9b** 🆕⏳ | Nombre de dominio y registrador | Por elegir por ti | — | Fase 0 |
| **D15b** 🆕⏳ | Cómo pasar reglas de `candidate` a `verified` | a) Permitir `nysmarkets.com`, `terms.nysmarkets.com`, `lucidtrading.com` y `support.lucidtrading.com` en la red del entorno de trabajo, para que yo lea las páginas y guarde capturas · b) Verificación manual tuya en la app | — | Fase 2 (los datos) |
| **D16** 🆕⏳ | Qué línea y programas de NYS usáis (futuros, CFDs o ambos) | Cargar primero solo los programas que uséis de verdad | Cargar todos | Fase 2 |
| **D17** 🆕⏳ | PITR (100 $/mes) | **No** al inicio: backups diarios de Supabase + copia lógica cifrada propia (RPO 24 h) | Activar PITR | Fase 0 |
| **D18** 🆕⏳ | Plan de Vercel | Hobby, **si sus condiciones admiten este uso privado** (sin confirmar) | Pro, 20 $/mes | Fase 0 |
| **D19** 🆕⏳ | Staging | Proyecto en la organización Pro (~10 $/mes, sin pausas) | Organización Free (0 $, se pausa) | Fase 0 |
| **D20** 🆕⏳ | Destino de la copia externa cifrada | Almacenamiento de objetos en un proveedor distinto de Supabase (B2/R2), con credencial solo de escritura | Ninguna copia externa | Fase 0 |

### 1.3 Decisiones necesarias antes de autorizar la Fase 0

D9b (dominio), D17 (PITR), D18 (plan de Vercel), D19 (staging) y D20 (copia externa).
Las demás pueden resolverse antes de la fase que bloquean.

## 2. Riesgos abiertos

### 2.1 Técnicos y de seguridad

| ID | Riesgo | Impacto | Mitigación | Estado |
|----|--------|---------|------------|--------|
| R1 | Olvidar RLS en una tabla nueva | Fuga entre usuarios | `force row level security` + prueba de cobertura + suite de ataque generada desde el catálogo + Security Advisors | Mitigado en diseño |
| R2 | Vista o función que salta RLS | Fuga | Vistas `security_invoker`; funciones definer solo en el esquema privado; pruebas | Mitigado en diseño |
| R3 | Uso indebido de `service_role` | Fuga total | 2 usos permitidos y documentados; comprobación en CI | Mitigado en diseño |
| R4 | Referenciar IDs ajenos | Mezcla de datos | FKs compuestas; ataques A5/A6 | Mitigado en diseño |
| R5 | La IA inventa o malinterpreta cifras | Contabilidad errónea | Evidencia literal, confirmación humana, extracción inmutable | Abierto hasta D3 y la evaluación con capturas reales |
| R6 | Doble contabilización | Beneficio inflado | 7 mecanismos (doc 05 "Prevención de duplicados") | Mitigado en diseño |
| R7 | Cambios financieros sin rastro | Pérdida de confianza en los datos | `record_changes`, RPC con motivo obligatorio, trigger que rechaza cambios sin motivo, sin DELETE | Mitigado en diseño |
| R8 | Flotantes y redondeo | Descuadres | `numeric` + `decimal.js` + pruebas | Mitigado en diseño |
| R9 | Los backups de Supabase no incluyen los archivos de Storage (según su documentación, por reconfirmar) | Pérdida de justificantes | Copia lógica propia de BD + bucket (D20) y ensayo de restauración | **Abierto** hasta D20 |
| R10 | Las copias contienen datos de todos los usuarios | Privacidad | Cifrado con clave solo del propietario técnico (parte de la limitación D4) | Aceptado (D4) |
| R11 | SMTP por defecto de Supabase | Correos que no llegan | Resend con dominio propio (D9) | Abierto hasta D9b |
| R12 | Invitación consumida si el alta falla a mitad | El invitado no puede registrarse | Reemisión por el propietario; prueba específica | Mitigado en diseño |
| R13 | Enlace de invitación reenviado | Alta de un tercero | Email vinculado, caducidad, uso único (D14 pendiente) | Abierto hasta D14 |
| R14 | Fotos con GPS | Exposición de ubicación | D8 | Abierto hasta D8 |
| R15 | Inyección de fórmulas en CSV/Excel exportados | Ejecución de fórmulas al abrir el archivo | Escape de `= + - @` | Mitigado en diseño |
| R16 | Dependencia de proveedores | Bloqueo | Postgres estándar, adaptadores, exportación completa | Mitigado en diseño |
| R17 | Acceso administrativo del propietario técnico | Privacidad frente al administrador | Aceptado (D4) y comunicado por escrito | Aceptado |

### 2.2 De datos y de negocio

| ID | Riesgo | Impacto | Mitigación | Estado |
|----|--------|---------|------------|--------|
| R-N1 🆕 | **Lucid limita el número de cuentas por hogar/familia** (candidato: 10 de evaluación, 5 funded, 10 en total). Si tú y tu mujer compartís domicilio, vuestras cuentas podrían contar juntas | Incumplir condiciones de la empresa y perder cuentas | PropPilot **no puede** avisar de esto sin romper el aislamiento entre usuarios. Debéis coordinarlo fuera de la app. Opcional: cada usuario introduce a mano en Ajustes "cuentas de mi hogar en otras personas" como número, sin ver datos ajenos | **Abierto**, y tú decides si añadir ese campo |
| R-N2 🆕 | Reglas no verificadas | Análisis y alertas incorrectos | Niveles de verificación; solo `verified` alimenta cálculos | Abierto hasta D15b |
| R-N3 🆕 | Contradicciones en las fuentes oficiales (NYS: payouts semanales/diarios y reparto; LucidDirect: consistencia; complemento de consistencia de 650 $ en Lucid 25K) | Datos erróneos | Nivel `disputed`; resolver con lectura directa o con soporte de la empresa | Abierto |
| R-N4 🆕 | Las empresas cambian reglas con frecuencia y por fecha de compra | Aplicar reglas que no tocan | Versionado con ventanas `applies_to_purchases_*` y revisión cada 90 días | Mitigado en diseño |
| R-N5 🆕 | Precios estimados sin lectura directa de la página oficial | Desviación en el presupuesto | Confirmar en las páginas vivas antes de contratar | Abierto |
| R-N6 🆕 | El P&L de trading se confunde con dinero real | Malas decisiones | Separación visual obligatoria entre finanzas reales y trading | Mitigado en diseño |

## 3. Próximos pasos (cuando des tu aprobación expresa)

1. Que resuelvas las decisiones de §1.3.
2. Que crees el repositorio privado `proppilot` (D1) y lo añadamos a la sesión; mover allí esta documentación.
3. Guiarte para crear los proyectos de Supabase y Vercel con **tus** cuentas. Los secretos irán directamente a las variables de entorno de cada servicio, nunca al chat ni al repositorio.
4. Fase 0.

**Hasta entonces no se programa nada ni se crea ni modifica ninguna infraestructura.**
