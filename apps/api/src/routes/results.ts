/**
 * Results Router  —  /api/results
 * ================================
 * Aggregated assessment results for the Executive / Admin dashboard.
 * All endpoints require authentication and org-scoped RBAC.
 *
 * Routes:
 *   GET /api/results/cycle/:cycleId             — org-level aggregated scores
 *   GET /api/results/cycle/:cycleId/departments — department breakdown (min 5 rule)
 *   GET /api/results/cycle/:cycleId/response-rate — live response rate
 *   GET /api/results/cycle/:cycleId/trend       — cross-cycle trend for same type
 *   GET /api/results/cycle/:cycleId/export      — full data export (audit-logged)
 */

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireOrgAccess } from "../middleware/rbac";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";
import {
  aggregateCycleScores,
  aggregateDepartmentScores,
  aggregateDemographicScores,
  getResponseRate,
  getCycleTrend,
  buildCycleSummary,
  MIN_DEPT_RESPONDENTS,
} from "../services/scoring";

export const resultsRouter = Router();

// ─── Guard helpers ────────────────────────────────────────────────────────────

/** Resolves a cycle and verifies the caller has access to its organisation. */
async function resolveCycle(cycleId: string, req: Request, res: Response) {
  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id: cycleId },
    include: {
      assessment: { select: { type: true, name: true, nameAr: true } },
      organisation: { select: { id: true, name: true } },
      _count: { select: { respondents: true } },
    },
  });

  if (!cycle) {
    res.status(404).json({ error: "Cycle not found" });
    return null;
  }

  if (
    req.user!.role === "EXECUTIVE" &&
    cycle.organisationId !== req.user!.organisationId
  ) {
    res.status(403).json({ error: "Access denied: not your organisation" });
    return null;
  }

  return cycle;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/cycle/:cycleId
// Organisation-level aggregated scores for a completed or active cycle.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.get(
  "/cycle/:cycleId",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;

      const agg = await aggregateCycleScores(cycle.id);

      if (!agg || agg.respondentCount === 0) {
        return res.json({
          cycleId: cycle.id,
          title: cycle.title,
          status: cycle.status,
          assessment: cycle.assessment,
          organisation: cycle.organisation,
          respondentCount: 0,
          subscales: [],
          message: "No submissions yet for this cycle.",
        });
      }

      return res.json({
        cycleId: cycle.id,
        title: cycle.title,
        status: cycle.status,
        startsAt: cycle.startsAt,
        endsAt: cycle.endsAt,
        closedAt: cycle.closedAt,
        assessment: cycle.assessment,
        organisation: cycle.organisation,
        respondentCount: agg.respondentCount,
        subscales: agg.subscales,
        overall: agg.subscales.find((s) => s.subscale === "total") ?? null,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/cycle/:cycleId/departments
// Per-department breakdown. Departments with < 5 respondents are excluded.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.get(
  "/cycle/:cycleId/departments",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;

      const [orgAgg, deptAggs] = await Promise.all([
        aggregateCycleScores(cycle.id),
        aggregateDepartmentScores(cycle.id),
      ]);

      return res.json({
        cycleId: cycle.id,
        title: cycle.title,
        assessment: cycle.assessment,
        minimumRespondentsRequired: MIN_DEPT_RESPONDENTS,
        organisation: {
          ...cycle.organisation,
          respondentCount: orgAgg?.respondentCount ?? 0,
          subscales: orgAgg?.subscales ?? [],
        },
        departments: deptAggs,
        excludedDepartmentsNote:
          `Departments with fewer than ${MIN_DEPT_RESPONDENTS} respondents are excluded to preserve anonymity.`,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/cycle/:cycleId/response-rate
// Live submission count + rate. Safe to poll while a cycle is ACTIVE.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.get(
  "/cycle/:cycleId/response-rate",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;

      const rate = await getResponseRate(cycle.id);

      return res.json({
        cycleId: cycle.id,
        title: cycle.title,
        status: cycle.status,
        endsAt: cycle.endsAt,
        ...rate,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/cycle/:cycleId/trend
// Cross-cycle "total" score trend for the same assessment type in this org.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.get(
  "/cycle/:cycleId/trend",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;

      const limit = Math.min(parseInt(req.query.limit as string ?? "12", 10), 24);
      const trend = await getCycleTrend(
        cycle.organisationId,
        cycle.assessment.type,
        limit
      );

      return res.json({
        organisationId: cycle.organisationId,
        assessmentType: cycle.assessment.type,
        assessmentName: cycle.assessment.name,
        dataPoints: trend,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/cycle/:cycleId/export
// Full anonymised data export: all respondent scores as JSON.
// Requires ADMIN or EXECUTIVE role. Audit-logged.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.get(
  "/cycle/:cycleId/export",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;

      await auditLog(AuditAction.DATA_EXPORT, {
        userId: req.user!.userId,
        entityType: "AssessmentCycle",
        entityId: cycle.id,
        metadata: { exportedBy: req.user!.email ?? req.user!.userId },
        req,
      });

      const respondents = await prisma.respondent.findMany({
        where: { cycleId: cycle.id, submittedAt: { not: null } },
        select: {
          id: true,
          departmentId: true,
          consentAt: true,
          consentVersion: true,
          submittedAt: true,
          department: { select: { name: true } },
          scores: {
            select: { subscale: true, scaledScore: true, band: true },
            orderBy: { subscale: "asc" },
          },
        },
        orderBy: { submittedAt: "asc" },
      });

      return res.json({
        exportedAt: new Date().toISOString(),
        cycleId: cycle.id,
        cycleTitle: cycle.title,
        assessmentType: cycle.assessment.type,
        assessmentName: cycle.assessment.name,
        organisationName: cycle.organisation.name,
        respondentCount: respondents.length,
        respondents: respondents.map((r, i) => ({
          respondentIndex: i + 1,
          departmentName: r.department?.name ?? null,
          consentAt: r.consentAt,
          consentVersion: r.consentVersion,
          submittedAt: r.submittedAt,
          scores: r.scores,
        })),
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/cycle/:cycleId/demographics
// Scores grouped by isSaudiNational, tenureRange, seniorityLevel.
// Segments with < MIN_DEPT_RESPONDENTS respondents are suppressed.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.get(
  "/cycle/:cycleId/demographics",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;
      const breakdown = await aggregateDemographicScores(cycle.id);
      return res.json(breakdown);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/results/cycle/:cycleId/snapshot
// Build + cache a summary snapshot into reports.summary_data.
// Called automatically when a cycle closes; can also be triggered manually.
// ─────────────────────────────────────────────────────────────────────────────
resultsRouter.post(
  "/cycle/:cycleId/snapshot",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await resolveCycle(req.params.cycleId, req, res);
      if (!cycle) return;

      const summary = await buildCycleSummary(cycle.id);

      const existing = await prisma.report.findFirst({
        where: { cycleId: cycle.id, type: "AD_HOC" },
      });

      const report = existing
        ? await prisma.report.update({
            where: { id: existing.id },
            data: { summaryData: summary as any, generatedAt: new Date() },
          })
        : await prisma.report.create({
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

      return res.json({ reportId: report.id, summary });
    } catch (err) { next(err); }
  }
);
