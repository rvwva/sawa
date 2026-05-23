-- Remove PSS from the platform
-- PostgreSQL does not support ALTER TYPE ... DROP VALUE, so we:
-- 1. Delete the PSS assessment record (cascades to any linked cycles/respondents)
-- 2. Recreate the enum without PSS
-- 3. Swap the column to use the new enum
-- 4. Drop the old enum and rename the new one

-- Step 1: Remove PSS assessment data (cascade handles cycles → respondents → scores)
DELETE FROM "assessments" WHERE "type" = 'PSS';

-- Step 2: Create replacement enum without PSS
CREATE TYPE "AssessmentType_new" AS ENUM ('CBI', 'WHO5', 'CULTURE');

-- Step 3: Migrate the assessments.type column
ALTER TABLE "assessments"
  ALTER COLUMN "type" TYPE "AssessmentType_new"
  USING "type"::text::"AssessmentType_new";

-- Step 4: Swap enum names
DROP TYPE "AssessmentType";
ALTER TYPE "AssessmentType_new" RENAME TO "AssessmentType";
