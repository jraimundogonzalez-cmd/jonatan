# 03 — Usuarios, privacidad y Row Level Security

## 1. Modelo de usuarios

| Rol | Quién | Qué puede hacer | Qué **no** puede hacer |
|-----|-------|-----------------|------------------------|
| `platform_owner` | Propietario inicial | Todo lo de un miembro + crear/revocar invitaciones + editar el catálogo **global** de empresas y reglas | Ver datos financieros, documentos, cuentas u operaciones de otros usuarios |
| `member` (por defecto) | Tu mujer, tu amigo, futuros invitados | Gestionar su propio espacio completo; crear empresas privadas | Ver nada de otros; crear invitaciones; editar el catálogo global |

- El rol se guarda en `platform_roles`, tabla **sin políticas de escritura**: nadie puede auto-asignárselo desde la app.
- No existe ningún panel global ni política que permita a un rol ver filas de otro `owner_id`. Esto se prueba automáticamente (doc 07).
- El modelo admite N usuarios sin cambios: el aislamiento es por fila, no por "número de usuarios".

## 2. Clasificación de datos

| Clase | Tablas | Acceso |
|-------|--------|--------|
| **Privada** | `profiles`, `accounts`, `evaluation_attempts`, `account_status_history`, `transactions`, `payouts`, `payout_status_history`, `trades`, `strategies`, `documents`, `document_extractions`, `document_links`, `import_batches`, `audit_log`, empresas/productos/reglas con `scope='private'` | Solo `owner_id = auth.uid()` |
| **Referencia compartida** | `prop_firms`/`account_products`/`rule_sets`/`rule_items` con `scope='global'`, `rule_keys`, `currencies`, `fx_rates`, `instruments` globales | Lectura: cualquier usuario autenticado. Escritura: `platform_owner` (catálogo) o servicio (fx) |
| **Control de acceso** | `invitations`, `platform_roles` | Ver §5 y doc 04 |

## 3. Plantilla RLS para tablas privadas

Se aplica a cada tabla privada mediante una función de migración para que ninguna se quede sin proteger:

```sql
alter table public.accounts enable row level security;
alter table public.accounts force  row level security;   -- incluso el propietario de la tabla pasa por RLS

revoke all on public.accounts from anon;                -- usuarios no autenticados: nada

create policy accounts_select on public.accounts
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy accounts_insert on public.accounts
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy accounts_update on public.accounts
  for update to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Sin política DELETE en tablas contables (transactions, payouts, *_history, document_extractions).
-- Para accounts/trades/strategies: archivado en lugar de borrado (decisión D11).
```

Notas:
- `(select auth.uid())` en lugar de `auth.uid()` permite a Postgres evaluarlo una vez por consulta (rendimiento recomendado por Supabase).
- `with check` en UPDATE impide **cambiar el propietario** de una fila propia a otro usuario.
- Además, defensa en profundidad:
  - Privilegios de columna: `grant update (label, notes, platform, ...) on accounts to authenticated;` — `owner_id`, `status`, `id` no figuran.
  - Trigger `forbid_owner_change` que lanza excepción si `NEW.owner_id <> OLD.owner_id`.
- Tablas append-only (`*_history`, `document_extractions`, `audit_log`): solo `select` e `insert`; trigger que rechaza UPDATE/DELETE incluso para roles privilegiados salvo migración explícita.

## 4. Tablas de referencia compartida

```sql
-- Lectura: global visible para todos los autenticados; privada solo para su dueño
create policy firms_select on prop_firms for select to authenticated
  using (scope = 'global' or owner_id = (select auth.uid()));

-- Escritura de empresas privadas: su dueño
create policy firms_insert_private on prop_firms for insert to authenticated
  with check (scope = 'private' and owner_id = (select auth.uid()));

-- Escritura del catálogo global: solo platform_owner
create policy firms_write_global on prop_firms for insert to authenticated
  with check (scope = 'global' and private.is_platform_owner());
```

`private.is_platform_owner()` es `SECURITY DEFINER`, `set search_path = ''`, en un esquema **no expuesto** por la API,
y solo consulta `platform_roles` para `auth.uid()`. Este rol **nunca** aparece en políticas de tablas privadas.

`fx_rates`: `select` para `authenticated`; sin políticas de escritura (la escribe solo la tarea programada con `service_role`).

## 5. Funciones (RPC), vistas y API

