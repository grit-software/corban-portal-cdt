#!/bin/sh
# Arranca el servidor standalone ya construido (pnpm build), pide una ruta y lo detiene.
# Uso: sh scripts/smoke-standalone.sh <ruta> <texto-esperado> [codigo-http] [metodo]
# Sale 0 solo si la ruta responde con el código esperado (200 por defecto) y el cuerpo
# contiene el texto esperado. Carga .env si existe (node --env-file-if-exists).
# Puerto: 3100 (o SMOKE_PORT). HOSTNAME se fija a 127.0.0.1 porque server.js usa HOSTNAME
# para escuchar y algunos entornos lo traen con el nombre del contenedor.
set -eu

ruta="$1"
esperado="$2"
codigo="${3:-200}"
metodo="${4:-GET}"
puerto="${SMOKE_PORT:-3100}"

if [ ! -f .next/standalone/server.js ]; then
  echo "falta .next/standalone/server.js: ejecuta pnpm build primero" >&2
  exit 1
fi

mkdir -p .data
PORT="$puerto" HOSTNAME=127.0.0.1 node --env-file-if-exists=.env .next/standalone/server.js \
  >.data/smoke-standalone.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

estado="000"
intento=0
while [ "$intento" -lt 60 ]; do
  rm -f .data/smoke-cuerpo.txt
  estado=$(curl -s -X "$metodo" -o .data/smoke-cuerpo.txt -w '%{http_code}' \
    "http://127.0.0.1:$puerto$ruta" || true)
  if [ "$estado" = "$codigo" ] && grep -q -- "$esperado" .data/smoke-cuerpo.txt; then
    echo "ok: $metodo $ruta -> $estado"
    exit 0
  fi
  intento=$((intento + 1))
  sleep 1
done

echo "fallo: $metodo $ruta respondió $estado (esperado $codigo); ver .data/smoke-standalone.log" >&2
exit 1
