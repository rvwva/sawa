-- Migration: notification_fields
-- Adds cycle-frequency config to organisations and email/reminder tracking to assessment_cycles.

-- Organisation: admin-configured cycle frequency (days)
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "cycle_frequency_days" INTEGER;

-- AssessmentCycle: store recipient emails for automated reminders
ALTER TABLE "assessment_cycles"
  ADD COLUMN IF NOT EXISTS "recipient_emails"      JSONB,
  ADD COLUMN IF NOT EXISTS "reminders_sent"        JSONB,
  ADD COLUMN IF NOT EXISTS "results_published_at"  TIMESTAMPTZ;
