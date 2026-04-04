import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

export const adminRouter = Router();

// GET /api/admin/audit-log
adminRouter.get(
  "/audit-log",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string ?? "1", 10);
    const limit = Math.min(parseInt(req.query.limit as string ?? "50", 10), 200);
    const skip = (page - 1) * limit;

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

// GET /api/admin/organisations
adminRouter.get(
  "/organisations",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response) => {
    const orgs = await prisma.organisation.findMany({
      include: {
        _count: { select: { users: true, cycles: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(orgs);
  }
);

// POST /api/admin/organisations
adminRouter.post(
  "/organisations",
  requireAuth,
  requireRole("ADMIN"),
  async (req: Request, res: Response) => {
    const { name, nameAr, slug, industry, sizeRange } = req.body;
    const org = await prisma.organisation.create({
      data: { name, nameAr, slug, industry, sizeRange },
    });
    return res.status(201).json(org);
  }
);

// POST /api/admin/data-retention — manual trigger for data retention cleanup
adminRouter.post(
  "/data-retention",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: Request, res: Response) => {
    const retentionYears = parseInt(process.env.DATA_RETENTION_YEARS ?? "5", 10);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

    // Delete respondent records older than retention period (cascades to responses + scores)
    const deleted = await prisma.respondent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return res.json({ message: `Deleted ${deleted.count} respondent records older than ${retentionYears} years` });
  }
);
