import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export const dataRightsRouter = Router();

/**
 * POST /api/data-rights/access
 * Employee requests to see their own data using their session token.
 */
dataRightsRouter.post("/access", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(400).json({ error: "sessionToken is required" });

    const respondent = await prisma.respondent.findUnique({
      where: { sessionToken },
      include: {
        responses: true,
        scores: true,
        cycle: { include: { assessment: { select: { name: true } } } }, // type via $queryRaw
      },
    });

    if (!respondent) return res.status(404).json({ error: "Session not found" });

    const [drTypeRow] = await prisma.$queryRaw<{ type: string }[]>`
      SELECT type::text AS type FROM assessments WHERE id = ${respondent.cycle.assessmentId}
    `;

    return res.json({
      submittedAt: respondent.submittedAt,
      consentAt: respondent.consentAt,
      consentVersion: respondent.consentVersion,
      assessment: { ...respondent.cycle.assessment, type: drTypeRow?.type ?? null },
      responses: respondent.responses,
      scores: respondent.scores,
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/data-rights/delete
 * Employee requests deletion of their assessment data.
 * Creates a deletion request and immediately soft-deletes respondent data.
 */
dataRightsRouter.post("/delete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(400).json({ error: "sessionToken is required" });

    const respondent = await prisma.respondent.findUnique({ where: { sessionToken } });
    if (!respondent) return res.status(404).json({ error: "Session not found" });

    await prisma.dataDeletionRequest.create({
      data: { sessionToken, processedAt: new Date(), status: "COMPLETED" },
    });

    await prisma.respondent.delete({ where: { sessionToken } });

    return res.json({ message: "Your data has been deleted successfully." });
  } catch (err) { next(err); }
});
