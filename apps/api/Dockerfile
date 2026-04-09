# Build context: monorepo root  (docker build -f apps/api/Dockerfile .)
# ── Stage 1: install + build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first so Docker can cache the npm ci layer
COPY package*.json ./
COPY packages/database/package*.json packages/database/
COPY apps/api/package*.json           apps/api/

RUN npm ci --workspace=apps/api --workspace=packages/database

# Copy source
COPY packages/database packages/database
COPY apps/api           apps/api

# Generate Prisma client (requires schema, not a DB connection)
RUN node_modules/.bin/prisma generate \
      --schema=packages/database/prisma/schema.prisma

# Compile TypeScript
RUN npm run build -w apps/api

# Prune devDependencies from node_modules before copying to runner
RUN npm prune --omit=dev --workspace=apps/api --workspace=packages/database

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 apiuser

# Compiled output
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist              dist/
# Runtime deps (includes @prisma/client + .prisma/client native binaries)
COPY --from=builder --chown=apiuser:nodejs /app/node_modules               node_modules/
# Prisma schema + migrations + seed (needed at startup)
COPY --from=builder --chown=apiuser:nodejs /app/packages/database/prisma   packages/database/prisma/
# Scoring definitions (imported by seed.ts for survey schema data)
COPY --from=builder --chown=apiuser:nodejs /app/packages/scoring/definitions packages/scoring/definitions/
# Startup script
COPY --chown=apiuser:nodejs apps/api/docker-entrypoint.sh entrypoint.sh
RUN chmod +x entrypoint.sh

USER apiuser
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
