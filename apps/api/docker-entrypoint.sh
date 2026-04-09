#!/bin/sh
# Run Prisma migrations and seed, then hand off to the Node process.
# 'exec' replaces this shell with node so signals (SIGTERM etc.) propagate correctly.
set -e

# 1. Apply any pending migrations (idempotent — uses advisory lock)
echo "[entrypoint] Running database migrations..."
node node_modules/.bin/prisma migrate deploy \
  --schema packages/database/prisma/schema.prisma

# 2. Seed assessment definitions + admin user (all upserts — safe to repeat)
#    Reads ADMIN_EMAIL + ADMIN_PASSWORD from env (injected via Secret Manager on Cloud Run).
#    Set SKIP_DEMO_ORG=true in production to skip the demo organisation.
echo "[entrypoint] Running seed..."
node node_modules/.bin/tsx packages/database/prisma/seed.ts

echo "[entrypoint] Startup complete — starting API server"
exec node dist/index.js
