#!/bin/sh
# Bootstrap de Corban CDT — mismos comandos que el bloque de §10 del blueprint (más este encabezado).
# Se ejecuta desde la RAÍZ del proyecto, con el bundle en blueprints/corban-portal-cdt/.
# Es seguro ejecutarlo dos veces: cada línea es idempotente y sale 0 en el camino "ya hecho".
# No necesita Docker: los servicios se levantan en el Verify del paso 2.
#
# order matters: copia del workspace (trae .gitignore con sus excepciones, biome.json con sus
# exclusiones y pnpm-workspace.yaml) → .env desde la plantilla → repo git → primer commit
# → toolchain (corepack/pnpm) → pnpm install. El .gitignore existe ANTES del primer commit.
set -eu

BUNDLE=blueprints/corban-portal-cdt

# 1. Copia NO destructiva del workspace: solo crea archivos que aún no existen.
#    Portable (GNU y BSD): no usa `cp -n` (en BSD sale 1 al saltar) ni rsync (puede no existir).
#    Nunca sobrescribe package.json, pnpm-lock.yaml ni ningún archivo que un paso haya editado.
(cd "$BUNDLE/workspace" && find . -type f) | while IFS= read -r f; do
  [ -e "$f" ] || { mkdir -p "$(dirname "$f")" && cp -p "$BUNDLE/workspace/$f" "$f"; }
done

# 2. .env local desde la plantilla; nunca se sobrescribe uno existente.
[ -e .env ] || cp .env.example .env

# 3. Repositorio propio del proyecto (no se asume que exista), identidad local si falta,
#    y un primer commit para que los tags de Checkpoint tengan a qué apuntar.
[ -d .git ] || git init -b main
git config user.email >/dev/null || git config user.email "constructor@corbanfc.local"
git config user.name >/dev/null || git config user.name "Constructor Corban CDT"
git rev-parse --verify -q HEAD >/dev/null || { git add -A && git commit -q -m "chore: bootstrap del workspace"; }

# 4. Toolchain: pnpm 12.16.1. `corepack enable` sin directorio falla con EACCES donde el bin
#    global no es escribible; se usa un directorio del usuario. Sin corepack (Node >= 25), npm.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
if command -v corepack >/dev/null 2>&1; then
  corepack enable --install-directory "$HOME/.local/bin"
  corepack prepare pnpm@12.16.1 --activate
else
  npm install -g --prefix "$HOME/.local" pnpm@12.16.1
fi
pnpm --version

# 5. Dependencias. La primera vez crea pnpm-lock.yaml (el paso 1 lo commitea); CI usa
#    --frozen-lockfile. pnpm install no reescribe package.json.
pnpm install
