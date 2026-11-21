# 08 — Plan de construcción por fases

> **La construcción no empieza hasta tu aprobación expresa.** Requisitos previos de la Fase 0: decisiones bloqueantes del doc 09 §1.3.

Cada fase termina con: pruebas en verde en CI, demo en entorno de preview, y tu visto bueno antes de seguir.
Ninguna fase toca datos reales hasta la fase de puesta en producción.

| Fase | Entregable | Criterios de aceptación |
|------|-----------|--------------------------|
| **0. Cimientos** | Repo privado `proppilot` nuevo (D1 aprobada; independiente de FitPro y TradePilot R); Next.js + TS estricto + Tailwind + shadcn; Supabase CLI; proyectos Supabase *staging* y *producción* (UE); Vercel conectado; CI con las puertas de calidad; cabeceras de seguridad; tokens de diseño | `main` despliega en Vercel; CI levanta Supabase local y ejecuta una prueba pgTAP vacía; ningún secreto en el repo; copia lógica cifrada nocturna configurada |
| **1. Identidad** (M1) | `profiles`, `platform_roles`, `invitations`; hook/flujo de invitación; login, verificación, recuperación, MFA; bootstrap del propietario; SMTP | Toda la matriz de invitaciones (doc 07 §5) en verde; prueba de cobertura RLS activa desde el primer día |
| **2. Empresas** (M2) | Catálogo global + privado; líneas, programas, productos por plataforma, opciones de compra; reglas versionadas con niveles de verificación; carga de NYS y Lucid según doc 10 (`candidate`/`pending`) | Miembro no puede editar el global; editar reglas crea versión nueva; ninguna regla `verified` sin fuente |
| **3. Cuentas** (M3) | Cuentas, intentos, máquina de estados, historial append-only, evaluación→funded, alta rápida | Matriz de aislamiento; transiciones inválidas rechazadas; historial no modificable |
| **4. Dinero** (M4) | Ledger, FX (BCE diario), auditoría `record_changes`, rectificaciones y anulaciones por RPC, dedupe de facturas/compras, gastos recurrentes, vista original/EUR | Invariante de cuadre; inmutabilidad; suite de auditoría (doc 07 §3 ter); golden dataset multidivisa |
| **5. Payouts** (M5) | Flujo completo con 4 cifras separadas y cobro → movimiento | Solicitado/aprobado nunca suman como ingreso; un cobro por payout |
| **6. Documentos** (M6) | Storage privado, subida desde cámara, bandeja, vínculos, dedupe por hash | Matriz de Storage (doc 07 §4) en verde |
| **7. IA/OCR** (M7) | `DocumentExtractor` + proveedor elegido + `MockExtractor`; revisión; confirmación transaccional; duplicados semánticos | Ningún dato se guarda sin confirmar; campos sin evidencia vacíos; pruebas con imágenes sintéticas; evaluación manual con 10–20 capturas reales **tuyas, con tu permiso** |
| **8. Operaciones** (M8) | Diario de trading, estrategias, instrumentos, cálculo de R; estructura de importación CSV | Golden dataset de trading; dedupe de operaciones |
| **9. Dashboard** (M9) | KPIs, gráficos, filtros, detalle por KPI, vista por empresa, responsive | SQL = referencia TS en todos los golden datasets; Lighthouse/axe sin errores graves |
| **9 bis. Exportación** (M10) | CSV y Excel por conjunto, ZIP de documentos, archivo completo | Suite de exportación (doc 07 §3 quinquies) y ataque A12 |
| **10. Auditoría y producción** | Revisión de seguridad completa, suite de ataque A1–A16, pruebas E2E finales, ensayo de restauración en un proyecto temporal aislado (doc 11 §4.3), exportación/eliminación de datos, guía de uso, invitaciones reales | Checklist de seguridad firmado; restauración probada; tu aprobación para invitar a tu mujer y a tu amigo |
| **Posterior** | Importación CSV por plataforma, informes PDF, recordatorios de renovación/payout, notificaciones | — |

## Cómo se trabaja dentro de cada fase

1. Migración SQL + pruebas pgTAP **antes** que la UI.
2. Tipos TS generados desde el esquema (`supabase gen types`).
3. Server Actions/Route Handlers con validación Zod.
4. UI.
5. Pruebas E2E del flujo.
6. PR pequeño, revisión, merge, despliegue a staging.

## Orden de riesgo

Las fases 1 y 3–5 concentran el riesgo de privacidad e integridad contable y van primero a propósito:
si la base es sólida, la IA y el dashboard se construyen encima sin rehacer nada.
