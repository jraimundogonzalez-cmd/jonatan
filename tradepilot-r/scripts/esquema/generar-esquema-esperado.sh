#!/bin/bash
# Regenera supabase/esquema-esperado.txt: los objetos del esquema public que
# espera ESTA versión de TradePilot, cada uno con su ORIGEN (la migración o el
# fichero de funciones que lo crea). El diagnóstico de Windows lo compara con
# la base real para distinguir:
#   · lo que falta y traerá la actualización (origen = migración pendiente);
#   · lo que falta y debería estar (origen = migración ya aplicada) → bloqueo;
#   · lo que sobra (no está en esta versión) → bloqueo: trabajo desconocido.
#
# Necesita PostgreSQL local (psql, createdb, dropdb) y permisos de superusuario.
# Construye una base temporal desde cero, migración a migración, y la borra al
# terminar. Ejecútalo cada vez que cambie una migración o un fichero de
# funciones; el test de esquema avisa si se olvida.
#
# Uso: scripts/esquema/generar-esquema-esperado.sh   (desde tradepilot-r/)
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DB="tp_esquema_esperado_$$"
TMP="$(mktemp -d)"
chmod 755 "$TMP"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
como_pg() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
limpiar() { cd /tmp; como_pg dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpiar EXIT
cd /tmp
como_pg createdb "$DB"

aplicar() { cp "$1" "$TMP/f.sql"; chmod 644 "$TMP/f.sql"; como_pg "${PSQL[@]}" -f "$TMP/f.sql" >/dev/null; }
listar() { cp "$RAIZ/scripts/esquema/objetos.sql" "$TMP/o.sql"; chmod 644 "$TMP/o.sql"; como_pg psql -X -At -d "$DB" -f "$TMP/o.sql"; }

aplicar "$RAIZ/supabase/tests/00_local_test_setup.sql"
listar > "$TMP/antes.txt"
: > "$TMP/origen.txt"
anotar() {  # $1 = etiqueta de origen
  listar > "$TMP/despues.txt"
  comm -13 <(sort "$TMP/antes.txt") <(sort "$TMP/despues.txt") | sed "s#^#$1|#" >> "$TMP/origen.txt"
  cp "$TMP/despues.txt" "$TMP/antes.txt"
}
for f in "$RAIZ"/supabase/migrations/*.sql; do aplicar "$f"; anotar "migracion:$(basename "$f" .sql)"; done
# Los ficheros de funciones, en el orden de supabase/config.toml.
for rel in $(grep -o '"\./functions/sql/[A-Za-z0-9_-]*\.sql"' "$RAIZ/supabase/config.toml" | tr -d '"' | sed 's#^\./##'); do
  aplicar "$RAIZ/supabase/$rel"; anotar "funciones:$(basename "$rel")"
done
# Un objeto que una migración posterior elimina no debe quedar como esperado.
listar | sort > "$TMP/final.txt"
{
  echo "# Esquema public esperado por esta versión de TradePilot."
  echo "# GENERADO por scripts/esquema/generar-esquema-esperado.sh — no editar a mano."
  echo "# Formato: origen|tipo|objeto"
  for f in "$RAIZ"/supabase/migrations/*.sql; do echo "# migracion $(basename "$f" .sql)"; done
  awk -F'|' 'NR==FNR { final[$0]=1; next } { obj=$2 "|" $3; if (obj in final && !(obj in visto)) { visto[obj]=1; print } }' "$TMP/final.txt" "$TMP/origen.txt" | sort -t'|' -k2,3
} > "$RAIZ/supabase/esquema-esperado.txt"
echo "Escrito supabase/esquema-esperado.txt: $(grep -vc '^#' "$RAIZ/supabase/esquema-esperado.txt") objetos."
