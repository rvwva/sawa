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
      const { cycleToken, departmentId, departmentLinkToken, consentVersion, responses } = req.body;

      logger.info("submit: received", {
        cycleToken,
        departmentLinkToken: departmentLinkToken ?? null,
        explicitDepartmentId: departmentId ?? null,
      });

      // Try direct cycle linkToken first (regular link), then resolve via dept link token
      let cycle = await prisma.assessmentCycle.findUnique({
        where: { linkToken: cycleToken },
        include: { assessment: true },
      });
      let resolvedDeptName: string | null = null;

      if (!cycle) {
        // When the employee arrived via a dept link, cycleToken IS the dept link token
        const lookupToken = departmentLinkToken ?? cycleToken;
        logger.info("submit: cycle not found by linkToken, trying dept link", { lookupToken });
        const deptLink = await prisma.cycleDepartmentLink.findUnique({
          where:   { token: lookupToken },
          include: { cycle: { include: { assessment: true } } },
        });
        if (deptLink) {
          cycle = deptLink.cycle;
          resolvedDeptName = deptLink.departmentName;
          logger.info("submit: resolved cycle via dept link", {
            cycleId: cycle.id,
            departmentName: resolvedDeptName,
          });
        } else {
          logger.warn("submit: no cycle or dept link found", { lookupToken });
        }
      }

      if (!cycle) return res.status(404).json({ error: "Assessment link not found" });
      if (cycle.status !== "ACTIVE") return res.status(410).json({ error: "Assessment not active" });
      if (new Date() > cycle.endsAt) return res.status(410).json({ error: "Assessment expired" });

      // Resolve departmentId: explicit selector > dept link name > nothing
      let resolvedDeptId: string | null = departmentId ?? null;
      if (!resolvedDeptId && (resolvedDeptName || departmentLinkToken)) {
        const deptName = resolvedDeptName ?? await prisma.cycleDepartmentLink
          .findUnique({ where: { token: departmentLinkToken } })
          .then((l) => l?.departmentName ?? null);

        logger.info("submit: resolving department", {
          deptName,
          organisationId: cycle.organisationId,
        });

        if (deptName) {
          // Find existing Department record; auto-create if absent (dept names come
          // from the employees CSV and may not have a matching Department row yet)
          let dept = await prisma.department.findFirst({
            where: { organisationId: cycle.organisationId, name: { equals: deptName, mode: "insensitive" } },
          });
          if (!dept) {
            dept = await prisma.department.create({
              data: { organisationId: cycle.organisationId, name: deptName },
            });
            logger.info("submit: auto-created Department record", { name: deptName, id: dept.id });
          }
          resolvedDeptId = dept.id;
          logger.info("submit: department resolved", { departmentId: resolvedDeptId, departmentName: deptName });
        }
      }

      logger.info("submit: creating respondent", {
        cycleId: cycle.id,
        resolvedDeptId,
      });

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
        req.socket.remoteAddress ??
        "unknown";

      const respondent = await prisma.respondent.create({
        data: {
          cycleId: cycle.id,
          departmentId: resolvedDeptId,
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

      const scoreRows = buildScoreRows(respondent.id, scoringResult, assessmentType);
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
      if (deptCount >= 1) { // TODO: change back to 5 before production
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
  result: Record<string, any>,
  assessmentType: string,
): {
  respondentId: string;
  subscale: string;
  rawScore: number;
  scaledScore: number;
  band: string;
}[] {
  const rows: ReturnType<typeof buildScoreRows> = [];

  // CBI: subscales object (personal_burnout, work_burnout, client_burnout)
  if (result.subscales) {
    for (const [key, val] of Object.entries<any>(result.subscales)) {
      rows.push({ respondentId, subscale: key, rawScore: val.score, scaledScore: val.score, band: val.band });
    }
  }

  // PSS / WHO-5 / CBI total
  if (result.total) {
    const rawScore    = result.total.raw_score ?? result.total.score;
    // PSS returns raw 0–40; normalize to 0–100 to match every other assessment.
    // WHO-5 already returns percentage_score (0–100) as result.total.score.
    const scaledScore = assessmentType === "PSS"
      ? Math.round((result.total.score / 40) * 1000) / 10
      : result.total.score;
    rows.push({ respondentId, subscale: "total", rawScore, scaledScore, band: result.total.band });
  }

  // Culture: dimensions array
  if (result.dimensions) {
    for (const dim of result.dimensions as any[]) {
      rows.push({ respondentId, subscale: dim.key, rawScore: dim.score, scaledScore: dim.score, band: dim.band });
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

  const grouped: Record<string, { vals: number[]; bands: Record<string, number> }> = {};
  for (const s of scores) {
    const g = (grouped[s.subscale] ??= { vals: [], bands: {} });
    g.vals.push(s.scaledScore);
    g.bands[s.band] = (g.bands[s.band] ?? 0) + 1;
  }

  const result: Record<string, { avg: number; band: string }> = {};
  for (const [subscale, { vals, bands }] of Object.entries(grouped)) {
    const avg      = vals.reduce((a, b) => a + b, 0) / vals.length;
    const modBand  = Object.entries(bands).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    result[subscale] = { avg: Math.round(avg * 10) / 10, band: modBand };
  }
  return result;
}
