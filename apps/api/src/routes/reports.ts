import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireOrgAccess } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction, AssessmentType } from "@prisma/client";

export const reportsRouter = Router();

// GET /api/reports — list reports for an organisation
reportsRouter.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  requireOrgAccess((req) => req.query.organisationId as string),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId =
        req.user!.role === "ADMIN"
          ? (req.query.organisationId as string)
          : req.user!.organisationId!;

      const reports = await prisma.report.findMany({
        where: { organisationId: orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          periodStart: true,
          periodEnd: true,
          pdfUrl: true,
          generatedAt: true,
          createdAt: true,
          cycle: {
            select: { title: true, assessment: { select: { type: true, name: true } } },
          },
        },
      });

      return res.json(reports);
    } catch (err) { next(err); }
  }
);

// GET /api/reports/:id/summary — get aggregated results for a cycle
reportsRouter.get(
  "/:id/summary",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await prisma.report.findUnique({
        where: { id: req.params.id },
        include: {
          organisation: { select: { name: true } },
          cycle: {
            include: {
              assessment: { select: { type: true, name: true } },
              respondents: {
                where: { submittedAt: { not: null } },
                include: { scores: true, department: { select: { name: true } } },
              },
            },
          },
        },
      });

      if (!report) return res.status(404).json({ error: "Report not found" });
      if (
        req.user!.role === "EXECUTIVE" &&
        report.organisationId !== req.user!.organisationId
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      await auditLog(AuditAction.REPORT_GENERATED, {
        userId: req.user!.userId,
        entityType: "Report",
        entityId: report.id,
        req,
      });

      return res.json(report);
    } catch (err) { next(err); }
  }
);

// POST /api/reports/generate — trigger on-demand report generation for a cycle
reportsRouter.post(
  "/generate",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycleId, type } = req.body;

      const cycle = await prisma.assessmentCycle.findUnique({
        where: { id: cycleId },
        include: { organisation: true },
      });
      if (!cycle) return res.status(404).json({ error: "Cycle not found" });

      if (
        req.user!.role === "EXECUTIVE" &&
        cycle.organisationId !== req.user!.organisationId
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      const report = await prisma.report.create({
        data: {
          organisationId: cycle.organisationId,
          cycleId: cycle.id,
          type: type ?? "AD_HOC",
          periodStart: cycle.startsAt,
          periodEnd: cycle.endsAt,
        },
      });

      return res.status(202).json({
        message: "Report generation queued",
        reportId: report.id,
      });
    } catch (err) { next(err); }
  }
);

// GET /api/reports/dashboard/:organisationId — dashboard stats
reportsRouter.get(
  "/dashboard/:organisationId",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  requireOrgAccess((req) => req.params.organisationId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organisationId } = req.params;

      const ACTIVE_TYPES = new Set(["CBI", "CULTURE", "PSYCH_SAFETY", "TURNOVER", "LMX7"]);

      const [totalCycles, activeCycles, totalRespondents, totalEnrolled, cycleTypeRows] =
        await Promise.all([
          prisma.assessmentCycle.count({ where: { organisationId } }),
          prisma.assessmentCycle.count({ where: { organisationId, status: "ACTIVE" } }),
          prisma.respondent.count({
            where: { cycle: { organisationId }, submittedAt: { not: null } },
          }),
          prisma.respondent.count({
            where: { cycle: { organisationId, status: { not: "DRAFT" } } },
          }),
          // Use raw SQL so we get type as plain text — avoids Prisma enum-validation
          // errors if the DB still contains a legacy value (PSS / WHO5) before migration.
          prisma.$queryRaw<{ type: string }[]>`
            SELECT DISTINCT a.type::text AS type
            FROM   assessment_cycles ac
            JOIN   assessments a ON a.id = ac.assessment_id
            WHERE  ac.organisation_id = ${organisationId}
              AND  ac.status != 'ARCHIVED'
          `,
        ]);

      // Participation rate — always meaningful regardless of assessment mix
      const participationRate =
        totalEnrolled > 0
          ? Math.round((totalRespondents / totalEnrolled) * 1000) / 10
          : null;

      // Average score — only meaningful when all non-archived cycles share one known type
      const distinctTypes = cycleTypeRows.map((r) => r.type).filter((t) => ACTIVE_TYPES.has(t));
      const singleType = distinctTypes.length === 1 ? distinctTypes[0] : null;

      let avgScore: number | null = null;
      let scoreAssessmentType: string | null = null;

      if (singleType) {
        const scores = await prisma.score.findMany({
          where: {
            respondent: {
              cycle: { organisationId, assessment: { type: singleType as AssessmentType } },
              submittedAt: { not: null },
            },
            subscale: "total",
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { scaledScore: true },
        });
        if (scores.length > 0) {
          const sum = scores.reduce((a, b) => a + b.scaledScore, 0);
          avgScore = Math.round((sum / scores.length) * 10) / 10;
          scoreAssessmentType = singleType;
        }
      }

      return res.json({
        totalCycles,
        activeCycles,
        totalRespondents,
        avgScore,
        scoreAssessmentType,
        participationRate,
      });
    } catch (err) { next(err); }
  }
);
