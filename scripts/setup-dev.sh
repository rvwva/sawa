#!/usr/bin/env bash
# ============================================================
# Sawa Platform — Development Setup Script
# Usage: ./scripts/setup-dev.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[setup]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ─── 1. Check prerequisites ───────────────────────────────────────────────────
info "Checking prerequisites…"
command -v node   >/dev/null || error "Node.js ≥ 20 is required"
command -v npm    >/dev/null || error "npm ≥ 10 is required"
command -v psql   >/dev/null || warn  "psql not found — make sure PostgreSQL is running via Docker"
command -v python3 >/dev/null || warn "Python 3 not found — scoring service won't start locally"

NODE_VERSION=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js 20+ is required (found v$NODE_VERSION)"
fi
info "Node.js v$(node -v) ✓"

# ─── 2. Copy .env if missing ──────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Creating .env from .env.example…"
  cp .env.example .env
  warn "Review .env and update secrets before running in production!"
else
  info ".env already exists — skipping copy"
fi

# ─── 3. Install npm dependencies ─────────────────────────────────────────────
info "Installing npm workspaces dependencies…"
npm install

# ─── 4. Generate Prisma client ────────────────────────────────────────────────
info "Generating Prisma client…"
cd packages/database
npm run generate
cd "$ROOT_DIR"

# ─── 5. Start PostgreSQL (Docker Compose) ────────────────────────────────────
if command -v docker &>/dev/null; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "sawa.*postgres"; then
    info "Starting PostgreSQL via Docker Compose…"
    docker compose up -d postgres
    info "Waiting for PostgreSQL to be ready…"
    for i in $(seq 1 30); do
      if docker compose exec -T postgres pg_isready -U sawa -d sawa_db &>/dev/null; then
        info "PostgreSQL ready ✓"
        break
      fi
      if [ $i -eq 30 ]; then
        error "PostgreSQL failed to start within 30s"
      fi
      sleep 1
    done
  else
    info "PostgreSQL already running ✓"
  fi
else
  warn "Docker not found — assuming PostgreSQL is already running on localhost:5432"
fi

# ─── 6. Run Prisma migrations ─────────────────────────────────────────────────
info "Running database migrations…"
cd packages/database
DATABASE_URL="${DATABASE_URL:-postgresql://sawa:changeme@localhost:5432/sawa_db}" \
  npx prisma migrate deploy
cd "$ROOT_DIR"
info "Migrations applied ✓"

# ─── 7. Seed database ─────────────────────────────────────────────────────────
read -r -p "Seed the database with assessment definitions + demo org? [Y/n] " yn
yn="${yn:-Y}"
if [[ "$yn" =~ ^[Yy]$ ]]; then
  info "Seeding database…"
  cd packages/database
  DATABASE_URL="${DATABASE_URL:-postgresql://sawa:changeme@localhost:5432/sawa_db}" \
    npm run seed
  cd "$ROOT_DIR"
  info "Seed complete ✓"
fi

# ─── 8. Start scoring service (optional) ─────────────────────────────────────
if command -v python3 &>/dev/null; then
  read -r -p "Start Python scoring service in background? [Y/n] " py
  py="${py:-Y}"
  if [[ "$py" =~ ^[Yy]$ ]]; then
    cd packages/scoring
    if [ ! -d .venv ]; then
      info "Creating Python virtual environment…"
      python3 -m venv .venv
    fi
    source .venv/bin/activate
    pip install -q -r requirements.txt
    SCORING_SERVICE_API_KEY="${SCORING_SERVICE_API_KEY:-dev-scoring-key}" \
      uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
    SCORING_PID=$!
    info "Scoring service started (PID $SCORING_PID) on http://localhost:8000"
    deactivate
    cd "$ROOT_DIR"
  fi
fi

# ─── 9. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Sawa dev environment ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Start the API:    cd apps/api && npm run dev"
echo "  Start the web:    cd apps/web && npm run dev"
echo "  Prisma Studio:    cd packages/database && npm run studio"
echo "  Scoring service:  http://localhost:8000/docs"
echo ""
echo "  API health:       http://localhost:4000/api/health"
echo "  Web app:          http://localhost:3000"
echo ""
