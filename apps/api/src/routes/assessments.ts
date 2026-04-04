import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";
import { buildCycleSummary } from "../services/scoring";
import {
  sendCycleClosedNotification,
  sendCycleInvite,
  sendCycleReminder,
} from "../services/email";
import { logger } from "../lib/logger";

export const assessmentsRouter = Router();

// GET /api/assessments — list all assessment types (authenticated users)
assessmentsRouter.get("/", requireAuth, async (_req: Request, res: Response) => {
  const assessments = await prisma.assessment.findMany({
    select: {
      id: true,
      type: true,
      name: true,
      nameAr: true,
      description: true,
      itemCount: true,
      version: true,
    },
    orderBy: { type: "asc" },
  });
  return res.json(assessments);
});

// GET /api/assessments/:type/schema — return SurveyJS schema for a given type
// This is called by the anonymous assessment page
assessmentsRouter.get("/:type/schema", async (req: Request, res: Response) => {
  const { type } = req.params;
  const assessment = await prisma.assessment.findUnique({
    where: { type: type.toUpperCase() as any },
    select: { id: true, type: true, name: true, nameAr: true, surveySchema: true },
  });
  if (!assessment) return res.status(404).json({ error: "Assessment type not found" });
  return res.json(assessment);
});

// POST /api/assessments/cycles — create an assessment cycle (ADMIN or EXECUTIVE)
assessmentsRouter.post(
  "/cycles",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  [
    body("title").notEmpty().isString(),
    body("assessmentType").isIn(["CBI", "PSS", "WHO5", "CULTURE"]),
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { organisationId, assessmentType, title, startsAt, endsAt } = req.body;

    const targetOrgId =
      req.user!.role === "ADMIN" ? organisationId : req.user!.organisationId;
    if (!targetOrgId) return res.status(400).json({ error: "Organisation ID required" });

    const assessment = await prisma.assessment.findUnique({
      where: { type: assessmentType },
    });
    if (!assessment) return res.status(400).json({ error: "Invalid assessment type" });

    const cycle = await prisma.assessmentCycle.create({
      data: {
        organisationId: targetOrgId,
        assessmentId: assessment.id,
        title,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status: "DRAFT",
      },
    });

    await auditLog(AuditAction.CYCLE_CREATED, {
      userId: req.user!.userId,
      entityType: "AssessmentCycle",
      entityId: cycle.id,
      req,
    });

    return res.status(201).json(cycle);
  }
);

