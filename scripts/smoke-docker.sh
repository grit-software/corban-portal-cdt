#!/bin/sh
# Arranca corban-cdt:local en el puerto 3300, pide /api/health y detiene el contenedor.
set -eu
nombre=corban-cdt-smoke
docker rm -f "$nombre" >/dev/null 2>&1 || true
docker run -d --rm --name "$nombre" -p 3300:3000 corban-cdt:local >/dev/null
trap 'docker stop "$nombre" >/dev/null 2>&1 || true' EXIT
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS http://127.0.0.1:3300/api/health | grep -q '"status":"ok"'; then
    echo "ok: el contenedor responde /api/health"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
docker logs "$nombre" >&2 || true
exit 1
