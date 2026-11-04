import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { canViewPlan, canUpdateStep } from "../services/planAccess";
import { generatePlans as generatePlansService } from "../services/planTemplates";
import { auditLog } from "../middleware/audit";
import { AuditAction, StepState, StepUpdateType } from "@prisma/client";

export const plansRouter = Router();

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Add days to a date (UTC day arithmetic).
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * If the date falls on a Friday (5) or Saturday (6) in Asia/Riyadh, shift
 * back to the Thursday before.
 */
function adjustForSaudiWeekend(date: Date): Date {
  const dowStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    weekday: "short",
  }).format(date);
  if (dowStr === "Fri") return new Date(date.getTime() - 1 * 24 * 60 * 60 * 1000);
  if (dowStr === "Sat") return new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000);
  return date;
}

// ─── Step display status ──────────────────────────────────────────────────────

type DisplayStatus = "done" | "adapted" | "needs_support" | "due_this_week" | "on_track" | "upcoming";

export function stepDisplayStatus(
  state: StepState,
  dueAt: Date | null,
  now: Date = new Date()
): DisplayStatus {
  if (state === "DONE") return "done";
  if (state === "ADAPTED") return "adapted";
  if (state === "NEEDS_SUPPORT") return "needs_support";

  if (dueAt) {
    const msUntilDue = dueAt.getTime() - now.getTime();
    const daysUntilDue = msUntilDue / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= 7) return "due_this_week"; // overdue (<=0) or within 7 days
    // Due later
    if (state === "IN_PROGRESS") return "on_track";
  }

  return "upcoming";
}

// ─── GET /api/plans/:orgId ────────────────────────────────────────────────────

plansRouter.get(
  "/:orgId",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      if (!canViewPlan(req.user!, { organisationId: orgId, departmentId: null })) {
        return res.status(403).json({ error: "Access denied" });
      }

      const plans = await prisma.actionPlan.findMany({
        where: {
          organisationId: orgId,
          ...(req.user!.role === "MANAGER"
            ? {
                OR: [
                  { departmentId: req.user!.departmentId ?? "none" },
                  { departmentId: null },
                ],
              }
            : {}),
        },
        include: {
          steps: { orderBy: { order: "asc" } },
          department: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json(plans);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/plans/:orgId/:id ────────────────────────────────────────────────

plansRouter.get(
  "/:orgId/:id",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await prisma.actionPlan.findFirst({
        where: { id: req.params.id, organisationId: req.params.orgId },
        include: {
          steps: {
            orderBy: { order: "asc" },
            include: { updates: { orderBy: { createdAt: "asc" } } },
          },
          department: { select: { id: true, name: true, nameAr: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (!canViewPlan(req.user!, plan)) return res.status(403).json({ error: "Access denied" });

      return res.json(plan);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/plans/:orgId/generate ─────────────────────────────────────────

plansRouter.post(
  "/:orgId/generate",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      if (
        req.user!.role === "EXECUTIVE" &&
        req.user!.organisationId !== orgId
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      const count = await generatePlansService(orgId);

      await auditLog(AuditAction.PLAN_GENERATED, {
        userId: req.user!.userId,
        entityType: "Organisation",
        entityId: orgId,
        metadata: { plansCreated: count },
        req,
      });

      return res.status(201).json({ created: count });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/plans/:orgId/:id/approve ──────────────────────────────────────

plansRouter.post(
  "/:orgId/:id/approve",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await prisma.actionPlan.findFirst({
        where: { id: req.params.id, organisationId: req.params.orgId },
        include: { steps: true },
      });

      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (!canViewPlan(req.user!, plan)) return res.status(403).json({ error: "Access denied" });
      if (plan.status !== "DRAFT") {
        return res.status(409).json({ error: "Only DRAFT plans can be approved" });
      }

      const approvalDate = new Date();

      // Set dueAt on each step (approvalDate + offset, adjusted for Saudi weekend)
      const stepUpdates = plan.steps.map((step) => {
        const raw = addDays(approvalDate, step.dueOffsetDays);
        const dueAt = adjustForSaudiWeekend(raw);
        return prisma.actionStep.update({ where: { id: step.id }, data: { dueAt } });
      });
      await Promise.all(stepUpdates);

      // Plan dueAt = last step's dueAt
      const maxOffset = Math.max(...plan.steps.map((s) => s.dueOffsetDays), 0);
      const rawPlanDue = addDays(approvalDate, maxOffset);
      const planDueAt = adjustForSaudiWeekend(rawPlanDue);

      const updated = await prisma.actionPlan.update({
        where: { id: plan.id },
        data: {
          status: "ACTIVE",
          approvedById: req.user!.userId,
          approvedAt: approvalDate,
          dueAt: planDueAt,
        },
        include: { steps: { orderBy: { order: "asc" } } },
      });

      await auditLog(AuditAction.PLAN_APPROVED, {
        userId: req.user!.userId,
        entityType: "ActionPlan",
        entityId: plan.id,
        metadata: { approvedAt: approvalDate.toISOString() },
        req,
      });

      return res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/plans/steps/:id/updates ───────────────────────────────────────

plansRouter.post(
  "/steps/:id/updates",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const step = await prisma.actionStep.findUnique({
        where: { id: req.params.id },
        include: { plan: { select: { organisationId: true, departmentId: true } } },
      });

      if (!step) return res.status(404).json({ error: "Step not found" });
      if (!canUpdateStep(req.user!, { plan: step.plan })) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { type, note } = req.body as { type?: string; note?: string };
      if (!type || !(type in StepUpdateType)) {
        return res
          .status(400)
          .json({ error: `type must be one of: ${Object.values(StepUpdateType).join(", ")}` });
      }

      const update = await prisma.stepUpdate.create({
        data: {
          stepId: step.id,
          userId: req.user!.userId,
          type: type as StepUpdateType,
          note: note ?? null,
        },
      });

      await auditLog(AuditAction.STEP_UPDATED, {
        userId: req.user!.userId,
        entityType: "ActionStep",
        entityId: step.id,
        metadata: { type, note },
        req,
      });

      return res.status(201).json(update);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/plans/steps/:id ──────────────────────────────────────────────

plansRouter.patch(
  "/steps/:id",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const step = await prisma.actionStep.findUnique({
        where: { id: req.params.id },
        include: { plan: { select: { organisationId: true, departmentId: true } } },
      });

      if (!step) return res.status(404).json({ error: "Step not found" });
      if (!canUpdateStep(req.user!, { plan: step.plan })) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { state } = req.body as { state?: string };
      if (state && !(state in StepState)) {
        return res
          .status(400)
          .json({ error: `state must be one of: ${Object.values(StepState).join(", ")}` });
      }

      const updated = await prisma.actionStep.update({
        where: { id: step.id },
        data: { ...(state ? { state: state as StepState } : {}) },
      });

      await auditLog(AuditAction.STEP_EDITED, {
        userId: req.user!.userId,
        entityType: "ActionStep",
        entityId: step.id,
        metadata: { state },
        req,
      });

      return res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);
