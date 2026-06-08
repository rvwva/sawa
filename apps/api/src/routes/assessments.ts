import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction, Prisma } from "@prisma/client";
import { aggregateCycleScores, aggregateDepartmentScores, buildCycleSummary } from "../services/scoring";
import {
  sendCycleClosedNotification,
  sendCycleInvite,
  sendCycleReminder,
  sendTeamPulseNotification,
} from "../services/email";
import { logger } from "../lib/logger";

export const assessmentsRouter = Router();

// ─── GET /api/assessments — list all assessment types ─────────────────────────

assessmentsRouter.get("/", requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const assessments = await prisma.$queryRaw<Array<{
      id: string; type: string; name: string; nameAr: string | null;
      description: string | null; itemCount: number; version: string;
    }>>`
      SELECT id, type::text AS type, name, name_ar AS "nameAr",
             description, item_count AS "itemCount", version
      FROM   assessments
      ORDER  BY type
    `;
    return res.json(assessments);
  } catch (err) { next(err); }
});

// ─── GET /api/assessments/:type/schema ────────────────────────────────────────

assessmentsRouter.get("/:type/schema", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [assessment] = await prisma.$queryRaw<Array<{
      id: string; type: string; name: string; nameAr: string | null; surveySchema: any;
    }>>`
      SELECT id, type::text AS type, name, name_ar AS "nameAr",
             survey_schema AS "surveySchema"
      FROM   assessments
      WHERE  type::text = ${req.params.type.toUpperCase()}
    `;
    if (!assessment) return res.status(404).json({ error: "Assessment type not found" });
    return res.json(assessment);
  } catch (err) { next(err); }
});

// ─── POST /api/assessments/cycles — create cycle ──────────────────────────────

assessmentsRouter.post(
  "/cycles",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  [
    body("title").notEmpty().isString(),
    body("assessmentType").isIn(["CBI", "CULTURE", "PSYCH_SAFETY", "TURNOVER", "LMX7"]),
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (err) { next(err); }
  }
);

// ─── GET /api/assessments/cycles — list cycles for org ───────────────────────

