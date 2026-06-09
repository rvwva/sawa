#!/bin/sh
# Run Prisma migrations and seed, then hand off to the Node process.
# 'exec' replaces this shell with node so signals (SIGTERM etc.) propagate correctly.
set -ex

echo "=== STEP 1: Starting prisma migrate deploy ==="
node node_modules/.bin/prisma migrate deploy \
  --schema packages/database/prisma/schema.prisma
echo "=== STEP 1: Complete ==="

echo "=== STEP 2: Starting seed ==="
node node_modules/.bin/tsx packages/database/prisma/seed.ts
echo "=== STEP 2: Complete ==="

echo "=== STEP 3: Starting server ==="
exec node dist/index.js
