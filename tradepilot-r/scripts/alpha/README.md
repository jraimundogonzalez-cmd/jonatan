# Entorno Alpha

Levanta TradePilot para **usarlo en un navegador**: PostgreSQL con todas las
migraciones y funciones del producto, PostgREST, Supabase Auth y la aplicación
Next.js.

```bash
scripts/alpha/binarios.sh      # una vez: descarga PostgREST y compila Auth
scripts/alpha/start.sh         # cada vez: levanta la pila
npm run dev --workspace=@tradepilot/web
```

Con `TP_ALPHA_RESET=1 scripts/alpha/start.sh` la base se reconstruye desde cero.

| Servicio | Puerto | Qué es |
|---|---|---|
| PostgreSQL | 5432 | El de siempre, con RLS vigente |
| PostgREST | 54320 | El oficial, 12.2.3 |
| Auth (GoTrue) | 54322 | El de Supabase, compilado de su fuente |
| Gateway | 54321 | Enruta `/rest/v1` y `/auth/v1`, como Kong |
| SMTP de captura | 2500 | Escribe los correos en `/tmp/tpalpha/buzon.txt` |

`apps/web/.env.local` no está versionado (`.gitignore`). Créalo así — la clave
es un JWT de rol `anon` firmado con el secreto local de Supabase, válido sólo
para esta pila:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWFscGhhIiwiZXhwIjoxOTgzODEyOTk2fQ.HFsOI1C3biQgvuOs62hNgcGxVLv6Ld5NUmnLJWlLiw8
```

## Por qué no es `supabase start`

La política de egreso de este entorno bloquea las CDN de blobs de los tres
registros de imágenes (Docker Hub, ghcr.io y ECR público): 403 o conexión
cortada. Sin blobs no hay imágenes y sin imágenes no hay contenedores. Los
*release assets* de GitHub sí son alcanzables, así que los binarios se obtienen
por ahí. No se sortea ninguna política de red: es la vía que la política
permite, y el software es el oficial, el mismo que correría dentro de los
contenedores. Lo único que falta es la capa de contenedores.

## Qué es real y qué no

Real: PostgreSQL, el esquema completo, RLS, los triggers de dominio, las RPC,
PostgREST, Auth y sus 70 migraciones, el login por *magic link* de principio a
fin. Nada del dominio está simulado.

Reducido: **sólo el buzón de correo**. `smtp-capture.mjs` habla SMTP lo justo
para aceptar el mensaje que envía Auth y volcarlo a un fichero, en lugar de
levantar Inbucket. El correo no es dominio; el enlace que contiene sí, y ése lo
genera Auth de verdad.

## Inicio de sesión

`start.sh` no crea ningún usuario. Para entrar, pide el enlace desde la propia
pantalla de acceso de la aplicación y recógelo de `/tmp/tpalpha/buzon.txt`.
