import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { auditLog } from "../middleware/audit";
import { AuditAction } from "@prisma/client";
import { logger } from "../lib/logger";

export const responsesRouter = Router();

const SCORING_URL = process.env.SCORING_SERVICE_URL ?? "http://localhost:8000";
const SCORING_KEY = process.env.SCORING_SERVICE_API_KEY ?? "dev-scoring-key";

const ASSESSMENT_ROUTE: Record<string, string> = {
  CBI: "cbi",
  PSS: "pss",
  WHO5: "who5",
  CULTURE: "culture",
};

/**
 * POST /api/responses/submit
 *
 * Body:
 *   cycleToken    string   — the cycle's linkToken
 *   departmentId  string?  — optional, employee's department
 *   consentIp     string   — client IP (set by API from request)
 *   consentVersion string  — consent text version
 *   responses     Record<string, number>
 */
responsesRouter.post(
  "/submit",
  [
    body("cycleToken").isString().notEmpty(),
    body("responses").isObject(),
    body("consentGiven").equals("true").withMessage("Consent is required"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { cycleToken, departmentId, consentVersion, responses } = req.body;

      const cycle = await prisma.assessmentCycle.findUnique({
        where: { linkToken: cycleToken },
        include: { assessment: true },
      });

      if (!cycle) return res.status(404).json({ error: "Assessment link not found" });
      if (cycle.status !== "ACTIVE") return res.status(410).json({ error: "Assessment not active" });
      if (new Date() > cycle.endsAt) return res.status(410).json({ error: "Assessment expired" });

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
        req.socket.remoteAddress ??
        "unknown";

      const respondent = await prisma.respondent.create({
        data: {
          cycleId: cycle.id,
          departmentId: departmentId ?? null,
          consentGiven: true,
          consentAt: new Date(),
          consentIp: clientIp,
          consentVersion: consentVersion ?? "1.0",
          submittedAt: new Date(),
        },
      });

      const responseRows = Object.entries(responses as Record<string, number>).map(
        ([questionKey, rawValue]) => ({
          respondentId: respondent.id,
          questionKey,
          rawValue: Number(rawValue),
        })
      );
      await prisma.response.createMany({ data: responseRows });

      const assessmentType = cycle.assessment.type;
      const scoringRoute = ASSESSMENT_ROUTE[assessmentType];

      let scoringResult: Record<string, any> = {};
      try {
        const { data } = await axios.post(
          `${SCORING_URL}/score/${scoringRoute}`,
          { responses },
          { headers: { "X-Scoring-Key": SCORING_KEY }, timeout: 10_000 }
        );
        scoringResult = data.result;
      } catch (err) {
        logger.error("Scoring service error", { err });
      }

      const scoreRows = buildScoreRows(respondent.id, scoringResult);
      if (scoreRows.length > 0) {
        await prisma.score.createMany({ data: scoreRows });
      }

      await auditLog(AuditAction.RESPONSE_SUBMITTED, {
        entityType: "Respondent",
        entityId: respondent.id,
        req,
      });
      await auditLog(AuditAction.CONSENT_GIVEN, {
        entityType: "Respondent",
        entityId: respondent.id,
        metadata: { consentVersion, cycleId: cycle.id },
        req,
      });

      return res.status(201).json({
        sessionToken: respondent.sessionToken,
        scores: scoringResult,
      });
    } catch (err) { next(err); }
  }
);

// GET /api/responses/my-score/:sessionToken — employee retrieves their own score
responsesRouter.get("/my-score/:sessionToken", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const respondent = await prisma.respondent.findUnique({
      where: { sessionToken: req.params.sessionToken },
      include: {
        scores: true,
        cycle: {
          include: {
            assessment: { select: { type: true, name: true } },
            organisation: { select: { name: true } },
          },
        },
      },
    });

    if (!respondent) return res.status(404).json({ error: "Session not found" });

    let deptAvg: Record<string, any> | null = null;
    if (respondent.departmentId) {
      const deptCount = await prisma.respondent.count({
        where: { cycleId: respondent.cycleId, departmentId: respondent.departmentId, submittedAt: { not: null } },
      });
      if (deptCount >= 5) {
        deptAvg = await computeGroupAverage(respondent.cycleId, respondent.departmentId);
      }
    }

    const orgAvg = await computeGroupAverage(respondent.cycleId, null);

    return res.json({
      assessment: respondent.cycle.assessment,
      submittedAt: respondent.submittedAt,
      myScores: respondent.scores,
      orgAverage: orgAvg,
      departmentAverage: deptAvg,
    });
  } catch (err) { next(err); }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildScoreRows(
  respondentId: string,
  result: Record<string, any>
): {
  respondentId: string;
  subscale: string;
  rawScore: number;
  scaledScore: number;
  band: string;
}[] {
  const rows: ReturnType<typeof buildScoreRows> = [];

  // Handle CBI (has subscales object + total)
  if (result.subscales) {
    for (const [key, val] of Object.entries<any>(result.subscales)) {
      rows.push({
        respondentId,
        subscale: key,
        rawScore: val.score,
        scaledScore: val.score,
        band: val.band,
      });
    }
  }
  // Handle PSS / WHO5 total
  if (result.total) {
    rows.push({
      respondentId,
      subscale: "total",
      rawScore: result.total.raw_score ?? result.total.score,
      scaledScore: result.total.score,
      band: result.total.band,
    });
  }
  // Handle Culture (dimensions array + total)
  if (result.dimensions) {
    for (const dim of result.dimensions as any[]) {
      rows.push({
        respondentId,
        subscale: dim.key,
        rawScore: dim.score,
        scaledScore: dim.score,
        band: dim.band,
      });
    }
  }

  return rows;
}

async function computeGroupAverage(
  cycleId: string,
  departmentId: string | null
): Promise<Record<string, { avg: number; band: string }>> {
  const scores = await prisma.score.findMany({
    where: {
      respondent: {
        cycleId,
        ...(departmentId ? { departmentId } : {}),
        submittedAt: { not: null },
      },
    },
    select: { subscale: true, scaledScore: true, band: true },
  });

  const grouped: Record<string, number[]> = {};
  for (const s of scores) {
    (grouped[s.subscale] ??= []).push(s.scaledScore);
  }

  const result: Record<string, { avg: number; band: string }> = {};
  for (const [subscale, vals] of Object.entries(grouped)) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    result[subscale] = { avg: Math.round(avg * 10) / 10, band: bandFromScore(avg) };
  }
  return result;
}

function bandFromScore(score: number): string {
  if (score < 29) return "Low";
  if (score < 51) return "Below Average";
  if (score < 68) return "Moderate";
  return "Good";
}
