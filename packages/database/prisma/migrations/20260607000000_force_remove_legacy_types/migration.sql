-- Force-remove PSS and WHO5 from all data and from the AssessmentType enum.
-- This migration is idempotent: every step is safe to run even if the data
-- was already cleaned up by a previous (failed or skipped) migration.
--
-- FK deletion order:
--   reports.cycle_id (nullable, no cascade) → must NULL before deleting cycles
--   assessment_cycles → cascades to respondents → responses / scores / dept links
--   assessments

-- Step 1: Detach reports from PSS/WHO5 cycles (reports.cycle_id is nullable, no cascade).
UPDATE "reports"
SET    "cycle_id" = NULL
WHERE  "cycle_id" IN (
  SELECT ac.id
  FROM   "assessment_cycles" ac
  JOIN   "assessments" a ON a.id = ac.assessment_id
  WHERE  a."type"::text IN ('PSS', 'WHO5')
);

-- Step 2: Delete cycles for deprecated types.
-- Cascades automatically to: respondents → responses, scores; cycle_department_links.
DELETE FROM "assessment_cycles"
WHERE "assessment_id" IN (
  SELECT id FROM "assessments" WHERE "type"::text IN ('PSS', 'WHO5')
);

-- Step 3: Delete the assessment definition rows.
DELETE FROM "assessments" WHERE "type"::text IN ('PSS', 'WHO5');

-- Step 4: Recreate the enum only if PSS or WHO5 are still present.
-- PostgreSQL cannot DROP VALUES from an enum, so we use the type-swap pattern.
--
-- Safety note: the lookup uses a pg_type JOIN instead of ::regtype so the
-- check is safe even if AssessmentType doesn't exist — it returns no rows
-- rather than throwing "type does not exist".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_enum      e
    JOIN   pg_type      t ON t.oid     = e.enumtypid
    JOIN   pg_namespace n ON n.oid     = t.typnamespace
    WHERE  t.typname  = 'AssessmentType'
      AND  n.nspname  = 'public'
      AND  e.enumlabel IN ('PSS', 'WHO5')
  ) THEN
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
  END IF;
END$$;
