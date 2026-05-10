import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireOrgAccess } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";

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

      const [totalCycles, activeCycles, totalRespondents, recentScores] = await Promise.all([
        prisma.assessmentCycle.count({ where: { organisationId } }),
        prisma.assessmentCycle.count({ where: { organisationId, status: "ACTIVE" } }),
        prisma.respondent.count({
          where: { cycle: { organisationId }, submittedAt: { not: null } },
        }),
        prisma.score.findMany({
          where: {
            respondent: { cycle: { organisationId } },
            subscale: "total",
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { scaledScore: true, band: true, createdAt: true },
        }),
      ]);

      const avgScore =
        recentScores.length > 0
          ? recentScores.reduce((a, b) => a + b.scaledScore, 0) / recentScores.length
          : null;

      return res.json({
        totalCycles,
        activeCycles,
        totalRespondents,
        avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
      });
    } catch (err) { next(err); }
  }
);
