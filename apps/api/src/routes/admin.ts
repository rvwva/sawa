import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

export const adminRouter = Router();

// ─── GET /api/admin/dashboard — platform-wide stats ──────────────────────────

adminRouter.get(
  "/dashboard",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [totalOrgs, activeCycles, totalRespondents, recentLogs] = await Promise.all([
        prisma.organisation.count(),
        prisma.assessmentCycle.count({ where: { status: "ACTIVE" } }),
        prisma.respondent.count({ where: { submittedAt: { not: null } } }),
        prisma.auditLog.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        }),
      ]);
      return res.json({ totalOrgs, activeCycles, totalRespondents, recentLogs });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/admin/organisations — list all orgs with activity summary ───────

adminRouter.get(
  "/organisations",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const orgs = await prisma.organisation.findMany({
        include: {
          _count: { select: { users: true, cycles: true } },
          cycles: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              endsAt: true,
              _count: { select: { respondents: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(orgs);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/admin/organisations/:id — single org detail ────────────────────

adminRouter.get(
  "/organisations/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await prisma.organisation.findUnique({
        where: { id: req.params.id },
        include: {
          departments: { select: { id: true, name: true, nameAr: true }, orderBy: { name: "asc" } },
          users: {
            where: { deletedAt: null },
            select: {
              id: true, email: true, firstName: true, lastName: true,
              role: true, isActive: true, lastLoginAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          cycles: {
            include: {
              assessment: { select: { type: true, name: true, nameAr: true } },
              _count: { select: { respondents: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!org) return res.status(404).json({ error: "Organisation not found" });
      return res.json(org);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/admin/organisations ───────────────────────────────────────────

adminRouter.post(
  "/organisations",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, nameAr, slug, industry, sizeRange, cycleFrequencyDays } = req.body;
      if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

      const org = await prisma.organisation.create({
        data: {
          name,
          nameAr:  nameAr  ?? null,
          slug,
          industry: industry ?? null,
          sizeRange: sizeRange ?? null,
          ...(cycleFrequencyDays != null ? { cycleFrequencyDays: Number(cycleFrequencyDays) } : {}),
        },
      });
      return res.status(201).json(org);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/admin/organisations/:id ──────────────────────────────────────

adminRouter.patch(
  "/organisations/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, nameAr, industry, sizeRange, cycleFrequencyDays } = req.body;
      const org = await prisma.organisation.update({
        where: { id: req.params.id },
        data: {
          ...(name               != null ? { name }               : {}),
          ...(nameAr             != null ? { nameAr }             : {}),
          ...(industry           != null ? { industry }           : {}),
          ...(sizeRange          != null ? { sizeRange }          : {}),
          ...(cycleFrequencyDays != null ? { cycleFrequencyDays: Number(cycleFrequencyDays) } : {}),
        },
      });
      return res.json(org);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────

adminRouter.get(
  "/audit-log",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page  = parseInt(req.query.page  as string ?? "1",  10);
      const limit = Math.min(parseInt(req.query.limit as string ?? "50", 10), 200);
      const skip  = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        }),
        prisma.auditLog.count(),
      ]);

      return res.json({ logs, total, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/admin/organisations/:orgId/employees/upload ───────────────────
// Accepts a JSON array of { email, department } rows parsed from a CSV on the
// client. Upserts all rows (replace list on re-upload via delete + insert).
// Requires ADMIN role; EXECUTIVE may upload only for their own org.

adminRouter.post(
  "/organisations/:orgId/employees/upload",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;

      if (req.user!.role === "EXECUTIVE" && req.user!.organisationId !== orgId)
        return res.status(403).json({ error: "Access denied" });

      const rows = req.body as { email: string; department?: string }[];
      if (!Array.isArray(rows) || rows.length === 0)
        return res.status(400).json({ error: "No employee rows provided" });

      const cleaned = rows
        .map((r) => ({ email: r.email?.trim().toLowerCase(), department: r.department?.trim() || null }))
        .filter((r) => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

      if (cleaned.length === 0)
        return res.status(400).json({ error: "No valid email addresses found" });

      // Replace the existing list for this org atomically
      await prisma.$transaction([
        prisma.employee.deleteMany({ where: { organisationId: orgId } }),
        prisma.employee.createMany({ data: cleaned.map((r) => ({ ...r, organisationId: orgId })) }),
      ]);

      // Return summary: total + counts per department (never individual emails)
      const summary = await prisma.employee.groupBy({
        by: ["department"],
        where: { organisationId: orgId },
        _count: { id: true },
        orderBy: { department: "asc" },
      });

      return res.json({
        total: cleaned.length,
        byDepartment: summary.map((s) => ({
          department: s.department ?? "(no department)",
          count: s._count.id,
        })),
      });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/admin/organisations/:orgId/employees/summary ───────────────────
// Returns aggregate counts only — never individual emails.

adminRouter.get(
  "/organisations/:orgId/employees/summary",
  requireAuth,
  requireRole("ADMIN", "EXECUTIVE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;

      if (req.user!.role === "EXECUTIVE" && req.user!.organisationId !== orgId)
        return res.status(403).json({ error: "Access denied" });

      const [total, byDept] = await Promise.all([
        prisma.employee.count({ where: { organisationId: orgId } }),
        prisma.employee.groupBy({
          by: ["department"],
          where: { organisationId: orgId },
          _count: { id: true },
          orderBy: { department: "asc" },
        }),
      ]);

      return res.json({
        total,
        byDepartment: byDept.map((s) => ({
          department: s.department ?? "(no department)",
          count: s._count.id,
        })),
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/admin/data-retention ──────────────────────────────────────────

adminRouter.post(
  "/data-retention",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const retentionYears = parseInt(process.env.DATA_RETENTION_YEARS ?? "5", 10);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

      const deleted = await prisma.respondent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      return res.json({
        message: `Deleted ${deleted.count} respondent records older than ${retentionYears} years`,
      });
    } catch (err) {
      next(err);
    }
  }
);
