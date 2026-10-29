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
| Limpieza y orden | Lectura completa de la bandeja (por rangos de fechas, porque la búsqueda devuelve como máximo 50 resultados y no pagina), agrupación por remitente, clasificación, propuesta revisable, aplicación tras confirmación y reglas de filtro para copiar en Gmail. |
| Borradores | Respuesta redactada con el contexto del hilo, editable, guardada como borrador; el envío exige confirmar destinatario, asunto y texto completo (doble confirmación si hay contenido sensible). |
| Historial | Registro de cada cambio con botón de deshacer (archivar, etiquetar, papelera, spam). |

## Límites conocidos del conector de Gmail

- No crea filtros ni cancela suscripciones: la página genera la regla exacta para crearla a mano en Gmail.
- No puede leer la carpeta de spam.
- `search_threads` devuelve como máximo 50 hilos por consulta y sin token de página.
- No existe borrado definitivo en el agente: como mucho, papelera (reversible durante 30 días).

## Actualizar

Edita `index.html` y vuelve a publicarlo desde Claude Code en la misma URL del artefacto.
