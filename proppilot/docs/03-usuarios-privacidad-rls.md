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

## 7. Límite honesto: el administrador técnico y la base de datos

Tú pediste que el administrador técnico no tenga acceso automático a los datos financieros de los demás.
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

**Es una decisión que debes tomar tú (D4)**, y conviene comunicarla a tu mujer y a tu amigo con claridad.

## 8. Otras medidas

- Sesiones con cookies `HttpOnly`, `Secure`, `SameSite=Lax` (gestión de `@supabase/ssr`).
- Middleware de Next.js que refresca la sesión y redirige a login; **pero la seguridad no depende de él**.
- MFA TOTP opcional para todos, **obligatoria para `platform_owner`** (recomendado, D13).
- Rate limiting en login, invitaciones y extracción de documentos.
- Eliminación de cuenta de usuario (RGPD): exportación completa + borrado controlado de todo su `owner_id`
  y su carpeta de Storage mediante un proceso explícito y auditado (decisión D11).
- Logs de aplicación sin importes, nombres de archivo ni contenido extraído (solo IDs).
