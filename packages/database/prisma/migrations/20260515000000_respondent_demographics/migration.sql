-- Add demographic enums and optional columns to respondents

CREATE TYPE "TenureRange" AS ENUM ('UNDER_1Y', 'ONE_TO_3Y', 'THREE_TO_7Y', 'OVER_7Y');
CREATE TYPE "SeniorityLevel" AS ENUM ('INDIVIDUAL_CONTRIBUTOR', 'MANAGER');

ALTER TABLE "respondents"
  ADD COLUMN "is_saudi_national" BOOLEAN,
  ADD COLUMN "tenure_range"      "TenureRange",
  ADD COLUMN "seniority_level"   "SeniorityLevel";
