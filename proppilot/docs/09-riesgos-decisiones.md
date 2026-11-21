# 09 — Riesgos y decisiones pendientes (Fase 2)

## 1. Decisiones que necesitan tu aprobación

| ID | Decisión | Recomendación | Alternativas |
|----|----------|---------------|--------------|
| **D1** | Dónde vive el código | **Repositorio nuevo y privado `proppilot`** (lo creas tú en GitHub; aquí solo queda esta documentación) | Subcarpeta en `jonatan` (desaconsejado: mezcla con FitPro y su despliegue) |
| **D2** | Hosting y planes | **Vercel + Supabase Cloud en la UE**. Supabase **Pro (~25 $/mes)** para producción: backups diarios y sin pausa por inactividad. Vercel Hobby (uso personal no comercial) | Supabase Free: se pausa tras 7 días sin uso y **sin backups** — no aceptable para datos financieros |
| **D3** | Proveedor de OCR/IA | **Modelo multimodal vía API con salida estructurada** (p. ej. Claude), detrás del adaptador, sin retención para entrenamiento. Coste estimado: céntimos por captura | Google Document AI / AWS Textract (mejor OCR puro, peor comprensión del documento); OCR local (Tesseract, peor calidad en capturas) |
| **D3b** | Consentimiento | Las capturas se envían a un tercero para su análisis. **Cada usuario debe aceptarlo** (casilla en onboarding) y poder desactivar la IA y registrar solo a mano | — |
| **D4** | Acceso del administrador de infraestructura | **Opción A** (política + MFA + transparencia hacia los usuarios). Ver doc 03 §7 | C: cifrado en cliente (rompe estadísticas y OCR); D: que otra persona sea la dueña del proyecto Supabase |
| **D5** | Catálogo de empresas | **Híbrido**: catálogo global mantenido por ti + empresas privadas por usuario | Solo privado (cada uno duplica NYS/Lucid); solo global (los demás no pueden añadir) |
| **D6** | Criterio contable | **Caja** (cuando se paga/cobra) | Devengo (más complejo, poco útil aquí) |
| **D7** | Gastos generales en el ROI | **Incluidos** en `G` (ROI real); ROI por empresa sin ellos + fila "No atribuido" | Excluirlos (ROI más bonito pero irreal) |
| **D8** | Metadatos EXIF/GPS de fotos del móvil | **Eliminar ubicación GPS** al subir y conservar el resto de la imagen intacta | Conservar el original byte a byte (prueba más fuerte, pero guarda la ubicación de tu casa) |
| **D9** | Dominio | **Dominio propio** (p. ej. `app.tudominio.com`, ~10 €/año): necesario para SMTP fiable y URL estable | `proppilot-xxx.vercel.app` (vale para empezar, pero el email saldría de un dominio prestado) |
| **D10** | "Payout pendiente/recibido" como estados de cuenta | **No como estados**: insignias derivadas de los payouts (una cuenta puede tener varios a la vez; como estado se perdería información) | Mantenerlos como estados (pediste esos estados; si los quieres literalmente, se añaden, pero con este riesgo) |
| **D11** | Borrado | **Sin borrado físico** de datos contables (anular). Cuentas/operaciones: archivar. Baja de usuario: exportación + borrado total explícito y auditado (RGPD) | Permitir borrar (riesgo de descuadres y pérdida de evidencia) |
| **D12** | Privacidad entre vosotros tres | **Aislamiento total**, como pediste. El esquema permitiría en el futuro compartir de forma voluntaria (p. ej. "vista hogar"), pero **no se construye** | — |
| **D13** | MFA | **Obligatoria para ti** (`platform_owner`), opcional para los demás | Opcional para todos |
| **D14** | Caducidad de invitaciones | **72 h por defecto**, máximo 7 días, vinculadas al email | Sin email vinculado (cualquiera con el enlace podría usarla) |
| **D15** | Verificar reglas reales de NYS Markets y Lucid | Con tu permiso, en Fase 2 consulto sus webs oficiales y propongo valores **con fuente y fecha** para que los confirmes tú | Las introduces tú manualmente |

## 2. Riesgos técnicos identificados

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Olvidar RLS en una tabla nueva | Fuga de datos entre usuarios | `force row level security` + prueba de cobertura que falla el CI + Security Advisors |
| Vista o función que salta RLS (`security definer`, vistas normales, materializadas) | Fuga | Vistas `security_invoker`, funciones definer solo en esquema no expuesto, pruebas automáticas |
| Uso de `service_role` en el servidor por comodidad | Fuga total | Prohibido salvo 2 usos documentados; lint/grep en CI que falla si aparece fuera de esos módulos |
| Referenciar IDs ajenos | Mezcla de datos entre usuarios | FKs compuestas `(id, owner_id)` |
| IA inventa o malinterpreta cifras | Contabilidad errónea | Evidencia literal obligatoria, umbral de confianza, confirmación humana, extracción inmutable auditada |
| Doble contabilización (dos capturas del mismo payout) | Beneficio inflado | Hash exacto + perceptual + `dedupe_key` + un cobro por payout |
| Errores de coma flotante | Descuadres | `numeric` en BD, `decimal.js` en TS, pruebas de redondeo |
| Tipos de cambio sobrescritos | Historia financiera alterada | Instantánea por movimiento; `fx_rates` nunca recalcula |
| Reglas de empresas cambian | Análisis incorrecto | Versionado + estado de verificación + aviso de antigüedad |
| SMTP por defecto de Supabase | Invitaciones/verificaciones que no llegan | SMTP propio con dominio verificado (D9) |
| Pausa/ausencia de backups en plan gratuito | Pérdida de datos | Plan Pro + prueba de restauración en Fase 10 |
| Invitación consumida si el alta falla a medio camino | El invitado no puede registrarse | El propietario reemite; se prueba el caso |
| Enlace de invitación reenviado por WhatsApp | Alta de un tercero | Vinculación a email, caducidad corta, uso único |
| Fotos con GPS | Exposición de ubicación | D8 |
| Límites de tiempo de funciones serverless con imágenes grandes | Extracciones fallidas | Compresión previa, reintentos, estado `failed` reintentable |
| Dependencia de proveedores (Vercel, Supabase, IA) | Bloqueo | Postgres estándar + migraciones SQL portables; adaptadores para IA y FX; exportación completa |
| Administrador con acceso a la consola de Supabase | Privacidad frente al admin | D4, comunicado con transparencia |

## 3. Qué haré cuando apruebes

1. Con D1 resuelto: preparar la estructura del repo `proppilot` y mover allí esta documentación.
2. Con D2/D9: guiarte paso a paso para crear los proyectos de Supabase y Vercel con **tus** cuentas (yo no puedo
   ni debo tener tus credenciales; los secretos irán directamente a las variables de entorno de cada servicio).
3. Empezar la Fase 0 y presentarte el resultado antes de pasar a la Fase 1.
