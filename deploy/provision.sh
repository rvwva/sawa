#!/usr/bin/env bash
# ============================================================
# Mindlign — GCP Infrastructure Provisioning
# Region: me-central2 (Dammam, Saudi Arabia)
#
# Run this ONCE to create all cloud resources.
# It is idempotent — safe to re-run.
#
# Prerequisites
#   gcloud CLI installed + authenticated (gcloud auth login)
#   A GCP project created and billing enabled
#
# Required env vars (set before running):
#   export PROJECT_ID=your-gcp-project-id
#   export API_URL=https://api.yourdomain.com      # your custom domain for the API
#   export WEB_URL=https://app.yourdomain.com      # your custom domain for the web app
#
# Optional (generated/prompted if not set):
#   SENDGRID_API_KEY   JWT_SECRET   REFRESH_TOKEN_SECRET   SCORING_KEY
# ============================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; BLU='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GRN}[✓]${NC} $*"; }
step()  { echo -e "\n${BLU}━━ $* ━━${NC}"; }
warn()  { echo -e "${YLW}[!]${NC} $*"; }
die()   { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
secret_or_prompt() {          # secret_or_prompt SECRET_NAME ENV_VAR "Prompt text"
  local name="$1" var="$2" prompt="$3"
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    info "Secret $name already exists — skipping"
    return
  fi
  local value="${!var:-}"
  if [[ -z "$value" ]]; then
    read -rsp "$prompt: " value; echo
  fi
  [[ -z "$value" ]] && die "$name is required"
  printf '%s' "$value" | gcloud secrets create "$name" \
    --data-file=- --project="$PROJECT_ID" --replication-policy=automatic
  info "Secret $name created"
}

# ── Validate inputs ───────────────────────────────────────────────────────────
: "${PROJECT_ID:?Set PROJECT_ID before running this script}"
: "${API_URL:?Set API_URL to your custom API domain, e.g. https://api.mindlign.sa}"
: "${WEB_URL:?Set WEB_URL to your custom web domain, e.g. https://app.mindlign.sa}"

REGION="${REGION:-me-central2}"
REPO="mindlign"
DB_INSTANCE="mindlign-postgres"
DB_NAME="mindlign"
DB_USER="mindlign"
AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_PREFIX="${AR_HOST}/${PROJECT_ID}/${REPO}"

echo -e "\n${BLU}Mindlign — GCP Provisioning${NC}"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  API URL : $API_URL"
echo "  Web URL : $WEB_URL"
echo ""
read -rp "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || die "Aborted."

gcloud config set project "$PROJECT_ID"

# ── 1. Enable APIs ────────────────────────────────────────────────────────────
step "Enabling GCP APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID"
info "APIs enabled"

# ── 2. Artifact Registry ──────────────────────────────────────────────────────
step "Artifact Registry"
if ! gcloud artifacts repositories describe "$REPO" \
     --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Mindlign container images" \
    --project="$PROJECT_ID"
  info "Repository $REPO created"
else
  info "Repository $REPO already exists"
fi

# Authorise Cloud Build to push to Artifact Registry
gcloud artifacts repositories add-iam-policy-binding "$REPO" \
  --location="$REGION" \
  --member="serviceAccount:$(gcloud projects describe "$PROJECT_ID" \
      --format='value(projectNumber)')@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" \
  --project="$PROJECT_ID" &>/dev/null || true

# ── 3. Cloud SQL (PostgreSQL 16) ──────────────────────────────────────────────
step "Cloud SQL"
if ! gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" &>/dev/null; then
  warn "Creating Cloud SQL instance — this takes 5–10 minutes…"
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-g1-small \
    --region="$REGION" \
    --storage-type=SSD \
    --storage-size=20GB \
    --availability-type=ZONAL \
    --no-assign-ip \
    --project="$PROJECT_ID"
  info "Cloud SQL instance $DB_INSTANCE created"
else
  info "Cloud SQL instance $DB_INSTANCE already exists"
fi

# Database
if ! gcloud sql databases describe "$DB_NAME" \
     --instance="$DB_INSTANCE" --project="$PROJECT_ID" &>/dev/null; then
  gcloud sql databases create "$DB_NAME" \
    --instance="$DB_INSTANCE" --project="$PROJECT_ID"
  info "Database $DB_NAME created"
fi

# DB user (generate a strong password, stored in Secret Manager)
CONNECTION_NAME="$(gcloud sql instances describe "$DB_INSTANCE" \
  --project="$PROJECT_ID" --format='value(connectionName)')"

step "Secrets"
if ! gcloud secrets describe mindlign-database-url \
     --project="$PROJECT_ID" &>/dev/null; then
  DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 40)"
  gcloud sql users create "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD" \
    --project="$PROJECT_ID" 2>/dev/null || true
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
  printf '%s' "$DATABASE_URL" | gcloud secrets create mindlign-database-url \
    --data-file=- --project="$PROJECT_ID" --replication-policy=automatic
  info "Secret mindlign-database-url created"
  warn "DB password stored only in Secret Manager — not shown here"
