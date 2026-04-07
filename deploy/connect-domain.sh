#!/usr/bin/env bash
# ============================================================
# Mindlign — Domain & Load Balancer Setup
# Connects mindlign.com (Namecheap) → Cloud Run via Google's
# Global External Application Load Balancer in me-central2.
#
# Run ONCE after provision.sh has completed.
#
# Required env var:
#   export PROJECT_ID=your-gcp-project-id
#
# Optional (defaults shown):
#   export REGION=me-central2
#   export DOMAIN=mindlign.com
#
# What this creates:
#   - 1 global static IPv4 (the IP you add to Namecheap)
#   - 2 Serverless NEGs  (web + api Cloud Run services)
#   - 2 backend services (web + api)
#   - URL map with host rules (apex+www → web, api. → api)
#   - Google-managed SSL certificate (auto-provisioned + renewed)
#   - HTTPS target proxy + HTTPS forwarding rule (port 443)
#   - HTTP target proxy + HTTP forwarding rule (port 80 → 301 redirect)
# ============================================================
set -euo pipefail

GRN='\033[0;32m'; YLW='\033[1;33m'; BLU='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GRN}[✓]${NC} $*"; }
step() { echo -e "\n${BLU}━━ $* ━━${NC}"; }
warn() { echo -e "${YLW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
: "${PROJECT_ID:?Set PROJECT_ID before running}"
REGION="${REGION:-me-central2}"
DOMAIN="${DOMAIN:-mindlign.com}"
API_SUB="api.${DOMAIN}"
WWW_SUB="www.${DOMAIN}"

echo -e "\n${BLU}Mindlign — Load Balancer & Domain Setup${NC}"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Domains : $DOMAIN  $WWW_SUB  $API_SUB"
echo ""
read -rp "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || die "Aborted."

gcloud config set project "$PROJECT_ID"

# ── 1. Global static IPv4 ─────────────────────────────────────────────────────
step "Reserving global static IP"
if ! gcloud compute addresses describe mindlign-ip --global \
     --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute addresses create mindlign-ip \
    --global \
    --ip-version=IPV4 \
    --project="$PROJECT_ID"
  info "mindlign-ip reserved"
else
  info "mindlign-ip already exists"
fi

STATIC_IP=$(gcloud compute addresses describe mindlign-ip \
  --global --format='value(address)' --project="$PROJECT_ID")
info "Static IP: $STATIC_IP"

# ── 2. Serverless NEGs (one per Cloud Run service) ────────────────────────────
step "Serverless Network Endpoint Groups"

create_neg() {
  local name="$1" service="$2"
  if ! gcloud compute network-endpoint-groups describe "$name" \
       --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    gcloud compute network-endpoint-groups create "$name" \
      --region="$REGION" \
      --network-endpoint-type=serverless \
      --cloud-run-service="$service" \
      --project="$PROJECT_ID"
    info "NEG $name created"
  else
    info "NEG $name already exists"
  fi
}

create_neg mindlign-web-neg mindlign-web
create_neg mindlign-api-neg mindlign-api

# ── 3. Backend services ───────────────────────────────────────────────────────
step "Backend services"

create_backend() {
  local name="$1" neg="$2"
  if ! gcloud compute backend-services describe "$name" \
       --global --project="$PROJECT_ID" &>/dev/null; then
    gcloud compute backend-services create "$name" \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --global \
      --project="$PROJECT_ID"
    gcloud compute backend-services add-backend "$name" \
      --global \
      --network-endpoint-group="$neg" \
      --network-endpoint-group-region="$REGION" \
      --project="$PROJECT_ID"
    info "Backend $name created"
  else
    info "Backend $name already exists"
  fi
}

create_backend mindlign-web-backend mindlign-web-neg
create_backend mindlign-api-backend mindlign-api-neg

# ── 4. URL map (host-based routing) ──────────────────────────────────────────
step "URL map"
if ! gcloud compute url-maps describe mindlign-urlmap \
     --global --project="$PROJECT_ID" &>/dev/null; then
  # Create with web as default, then import full routing rules
  gcloud compute url-maps create mindlign-urlmap \
    --default-service="projects/${PROJECT_ID}/global/backendServices/mindlign-web-backend" \
    --global \
    --project="$PROJECT_ID"

  gcloud compute url-maps import mindlign-urlmap \
    --global \
    --project="$PROJECT_ID" \
    --source=- <<URLMAP
kind: compute#urlMap
name: mindlign-urlmap
defaultService: projects/${PROJECT_ID}/global/backendServices/mindlign-web-backend
hostRules:
  - hosts:
      - "${DOMAIN}"
      - "${WWW_SUB}"
    pathMatcher: web-matcher
  - hosts:
      - "${API_SUB}"
    pathMatcher: api-matcher
pathMatchers:
  - name: web-matcher
    defaultService: projects/${PROJECT_ID}/global/backendServices/mindlign-web-backend
  - name: api-matcher
    defaultService: projects/${PROJECT_ID}/global/backendServices/mindlign-api-backend
URLMAP
  info "URL map mindlign-urlmap created"
else
  info "URL map mindlign-urlmap already exists"
fi

# ── 5. Google-managed SSL certificate ────────────────────────────────────────
step "SSL certificate"
if ! gcloud compute ssl-certificates describe mindlign-cert \
     --global --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute ssl-certificates create mindlign-cert \
    --domains="${DOMAIN},${WWW_SUB},${API_SUB}" \
    --global \
    --project="$PROJECT_ID"
  info "SSL certificate mindlign-cert created (will provision after DNS is set)"
else
  info "SSL certificate mindlign-cert already exists"
fi

# ── 6. HTTPS proxy + forwarding rule ─────────────────────────────────────────
step "HTTPS proxy"
if ! gcloud compute target-https-proxies describe mindlign-https-proxy \
     --global --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute target-https-proxies create mindlign-https-proxy \
    --url-map=mindlign-urlmap \
    --ssl-certificates=mindlign-cert \
    --global \
    --project="$PROJECT_ID"
  info "HTTPS proxy created"
fi

if ! gcloud compute forwarding-rules describe mindlign-https-rule \
     --global --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute forwarding-rules create mindlign-https-rule \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --address=mindlign-ip \
    --global \
    --target-https-proxy=mindlign-https-proxy \
    --ports=443 \
    --project="$PROJECT_ID"
  info "HTTPS forwarding rule created (port 443)"
fi

# ── 7. HTTP → HTTPS redirect ──────────────────────────────────────────────────
step "HTTP → HTTPS redirect"
if ! gcloud compute url-maps describe mindlign-redirect-urlmap \
     --global --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute url-maps import mindlign-redirect-urlmap \
    --global \
    --project="$PROJECT_ID" \
    --source=- <<REDIRECT
kind: compute#urlMap
name: mindlign-redirect-urlmap
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
REDIRECT
  info "Redirect URL map created"
fi

if ! gcloud compute target-http-proxies describe mindlign-http-proxy \
     --global --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute target-http-proxies create mindlign-http-proxy \
    --url-map=mindlign-redirect-urlmap \
    --global \
    --project="$PROJECT_ID"
  info "HTTP proxy created"
fi

if ! gcloud compute forwarding-rules describe mindlign-http-rule \
     --global --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute forwarding-rules create mindlign-http-rule \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --address=mindlign-ip \
    --global \
    --target-http-proxy=mindlign-http-proxy \
    --ports=80 \
    --project="$PROJECT_ID"
  info "HTTP forwarding rule created (port 80 → 301)"
fi

# ── 8. Check certificate status ───────────────────────────────────────────────
CERT_STATUS=$(gcloud compute ssl-certificates describe mindlign-cert \
  --global --project="$PROJECT_ID" \
  --format='value(managed.status)' 2>/dev/null || echo "UNKNOWN")

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GRN}  Load balancer ready!${NC}"
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Static IP      : ${GRN}${STATIC_IP}${NC}"
echo "  SSL cert status: $CERT_STATUS"
echo ""
echo -e "${YLW}NOW add these DNS records at Namecheap:${NC}"
echo ""
echo "  Type | Host | Value          | TTL"
echo "  ─────┼──────┼────────────────┼──────"
echo "  A    | @    | ${STATIC_IP}   | Auto"
echo "  A    | www  | ${STATIC_IP}   | Auto"
echo "  A    | api  | ${STATIC_IP}   | Auto"
echo ""
echo -e "${YLW}AND update your Cloud Build trigger substitutions:${NC}"
echo "  _API_URL = https://${API_SUB}"
echo "  _WEB_URL = https://${DOMAIN}"
echo ""
echo "Then push a new commit to trigger a rebuild with the correct"
echo "NEXT_PUBLIC_API_URL baked into the web image."
echo ""
echo "SSL provisioning starts automatically once DNS propagates (~15–60 min)."
echo "Check status: gcloud compute ssl-certificates describe mindlign-cert --global"
echo ""
