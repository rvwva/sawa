# Build context: monorepo root  (docker build -f apps/web/Dockerfile .)
# next.config.js already sets  output: 'standalone'
# ── Stage 1: install deps ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/

RUN npm ci --workspace=apps/web

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY --from=deps /app/node_modules node_modules/
COPY apps/web apps/web

RUN npm run build -w apps/web

# ── Stage 3: minimal production runner ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# The standalone output is a self-contained server with all required deps
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone   ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static       apps/web/.next/static/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public             apps/web/public/

USER nextjs
EXPOSE 3000

# next build --output standalone produces server.js at the project root inside standalone
CMD ["node", "apps/web/server.js"]