else
  info "Secret mindlign-database-url already exists"
fi

# Application secrets
secret_or_prompt "mindlign-jwt-secret"          JWT_SECRET          "JWT secret (64 random chars)"
secret_or_prompt "mindlign-refresh-secret"      REFRESH_TOKEN_SECRET "Refresh token secret (64 random chars)"
secret_or_prompt "mindlign-sendgrid-key"        SENDGRID_API_KEY    "SendGrid API key"
secret_or_prompt "mindlign-scoring-key"         SCORING_KEY         "Scoring service API key (any random string)"

# ── 4. Service accounts ───────────────────────────────────────────────────────
step "Service Accounts"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

create_sa() {
  local name="$1" display="$2"
  if ! gcloud iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" \
       --project="$PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts create "$name" \
      --display-name="$display" --project="$PROJECT_ID"
    info "Service account $name created"
  else
    info "Service account $name already exists"
  fi
}

bind() { # bind SA_EMAIL ROLE
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$1" --role="$2" --condition=None &>/dev/null || true
}

create_sa mindlign-api-sa     "Mindlign API"
create_sa mindlign-scoring-sa "Mindlign Scoring"
create_sa mindlign-web-sa     "Mindlign Web"

API_SA="mindlign-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
bind "$API_SA" "roles/cloudsql.client"
bind "$API_SA" "roles/secretmanager.secretAccessor"
bind "$API_SA" "roles/run.invoker"   # allow API to call scoring (internal)

WEB_SA="mindlign-web-sa@${PROJECT_ID}.iam.gserviceaccount.com"
# Web SA has no special permissions (it just serves Next.js)

# Cloud Build SA needs to deploy Cloud Run services
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
bind "$CB_SA" "roles/run.admin"
bind "$CB_SA" "roles/iam.serviceAccountUser"
bind "$CB_SA" "roles/secretmanager.secretAccessor"

info "IAM bindings applied"

# ── 5. Initial Cloud Run service stubs ────────────────────────────────────────
# We create placeholder services so Cloud Build's update steps work on first run.
# The actual image will be replaced by the first Cloud Build trigger run.
step "Cloud Run services (initial stubs)"

PLACEHOLDER="us-docker.pkg.dev/cloudrun/container/hello"

deploy_stub() {
  local svc="$1"; shift
  if ! gcloud run services describe "$svc" \
       --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    gcloud run services replace - --region="$REGION" --project="$PROJECT_ID" \
      --format=none <<YAML
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: $svc
  annotations:
    run.googleapis.com/ingress: "$1"
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
    spec:
      serviceAccountName: "$2"
      containers:
        - image: $PLACEHOLDER
YAML
    info "Stub service $svc created"
  else
    info "Service $svc already exists"
  fi
}

deploy_stub mindlign-scoring "internal"      "mindlign-scoring-sa@${PROJECT_ID}.iam.gserviceaccount.com"
deploy_stub mindlign-api     "all"           "$API_SA"
deploy_stub mindlign-web     "all"           "mindlign-web-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Allow unauthenticated invocations on public services
for svc in mindlign-api mindlign-web; do
  gcloud run services add-iam-policy-binding "$svc" \
    --region="$REGION" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --project="$PROJECT_ID" &>/dev/null || true
done

# Allow API SA to invoke scoring (internal service)
gcloud run services add-iam-policy-binding "mindlign-scoring" \
  --region="$REGION" \
  --member="serviceAccount:${API_SA}" \
  --role="roles/run.invoker" \
  --project="$PROJECT_ID" &>/dev/null || true

# ── 6. Cloud Build trigger ────────────────────────────────────────────────────
step "Cloud Build trigger"
warn "Skipping automatic trigger creation — connect your repo manually:"
echo "  1. Open: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo "  2. Click 'Connect repository' and link rvwva/sawa"
echo "  3. Create trigger:"
echo "     - Event: Push to branch  claude/sawa-platform-setup-kZCD0 (or main)"
echo "     - Config: deploy/cloudbuild.yaml"
echo "     - Substitutions:"
echo "       _REGION  = $REGION"
echo "       _REPO    = $REPO"
echo "       _API_URL = $API_URL"
echo "       _WEB_URL = $WEB_URL"

# ── 7. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GRN}  Provisioning complete!${NC}"
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Cloud SQL connection: $CONNECTION_NAME"
echo "Artifact Registry  : ${IMAGE_PREFIX}/<service>:<tag>"
echo ""
echo "Next steps:"
echo "  1. Map custom domains in Cloud Run console:"
echo "     - $API_URL  → mindlign-api"
echo "     - $WEB_URL  → mindlign-web"
echo "  2. Connect your GitHub repo and create the Cloud Build trigger (see above)"
echo "  3. Push a commit to trigger your first deployment"
echo "  4. Update EMAIL_FROM in Secret Manager if needed"
echo ""
