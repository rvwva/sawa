-- Sync AssessmentType enum with production database state.
-- Production DB retains PSS; this migration only adds the three new scale types.
-- IF NOT EXISTS makes each statement safe to run regardless of current enum state.
ALTER TYPE "AssessmentType" ADD VALUE IF NOT EXISTS 'PSYCH_SAFETY';
ALTER TYPE "AssessmentType" ADD VALUE IF NOT EXISTS 'TURNOVER';
ALTER TYPE "AssessmentType" ADD VALUE IF NOT EXISTS 'LMX7';
