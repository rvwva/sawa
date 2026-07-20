-- Add Microsoft 365 / ONA fields to organisations
ALTER TABLE "organisations"
  ADD COLUMN "m365_tenant_id"    TEXT,
  ADD COLUMN "m365_client_id"    TEXT,
  ADD COLUMN "m365_client_secret" TEXT,
  ADD COLUMN "ona_enabled"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "ona_last_sync_at"  TIMESTAMP(3);

-- ONA: raw interaction graph edges
CREATE TABLE "ona_interactions" (
  "id"              TEXT NOT NULL,
  "organisation_id" TEXT NOT NULL,
  "from_user_email" TEXT NOT NULL,
  "to_user_email"   TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "weight"          DOUBLE PRECISION NOT NULL,
  "period_start"    TIMESTAMP(3) NOT NULL,
  "period_end"      TIMESTAMP(3) NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ona_interactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ona_interactions_organisation_id_idx" ON "ona_interactions"("organisation_id");
CREATE INDEX "ona_interactions_period_start_period_end_idx" ON "ona_interactions"("period_start", "period_end");

ALTER TABLE "ona_interactions"
  ADD CONSTRAINT "ona_interactions_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ONA: per-user network centrality metrics
CREATE TABLE "ona_metrics" (
  "id"                 TEXT NOT NULL,
  "organisation_id"    TEXT NOT NULL,
  "user_email"         TEXT NOT NULL,
  "department_id"      TEXT,
  "degree_centrality"  DOUBLE PRECISION NOT NULL,
  "betweenness"        DOUBLE PRECISION NOT NULL,
  "eigenvector"        DOUBLE PRECISION NOT NULL,
  "isolation_score"    DOUBLE PRECISION NOT NULL,
  "collaboration_load" DOUBLE PRECISION NOT NULL,
  "reciprocity_score"  DOUBLE PRECISION NOT NULL,
  "period_start"       TIMESTAMP(3) NOT NULL,
  "period_end"         TIMESTAMP(3) NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ona_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ona_metrics_organisation_id_idx" ON "ona_metrics"("organisation_id");

ALTER TABLE "ona_metrics"
  ADD CONSTRAINT "ona_metrics_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ona_metrics"
  ADD CONSTRAINT "ona_metrics_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ONA: AI-generated insight cards per department
CREATE TABLE "ona_insight_cards" (
  "id"              TEXT NOT NULL,
  "organisation_id" TEXT NOT NULL,
  "department_id"   TEXT NOT NULL,
  "cycle_id"        TEXT,
  "signals"         JSONB NOT NULL,
  "risk_level"      TEXT NOT NULL,
  "insight_text"    TEXT NOT NULL,
  "insight_text_ar" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ona_insight_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ona_insight_cards_organisation_id_idx" ON "ona_insight_cards"("organisation_id");

ALTER TABLE "ona_insight_cards"
  ADD CONSTRAINT "ona_insight_cards_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ona_insight_cards"
  ADD CONSTRAINT "ona_insight_cards_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ona_insight_cards"
  ADD CONSTRAINT "ona_insight_cards_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "assessment_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ONA: consent disclosure audit log
CREATE TABLE "ona_consent_logs" (
  "id"              TEXT NOT NULL,
  "organisation_id" TEXT NOT NULL,
  "disclosed_by"    TEXT NOT NULL,
  "disclosure_date" TIMESTAMP(3) NOT NULL,
  "policy_version"  TEXT NOT NULL,
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ona_consent_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ona_consent_logs"
  ADD CONSTRAINT "ona_consent_logs_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