| Regla | Motivo |
|-------|--------|
| Todas las funciones de negocio son `SECURITY INVOKER` (por defecto) | Se ejecutan con los permisos del usuario → RLS aplica dentro |
| Las pocas `SECURITY DEFINER` (validar invitación, `is_platform_owner`, triggers de historial) viven en el esquema `private`, con `set search_path = ''`, comprueban `auth.uid()` explícitamente y tienen `revoke execute ... from public, anon` | Evitar escaladas y secuestro de `search_path` |
| Todas las vistas se crean `with (security_invoker = true)` | Una vista normal se ejecuta con permisos de su creador y **saltaría RLS** |
| Vistas materializadas: **no se usan** para datos privados | No admiten RLS; filtrarían datos de todos |
| El esquema `private` no se expone en la API de Supabase | Funciones internas no invocables desde el cliente |
| Ninguna Route Handler usa `service_role` para leer datos privados | El servidor actúa siempre "como el usuario" con su JWT |
| Se ejecutan los *Security Advisors* de Supabase en CI | Detecta tablas sin RLS, vistas inseguras, funciones con `search_path` mutable |

Las estadísticas del dashboard se calculan con funciones `SECURITY INVOKER` que filtran explícitamente
`owner_id = auth.uid()` **además** de RLS (doble barrera, y mejor uso de índices).

## 6. Storage

- Bucket `documents` **privado** (`public = false`), límite 15 MB, tipos MIME permitidos: jpeg, png, webp, heic, pdf, csv.
- Ruta obligatoria: `{auth.uid()}/{document_id}.{ext}`.

```sql
create policy "docs_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "docs_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Sin UPDATE (no se sobrescribe un justificante) ni DELETE desde el cliente.
```

- Descargas mediante **URLs firmadas de 60 s** generadas con el JWT del usuario (solo se generan si RLS permite leer el objeto).
- Bucket aparte `firm-logos` **público** solo para logotipos (no contienen datos privados).
- Metadatos EXIF (GPS de fotos del móvil): ver decisión D8.

## 6 bis. Revisión completa de superficie de acceso (mejora obligatoria 4)

### Tablas

| Tabla | Clase | SELECT | INSERT | UPDATE | DELETE | Protección adicional |
|-------|-------|--------|--------|--------|--------|----------------------|
| `profiles` | privada | `id = uid` | trigger de alta | `id = uid` (solo `display_name`, `timezone`) | — | sin columna de rol |
| `platform_roles` | control | `user_id = uid` | — | — | — | solo migración |
| `invitations` | control | `created_by = uid` ∧ owner | owner | owner (`revoked_at`, `status`) | — | token solo como hash |
| `prop_firms`, `firm_programs`, `account_products`, `product_options`, `rule_sets`, `rule_items`, `firm_aliases` | ref./privada | `global` ∨ `owner_id = uid` | privada: dueño · global: owner | ídem | — (archivar) | `scope` y `owner_id` inmutables |
| `accounts` | privada | `owner_id = uid` | `owner_id = uid` | RPC con motivo | — | `status` solo vía historial; FK compuestas |
| `account_selected_options` | privada | dueño | dueño | — | — | FK compuesta |
| `evaluation_attempts` | privada | dueño | dueño | RPC con motivo | — | FK compuesta |
| `account_status_history`, `payout_status_history` | privada append-only | dueño | dueño (valida trigger) | — | — | trigger rechaza UPD/DEL |
| `transactions` | privada financiera | dueño | dueño / RPC | **solo RPC** con motivo | — | importes inmutables, auditoría |
| `payouts` | privada financiera | dueño | dueño / RPC | **solo RPC** con motivo | — | auditoría |
| `trades` | privada financiera | dueño | dueño / RPC | **solo RPC** con motivo | — (anular) | auditoría, fingerprint |
| `strategies`, `instruments` (privados) | privada | dueño (+ globales en `instruments`) | dueño | dueño | — (archivar) | |
| `documents`, `document_links` | privada | dueño | dueño | estado solo vía RPC | — | ruta con prefijo `uid` |
| `document_extractions` | privada append-only | dueño | servidor con JWT del dueño | — | — | |
| `import_batches`, `export_jobs` | privada | dueño | dueño | RPC | — | |
| `record_changes`, `audit_log` | privada append-only | dueño | solo trigger | — | — | |
| `currencies`, `rule_keys`, `fx_rates` | referencia | autenticados | — (migración / tarea FX) | — | — | |

`uid` = `(select auth.uid())`; "owner" = `private.is_platform_owner()`. Toda tabla: `enable` + `force row level security`, `revoke all from anon`.

### Funciones RPC previstas

| Función | Seguridad | Comprobaciones |
|---------|-----------|----------------|
| `create_account_with_purchase`, `change_account_status`, `register_payout_*`, `rectify_transaction`, `void_transaction`, `update_*`, `void_trade`, `confirm_document`, `import_trades`, `revert_import`, `stats_*`, `request_export` | `SECURITY INVOKER` | RLS + `owner_id = auth.uid()` explícito + validación de que **todos** los IDs recibidos pertenecen al llamante (si no, el error es "no encontrado", sin revelar si existen) |
| `private.is_platform_owner`, `private.check_invitation`, `private.consume_invitation`, `private.audit_trigger`, `private.status_history_trigger` | `SECURITY DEFINER`, `search_path = ''`, esquema no expuesto | `revoke execute from public, anon, authenticated` salvo las imprescindibles; no reciben `owner_id` como parámetro |

