#!/bin/sh
# OPCIONAL, para Linux o uso manual. Los scripts de Windows ya NO lo usan: su
# verificación (scripts/windows/comun.ps1) solo necesita psql y pg_restore,
# porque sh/awk/wc no están garantizados en la imagen de Supabase.
#
# Verifica una copia de seguridad hecha con `pg_dump -Fc` contando, tabla a
# tabla, las filas de la base viva y las que contiene la copia. No restaura
# nada ni escribe en la base: solo lee.
#
# Se ejecuta DENTRO del contenedor de la base (ver IMPORTAR-OPERACIONES.md):
#   docker cp scripts\respaldo\verificar-respaldo.sh supabase_db_tradepilot-r:/tmp/verificar-respaldo.sh
#   docker exec supabase_db_tradepilot-r sh /tmp/verificar-respaldo.sh /tmp/respaldo.dump
#
# Sale con código 0 solo si todos los recuentos coinciden.
DUMP="${1:-/tmp/respaldo.dump}"
PSQL="psql -U ${PGUSER:-postgres} -d ${PGDATABASE:-postgres} -X -At"

if [ ! -s "$DUMP" ]; then
  echo "FALLO: no existe la copia $DUMP o está vacía"
  exit 1
fi

fallos=0
for t in accounts trades trade_partials_executed trade_partials_planned account_capital_events audit_log management_plans management_intents; do
  vivo=$($PSQL -c "select count(*) from public.$t" 2>/dev/null)
  if [ -z "$vivo" ]; then
    echo "AVISO: la tabla $t no existe en la base viva; se omite"
    continue
  fi
  # Las filas de una tabla van entre su línea COPY y la línea "\." final.
  copia=$(pg_restore --data-only --table="$t" -f - "$DUMP" | awk '/^COPY /{c=1;next} /^\\\.$/{c=0} c' | wc -l | tr -d ' ')
  if [ "$vivo" = "$copia" ]; then
    printf 'OK     %-26s viva=%-7s copia=%s\n' "$t" "$vivo" "$copia"
  else
    printf 'FALLO  %-26s viva=%-7s copia=%s\n' "$t" "$vivo" "$copia"
    fallos=$((fallos + 1))
  fi
done

if [ "$fallos" -ne 0 ]; then
  echo "LA COPIA NO COINCIDE CON LA BASE ($fallos tablas). No apliques la actualización."
  exit 1
fi
echo "COPIA VERIFICADA: todos los recuentos coinciden."
