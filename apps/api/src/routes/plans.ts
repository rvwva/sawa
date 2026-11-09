import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { canViewPlan, canUpdateStep } from "../services/planAccess";
import {
  generatePlans as generatePlansService,
  getTemplate,
  renderPlanText,
  renderStepText,
} from "../services/planTemplates";
import { auditLog } from "../middleware/audit";
import { AuditAction, PlanStatus, Prisma, StepState, StepUpdateType } from "@prisma/client";

export const plansRouter = Router();

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** approvalDate + offset days; a Friday or Saturday (Asia/Riyadh) moves back to the Thursday before. */
export function computeDueAt(approvalDate: Date, offsetDays: number): Date {
  const raw = new Date(approvalDate.getTime() + offsetDays * DAY_MS);
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "short" }).format(raw);
  if (dow === "Fri") return new Date(raw.getTime() - DAY_MS);
  if (dow === "Sat") return new Date(raw.getTime() - 2 * DAY_MS);
  return raw;
}

// ─── Step display status ──────────────────────────────────────────────────────

type DisplayStatus = "done" | "adapted" | "needs_support" | "due_this_week" | "on_track" | "upcoming";

export function stepDisplayStatus(state: StepState, dueAt: Date | null, now: Date = new Date()): DisplayStatus {
  if (state === "DONE") return "done";
  if (state === "ADAPTED") return "adapted";
  if (state === "NEEDS_SUPPORT") return "needs_support";
  if (dueAt) {
    const daysUntilDue = (dueAt.getTime() - now.getTime()) / DAY_MS;
    if (daysUntilDue <= 7) return "due_this_week";
    if (state === "IN_PROGRESS") return "on_track";
  }
  return "upcoming";
}

const MANAGER_VISIBLE_STATUSES: PlanStatus[] = ["ACTIVE", "COMPLETED"];

function withDisplayStatus<T extends { state: StepState; dueAt: Date | null }>(step: T, now = new Date()) {
  return { ...step, displayStatus: stepDisplayStatus(step.state, step.dueAt, now) };
}

function planWithDisplayStatus<T extends { steps: { state: StepState; dueAt: Date | null }[] }>(plan: T) {
  const now = new Date();
  return { ...plan, steps: plan.steps.map((s) => withDisplayStatus(s, now)) };
}

// ─── GET /api/plans/:orgId ────────────────────────────────────────────────────