**Regla de diseño:** ninguna RPC acepta `owner_id` o `user_id` como parámetro. El propietario siempre es `auth.uid()`.

### Storage

| Bucket | Público | Lectura | Escritura | Borrado |
|--------|---------|---------|-----------|---------|
| `documents` | no | carpeta `uid/` | carpeta `uid/` | nunca desde el cliente |
| `documents` → `uid/exports/` | no | carpeta `uid/` | solo el servidor, con el JWT del usuario | limpieza automática a las 24 h |
| `firm-logos` | sí | todos | solo el owner | solo el owner |

### Exportaciones

Se generan en servidor **con el JWT del usuario** (RLS aplica a cada consulta), nunca con `service_role`. El archivo se guarda en
`uid/exports/` y se descarga por URL firmada de 60 s. Ver doc 05 M10.

## 7. Límite aceptado: el administrador técnico y la base de datos (D4, **aprobada**)

> **Decisión aprobada (D4):** se acepta que el propietario técnico de la infraestructura tenga capacidad de acceso administrativo a Supabase.
> La aplicación garantiza que **ningún usuario**, incluido el propietario dentro de la app, pueda consultar datos privados de otro.

**Texto que verán todos los usuarios en el onboarding y en Ajustes → Privacidad:**

> *PropPilot aísla tus datos de los demás usuarios mediante seguridad en la base de datos: ningún otro usuario de la aplicación,
> incluido su administrador, puede ver tus cuentas, movimientos, operaciones, payouts ni documentos desde la aplicación.
> Sin embargo, la persona que administra la infraestructura (base de datos y copias de seguridad) tiene, por la naturaleza del servicio,
> capacidad técnica de acceso administrativo a los datos almacenados. Se compromete a no utilizarla salvo para mantenimiento
> o recuperación ante fallos, y ese acceso está protegido con doble factor.*

Hay que distinguir dos cosas:

1. **Dentro de la aplicación:** garantizado. No existe ruta, rol, política ni panel que muestre datos ajenos
   a ningún usuario, incluido el `platform_owner`. Se prueba en CI.
2. **Fuera de la aplicación (infraestructura):** quien es **propietario del proyecto en Supabase** puede abrir
   el editor SQL del panel de Supabase, que se conecta como superusuario y **no pasa por RLS**. Lo mismo
   ocurre con cualquier proveedor cloud. RLS protege a los usuarios entre sí, no frente al dueño de la infraestructura.

Opciones:

| Opción | Protege frente al admin | Coste |
|--------|-------------------------|-------|
| **A. Política + transparencia** (recomendada para empezar): acceso a la consola de Supabase solo con MFA, sin compartir credenciales; registro de auditoría de Supabase; los usuarios saben quién administra la infraestructura | Organizativamente | Ninguno |
| B. Cifrado de columnas sensibles en la BD (pgsodium/Vault) | No: las claves están en la misma BD/proyecto | Complejidad sin beneficio real frente al admin |
| C. Cifrado en el cliente con clave derivada de la contraseña del usuario | Sí | Rompe estadísticas en SQL, OCR en servidor, deduplicación y recuperación de contraseña (perder la contraseña = perder los datos). No recomendable para este producto |
| D. Que otra persona de confianza (no usuario) sea la propietaria del proyecto Supabase | Parcial: desplaza la confianza | Operativo |

**Resuelto: se adopta la opción A (D4 aprobada).** Medidas que la acompañan:
- La cuenta de Supabase del propietario técnico con MFA obligatoria, sin credenciales compartidas.
- No se crean usuarios de base de datos adicionales con `bypassrls`.
- Las copias de seguridad van cifradas y la clave solo la tiene el propietario técnico (doc 11 §4).
- La limitación se comunica por escrito a cada usuario (texto anterior) y cada usuario la acepta en su alta.

## 8. Otras medidas

- Sesiones con cookies `HttpOnly`, `Secure`, `SameSite=Lax` (gestión de `@supabase/ssr`).
- Middleware de Next.js que refresca la sesión y redirige a login; **pero la seguridad no depende de él**.
- MFA TOTP opcional para todos, **obligatoria para `platform_owner`** (recomendado, D13).
- Rate limiting en login, invitaciones y extracción de documentos.
- Eliminación de cuenta de usuario (RGPD): exportación completa + borrado controlado de todo su `owner_id`
  y su carpeta de Storage mediante un proceso explícito y auditado (decisión D11).
- Logs de aplicación sin importes, nombres de archivo ni contenido extraído (solo IDs).
