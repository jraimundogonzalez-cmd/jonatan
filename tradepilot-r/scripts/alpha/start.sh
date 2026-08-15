#!/usr/bin/env bash
# Entorno Alpha de TradePilot — los servicios REALES de Supabase corriendo como
# procesos nativos en vez de contenedores.
#
# Por qué nativos: la política de egreso de este entorno bloquea las CDN de
# blobs de los tres registros de imágenes (Docker Hub, ghcr.io y ECR público),
# así que `supabase start` no puede descargar nada. Los binarios sí son
# alcanzables: PostgREST desde sus release assets de GitHub y Auth compilado
# desde el repositorio oficial de Supabase. Es el mismo software que correría
# dentro de los contenedores, sin la capa de contenedores.
#
# Nada de esto sustituye ni simula el dominio: PostgreSQL es real, RLS está
# vigente, PostgREST es el oficial y Auth es el de Supabase compilado de su
# fuente. Lo único reducido es el buzón de correo (ver smtp-capture.mjs).
set -u
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
DB="${TP_ALPHA_DB:-tpalpha}"
RUN=/tmp/tpalpha
mkdir -p "$RUN"

# Secreto de firma JWT del entorno LOCAL de Supabase — el mismo valor público
# que usa `supabase start`. No es una credencial: sirve para que PostgREST y
# Auth se reconozcan entre sí en esta máquina. Nunca debe viajar a un entorno
# real, donde el secreto lo genera la plataforma.
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

for b in postgrest auth; do
  [ -x "$RUN/$b" ] || { echo "Falta $RUN/$b — ejecuta antes: $AQUI/binarios.sh $RUN"; exit 1; }
done

echo "▸ PostgreSQL"
service postgresql start >/dev/null 2>&1
for i in $(seq 1 20); do su postgres -c "psql -tAc 'select 1'" >/dev/null 2>&1 && break; sleep 1; done

if [ "${TP_ALPHA_RESET:-0}" = "1" ] || ! su postgres -c "psql -lqt" | cut -d'|' -f1 | grep -qw "$DB"; then
  echo "▸ creando base $DB desde cero"
  # Los servicios anteriores mantienen conexiones abiertas: sin cerrarlas,
  # `dropdb` falla y la base queda a medio construir.
  pkill -f "postgrest $RUN" 2>/dev/null; pkill -f "$RUN/auth serve" 2>/dev/null; pkill -f "$AQUI/gateway.mjs" 2>/dev/null; sleep 1
  su postgres -c "psql -qd postgres -c \"select pg_terminate_backend(pid) from pg_stat_activity where datname='$DB'\"" >/dev/null 2>&1
  su postgres -c "dropdb --if-exists $DB" || exit 1
  su postgres -c "createdb $DB" || exit 1
  su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $AQUI/00_roles_y_helpers.sql"

  echo "▸ migraciones de Auth (GoTrue construye su propio esquema)"
  ( set -a; . "$AQUI/auth.env"; set +a; cd "$RUN" && "$RUN/auth" migrate ) 2>&1 | grep -E "applied|fatal" || true

  su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $AQUI/01_auth_helpers.sql"

  echo "▸ migraciones del producto"
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $f" >/dev/null || { echo "  FALLO $(basename "$f")"; exit 1; }
  done
  for f in funding operations management_intent; do
    su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $RAIZ/supabase/functions/sql/$f.sql" >/dev/null || { echo "  FALLO $f"; exit 1; }
  done
  su postgres -c "psql -q -d $DB -c \"grant select, insert, update, delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated, anon; grant usage, select on all sequences in schema public to authenticated;\"" >/dev/null
fi

# El gateway se quedaba vivo entre reinicios (BUILD 020 no lo mataba): seguía
# ocupando :54321 con su versión antigua y los cambios no tenían efecto.
pkill -f "postgrest $RUN" 2>/dev/null; pkill -f "$RUN/auth serve" 2>/dev/null
pkill -f "$AQUI/smtp-capture.mjs" 2>/dev/null; pkill -f "$AQUI/gateway.mjs" 2>/dev/null; sleep 1

echo "▸ SMTP de captura (:2500)"
(node "$AQUI/smtp-capture.mjs" > "$RUN/smtp.log" 2>&1 &)

echo "▸ Gateway Supabase (:54321) — enruta /rest/v1, /auth/v1 y las plantillas"
# Antes que Auth a propósito: Auth descarga de aquí sus plantillas de correo.
(node "$AQUI/gateway.mjs" > "$RUN/gateway.log" 2>&1 &)
sleep 1

echo "▸ Auth (:54322)"
# Las plantillas de correo las sirve el gateway por HTTP: GoTrue sólo sabe
# descargarlas así (una URL `file://` se ignora sin avisar). Ver
# `plantillas/magic-link.html` para el porqué de la plantilla en sí.
( set -a; . "$AQUI/auth.env"
  GOTRUE_MAILER_TEMPLATES_MAGIC_LINK="http://127.0.0.1:54321/plantillas/magic-link.html"
  GOTRUE_MAILER_TEMPLATES_CONFIRMATION="http://127.0.0.1:54321/plantillas/confirmacion.html"
  set +a; cd "$RUN" && "$RUN/auth" serve > "$RUN/auth.log" 2>&1 & )

echo "▸ PostgREST (:54321)"
cat > "$RUN/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:tpalpha@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 54320
server-host = "127.0.0.1"
db-pool = 10
CONF
("$RUN/postgrest" "$RUN/postgrest.conf" > "$RUN/postgrest.log" 2>&1 &)

sleep 6
echo
echo "  API Supabase   http://127.0.0.1:54321"
echo "  buzón          $RUN/buzon.txt"
echo "  logs           $RUN/{auth,postgrest,gateway,smtp}.log"
