#!/bin/sh
# Run Prisma migrations then hand off to the Node process.
# Using 'exec' replaces this shell with node so signals propagate correctly.
set -e

echo "[entrypoint] Running database migrations..."
node node_modules/.bin/prisma migrate deploy \
  --schema packages/database/prisma/schema.prisma

echo "[entrypoint] Migrations complete — starting API server"
exec node dist/index.js
