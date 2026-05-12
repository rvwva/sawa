-- Migration: employees_table
-- Creates the employees table for storing per-organisation email lists
-- uploaded via CSV. Used to auto-populate cycle recipient lists.

CREATE TABLE "employees" (
    "id"              TEXT        NOT NULL,
    "organisation_id" TEXT        NOT NULL,
    "email"           TEXT        NOT NULL,
    "department"      TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_organisation_id_email_key"
    ON "employees"("organisation_id", "email");

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_organisation_id_fkey"
    FOREIGN KEY ("organisation_id")
    REFERENCES "organisations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
