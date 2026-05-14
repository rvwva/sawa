-- Add department-specific results token to cycle_department_links
-- Each token scopes the results page to that department only.

ALTER TABLE "cycle_department_links"
  ADD COLUMN "results_token" TEXT;

-- Back-fill any existing rows so we can add NOT NULL
UPDATE "cycle_department_links"
  SET "results_token" = gen_random_uuid()::text
  WHERE "results_token" IS NULL;

ALTER TABLE "cycle_department_links"
  ALTER COLUMN "results_token" SET NOT NULL;

CREATE UNIQUE INDEX "cycle_department_links_results_token_key"
  ON "cycle_department_links"("results_token");
