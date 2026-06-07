-- Remove PSS and WHO5 from AssessmentType; add PSYCH_SAFETY, TURNOVER, LMX7.
--
-- Must delete dependents in FK order before touching the assessments table,
-- because assessment_cycles.assessment_id has no ON DELETE CASCADE.

-- Step 1: Detach reports from cycles that will be deleted (nullable FK, no cascade).
UPDATE "reports"
SET    "cycle_id" = NULL
WHERE  "cycle_id" IN (
  SELECT ac.id
  FROM   "assessment_cycles" ac
  JOIN   "assessments" a ON a.id = ac.assessment_id
  WHERE  a."type"::text IN ('PSS', 'WHO5')
);

-- Step 2: Delete the cycles for deprecated types.
-- Cascades automatically to: respondents → responses/scores, cycle_department_links.
DELETE FROM "assessment_cycles"
WHERE "assessment_id" IN (
  SELECT id FROM "assessments" WHERE "type"::text IN ('PSS', 'WHO5')
);

-- Step 3: Delete the assessment definition rows.
DELETE FROM "assessments" WHERE "type"::text IN ('PSS', 'WHO5');

-- Step 4: Recreate the enum with the target set.
-- PostgreSQL cannot DROP VALUES from an enum, so we use the recreate pattern.
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
