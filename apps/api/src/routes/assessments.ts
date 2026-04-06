import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";
import { aggregateCycleScores, buildCycleSummary } from "../services/scoring";
import {
  sendCycleClosedNotification,
  sendCycleInvite,
  sendCycleReminder,
  sendTeamPulseNotification,
} from "../services/email";
import { logger } from "../lib/logger";

export const assessmentsRouter = Router();

// ─── GET /api/assessments — list all assessment types ─────────────────────────

assessmentsRouter.get("/", requireAuth, async (_req: Request, res: Response) => {
  const assessments = await prisma.assessment.findMany({
    select: {
      id: true, type: true, name: true, nameAr: true,
      description: true, itemCount: true, version: true,
    },
    orderBy: { type: "asc" },
  });
  return res.json(assessments);
});

// ─── GET /api/assessments/:type/schema ────────────────────────────────────────

assessmentsRouter.get("/:type/schema", async (req: Request, res: Response) => {
  const assessment = await prisma.assessment.findUnique({
    where: { type: req.params.type.toUpperCase() as any },
    select: { id: true, type: true, name: true, nameAr: true, surveySchema: true },
  });
  if (!assessment) return res.status(404).json({ error: "Assessment type not found" });
  return res.json(assessment);
});

// ─── POST /api/assessments/cycles — create cycle ──────────────────────────────

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

    const assessment = await prisma.assessment.findUnique({ where: { type: assessmentType } });
    if (!assessment) return res.status(400).json({ error: "Invalid assessment type" });

    const cycle = await prisma.assessmentCycle.create({
      data: {
        organisationId: targetOrgId,
        assessmentId:   assessment.id,
        title,
        startsAt: new Date(startsAt),
        endsAt:   new Date(endsAt),
        status:   "DRAFT",
      },
    });

    await auditLog(AuditAction.CYCLE_CREATED, {
      userId: req.user!.userId, entityType: "AssessmentCycle", entityId: cycle.id, req,
    });

    return res.status(201).json(cycle);
  }
);

// ─── GET /api/assessments/cycles — list cycles for org ───────────────────────

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
        _count:     { select: { respondents: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(cycles);
  }
);

// ─── PATCH /api/assessments/cycles/:id/activate ───────────────────────────────
// Activates a cycle and optionally stores + sends invitations.

assessmentsRouter.patch(
  "/cycles/:id/activate",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
      return res.status(403).json({ error: "Access denied" });
    if (cycle.status !== "DRAFT")
      return res.status(409).json({ error: `Cycle is already ${cycle.status}` });

    const { recipientEmails } = req.body as { recipientEmails?: string[] };

    // Persist recipient list on the cycle for automated reminders later
    const updated = await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data: {
        status: "ACTIVE",
        ...(recipientEmails && recipientEmails.length > 0
          ? { recipientEmails }
          : {}),
      },
    });

    await auditLog(AuditAction.CYCLE_ACTIVATED, {
      userId: req.user!.userId, entityType: "AssessmentCycle", entityId: cycle.id, req,
    });

    // Send invitations (non-blocking)
    if (recipientEmails && recipientEmails.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      sendCycleInvite({
        recipientEmails,
        organisationName:   cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr ?? undefined,
        assessmentName:     cycle.assessment.name,
        assessmentNameAr:   cycle.assessment.nameAr ?? undefined,
        cycleTitle:         cycle.title,
        assessmentUrl:      `${appUrl}/assess/${cycle.linkToken}`,
        endsAt:             cycle.endsAt,
      }).catch((err) => logger.error("sendCycleInvite failed", { err }));
    }

    return res.json(updated);
  }
);

// ─── PATCH /api/assessments/cycles/:id/remind — manual reminder blast ─────────

assessmentsRouter.patch(
  "/cycles/:id/remind",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  [body("recipientEmails").optional().isArray()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle)                 return res.status(404).json({ error: "Cycle not found" });
    if (cycle.status !== "ACTIVE") return res.status(409).json({ error: "Only ACTIVE cycles can send reminders" });
    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
      return res.status(403).json({ error: "Access denied" });

    // Use supplied list or fall back to stored list
    const emails: string[] =
      (req.body.recipientEmails && req.body.recipientEmails.length > 0)
        ? req.body.recipientEmails
        : (cycle.recipientEmails as string[] | null) ?? [];

    if (emails.length === 0)
      return res.status(400).json({ error: "No recipient emails available" });

    const daysRemaining = Math.ceil(
      (cycle.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await sendCycleReminder({
      recipientEmails:    emails,
      organisationName:   cycle.organisation.name,
      organisationNameAr: cycle.organisation.nameAr ?? undefined,
      assessmentName:     cycle.assessment.name,
      assessmentNameAr:   cycle.assessment.nameAr ?? undefined,
      cycleTitle:         cycle.title,
      assessmentUrl:      `${appUrl}/assess/${cycle.linkToken}`,
      endsAt:             cycle.endsAt,
      daysRemaining,
    });

    await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data:  { reminderSentAt: new Date() },
    });

    return res.json({ message: `Reminder sent to ${emails.length} recipients` });
  }
);

