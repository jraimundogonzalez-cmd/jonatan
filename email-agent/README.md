# Despacho de Correo

Agente personal de Gmail que funciona como página privada de claude.ai (navegador de ordenador y móvil, HTTPS, sin servidor propio).

## Arquitectura

- **Página**: `index.html`, publicada como artefacto privado de claude.ai. Solo la puede abrir su propietario.
- **Acceso a Gmail**: el conector oficial de Gmail de claude.ai (OAuth gestionado por claude.ai). La página nunca ve tokens ni contraseñas, y no hay credenciales en este repositorio.
- **Interpretación y redacción**: la capacidad `sample` (Claude, con la cuenta del propio usuario).
- **Historial de acciones**: la base de datos del artefacto, en el espacio privado de cada usuario (`data/users/<id>/log`). Guarda identificadores de hilo, asuntos y resultados, nunca cuerpos de mensajes.

## Qué hace

| Sección | Funciones |
| --- | --- |
| Buscar | Pregunta en lenguaje natural → 2-4 consultas Gmail de precisa a amplia → lectura de los hilos → resumen, estado, adjuntos y enlace a Gmail. Muestra las consultas probadas. |
| Pendientes | Hilos donde el último mensaje es tuyo (con búsqueda de respuestas en otros hilos y fecha sugerida de seguimiento) y correos recientes que piden una acción. |
| Limpieza y orden | Análisis de solo lectura de toda la bandeja (por rangos de fechas, porque la búsqueda devuelve como máximo 50 resultados y no pagina) → resumen por categorías sin nada seleccionado → selección por categoría con exclusión de remitentes → vista previa calculada → prueba real limitada (un remitente, N conversaciones) → confirmación → resultado con errores parciales y deshacer. Solo etiqueta y archiva; nunca papelera ni spam. |
| Borradores | Respuesta redactada con el contexto del hilo, editable, guardada como borrador; el envío exige confirmar destinatario, asunto y texto completo (doble confirmación si hay contenido sensible). |
| Historial | Registro de cada cambio (completado, parcial o fallido) con botón de deshacer el etiquetado y el archivado. |

## Límites conocidos del conector de Gmail

- No crea filtros ni cancela suscripciones: la página genera la regla exacta para crearla a mano en Gmail.
- No puede leer la carpeta de spam.
- `search_threads` devuelve como máximo 50 hilos por consulta y sin token de página.
- El agente no borra, no mueve a la papelera ni marca spam; solo etiqueta y archiva.

## Actualizar

Edita `index.html` y vuelve a publicarlo desde Claude Code en la misma URL del artefacto.

## Reglas de seguridad de la limpieza

- Estado único: categorías seleccionadas + exclusiones por remitente. Contador, vista previa y confirmación salen de la misma función (`computePlan`).
- Remitentes protegidos (lista, dominios, patrón de banco/facturación/seguridad o categoría protegida): solo se pueden etiquetar, nunca archivar.
- Cada conversación cuyo asunto o fragmento parezca reembolso, factura, pedido, pago, nómina, suscripción o aviso de seguridad queda retenida aunque el remitente sea comercial.
- Primero se etiqueta y solo después se archiva, así ninguna conversación sale de la bandeja sin etiqueta. Las operaciones completadas no se repiten.
- Los remitentes «Sin clasificar», «Personal» y «Posible spam o fraude» no se pueden seleccionar.

## Pruebas

`tests/cleanup.e2e.js` abre la página en Chromium con un Gmail simulado (~280 conversaciones) y comprueba la selección, las exclusiones, las protecciones, la cancelación, los fallos parciales, el reintento, el deshacer y la búsqueda. No toca ningún Gmail real.

```bash
node email-agent/tests/cleanup.e2e.js email-agent/index.html
```
