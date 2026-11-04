-- Add MANAGER to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';

-- Add new AuditAction values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PLAN_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PLAN_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STEP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STEP_EDITED';

-- Add department_id to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department_id" TEXT;

ALTER TABLE "users"
  ADD CONSTRAINT "users_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create new enums for action plans
CREATE TYPE "PlanPriority" AS ENUM ('HIGH', 'MEDIUM', 'STANDARD');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "StepOwnerRole" AS ENUM ('MANAGER', 'HR', 'SPONSOR', 'TEAM');
CREATE TYPE "StepState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NEEDS_SUPPORT', 'ADAPTED');
CREATE TYPE "StepVerification" AS ENUM ('NONE', 'CALENDAR_ONE_TO_ONE', 'CALENDAR_MEETING_LOAD', 'PULSE');
CREATE TYPE "StepUpdateType" AS ENUM ('DONE', 'NOT_YET', 'NEEDS_SUPPORT', 'ADAPTED', 'ACKNOWLEDGED', 'SUPPORT_OFFERED', 'REOPENED', 'COMMENT');

-- Create action_plans table
CREATE TABLE "action_plans" (
  "id"              TEXT NOT NULL,
  "organisation_id" TEXT NOT NULL,
  "department_id"   TEXT,
  "template_key"    TEXT NOT NULL,
  "priority"        "PlanPriority" NOT NULL,
  "status"          "PlanStatus" NOT NULL DEFAULT 'DRAFT',
  "title_en"        TEXT NOT NULL,
  "title_ar"        TEXT NOT NULL,
  "approved_by_id"  TEXT,
  "approved_at"     TIMESTAMP(3),
  "due_at"          TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "action_plans_organisation_id_idx" ON "action_plans"("organisation_id");

ALTER TABLE "action_plans"
  ADD CONSTRAINT "action_plans_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "action_plans"
  ADD CONSTRAINT "action_plans_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "action_plans"
  ADD CONSTRAINT "action_plans_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create action_steps table
CREATE TABLE "action_steps" (
  "id"              TEXT NOT NULL,
  "plan_id"         TEXT NOT NULL,
  "order"           INTEGER NOT NULL,
  "title_en"        TEXT NOT NULL,
  "title_ar"        TEXT NOT NULL,
  "body_en"         TEXT NOT NULL,
  "body_ar"         TEXT NOT NULL,
  "owner_role"      "StepOwnerRole" NOT NULL,
  "due_offset_days" INTEGER NOT NULL,
  "due_at"          TIMESTAMP(3),
  "state"           "StepState" NOT NULL DEFAULT 'NOT_STARTED',
  "verification"    "StepVerification" NOT NULL DEFAULT 'NONE',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "action_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "action_steps_plan_id_idx" ON "action_steps"("plan_id");

ALTER TABLE "action_steps"
  ADD CONSTRAINT "action_steps_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create step_updates table
CREATE TABLE "step_updates" (
  "id"         TEXT NOT NULL,
  "step_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "type"       "StepUpdateType" NOT NULL,
  "note"       TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "step_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "step_updates_step_id_idx" ON "step_updates"("step_id");

ALTER TABLE "step_updates"
  ADD CONSTRAINT "step_updates_step_id_fkey"
  FOREIGN KEY ("step_id") REFERENCES "action_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "step_updates"
  ADD CONSTRAINT "step_updates_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
