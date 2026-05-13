CREATE TABLE "cycle_department_links" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "department_name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_department_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cycle_department_links_token_key" ON "cycle_department_links"("token");

ALTER TABLE "cycle_department_links" ADD CONSTRAINT "cycle_department_links_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "assessment_cycles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
