# 00 — Diagnóstico del entorno

## 1. Qué se ha inspeccionado

| Elemento | Resultado |
|----------|-----------|
| Repositorio de trabajo | `jraimundogonzalez-cmd/jonatan`, rama `claude/wizardly-newton-yyf27f` (limpia) |
| Ramas existentes | `claude/wizardly-newton-yyf27f`, `claude/elegant-planck-g1PdA` (ambas con el mismo historial de 50 commits) |
| Contenido | Aplicación **FitPro**: PWA de entrenamiento y nutrición (React 19 + Vite 8, JavaScript, sin backend) |
| Despliegue existente | GitHub Actions → GitHub Pages, se dispara en `main` y `claude/elegant-planck-g1PdA` |
| Proyecto PropPilot previo | **No existe.** No hay código, esquema, migraciones ni configuración de Supabase relacionados |
| Herramientas del contenedor | Node 22, npm 10, pnpm 10, `psql`, Docker (solo en este contenedor efímero en la nube, no en tu PC) |

## 2. Conclusión: PropPilot no debe construirse dentro de este repositorio

El repositorio `jonatan` contiene otra aplicación con su propio ciclo de despliegue.
Mezclar PropPilot en él supondría:

- Riesgo de romper el despliegue de FitPro (el workflow publica el contenido de la raíz).
- Mezclar dependencias, configuración de lint y secretos de dos productos distintos.
- Historial de git y permisos compartidos entre una app personal de fitness y una app financiera multiusuario.

**Acción tomada:** la documentación de Fase 1 se ha escrito en una carpeta aislada `proppilot/docs/`
en la rama de trabajo. No se ha modificado ningún archivo de FitPro. Esta rama no dispara el workflow de despliegue.

**D1 aprobada:** PropPilot tendrá un repositorio nuevo, privado e independiente llamado `proppilot`, sin mezclarse con FitPro ni con TradePilot R.
Todavía no se ha creado: es infraestructura y se hará cuando autorices la Fase 0. Esta documentación se moverá allí.

**Acceso a red de la sesión (2026-11-21):** el entorno de trabajo no puede abrir las webs de NYS Markets, Lucid Trading, Supabase ni Vercel
(las bloquea su política de red). Solo funciona el buscador web. Esto condiciona la verificación de reglas (doc 10 §1) y de precios (doc 11).

## 3. Observación sobre el proyecto existente (no se ha modificado)

FitPro llama a la API de Anthropic **directamente desde el navegador** con una clave guardada en
`localStorage` (`src/utils/aiVision.js`, cabecera `anthropic-dangerous-direct-browser-access`).
Para una app personal de un solo usuario puede ser aceptable, pero **PropPilot no replicará este patrón**:
todas las claves de IA/OCR vivirán exclusivamente en el servidor. Lo dejo anotado por si quieres revisarlo en FitPro.

## 4. Implicaciones para PropPilot

- Se parte de cero: no hay deuda técnica que heredar, pero tampoco nada validado.
- Docker/psql existen solo en este contenedor de desarrollo. **Tu uso diario no dependerá de ellos**:
  las pruebas se ejecutarán en GitHub Actions y la app vivirá en Vercel + Supabase.
- Ningún servicio en la nube (Supabase, Vercel, dominio, proveedor de IA, SMTP) existe aún.
  Crearlos requiere tus cuentas y tu aprobación (ver doc 09).
