#!/bin/sh
# Entrypoint de producción: migraciones reproducibles, seed opcional y arranque.
# No imprime secretos. Falla si las migraciones no se pueden aplicar.
set -eu

echo "Aplicando migraciones Prisma..."
npx prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Ejecutando seed idempotente..."
  node dist/prisma/seed.js
fi

echo "Iniciando API..."
exec node dist/src/main.js
