# PropPilot — Documentación de arquitectura

> Estado: **FASE 2 — Revisión. Pendiente de tu aprobación expresa para empezar la Fase 0.**
> No hay código de aplicación. No se ha creado ni modificado ninguna base de datos, repositorio, proyecto ni servicio externo.
> Última revisión: 2026-11-21 (revisión 2)

PropPilot es una plataforma web privada y multiusuario para gestionar la actividad
económica y operativa con empresas de fondeo (Prop Firms): compras, evaluaciones,
cuentas funded, operaciones, payouts, gastos y rentabilidad real.

PropPilot **es una herramienta de gestión y análisis. Nunca ejecuta órdenes ni se conecta
a plataformas de trading para operar.**

## Índice

| # | Documento | Contenido |
|---|-----------|-----------|
| 00 | [Diagnóstico del entorno](00-diagnostico-entorno.md) | Qué hay en el entorno, qué no se toca y por qué |
| 01 | [Arquitectura técnica](01-arquitectura.md) | Stack, justificación, alternativas descartadas, diagrama de componentes, despliegue |
| 02 | [Modelo de datos](02-modelo-datos.md) | Entidades, ERD, dinero y divisas, integridad, **auditoría financiera**, exportaciones |
| 03 | [Usuarios, privacidad y RLS](03-usuarios-privacidad-rls.md) | Aislamiento, **revisión tabla por tabla, RPC y Storage**, limitación del administrador (D4) |
| 04 | [Sistema de invitaciones](04-invitaciones.md) | Flujo, tokens, caducidad, uso único, WhatsApp, recuperación de contraseña |
| 05 | [Diseño funcional de módulos](05-modulos.md) | Módulos, **prevención de duplicados**, **exportación CSV/Excel**, UX |
| 06 | [Estadísticas y fórmulas](06-estadisticas-formulas.md) | Definición matemática de cada indicador y sus denominadores |
| 07 | [Pruebas y QA](07-pruebas-qa.md) | Matriz RLS, **suite de ataque con IDs ajenos**, auditoría, duplicados, exportación, CI |
| 08 | [Plan de construcción por fases](08-plan-fases.md) | Módulos pequeños, criterios de aceptación por fase |
| 09 | [Decisiones y riesgos](09-riesgos-decisiones.md) | **Registro de decisiones aprobadas y pendientes**, riesgos abiertos |
| 10 | [Reglas de NYS Markets y Lucid Trading](10-reglas-nys-lucid.md) | Programas, URL oficiales, fecha de consulta, niveles de verificación |
| 11 | [Costes y proveedores de IA](11-costes-y-proveedores-ia.md) | Estimación mensual, comparativa OCR/IA, copias de seguridad y restauración |

## Principios rectores

1. **Privacidad en la base de datos, no en la interfaz.** Toda fila privada tiene `owner_id`;
   RLS activado y forzado en todas las tablas; Storage con políticas por carpeta de usuario.
2. **Integridad financiera antes que velocidad.** Importes en `numeric`, nunca `float`.
   Libro de movimientos (ledger) único como fuente de verdad del dinero. Sin borrados: anulaciones y rectificaciones trazables.
3. **Todo cambio financiero queda auditado**, con usuario, fecha, valor anterior, valor nuevo y motivo.
4. **Nada se registra sin confirmación humana** cuando procede de OCR/IA, y la IA nunca puede generar un movimiento duplicado.
5. **No se inventan reglas de empresas.** Toda regla tiene nivel de verificación, URL de origen y fecha de consulta.
6. **Historial inmutable.** Los cambios de estado se registran en tablas append-only.
7. **Modularidad.** Proveedor de OCR/IA, proveedor de tipos de cambio y fuentes de importación detrás de interfaces intercambiables.
8. **Sin dependencias locales.** Todo alojado en la nube con HTTPS; el usuario solo necesita un enlace.

## Historial de revisiones

| Revisión | Fecha | Cambios |
|----------|-------|---------|
| 1 | 2026-11-21 | Fase 1: auditoría y diseño inicial (docs 00–09) |
| 2 | 2026-11-21 | Decisiones D1, D2, D4, D9, D10 y D15 aprobadas; D3 se mantiene pendiente con comparativa. Auditoría financiera (`record_changes`, rectificaciones), exportación CSV/Excel, prevención de duplicados, revisión completa de privacidad y suite de ataque, modelo de reglas por línea/programa/producto/opción con niveles de verificación, investigación de NYS y Lucid (doc 10), costes y copias de seguridad (doc 11) |
