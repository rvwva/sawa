import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

export const adminRouter = Router();

// ─── GET /api/admin/dashboard — platform-wide stats ──────────────────────────

adminRouter.get(
  "/dashboard",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response) => {
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
  }
);

// ─── GET /api/admin/organisations — list all orgs with activity summary ───────

adminRouter.get(
  "/organisations",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response) => {
    const orgs = await prisma.organisation.findMany({
      include: {
        _count: { select: { users: true, cycles: true } },
        // Pull the most recent cycle to surface participation quickly
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
  }
);

// ─── GET /api/admin/organisations/:id — single org detail ────────────────────

adminRouter.get(
  "/organisations/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
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
  }
);

// ─── POST /api/admin/organisations ───────────────────────────────────────────

adminRouter.post(
  "/organisations",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
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
  }
);

// ─── PATCH /api/admin/organisations/:id ──────────────────────────────────────

adminRouter.patch(
  "/organisations/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
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
  }
);

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────

adminRouter.get(
  "/audit-log",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
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
  }
);

// ─── POST /api/admin/data-retention ──────────────────────────────────────────

adminRouter.post(
  "/data-retention",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response) => {
    const retentionYears = parseInt(process.env.DATA_RETENTION_YEARS ?? "5", 10);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

    const deleted = await prisma.respondent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return res.json({
      message: `Deleted ${deleted.count} respondent records older than ${retentionYears} years`,
    });
  }
);
