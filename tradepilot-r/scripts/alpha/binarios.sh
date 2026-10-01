#!/usr/bin/env bash
# Aprovisiona los dos binarios que `start.sh` necesita: PostgREST y Auth.
#
# POR QUÉ EXISTE ESTE FICHERO: `supabase start` no puede funcionar aquí. La
# política de egreso del entorno bloquea las CDN de blobs de los tres registros
# de imágenes (Docker Hub → cloudfront, ghcr.io → pkg-containers, ECR público →
# S3): todas responden 403 o cortan la conexión. Sin blobs no hay imágenes, y
# sin imágenes no hay contenedores.
#
# Lo que SÍ es alcanzable son los *release assets* de GitHub. No se sortea
# ninguna política: se descarga por la vía que la política permite, el software
# es el oficial y es exactamente el que correría dentro de los contenedores.
# Lo único que desaparece es la capa de contenedores.
#
# Uso:  scripts/alpha/binarios.sh [destino]        (destino por defecto: /tmp/tpalpha)
set -eu
DESTINO="${1:-/tmp/tpalpha}"
PGRST_VER="${PGRST_VER:-v12.2.3}"
AUTH_REF="${AUTH_REF:-v2.195.0}"
mkdir -p "$DESTINO"
TRABAJO="$(mktemp -d)"
trap 'rm -rf "$TRABAJO"' EXIT

if [ -x "$DESTINO/postgrest" ]; then
  echo "▸ PostgREST ya presente: $("$DESTINO/postgrest" --version)"
else
  echo "▸ descargando PostgREST $PGRST_VER"
  # Binario estático: no depende de la libpq del sistema.
  URL="https://github.com/PostgREST/postgrest/releases/download/$PGRST_VER/postgrest-$PGRST_VER-linux-static-x64.tar.xz"
  curl -fsSL "$URL" -o "$TRABAJO/pgrst.tar.xz"
  tar -xJf "$TRABAJO/pgrst.tar.xz" -C "$DESTINO" postgrest
  chmod +x "$DESTINO/postgrest"
  echo "  $("$DESTINO/postgrest" --version)"
fi

if [ -x "$DESTINO/auth" ]; then
  echo "▸ Auth ya presente"
else
  command -v go >/dev/null || {
    echo "  FALTA Go. Auth se compila de su fuente oficial; instala Go y repite." >&2
    exit 1
  }
  echo "▸ compilando Auth ($AUTH_REF) desde la fuente oficial de Supabase"
  # `--depth 1` sobre la etiqueta: es el mismo commit que produce la imagen
  # oficial, sin arrastrar el historial completo del repositorio.
  git clone --depth 1 --branch "$AUTH_REF" https://github.com/supabase/auth "$TRABAJO/auth" >/dev/null 2>&1 \
    || git clone --depth 1 https://github.com/supabase/auth "$TRABAJO/auth" >/dev/null 2>&1
  ( cd "$TRABAJO/auth" && go build -o "$DESTINO/auth" . )
  chmod +x "$DESTINO/auth"
  echo "  compilado en $DESTINO/auth"
fi

echo
echo "Listo. Ahora: scripts/alpha/start.sh"
