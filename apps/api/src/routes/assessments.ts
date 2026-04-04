import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

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
  async (req: Request, res: Response) => {
    const { organisationId, assessmentType, title, startsAt, endsAt } = req.body;

    // Executives can only create cycles for their own org
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
    const cycle = await prisma.assessmentCycle.findUnique({ where: { id: req.params.id } });
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    if (req.user!.role === "EXECUTIVE" && cycle.organisationId !== req.user!.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updated = await prisma.assessmentCycle.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE" },
    });

    return res.json(updated);
  }
);

// GET /api/assessments/cycles/by-token/:token — anonymous employee resolves cycle via link token
assessmentsRouter.get(
  "/cycles/by-token/:token",
  async (req: Request, res: Response) => {
    const cycle = await prisma.assessmentCycle.findUnique({
      where: { linkToken: req.params.token },
      include: {
        assessment: {
          select: { type: true, name: true, nameAr: true, description: true, itemCount: true },
        },
        organisation: { select: { name: true, nameAr: true, logoUrl: true } },
      },
    });

    if (!cycle) return res.status(404).json({ error: "Assessment link not found" });
    if (cycle.status !== "ACTIVE") {
      return res.status(410).json({ error: "This assessment is no longer active" });
    }
    if (new Date() > cycle.endsAt) {
      return res.status(410).json({ error: "This assessment has expired" });
    }

    return res.json({
      cycleId: cycle.id,
      title: cycle.title,
      endsAt: cycle.endsAt,
      assessment: cycle.assessment,
      organisation: cycle.organisation,
    });
  }
);