assessmentsRouter.get(
  "/cycles",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId =
        req.user!.role === "ADMIN"
          ? (req.query.organisationId as string)
          : req.user!.organisationId;

      const cycles = await prisma.assessmentCycle.findMany({
        where: { organisationId: orgId ?? undefined },
        include: {
          assessment: { select: { name: true } },
          _count:     { select: { respondents: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Fetch assessment types as plain text — avoids Prisma enum deserialization
      // errors if the DB still contains a legacy type (PSS / WHO5).
      const assessmentIds = [...new Set(cycles.map((c) => c.assessmentId))];
      const typeMap = new Map<string, string>();
      if (assessmentIds.length > 0) {
        const rows = await prisma.$queryRaw<{ id: string; type: string }[]>(
          Prisma.sql`SELECT id, type::text AS type FROM assessments WHERE id IN (${Prisma.join(assessmentIds)})`
        );
        rows.forEach((r) => typeMap.set(r.id, r.type));
      }

      return res.json(
        cycles.map((c) => ({
          ...c,
          assessment: { name: c.assessment.name, type: typeMap.get(c.assessmentId) ?? null },
        }))
      );
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/assessments/cycles/:id/activate ───────────────────────────────
// Activates a cycle and optionally stores + sends invitations.

assessmentsRouter.patch(
  "/cycles/:id/activate",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: { select: { name: true, nameAr: true } }, organisation: true },
    });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
      return res.status(403).json({ error: "Access denied" });
    if (cycle.status !== "DRAFT")
      return res.status(409).json({ error: `Cycle is already ${cycle.status}` });

    let { recipientEmails } = req.body as { recipientEmails?: string[] };

    // Fetch full employee list once — used for recipients, dept links, and routing
    const allEmployees = await prisma.employee.findMany({
      where:  { organisationId: cycle.organisationId },
      select: { email: true, department: true },
    });

    // If no emails supplied, fall back to the org's uploaded employee list
    if ((!recipientEmails || recipientEmails.length === 0) && allEmployees.length > 0) {
      recipientEmails = allEmployees.map((e) => e.email);
      logger.info(`Auto-populated ${recipientEmails.length} recipients from employee list`, { cycleId: cycle.id });
    }

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

    // Generate one department-specific link per unique department in the employee list
    const uniqueDepts = [...new Set(
      allEmployees.map((e) => e.department).filter((d): d is string => !!d)
    )];
    let deptLinkMap = new Map<string, string>(); // dept name (lower) → link token
    if (uniqueDepts.length > 0) {
      await prisma.cycleDepartmentLink.createMany({
        data: uniqueDepts.map((departmentName) => ({ cycleId: cycle.id, departmentName })),
        skipDuplicates: true,
      });
      const deptLinks = await prisma.cycleDepartmentLink.findMany({
        where:  { cycleId: cycle.id },
        select: { departmentName: true, token: true },
      });
      deptLinkMap = new Map(deptLinks.map((l) => [l.departmentName.toLowerCase(), l.token]));
      logger.info(`Generated ${uniqueDepts.length} department links`, { cycleId: cycle.id });
    }

    // Send personalized invitations — each employee gets their department-specific link
    if (recipientEmails && recipientEmails.length > 0) {
      const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const baseParams = {
        organisationName:   cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr ?? undefined,
        assessmentName:     cycle.assessment.name,
        assessmentNameAr:   cycle.assessment.nameAr ?? undefined,
        cycleTitle:         cycle.title,
        endsAt:             cycle.endsAt,
      };

      if (deptLinkMap.size > 0) {
        // Build email → dept lookup from the employee list
        const emailDeptMap = new Map(allEmployees.map((e) => [e.email, e.department ?? null]));
        const generalUrl = `${appUrl}/assess/${cycle.linkToken}`;

        // Group recipients by the URL they should receive
        const urlGroups = new Map<string, string[]>();
        for (const email of recipientEmails) {
          const dept  = emailDeptMap.get(email);
          const token = dept ? deptLinkMap.get(dept.toLowerCase()) : undefined;
          const url   = token ? `${appUrl}/assess/${token}` : generalUrl;
          const group = urlGroups.get(url) ?? [];
          group.push(email);
          urlGroups.set(url, group);
        }

        // One sendCycleInvite call per unique dept URL (non-blocking)
        for (const [assessmentUrl, emails] of urlGroups) {
          sendCycleInvite({ ...baseParams, recipientEmails: emails, assessmentUrl })
            .catch((err) => logger.error("sendCycleInvite failed", { err, assessmentUrl, count: emails.length }));
        }
      } else {
        // No dept links — send the general link to everyone
        sendCycleInvite({ ...baseParams, recipientEmails, assessmentUrl: `${appUrl}/assess/${cycle.linkToken}` })
          .catch((err) => logger.error("sendCycleInvite failed", { err }));
      }
    }

    return res.json(updated);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/assessments/cycles/:id/remind — manual reminder blast ─────────

assessmentsRouter.patch(
  "/cycles/:id/remind",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  [body("recipientEmails").optional().isArray()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const cycle = await prisma.assessmentCycle.findUnique({
        where:   { id: req.params.id },
        include: { assessment: { select: { name: true, nameAr: true } }, organisation: true },
      });
      if (!cycle)                 return res.status(404).json({ error: "Cycle not found" });
      if (cycle.status !== "ACTIVE") return res.status(409).json({ error: "Only ACTIVE cycles can send reminders" });
      if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
        return res.status(403).json({ error: "Access denied" });

      const emails: string[] =
        (req.body.recipientEmails && req.body.recipientEmails.length > 0)
          ? req.body.recipientEmails
          : (cycle.recipientEmails as string[] | null) ?? [];

      if (emails.length === 0)
        return res.status(400).json({ error: "No recipient emails available" });

      const daysRemaining = Math.ceil(
        (cycle.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      // Record send time immediately, then fire email non-blocking (same
      // pattern as activate/publish — don't block the response on SendGrid).
      await prisma.assessmentCycle.update({
        where: { id: cycle.id },
        data:  { reminderSentAt: new Date() },
      });

      sendCycleReminder({
        recipientEmails:    emails,
        organisationName:   cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr ?? undefined,
        assessmentName:     cycle.assessment.name,
        assessmentNameAr:   cycle.assessment.nameAr ?? undefined,
        cycleTitle:         cycle.title,
        assessmentUrl:      `${appUrl}/assess/${cycle.linkToken}`,
        endsAt:             cycle.endsAt,
        daysRemaining,
      }).catch((err) => logger.error("sendCycleReminder failed", { err }));

      return res.json({ message: `Reminder sent to ${emails.length} recipients` });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/assessments/cycles/:id/close ─────────────────────────────────
// Closes cycle, builds summary, sends exec notification with headline metrics.

assessmentsRouter.patch(
  "/cycles/:id/close",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: { select: { name: true, nameAr: true } }, organisation: true },
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
    const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/assessments/cycles/:id/publish ───────────────────────────────
// Marks results as published and sends team pulse email to stored recipients.

assessmentsRouter.patch(
  "/cycles/:id/publish",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    const cycle = await prisma.assessmentCycle.findUnique({
      where:   { id: req.params.id },
      include: { assessment: { select: { name: true, nameAr: true } }, organisation: true },
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

    // Send dept-scoped results links — each employee sees only their dept + company overall
    const emails = (cycle.recipientEmails as string[] | null) ?? [];
    if (emails.length > 0) {
      const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const generalResultsUrl = `${appUrl}/results/${cycle.linkToken}`;

      const [allEmployees, deptLinks] = await Promise.all([
        prisma.employee.findMany({
          where:  { organisationId: cycle.organisationId },
          select: { email: true, department: true },
        }),
        prisma.cycleDepartmentLink.findMany({
          where:  { cycleId: cycle.id },
          select: { departmentName: true, resultsToken: true },
        }),
      ]);

      const emailDeptMap   = new Map(allEmployees.map((e) => [e.email, e.department ?? null]));
      const deptResultsMap = new Map(deptLinks.map((l) => [l.departmentName.toLowerCase(), l.resultsToken]));

      // Group recipients by the results URL they should receive
      const urlGroups = new Map<string, string[]>();
      for (const email of emails) {
        const dept  = emailDeptMap.get(email);
        const rTok  = dept ? deptResultsMap.get(dept.toLowerCase()) : null;
        const url   = rTok ? `${appUrl}/results/${rTok}` : generalResultsUrl;
        const group = urlGroups.get(url) ?? [];
        group.push(email);
        urlGroups.set(url, group);
      }

      const baseParams = {
        organisationName:   cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr ?? undefined,
        cycleTitle:         cycle.title,
        assessmentName:     cycle.assessment.name,
        assessmentNameAr:   cycle.assessment.nameAr ?? undefined,
      };

      for (const [resultsUrl, recipientEmails] of urlGroups) {
        sendTeamPulseNotification({ ...baseParams, recipientEmails, resultsUrl })
          .catch((err) => logger.error("sendTeamPulseNotification failed", { err, resultsUrl, count: recipientEmails.length }));
      }

      logger.info("publish: team pulse dispatched", {
        cycleId: cycle.id,
        groups: urlGroups.size,
        total: emails.length,
      });
    }

    return res.json({
      message:    "Results published. Team pulse sent to stored recipients.",
      cycleId:    cycle.id,
      recipients: emails.length,
    });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/assessments/cycles/by-token/:token — public employee entry ──────

assessmentsRouter.get(
  "/cycles/by-token/:token",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    const cycleInclude = {
      assessment: {
        // type excluded — fetched via $queryRaw below to avoid enum deserialization errors
        select: { name: true, nameAr: true, description: true, itemCount: true },
      },
      organisation: {
        select: {
          id: true, name: true, nameAr: true, logoUrl: true,
          departments: {
            select: { id: true, name: true, nameAr: true },
            orderBy: { name: "asc" as const },
          },
        },
      },
    };

    // Try the main cycle token first, then fall back to a department link token
    let cycle = await prisma.assessmentCycle.findUnique({
      where: { linkToken: req.params.token },
      include: cycleInclude,
    });
    let departmentLinkToken: string | null = null;

    if (!cycle) {
      const deptLink = await prisma.cycleDepartmentLink.findUnique({
        where: { token: req.params.token },
        include: { cycle: { include: cycleInclude } },
      });
      if (deptLink) {
        cycle = deptLink.cycle as NonNullable<typeof cycle>;
        departmentLinkToken = deptLink.token;
      }
    }

    if (!cycle) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ error: "Assessment link not found" });
    }
    if (cycle.status !== "ACTIVE") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(410).json({ error: "This assessment is no longer active" });
    }
    if (new Date() > cycle.endsAt) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(410).json({ error: "This assessment has expired" });
    }

    // Fetch type as plain text to bypass Prisma enum validation
    const [typeRow] = await prisma.$queryRaw<{ type: string }[]>`
      SELECT type::text AS type FROM assessments WHERE id = ${cycle.assessmentId}
    `;

    const { departments, ...org } = cycle.organisation;
    return res.json({
      cycleId:      cycle.id,
      title:        cycle.title,
      endsAt:       cycle.endsAt,
      assessment:   { ...cycle.assessment, type: typeRow?.type ?? null },
      organisation: org,
      departments,
      ...(departmentLinkToken ? { departmentLinkToken } : {}),
    });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/assessments/cycles/results/:token — public team results ─────────
// Returned only when the cycle's resultsPublishedAt is set. No auth required.
// Token may be the cycle's linkToken (all depts) or a CycleDepartmentLink's
// resultsToken (scoped to that one dept + company overall for comparison).

assessmentsRouter.get(
  "/cycles/results/:token",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycleInclude = {
        assessment:   { select: { name: true, nameAr: true } }, // type fetched via $queryRaw
        organisation: { select: { name: true, nameAr: true, logoUrl: true } },
      };

      let cycle = await prisma.assessmentCycle.findUnique({
        where:   { linkToken: req.params.token },
        include: cycleInclude,
      });
      let filterDeptName: string | null = null;

      if (!cycle) {
        // Try a department-specific results token
        const deptLink = await prisma.cycleDepartmentLink.findUnique({
          where:   { resultsToken: req.params.token },
          include: { cycle: { include: cycleInclude } },
        });
        if (deptLink) {
          cycle = deptLink.cycle as NonNullable<typeof cycle>;
          filterDeptName = deptLink.departmentName;
        }
      }

      if (!cycle) return res.status(404).json({ error: "Results not found" });
      if (!cycle.resultsPublishedAt)
        return res.status(403).json({ error: "Results have not been published yet" });

      // Fetch type as plain text to bypass Prisma enum deserialization
      const [typeRow] = await prisma.$queryRaw<{ type: string }[]>`
        SELECT type::text AS type FROM assessments WHERE id = ${cycle.assessmentId}
      `;

      const [orgAgg, deptAggs] = await Promise.all([
        aggregateCycleScores(cycle.id),
        aggregateDepartmentScores(cycle.id),
      ]);

      // Dept-scoped token: show only the employee's own department
      const departments = filterDeptName
        ? deptAggs.filter((d) => d.departmentName.toLowerCase() === filterDeptName!.toLowerCase())
        : deptAggs;

      return res.json({
        cycleId:            cycle.id,
        cycleTitle:         cycle.title,
        assessmentType:     typeRow?.type ?? null,
        assessmentName:     cycle.assessment.name,
        assessmentNameAr:   cycle.assessment.nameAr,
        organisationName:   cycle.organisation.name,
        organisationNameAr: cycle.organisation.nameAr,
        logoUrl:            cycle.organisation.logoUrl,
        respondentCount:    orgAgg?.respondentCount ?? 0,
        publishedAt:        cycle.resultsPublishedAt,
        organisation:       orgAgg,
        departments,
        // Let the front-end know this is a dept-scoped view
        ...(filterDeptName ? { departmentView: filterDeptName } : {}),
      });
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/assessments/cycles/:id/recipients — update recipient list ────

assessmentsRouter.patch(
  "/cycles/:id/recipients",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await prisma.assessmentCycle.findUnique({ where: { id: req.params.id } });
      if (!cycle) return res.status(404).json({ error: "Cycle not found" });
      if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
        return res.status(403).json({ error: "Access denied" });

      const { emails } = req.body as { emails: string[] };
      if (!Array.isArray(emails)) return res.status(400).json({ error: "emails must be an array" });

      const cleaned = [...new Set(emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean))];
      const updated = await prisma.assessmentCycle.update({
        where: { id: req.params.id },
        data:  { recipientEmails: cleaned },
      });

      return res.json({ recipientEmails: updated.recipientEmails });
    } catch (err) { next(err); }
  }
);
// Must be registered AFTER /cycles/by-token/:token to avoid shadowing.

assessmentsRouter.get(
  "/cycles/:id",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await prisma.assessmentCycle.findUnique({
        where: { id: req.params.id },
        include: {
          assessment:      { select: { name: true, nameAr: true } }, // type via $queryRaw
          organisation:    { select: { id: true, name: true, nameAr: true } },
          departmentLinks: { select: { id: true, departmentName: true, token: true, resultsToken: true }, orderBy: { departmentName: "asc" } },
          _count:          { select: { respondents: true } },
        },
      });
      if (!cycle) return res.status(404).json({ error: "Cycle not found" });
      if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId)
        return res.status(403).json({ error: "Access denied" });
      const [cycleTypeRow] = await prisma.$queryRaw<{ type: string }[]>`
        SELECT type::text AS type FROM assessments WHERE id = ${cycle.assessmentId}
      `;
      return res.json({ ...cycle, assessment: { ...cycle.assessment, type: cycleTypeRow?.type ?? null } });
    } catch (err) {
      next(err);
    }
  }
);
