-- ============================================================
-- Sawa Platform — Initial PostgreSQL Migration
-- Generated for Prisma ORM
-- ============================================================

-- ─── Enums ──────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EXECUTIVE', 'EMPLOYEE');

CREATE TYPE "AssessmentType" AS ENUM ('CBI', 'PSS', 'WHO5', 'CULTURE');

CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'AD_HOC');

CREATE TYPE "AuditAction" AS ENUM (
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'CYCLE_CREATED',
  'CYCLE_ACTIVATED',
  'CYCLE_CLOSED',
  'RESPONSE_SUBMITTED',
  'CONSENT_GIVEN',
  'REPORT_GENERATED',
  'DATA_EXPORT',
  'DATA_DELETED',
  'ROLE_CHANGED'
);

-- ─── organisations ───────────────────────────────────────────

CREATE TABLE "organisations" (
    "id"           TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "name_ar"      TEXT,
    "slug"         TEXT         NOT NULL,
    "logo_url"     TEXT,
    "industry"     TEXT,
    "size_range"   TEXT,
    "country_code" TEXT         NOT NULL DEFAULT 'SA',
    "timezone"     TEXT         NOT NULL DEFAULT 'Asia/Riyadh',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- ─── departments ─────────────────────────────────────────────

CREATE TABLE "departments" (
    "id"              TEXT         NOT NULL,
    "organisation_id" TEXT         NOT NULL,
    "name"            TEXT         NOT NULL,
    "name_ar"         TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "departments_organisation_id_idx" ON "departments"("organisation_id");

-- ─── users ───────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"              TEXT         NOT NULL,
    "organisation_id" TEXT,
    "email"           TEXT         NOT NULL,
    "password_hash"   TEXT         NOT NULL,
    "first_name"      TEXT         NOT NULL,
    "last_name"       TEXT         NOT NULL,
    "role"            "UserRole"   NOT NULL,
    "is_active"       BOOLEAN      NOT NULL DEFAULT true,
    "last_login_at"   TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"      TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_organisation_id_idx" ON "users"("organisation_id");
CREATE INDEX "users_role_idx" ON "users"("role");

-- ─── refresh_tokens ──────────────────────────────────────────

CREATE TABLE "refresh_tokens" (
    "id"         TEXT         NOT NULL,
    "user_id"    TEXT         NOT NULL,
    "token"      TEXT         NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- ─── assessments ─────────────────────────────────────────────

CREATE TABLE "assessments" (
    "id"            TEXT             NOT NULL,
    "type"          "AssessmentType" NOT NULL,
    "name"          TEXT             NOT NULL,
    "name_ar"       TEXT,
    "description"   TEXT,
    "item_count"    INTEGER          NOT NULL,
    "survey_schema" JSONB            NOT NULL,
    "scoring_rules" JSONB            NOT NULL,
    "version"       TEXT             NOT NULL DEFAULT '1.0',
    "created_at"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessments_type_key" ON "assessments"("type");

-- ─── assessment_cycles ───────────────────────────────────────

CREATE TABLE "assessment_cycles" (
    "id"               TEXT          NOT NULL,
    "organisation_id"  TEXT          NOT NULL,
    "assessment_id"    TEXT          NOT NULL,
    "title"            TEXT          NOT NULL,
    "status"           "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at"        TIMESTAMP(3)  NOT NULL,
    "ends_at"          TIMESTAMP(3)  NOT NULL,
    "link_token"       TEXT          NOT NULL,
    "reminder_sent_at" TIMESTAMP(3),
    "closed_at"        TIMESTAMP(3),
    "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessment_cycles_link_token_key"    ON "assessment_cycles"("link_token");
CREATE INDEX "assessment_cycles_organisation_id_idx"      ON "assessment_cycles"("organisation_id");
CREATE INDEX "assessment_cycles_status_idx"               ON "assessment_cycles"("status");
CREATE INDEX "assessment_cycles_ends_at_idx"              ON "assessment_cycles"("ends_at");

-- ─── respondents ─────────────────────────────────────────────

CREATE TABLE "respondents" (
    "id"              TEXT         NOT NULL,
    "cycle_id"        TEXT         NOT NULL,
    "department_id"   TEXT,
    "session_token"   TEXT         NOT NULL,
    "consent_given"   BOOLEAN      NOT NULL DEFAULT false,
    "consent_at"      TIMESTAMP(3),
    "consent_ip"      TEXT,
    "consent_version" TEXT,
    "submitted_at"    TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respondents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "respondents_session_token_key"  ON "respondents"("session_token");
CREATE INDEX "respondents_cycle_id_idx"              ON "respondents"("cycle_id");
CREATE INDEX "respondents_department_id_idx"         ON "respondents"("department_id");
CREATE INDEX "respondents_submitted_at_idx"          ON "respondents"("submitted_at");

-- ─── responses ───────────────────────────────────────────────
-- One row per question per respondent (raw submitted value)

CREATE TABLE "responses" (
    "id"            TEXT         NOT NULL,
    "respondent_id" TEXT         NOT NULL,
    "question_key"  TEXT         NOT NULL,
    "raw_value"     INTEGER      NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "responses_respondent_id_question_key_key"
    ON "responses"("respondent_id", "question_key");
CREATE INDEX "responses_respondent_id_idx" ON "responses"("respondent_id");

-- ─── scores ──────────────────────────────────────────────────
-- Computed scores per respondent per subscale/dimension

CREATE TABLE "scores" (
    "id"             TEXT             NOT NULL,
    "respondent_id"  TEXT             NOT NULL,
    "subscale"       TEXT             NOT NULL,
    "raw_score"      DOUBLE PRECISION NOT NULL,
    "scaled_score"   DOUBLE PRECISION NOT NULL,
    "band"           TEXT             NOT NULL,
    "created_at"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scores_respondent_id_subscale_key"
    ON "scores"("respondent_id", "subscale");
CREATE INDEX "scores_respondent_id_idx" ON "scores"("respondent_id");
CREATE INDEX "scores_subscale_idx"      ON "scores"("subscale");

-- ─── reports ─────────────────────────────────────────────────

CREATE TABLE "reports" (
    "id"              TEXT         NOT NULL,
    "organisation_id" TEXT         NOT NULL,
    "cycle_id"        TEXT,
    "type"            "ReportType" NOT NULL,
    "period_start"    TIMESTAMP(3) NOT NULL,
    "period_end"      TIMESTAMP(3) NOT NULL,
    "pdf_url"         TEXT,
    "generated_at"    TIMESTAMP(3),
    "summary_data"    JSONB,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reports_organisation_id_idx" ON "reports"("organisation_id");
CREATE INDEX "reports_cycle_id_idx"        ON "reports"("cycle_id");

-- ─── audit_logs ──────────────────────────────────────────────

CREATE TABLE "audit_logs" (
    "id"          TEXT          NOT NULL,
    "user_id"     TEXT,
    "action"      "AuditAction" NOT NULL,
    "entity_type" TEXT,
    "entity_id"   TEXT,
    "metadata"    JSONB,
    "ip_address"  TEXT,
    "user_agent"  TEXT,
    "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_user_id_idx"    ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx"     ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_entity_id_idx"  ON "audit_logs"("entity_id");

-- ─── data_deletion_requests ──────────────────────────────────

CREATE TABLE "data_deletion_requests" (
    "id"            TEXT         NOT NULL,
    "session_token" TEXT         NOT NULL,
    "requested_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at"  TIMESTAMP(3),
    "status"        TEXT         NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_deletion_requests_session_token_idx"
    ON "data_deletion_requests"("session_token");

-- ─── Foreign Key Constraints ─────────────────────────────────

ALTER TABLE "departments"
    ADD CONSTRAINT "departments_organisation_id_fkey"
    FOREIGN KEY ("organisation_id")
    REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_organisation_id_fkey"
    FOREIGN KEY ("organisation_id")
    REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assessment_cycles"
    ADD CONSTRAINT "assessment_cycles_organisation_id_fkey"
    FOREIGN KEY ("organisation_id")
    REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_cycles"
    ADD CONSTRAINT "assessment_cycles_assessment_id_fkey"
    FOREIGN KEY ("assessment_id")
    REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "respondents"
    ADD CONSTRAINT "respondents_cycle_id_fkey"
    FOREIGN KEY ("cycle_id")
    REFERENCES "assessment_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "respondents"
    ADD CONSTRAINT "respondents_department_id_fkey"
    FOREIGN KEY ("department_id")
    REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "responses"
    ADD CONSTRAINT "responses_respondent_id_fkey"
    FOREIGN KEY ("respondent_id")
    REFERENCES "respondents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scores"
    ADD CONSTRAINT "scores_respondent_id_fkey"
    FOREIGN KEY ("respondent_id")
    REFERENCES "respondents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports"
    ADD CONSTRAINT "reports_organisation_id_fkey"
    FOREIGN KEY ("organisation_id")
    REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reports"
    ADD CONSTRAINT "reports_cycle_id_fkey"
    FOREIGN KEY ("cycle_id")
    REFERENCES "assessment_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── updated_at trigger function ─────────────────────────────
-- Keeps updated_at current without relying solely on Prisma client

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organisations
  BEFORE UPDATE ON "organisations"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_assessments
  BEFORE UPDATE ON "assessments"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_assessment_cycles
  BEFORE UPDATE ON "assessment_cycles"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
