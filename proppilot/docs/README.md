# PropPilot — Documentación de arquitectura (Fase 1)

> Estado: **FASE 1 — Auditoría y diseño. Pendiente de aprobación (Fase 2).**
> No hay código de aplicación escrito. Ningún servicio externo ha sido creado o modificado.
> Fecha: 2026-11-21

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
| 02 | [Modelo de datos](02-modelo-datos.md) | Entidades, relaciones (ERD), tipos, dinero y divisas, integridad |
| 03 | [Usuarios, privacidad y RLS](03-usuarios-privacidad-rls.md) | Aislamiento por usuario, políticas RLS, Storage, RPC, límites honestos del modelo |
| 04 | [Sistema de invitaciones](04-invitaciones.md) | Flujo, tokens, caducidad, uso único, WhatsApp, recuperación de contraseña |
| 05 | [Diseño funcional de módulos](05-modulos.md) | Prop Firms, cuentas, documentos+IA, operaciones, payouts, divisas, dashboard, UX |
| 06 | [Estadísticas y fórmulas](06-estadisticas-formulas.md) | Definición matemática de cada indicador y sus denominadores |
| 07 | [Pruebas y QA](07-pruebas-qa.md) | Estrategia de pruebas, matriz RLS, pruebas contables, CI |
| 08 | [Plan de construcción por fases](08-plan-fases.md) | Módulos pequeños, criterios de aceptación por fase |
| 09 | [Riesgos y decisiones pendientes](09-riesgos-decisiones.md) | Lo que necesita tu aprobación antes de programar |

## Principios rectores

1. **Privacidad en la base de datos, no en la interfaz.** Toda fila privada tiene `owner_id`;
   RLS activado y forzado en todas las tablas; Storage con políticas por carpeta de usuario.
2. **Integridad financiera antes que velocidad.** Importes en `numeric`, nunca `float`.
   Libro de movimientos (ledger) único como fuente de verdad del dinero. Sin borrados físicos
   de datos contables: se anulan con trazabilidad.
3. **Nada se registra sin confirmación humana** cuando procede de OCR/IA.
4. **No se inventan reglas de empresas.** Toda regla tiene estado de verificación y fuente.
5. **Historial inmutable.** Los cambios de estado se registran en tablas append-only.
6. **Modularidad.** Proveedor de OCR/IA, proveedor de tipos de cambio y fuentes de importación
   detrás de interfaces intercambiables.
7. **Sin dependencias locales.** Todo alojado en la nube con HTTPS; el usuario solo necesita un enlace.
