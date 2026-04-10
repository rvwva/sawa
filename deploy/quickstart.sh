#!/usr/bin/env bash
# ============================================================
# Mindlign — One-Command Deployment to GCP me-central2
#
# Pre-configured for:
#   Project : mindlign
#   Region  : me-central2 (Dammam, KSA)
#   Domains : mindlign.com / www.mindlign.com / api.mindlign.com
#
# Prerequisites (on your local machine):
#   1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
#   2. gcloud auth login
#   3. gcloud auth application-default login
#
# Usage:
#   cd deploy
#   bash quickstart.sh
#
# Have these ready when prompted:
#   - SendGrid API key  (for employee invitation & reminder emails)
#   - Admin email       (your platform admin login email)
#   - Admin password    (min 12 chars — stored in Secret Manager)
#
# JWT secrets and the scoring key are auto-generated if not set.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Pre-configured values ─────────────────────────────────────────────────────
export PROJECT_ID="mindlign"
export REGION="me-central2"
export API_URL="https://api.mindlign.com"
export WEB_URL="https://mindlign.com"

# Auto-generate secrets if not already set
if [[ -z "${JWT_SECRET:-}" ]]; then
  export JWT_SECRET="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 64)"
  echo "[auto] Generated JWT_SECRET"
fi
if [[ -z "${REFRESH_TOKEN_SECRET:-}" ]]; then
  export REFRESH_TOKEN_SECRET="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 64)"
  echo "[auto] Generated REFRESH_TOKEN_SECRET"
fi
if [[ -z "${SCORING_KEY:-}" ]]; then
  export SCORING_KEY="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
  echo "[auto] Generated SCORING_KEY"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    Mindlign — GCP Deployment Quickstart              ║"
echo "║    Project : mindlign                                ║"
echo "║    Region  : me-central2 (Dammam, KSA)              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Verify gcloud auth ────────────────────────────────────────────────
echo "Checking gcloud authentication..."
if ! gcloud auth print-access-token &>/dev/null; then
  echo ""
  echo "ERROR: Not authenticated with gcloud."
  echo "Run: gcloud auth login"
  exit 1
fi
echo "  ✓ Authenticated as: $(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1)"
echo ""

# ── Step 2: Infrastructure provisioning ──────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1/2: Provisioning GCP infrastructure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
bash "${SCRIPT_DIR}/provision.sh"

# ── Step 3: Load balancer + static IP ─────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2/2: Setting up Load Balancer + Static IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
bash "${SCRIPT_DIR}/connect-domain.sh"
