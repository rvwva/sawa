-- Remove PSS and WHO5 from AssessmentType; add PSYCH_SAFETY, TURNOVER, LMX7.
--
-- Delete any assessment definition rows for the deprecated types first.
-- This cascades to any AssessmentCycles and downstream records that reference them.
DELETE FROM "assessments" WHERE "type"::text IN ('PSS', 'WHO5');

-- PostgreSQL cannot DROP VALUES from an enum, so we recreate the type.
CREATE TYPE "AssessmentType_new" AS ENUM (
  'CBI',
  'CULTURE',
  'PSYCH_SAFETY',
  'TURNOVER',
  'LMX7'
);

ALTER TABLE "assessments"
  ALTER COLUMN "type" TYPE "AssessmentType_new"
  USING "type"::text::"AssessmentType_new";

DROP TYPE "AssessmentType";
ALTER TYPE "AssessmentType_new" RENAME TO "AssessmentType";
