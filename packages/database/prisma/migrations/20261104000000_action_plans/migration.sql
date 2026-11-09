-- CreateEnum
CREATE TYPE "PlanPriority" AS ENUM ('HIGH', 'MEDIUM', 'STANDARD');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StepOwnerRole" AS ENUM ('MANAGER', 'HR', 'SPONSOR', 'TEAM');

-- CreateEnum
CREATE TYPE "StepState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NEEDS_SUPPORT', 'ADAPTED');

-- CreateEnum
CREATE TYPE "StepVerification" AS ENUM ('NONE', 'CALENDAR_ONE_TO_ONE', 'CALENDAR_MEETING_LOAD', 'PULSE');

-- CreateEnum
CREATE TYPE "StepUpdateType" AS ENUM ('DONE', 'NOT_YET', 'NEEDS_SUPPORT', 'ADAPTED', 'ACKNOWLEDGED', 'SUPPORT_OFFERED', 'REOPENED', 'COMMENT');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MANAGER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PLAN_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'STEP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'STEP_EDITED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department_id" TEXT;

-- CreateTable
CREATE TABLE "action_plans" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "department_id" TEXT,
    "partner_department_id" TEXT,
    "sponsor_user_id" TEXT,
    "template_key" TEXT NOT NULL,
    "priority" "PlanPriority" NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "title_en" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "intro_en" TEXT NOT NULL,
    "intro_ar" TEXT NOT NULL,
    "done_when_en" TEXT NOT NULL,
    "done_when_ar" TEXT NOT NULL,
    "watch_for_en" JSONB NOT NULL,
    "watch_for_ar" JSONB NOT NULL,
    "signals_snapshot" JSONB NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_steps" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "evidence_level" TEXT NOT NULL,
    "source_keys" TEXT[],
    "workstream_en" TEXT,
    "workstream_ar" TEXT,
    "when_en" TEXT NOT NULL,
    "when_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_ar" TEXT NOT NULL,
    "who_en" TEXT NOT NULL,
    "who_ar" TEXT NOT NULL,
    "output_en" TEXT NOT NULL,
    "output_ar" TEXT NOT NULL,
    "evidence_note_en" TEXT NOT NULL,
    "evidence_note_ar" TEXT NOT NULL,
    "owner_role" "StepOwnerRole" NOT NULL,
    "owner_user_id" TEXT,
    "due_offset_days" INTEGER NOT NULL,
    "due_at" TIMESTAMP(3),
    "state" "StepState" NOT NULL DEFAULT 'NOT_STARTED',
    "verification" "StepVerification" NOT NULL DEFAULT 'NONE',
    "verified_at" TIMESTAMP(3),
    "verification_note" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_updates" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "StepUpdateType" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_plans_organisation_id_idx" ON "action_plans"("organisation_id");

-- CreateIndex
CREATE INDEX "action_steps_plan_id_idx" ON "action_steps"("plan_id");

-- CreateIndex
CREATE INDEX "step_updates_step_id_idx" ON "step_updates"("step_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_partner_department_id_fkey" FOREIGN KEY ("partner_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_sponsor_user_id_fkey" FOREIGN KEY ("sponsor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_steps" ADD CONSTRAINT "action_steps_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_steps" ADD CONSTRAINT "action_steps_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_updates" ADD CONSTRAINT "step_updates_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "action_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_updates" ADD CONSTRAINT "step_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