// GET /api/assessments/cycles — list cycles for the user's organisation
assessmentsRouter.get(
  "/cycles",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response) => {
    const orgId =
      req.user!.role === "ADMIN"
        ? (req.query.organisationId as string)
        : req.user!.organisationId;

    const cycles = await prisma.assessmentCycle.findMany({
      where: { organisationId: orgId ?? undefined },
      include: {
        assessment: { select: { type: true, name: true } },
        _count: { select: { respondents: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(cycles);
  }
);

// PATCH /api/assessments/cycles/:id/activate
assessmentsRouter.patch(
  "/cycles/:id/activate",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where: { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (cycle.status !== "DRAFT") {
      return res.status(409).json({ error: `Cycle is already ${cycle.status}` });
    }

    const updated = await prisma.assessmentCycle.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE" },
    });

    await auditLog(AuditAction.CYCLE_ACTIVATED, {
      userId: req.user!.userId,
      entityType: "AssessmentCycle",
      entityId: cycle.id,
      req,
    });

    // Optionally send invite emails if recipientEmails provided in body
    const { recipientEmails } = req.body as { recipientEmails?: string[] };
    if (recipientEmails && recipientEmails.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      sendCycleInvite({
        recipientEmails,
        organisationName: cycle.organisation.name,
        assessmentName: cycle.assessment.name,
        cycleTitle: cycle.title,
        assessmentUrl: `${appUrl}/assess/${cycle.linkToken}`,
        endsAt: cycle.endsAt,
      }).catch((err) => logger.error("Failed to send invite emails", { err }));
    }

    return res.json(updated);
  }
);

// PATCH /api/assessments/cycles/:id/remind
// Re-send reminder emails to a list of recipients
assessmentsRouter.patch(
  "/cycles/:id/remind",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  [body("recipientEmails").isArray({ min: 1 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const cycle = await prisma.assessmentCycle.findUnique({
      where: { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });
    if (cycle.status !== "ACTIVE") {
      return res.status(409).json({ error: "Only ACTIVE cycles can send reminders" });
    }
    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const daysRemaining = Math.ceil(
      (cycle.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await sendCycleReminder({
      recipientEmails: req.body.recipientEmails,
      organisationName: cycle.organisation.name,
      assessmentName: cycle.assessment.name,
      cycleTitle: cycle.title,
      assessmentUrl: `${appUrl}/assess/${cycle.linkToken}`,
      endsAt: cycle.endsAt,
      daysRemaining,
    });

    await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data: { reminderSentAt: new Date() },
    });

    return res.json({ message: `Reminder sent to ${req.body.recipientEmails.length} recipients` });
  }
);

// PATCH /api/assessments/cycles/:id/close
// Closes a cycle: marks CLOSED, builds summary snapshot, notifies HR.
assessmentsRouter.patch(
  "/cycles/:id/close",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where: { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED") {
      return res.status(409).json({ error: `Cycle is already ${cycle.status}` });
    }

    // 1. Mark closed
    await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    await auditLog(AuditAction.CYCLE_CLOSED, {
      userId: req.user!.userId,
      entityType: "AssessmentCycle",
      entityId: cycle.id,
      req,
    });

    // 2. Build + cache summary snapshot (non-blocking)
    buildCycleSummary(cycle.id)
      .then(async (summary) => {
        await prisma.report.create({
          data: {
            organisationId: cycle.organisationId,
            cycleId: cycle.id,
            type: "AD_HOC",
            periodStart: cycle.startsAt,
            periodEnd: cycle.endsAt,
            summaryData: summary as any,
            generatedAt: new Date(),
          },
        });
      })
      .catch((err) => logger.error("Failed to build cycle summary", { err, cycleId: cycle.id }));

    // 3. Notify the closing HR/Executive user by email (non-blocking)
    const respondentCount = await prisma.respondent.count({
      where: { cycleId: cycle.id, submittedAt: { not: null } },
    });
    const closingUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (closingUser?.email) {
      sendCycleClosedNotification({
        recipientEmail: closingUser.email,
        organisationName: cycle.organisation.name,
        cycleTitle: cycle.title,
        assessmentName: cycle.assessment.name,
        respondentCount,
        dashboardUrl: `${appUrl}/dashboard/cycles/${cycle.id}`,
      }).catch((err) => logger.error("Failed to send cycle-closed email", { err }));
    }

    return res.json({
      message: "Cycle closed successfully",
      cycleId: cycle.id,
      respondentCount,
    });
  }
);

// GET /api/assessments/cycles/by-token/:token — anonymous employee resolves cycle via link token
// GET /api/assessments/cycles/by-token/:token
// Public — resolves cycle info from the anonymous employee link token.
// Returns assessment metadata, org branding, and the org's departments
// (so the frontend can render the optional department selector step).
assessmentsRouter.get(
  "/cycles/by-token/:token",
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where: { linkToken: req.params.token },
      include: {
        assessment: {
          select: { type: true, name: true, nameAr: true, description: true, itemCount: true },
        },
        organisation: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            logoUrl: true,
            departments: {
              select: { id: true, name: true, nameAr: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });

    if (!cycle) return res.status(404).json({ error: "Assessment link not found" });
    if (cycle.status !== "ACTIVE") {
      return res.status(410).json({ error: "This assessment is no longer active" });
    }
    if (new Date() > cycle.endsAt) {
      return res.status(410).json({ error: "This assessment has expired" });
    }

    const { departments, ...orgWithoutDepts } = cycle.organisation;

    return res.json({
      cycleId: cycle.id,
      title: cycle.title,
      endsAt: cycle.endsAt,
      assessment: cycle.assessment,
      organisation: orgWithoutDepts,
      departments,   // array of { id, name, nameAr } — empty if org has none
    });
  }
);
