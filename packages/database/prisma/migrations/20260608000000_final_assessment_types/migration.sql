-- Update AssessmentType enum to match current schema.prisma:
--   Remove: PSS, WHO5
--   Add:    PSYCH_SAFETY, TURNOVER, LMX7
--
-- PREREQUISITE (run manually in Railway query editor BEFORE this deploy):
--
--   DELETE FROM reports WHERE cycle_id IN (
--     SELECT ac.id FROM assessment_cycles ac
--     JOIN assessments a ON a.id = ac.assessment_id
--     WHERE a.type::text IN ('PSS','WHO5')
--   );
--   UPDATE reports SET cycle_id = NULL WHERE cycle_id IN (
--     SELECT ac.id FROM assessment_cycles ac
--     JOIN assessments a ON a.id = ac.assessment_id
--     WHERE a.type::text IN ('PSS','WHO5')
--   );
--   DELETE FROM assessment_cycles WHERE assessment_id IN (
--     SELECT id FROM assessments WHERE type::text IN ('PSS','WHO5')
--   );
--   DELETE FROM assessments WHERE type::text IN ('PSS','WHO5');
--   DELETE FROM _prisma_migrations
--     WHERE migration_name IN (
--       '20260524000000_sync_assessment_types',
--       '20260607000000_force_remove_legacy_types'
--     );
--
-- PostgreSQL cannot DROP VALUES from an enum; the recreate pattern is required.
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
