# AGENTS.md — reglas operativas para agentes de IA

> Reglas de trabajo para cualquier IA que opere sobre **TradePilot R**.
> El **contexto** del proyecto está en `docs/context/`. Esto son las **reglas**.
>
> Fichero principal de instrucciones para agentes. `CLAUDE.md` apunta aquí.

---

## 0. Antes de tocar nada

**Lee, en este orden:**

1. `docs/context/00_PROJECT_CONTEXT.md` — qué es el proyecto y qué NO es.
2. `docs/context/10_CURRENT_STATUS.md` — qué está hecho hoy.
3. El documento de `docs/context/` que cubra el área que vas a tocar.

No empieces a modificar código sin esto. El proyecto tiene decisiones
arquitectónicas tomadas con auditoría; reinventarlas cuesta días.

---

## 1. El código es la fuente de verdad

- **Lo implementado lo dice el código**, no la documentación.
- `docs/00-…` a `docs/32-…` y `specs/` son el **blueprint de diseño**: contexto
  valioso, **no prueba de que algo exista**. Mucho está brillantemente
  especificado y sin escribir.
- Si documentación y código se contradicen, **gana el código** — y entonces hay
  que corregir la documentación.

## 2. Distingue siempre tres estados

```
IMPLEMENTADO   hay código y pasa tests
ESPECIFICADO   hay diseño aprobado, no hay código
PENDIENTE      ni una cosa ni otra
```

Decir "el sistema hace X" cuando X solo está especificado es el error más caro
que puedes cometer aquí. Ha pasado. No lo repitas.

## 3. Comprueba antes de afirmar

**No des algo por funcionando porque exista un fichero.**

- Ejecuta: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Para la base de datos: las suites de `supabase/tests/` contra Postgres real.
- Si no puedes ejecutar algo, **dilo explícitamente**. No lo presentes como
  verificado.
- Si tu instrumento de medida falla, **sospecha de tu instrumento antes que del
  sistema**. Ha sido la causa de varios falsos positivos.

Dos trampas reales al probar la base de datos:
- El **superusuario y el propietario están exentos de RLS**. Conéctate como
  `authenticated` o tus tests de aislamiento son falsos.
- **RLS deniega en silencio** (0 filas), no con excepción. Comprueba el **valor**,
  no la excepción.

## 4. No inventes

- No inventes funcionalidades, tablas, campos ni endpoints.
- **No existen** `positions`, `orders`, ni «multiplicadores». No los supongas.
- **No existen «axiomas A1–A10»**. Son **invariantes I1–I21**, repartidos entre
  `docs/23` (I1–I15) y `docs/19` §8 (I16–I21).
- Si no sabes un dato, escribe `PENDIENTE`. Una suposición escrita se convierte
  en un hecho falso tres semanas después.

## 5. Respeta los invariantes

Antes de un cambio que roce el dominio, comprueba que no rompes:

| | |
|---|---|
| **I3 · Snapshot** | editar un Plan no reescribe operaciones ya registradas |
| **I5 · Decimales** | exactos; cadenas en fronteras jsonb/API |
| **I10 · Sin prop firm** | cero código específico de ninguna plataforma o empresa |
| **I13 · Calcular ≠ Juzgar** | quien calcula no juzga |
| **I17 · Evaluate ≠ Execute** | ninguna regla dispara una acción |

Y las reglas estructurales:
- **Una sola vía de alta de Operaciones** (`crear_operacion_nucleo`). No añadas
  una tercera puerta.
- **Idempotencia obligatoria**: la misma petición dos veces devuelve lo
  existente, nunca duplica.
- **La evidencia es inmutable**: parciales, eventos de capital y `audit_log` no
  se reescriben ni se borran.

## 6. No toques secretos

> 🔒 **Nunca pidas, aceptes, escribas ni repitas una credencial real.**

Ni API keys, ni secrets, ni tokens OAuth, ni refresh tokens, ni contraseñas, ni
cookies, ni identificadores de sesión, ni `service_role`.

- Puedes conocer el **nombre** de una plataforma, la **forma** de sus
  credenciales y el **formato** de sus datos. Nunca el valor.
- Debes poder escribir un conector completo **sin ver un secreto**. Si un diseño
  exige lo contrario, el diseño está mal.
- Nada de secretos en código, frontend, git, logs ni ficheros de ejemplo.
- Todo lo que empieza por `NEXT_PUBLIC_` **se publica en el navegador**.

Detalle en `docs/context/07_SECURITY.md`.

## 7. No cambies arquitectura sin justificarlo

- Un cambio arquitectónico necesita **una razón demostrable**, no una preferencia.
- Si encuentras una contradicción que exige una decisión humana, **párate y
  señálala**. No la resuelvas por tu cuenta.
- Mantén compatibilidad con lo que ya existe. Este proyecto prefiere estabilidad
  a elegancia.

## 8. Alcance

- Haz lo que se te pide. Ni menos, ni más.
- No "aproveches para" refactorizar, renombrar ni reordenar.
- Si detectas algo mal fuera del encargo: **repórtalo, no lo arregles** sin
  autorización.

## 9. Actualiza la documentación cuando cambie una decisión

- Decisión nueva → entrada en `docs/context/09_DECISIONS.md`.
- Cambia el estado de un módulo → `docs/context/10_CURRENT_STATUS.md`.
- Cambia el contrato de conectores → `docs/context/06_CONNECTORS.md`.

Documentación desactualizada es peor que ausente: se cree.

## 10. Al entregar

Di siempre, sin adornos:

1. **Qué has cambiado** (ficheros concretos).
2. **Qué has verificado** y con qué comando.
3. **Qué NO has podido verificar** y por qué.
4. **Qué queda abierto** o necesita decisión humana.

No declares nada "resuelto" sin haber ejecutado la comprobación. Si no pudiste
ejecutarla, la palabra es "sin verificar".

---

## Comandos

```bash
npm install                              # dependencias
npm run typecheck                        # tipos
npm run lint                             # estilo
npm run test                             # 327 pruebas
npm run build --workspace=@tradepilot/web

# Entorno local (Docker):  supabase stop && supabase start
# Sin Docker:              scripts/alpha/start.sh
# Suites SQL:              supabase/tests/  (ver su README)
```

⚠️ **Nunca uses `--ignore-health-check` para "arreglar" un arranque.** Desactiva
todas las comprobaciones de salud y esconde el problema real.