// ─── PATCH /api/assessments/cycles/:id/close ─────────────────────────────────
// Closes cycle, builds summary, sends exec notification with headline metrics.

assessmentsRouter.patch(
  "/cycles/:id/close",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
      return res.status(403).json({ error: "Access denied" });
    if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED")
      return res.status(409).json({ error: `Cycle is already ${cycle.status}` });

    // 1. Mark closed
    await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data:  { status: "CLOSED", closedAt: new Date() },
    });

    await auditLog(AuditAction.CYCLE_CLOSED, {
      userId: req.user!.userId, entityType: "AssessmentCycle", entityId: cycle.id, req,
    });

    // 2. Build summary snapshot and persist report
    let summary: Awaited<ReturnType<typeof buildCycleSummary>> | null = null;
    try {
      summary = await buildCycleSummary(cycle.id);
      await prisma.report.create({
        data: {
          organisationId: cycle.organisationId,
          cycleId:        cycle.id,
          type:           "AD_HOC",
          periodStart:    cycle.startsAt,
          periodEnd:      cycle.endsAt,
          summaryData:    summary as any,
          generatedAt:    new Date(),
        },
      });
    } catch (err) {
      logger.error("Failed to build cycle summary", { err, cycleId: cycle.id });
    }

    // 3. Extract headline metrics for the email
    const respondentCount = summary?.respondentCount ?? 0;
    const orgScores = summary?.organisationScores;
    const overall   = orgScores?.subscales.find((s: any) => s.subscale === "total");
    const avgScore  = overall ? (overall.avg as number) : null;

    // Top / lowest dimension (exclude "total")
    const dims = orgScores?.subscales.filter((s: any) => s.subscale !== "total") ?? [];
    const sortedDims = [...dims].sort((a: any, b: any) => b.avg - a.avg);
    const topDimension    = sortedDims[0]?.label as string | undefined;
    const lowestDimension = sortedDims[sortedDims.length - 1]?.label as string | undefined;

    // 4. Notify the closing HR/Executive user
    const closingUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, firstName: true },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (closingUser?.email) {
      sendCycleClosedNotification({
        recipientEmail:    closingUser.email,
        recipientName:     closingUser.firstName ?? undefined,
        organisationName:  cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr ?? undefined,
        cycleTitle:        cycle.title,
        assessmentName:    cycle.assessment.name,
        assessmentNameAr:  cycle.assessment.nameAr ?? undefined,
        respondentCount,
        avgScore:          avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        topDimension:      dims.length > 0 ? topDimension : undefined,
        lowestDimension:   dims.length > 1 ? lowestDimension : undefined,
        dashboardUrl:      `${appUrl}/dashboard`,
      }).catch((err) => logger.error("sendCycleClosedNotification failed", { err }));
    }

    return res.json({ message: "Cycle closed successfully", cycleId: cycle.id, respondentCount });
  }
);

// ─── PATCH /api/assessments/cycles/:id/publish ───────────────────────────────
// Marks results as published and sends team pulse email to stored recipients.

assessmentsRouter.patch(
  "/cycles/:id/publish",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: true, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
      return res.status(403).json({ error: "Access denied" });
    if (cycle.status !== "CLOSED")
      return res.status(409).json({ error: "Only CLOSED cycles can be published" });
    if (cycle.resultsPublishedAt)
      return res.status(409).json({ error: "Results already published for this cycle" });

    await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data:  { resultsPublishedAt: new Date() },
    });

    // Send team pulse to stored recipient list (non-blocking)
    const emails = (cycle.recipientEmails as string[] | null) ?? [];
    if (emails.length > 0) {
      sendTeamPulseNotification({
        recipientEmails:    emails,
        organisationName:   cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr ?? undefined,
        cycleTitle:         cycle.title,
        assessmentName:     cycle.assessment.name,
        assessmentNameAr:   cycle.assessment.nameAr ?? undefined,
      }).catch((err) => logger.error("sendTeamPulseNotification failed", { err }));
    }

    return res.json({
      message:    "Results published. Team pulse sent to stored recipients.",
      cycleId:    cycle.id,
      recipients: emails.length,
    });
  }
);

// ─── GET /api/assessments/cycles/by-token/:token — public employee entry ──────

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
            id: true, name: true, nameAr: true, logoUrl: true,
            departments: {
              select: { id: true, name: true, nameAr: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });

    if (!cycle)                return res.status(404).json({ error: "Assessment link not found" });
    if (cycle.status !== "ACTIVE") return res.status(410).json({ error: "This assessment is no longer active" });
    if (new Date() > cycle.endsAt)  return res.status(410).json({ error: "This assessment has expired" });

    const { departments, ...org } = cycle.organisation;
    return res.json({
      cycleId:      cycle.id,
      title:        cycle.title,
      endsAt:       cycle.endsAt,
      assessment:   cycle.assessment,
      organisation: org,
      departments,
    });
  }
);