plansRouter.get(
  "/:orgId",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      const user = req.user!;
      if (user.role === "EXECUTIVE" && user.organisationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (user.role === "MANAGER" && (user.organisationId !== orgId || !user.departmentId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const plans = await prisma.actionPlan.findMany({
        where: {
          organisationId: orgId,
          ...(user.role === "MANAGER"
            ? { departmentId: user.departmentId!, status: { in: MANAGER_VISIBLE_STATUSES } }
            : {}),
        },
        include: {
          steps: { orderBy: { order: "asc" } },
          department: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json(plans.filter((p) => canViewPlan(user, p)).map(planWithDisplayStatus));
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
          steps: { orderBy: { order: "asc" }, include: { updates: { orderBy: { createdAt: "asc" } } } },
          department: { select: { id: true, name: true, nameAr: true } },
          partnerDepartment: { select: { id: true, name: true, nameAr: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          sponsor: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (!canViewPlan(req.user!, plan)) return res.status(403).json({ error: "Access denied" });
      if (req.user!.role === "MANAGER" && !MANAGER_VISIBLE_STATUSES.includes(plan.status)) {
        return res.status(404).json({ error: "Plan not found" });
      }
      return res.json(planWithDisplayStatus(plan));
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
      if (req.user!.role === "EXECUTIVE" && req.user!.organisationId !== orgId) {
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
// Body: sponsorUserId (required), partnerDepartmentId?, managerUserId? (overrides the
// department manager as owner of MANAGER-role steps).

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
      if (plan.status !== "DRAFT") return res.status(409).json({ error: "Only DRAFT plans can be approved" });

      const { sponsorUserId, partnerDepartmentId, managerUserId } = req.body as {
        sponsorUserId?: string;
        partnerDepartmentId?: string;
        managerUserId?: string;
      };

      if (!sponsorUserId) return res.status(400).json({ error: "sponsorUserId is required" });

      const activeInOrg = { organisationId: plan.organisationId, isActive: true, deletedAt: null };
      const sponsor = await prisma.user.findFirst({ where: { id: sponsorUserId, ...activeInOrg } });
      if (!sponsor) return res.status(400).json({ error: "sponsorUserId is not a user in this organisation" });

      let managerId: string | null = null;
      if (managerUserId) {
        const m = await prisma.user.findFirst({ where: { id: managerUserId, ...activeInOrg } });
        if (!m) return res.status(400).json({ error: "managerUserId is not a user in this organisation" });
        managerId = m.id;
      } else if (plan.departmentId) {
        const m = await prisma.user.findFirst({
          where: { role: "MANAGER", departmentId: plan.departmentId, ...activeInOrg },
          orderBy: { createdAt: "asc" },
        });
        managerId = m?.id ?? null;
      }

      const partnerChanged =
        partnerDepartmentId !== undefined && partnerDepartmentId !== plan.partnerDepartmentId;
      let rendered: { plan: ReturnType<typeof renderPlanText>; steps: Map<number, ReturnType<typeof renderStepText>> } | null =
        null;

      if (partnerChanged) {
        if (partnerDepartmentId === plan.departmentId) {
          return res.status(400).json({ error: "partnerDepartmentId must differ from the plan's department" });
        }
        const partner = await prisma.department.findFirst({
          where: { id: partnerDepartmentId, organisationId: plan.organisationId },
        });
        if (!partner) return res.status(400).json({ error: "partnerDepartmentId is not in this organisation" });

        const tmpl = getTemplate(plan.templateKey);
        if (!tmpl) return res.status(500).json({ error: `Template ${plan.templateKey} no longer exists` });

        const dept = plan.departmentId
          ? await prisma.department.findUnique({ where: { id: plan.departmentId } })
          : null;
        const names = {
          department: { en: dept?.name ?? "", ar: dept?.nameAr ?? dept?.name ?? "" },
          partner: { en: partner.name, ar: partner.nameAr ?? partner.name },
        };
        rendered = {
          plan: renderPlanText(tmpl, names),
          steps: new Map(tmpl.steps.map((s) => [s.order, renderStepText(s, names)])),
        };
      }

      const approvalDate = new Date();
      const approverId = req.user!.userId;

      function ownerFor(role: string): string | null {
        if (role === "MANAGER") return managerId;
        if (role === "HR") return approverId;
        if (role === "SPONSOR") return sponsor!.id;
        return null;
      }

      const maxOffset = Math.max(0, ...plan.steps.map((s) => s.dueOffsetDays));

      const updated = await prisma.$transaction(async (tx) => {
        for (const step of plan.steps) {
          await tx.actionStep.update({
            where: { id: step.id },
            data: {
              dueAt: computeDueAt(approvalDate, step.dueOffsetDays),
              ownerUserId: ownerFor(step.ownerRole),
              ...(rendered?.steps.get(step.order) ?? {}),
            },
          });
        }
        return tx.actionPlan.update({
          where: { id: plan.id },
          data: {
            status: "ACTIVE",
            approvedById: approverId,
            approvedAt: approvalDate,
            dueAt: computeDueAt(approvalDate, maxOffset),
            sponsorUserId: sponsor.id,
            ...(partnerChanged ? { partnerDepartmentId } : {}),
            ...(rendered?.plan ?? {}),
          },
          include: { steps: { orderBy: { order: "asc" } } },
        });
      });

      await auditLog(AuditAction.PLAN_APPROVED, {
        userId: approverId,
        entityType: "ActionPlan",
        entityId: plan.id,
        metadata: {
          approvedAt: approvalDate.toISOString(),
          sponsorUserId: sponsor.id,
          managerUserId: managerId,
          partnerDepartmentId: partnerChanged ? partnerDepartmentId : undefined,
        },
        req,
      });

      return res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/plans/steps/:id/updates ───────────────────────────────────────
// Records an update and applies its state change in one transaction.

const MIN_NOTE_LENGTH = 10;

const UPDATE_RULES: Record<
  StepUpdateType,
  { state?: StepState; completedAt?: "set" | "clear"; note?: "required" | "min"; leadershipOnly?: boolean }
> = {
  DONE: { state: "DONE", completedAt: "set" },
  NOT_YET: { state: "IN_PROGRESS" },
  NEEDS_SUPPORT: { state: "NEEDS_SUPPORT", note: "min" },
  ADAPTED: { state: "ADAPTED", note: "min" },
  REOPENED: { state: "IN_PROGRESS", completedAt: "clear" },
  COMMENT: { note: "required" },
  ACKNOWLEDGED: { leadershipOnly: true },
  SUPPORT_OFFERED: { leadershipOnly: true },
};

plansRouter.post(
  "/steps/:id/updates",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE", "MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const step = await prisma.actionStep.findUnique({
        where: { id: req.params.id },
        include: { plan: { select: { organisationId: true, departmentId: true, status: true } } },
      });

      if (!step) return res.status(404).json({ error: "Step not found" });
      if (!canUpdateStep(req.user!, step)) return res.status(403).json({ error: "Access denied" });

      const { type, note } = req.body as { type?: string; note?: unknown };
      if (!type || !(type in StepUpdateType)) {
        return res.status(400).json({ error: `type must be one of: ${Object.values(StepUpdateType).join(", ")}` });
      }
      const rule = UPDATE_RULES[type as StepUpdateType];

      // canUpdateStep already limits EXECUTIVE to the same organisation.
      if (rule.leadershipOnly && req.user!.role === "MANAGER") {
        return res.status(403).json({ error: `${type} can only be sent by HR or an administrator` });
      }

      const trimmed = typeof note === "string" ? note.trim() : "";
      if (rule.note === "min" && trimmed.length < MIN_NOTE_LENGTH) {
        return res.status(400).json({ error: `${type} needs a note of at least ${MIN_NOTE_LENGTH} characters` });
      }
      if (rule.note === "required" && trimmed.length === 0) {
        return res.status(400).json({ error: `${type} needs a note` });
      }

      if (step.plan.status !== "ACTIVE") {
        return res.status(409).json({ error: "Updates can only be added to an ACTIVE plan" });
      }

      const stepData: Prisma.ActionStepUpdateInput = {};
      if (rule.state) stepData.state = rule.state;
      if (rule.completedAt === "set") stepData.completedAt = new Date();
      if (rule.completedAt === "clear") stepData.completedAt = null;

      const updatedStep = await prisma.$transaction(async (tx) => {
        await tx.stepUpdate.create({
          data: { stepId: step.id, userId: req.user!.userId, type: type as StepUpdateType, note: trimmed || null },
        });
        return Object.keys(stepData).length
          ? tx.actionStep.update({ where: { id: step.id }, data: stepData })
          : tx.actionStep.findUniqueOrThrow({ where: { id: step.id } });
      });

      await auditLog(AuditAction.STEP_UPDATED, {
        userId: req.user!.userId,
        entityType: "ActionStep",
        entityId: step.id,
        metadata: { type, from: step.state, to: updatedStep.state },
        req,
      });

      return res.status(201).json(withDisplayStatus(updatedStep));
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/plans/steps/:id ──────────────────────────────────────────────
// Leadership edits to owner and due date. State changes go through /updates.

plansRouter.patch(
  "/steps/:id",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const step = await prisma.actionStep.findUnique({
        where: { id: req.params.id },
        include: { plan: { select: { organisationId: true, departmentId: true } } },
      });

      if (!step) return res.status(404).json({ error: "Step not found" });
      if (!canUpdateStep(req.user!, step)) return res.status(403).json({ error: "Access denied" });

      const { ownerUserId, dueAt } = req.body as { ownerUserId?: string; dueAt?: string };
      if (ownerUserId === undefined && dueAt === undefined) {
        return res.status(400).json({ error: "Provide ownerUserId and/or dueAt" });
      }

      const data: Prisma.ActionStepUncheckedUpdateInput = {};

      if (ownerUserId !== undefined) {
        const owner = await prisma.user.findFirst({
          where: { id: ownerUserId, organisationId: step.plan.organisationId, isActive: true, deletedAt: null },
        });
        if (!owner) return res.status(400).json({ error: "ownerUserId is not an active user in this organisation" });
        data.ownerUserId = owner.id;
      }

      if (dueAt !== undefined) {
        const parsed = new Date(dueAt);
        if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: "dueAt must be a valid date" });
        data.dueAt = computeDueAt(parsed, 0);
      }

      const updated = await prisma.actionStep.update({ where: { id: step.id }, data });

      await auditLog(AuditAction.STEP_EDITED, {
        userId: req.user!.userId,
        entityType: "ActionStep",
        entityId: step.id,
        metadata: {
          ...(data.ownerUserId !== undefined ? { ownerUserId: { from: step.ownerUserId, to: data.ownerUserId } } : {}),
          ...(data.dueAt !== undefined ? { dueAt: { from: step.dueAt, to: data.dueAt } } : {}),
        },
        req,
      });

      return res.json(withDisplayStatus(updated));
    } catch (err) {
      next(err);
    }
  }
);
