/**
 * seedCorrelationTest.ts — Correlation Engine Test Data Generator
 * ===================================================================
 * TEMPORARY DEV TOOL. Creates three departments inside a given org
 * (Engineering, Sales, Support), each tuned to land at a different risk
 * tier, combining CBI + PSYCH_SAFETY + LMX7 scores (in CLOSED cycles)
 * with OnaMetric rows — so the correlation engine can be exercised and
 * visually verified without a live Microsoft 365 tenant.
 *
 * Called from POST /api/ona/seed-correlation-test/:orgId (admin only).
 * Safe to call twice — each seeding step checks for existing data first.
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { CycleStatus } from "@prisma/client";

function cbiBand(score: number): string {
  if (score >= 75) return "High";
  if (score >= 50) return "Moderate";
  return "Low";
}
function psychSafetyBand(score: number): string {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Moderate";
  return "Low";
}
function lmx7Band(score: number): string {
  if (score >= 70) return "Healthy";
  if (score >= 45) return "Moderate";
  return "Low";
}

async function findOrCreateDept(orgId: string, name: string, nameAr: string) {
  const existing = await prisma.department.findFirst({ where: { organisationId: orgId, name } });
  return existing ?? prisma.department.create({ data: { organisationId: orgId, name, nameAr } });
}

async function getAssessmentOrThrow(type: "CBI" | "PSYCH_SAFETY" | "LMX7") {
  const a = await prisma.assessment.findUnique({ where: { type } });
  if (!a) throw new Error(`${type} assessment definition not found — run the base seed first.`);
  return a;
}

async function seedClosedCycleScores(opts: {
  orgId: string; departmentId: string; assessmentId: string; cycleTitle: string;
  totals: number[]; bandFn: (score: number) => string; isCbi?: boolean;
}) {
  const { orgId, departmentId, assessmentId, cycleTitle, totals, bandFn, isCbi } = opts;
  const existingCycle = await prisma.assessmentCycle.findFirst({ where: { organisationId: orgId, title: cycleTitle } });
  const closedAt = new Date();
  const startsAt = new Date(closedAt.getTime() - 14 * 24 * 3_600_000);
  const cycle = existingCycle ?? await prisma.assessmentCycle.create({
    data: { organisationId: orgId, assessmentId, title: cycleTitle, status: CycleStatus.CLOSED, startsAt, endsAt: closedAt, closedAt },
  });

  const alreadySeeded = await prisma.respondent.count({ where: { cycleId: cycle.id, departmentId } });
  if (alreadySeeded > 0) return 0;

  for (let i = 0; i < totals.length; i++) {
    const total = totals[i];
    const submittedAt = new Date(closedAt.getTime() - (totals.length - i) * 3_600_000);
    const respondent = await prisma.respondent.create({
      data: { cycleId: cycle.id, departmentId, consentGiven: true, consentAt: submittedAt, consentVersion: "1.0", submittedAt },
    });
    if (isCbi) {
      await prisma.score.createMany({
        data: [
          { respondentId: respondent.id, subscale: "personal_burnout", rawScore: total, scaledScore: total, band: bandFn(total) },
          { respondentId: respondent.id, subscale: "work_burnout", rawScore: total, scaledScore: total, band: bandFn(total) },
          { respondentId: respondent.id, subscale: "client_burnout", rawScore: total, scaledScore: total, band: bandFn(total) },
          { respondentId: respondent.id, subscale: "total", rawScore: total, scaledScore: total, band: bandFn(total) },
        ],
      });
    } else {
      await prisma.score.create({
        data: { respondentId: respondent.id, subscale: "total", rawScore: total, scaledScore: total, band: bandFn(total) },
      });
    }
  }
  return totals.length;
}

async function seedOnaMetrics(opts: {
  orgId: string; departmentId: string; deptLabel: string; count: number;
  isolationScore: number; reciprocityScore: number; collaborationLoad: number;
}) {
  const { orgId, departmentId, deptLabel, count, isolationScore, reciprocityScore, collaborationLoad } = opts;
  const existing = await prisma.onaMetric.count({ where: { organisationId: orgId, departmentId } });
  if (existing > 0) return 0;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 3_600_000);
  const rows = Array.from({ length: count }, (_, i) => ({
    organisationId: orgId,
    userEmail: `${deptLabel.toLowerCase()}.employee${i + 1}@test-correlation.mindlign.com`,
    departmentId,
    degreeCentrality: 0.4 + Math.random() * 0.2,
    betweenness: 0.1 + Math.random() * 0.1,
    eigenvector: 0.3 + Math.random() * 0.2,
    isolationScore: isolationScore + (Math.random() - 0.5) * 0.05,
    collaborationLoad: collaborationLoad + (Math.random() - 0.5) * 0.05,
    reciprocityScore: reciprocityScore + (Math.random() - 0.5) * 0.05,
    periodStart,
    periodEnd,
  }));
  await prisma.onaMetric.createMany({ data: rows });
  return count;
}

export async function seedCorrelationTestData(orgId: string): Promise<{ departments: string[] }> {
  logger.info(`Seeding correlation test data for org ${orgId}`);

  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } });
  const cbi = await getAssessmentOrThrow("CBI");
  const psychSafety = await getAssessmentOrThrow("PSYCH_SAFETY");
  const lmx7 = await getAssessmentOrThrow("LMX7");

  const engineering = await findOrCreateDept(org.id, "Engineering", "الهندسة");
  const sales = await findOrCreateDept(org.id, "Sales", "المبيعات");
  const support = await findOrCreateDept(org.id, "Support", "الدعم");

  await seedOnaMetrics({ orgId: org.id, departmentId: engineering.id, deptLabel: "Engineering", count: 6, isolationScore: 0.78, reciprocityScore: 0.18, collaborationLoad: 0.55 });
  await seedClosedCycleScores({ orgId: org.id, departmentId: engineering.id, assessmentId: cbi.id, cycleTitle: "Correlation Test — CBI", totals: [70, 74, 68, 76, 71], bandFn: cbiBand, isCbi: true });

  await seedOnaMetrics({ orgId: org.id, departmentId: support.id, deptLabel: "Support", count: 5, isolationScore: 0.6, reciprocityScore: 0.45, collaborationLoad: 0.55 });
  await seedClosedCycleScores({ orgId: org.id, departmentId: support.id, assessmentId: cbi.id, cycleTitle: "Correlation Test — CBI", totals: [52, 58, 55, 50, 57], bandFn: cbiBand, isCbi: true });

  await seedOnaMetrics({ orgId: org.id, departmentId: sales.id, deptLabel: "Sales", count: 6, isolationScore: 0.25, reciprocityScore: 0.65, collaborationLoad: 0.5 });
  await seedClosedCycleScores({ orgId: org.id, departmentId: sales.id, assessmentId: cbi.id, cycleTitle: "Correlation Test — CBI", totals: [28, 32, 30, 35, 27], bandFn: cbiBand, isCbi: true });
  await seedClosedCycleScores({ orgId: org.id, departmentId: sales.id, assessmentId: psychSafety.id, cycleTitle: "Correlation Test — Psychological Safety", totals: [82, 88, 79, 85, 90], bandFn: psychSafetyBand });
  await seedClosedCycleScores({ orgId: org.id, departmentId: sales.id, assessmentId: lmx7.id, cycleTitle: "Correlation Test — LMX-7", totals: [75, 80, 73, 78, 82], bandFn: lmx7Band });

  logger.info(`Correlation test seed complete for org ${orgId}`);
  return { departments: ["Engineering", "Sales", "Support"] };
}
