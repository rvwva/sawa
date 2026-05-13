/**
 * Scoring Aggregation Service
 * ============================
 * Pure DB-layer aggregations over the `scores` and `respondents` tables.
 * Called by the /api/results router. Never calls the Python scoring service —
 * that already ran at submission time and persisted results into `scores`.
 *
 * Key rules:
 *  - Department breakdowns only returned when respondentCount >= 1 (TESTING — change back to 5 before production)
 *  - All scores are on a 0–100 normalised scale
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// TODO: change back to 5 before production (PDPL anonymity requirement)
export const MIN_DEPT_RESPONDENTS = 1;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubscaleAggregate {
  subscale: string;
  label: string;           // human-friendly label
  avg: number;
  min: number;
  max: number;
  stddev: number;
  count: number;
  band: string;
  bandDistribution: Record<string, number>; // band → count
}

export interface CycleAggregate {
  cycleId: string;
  respondentCount: number;
  assessmentType: string;
  subscales: SubscaleAggregate[];
}

export interface DepartmentAggregate {
  departmentId: string;
  departmentName: string;
  respondentCount: number;
  subscales: SubscaleAggregate[];
}

export interface TrendPoint {
  cycleId: string;
  cycleTitle: string;
  closedAt: Date | null;
  endsAt: Date;
  respondentCount: number;
  avgTotal: number | null;   // overall "total" subscale mean, 0–100
}

// ─── Band helpers ─────────────────────────────────────────────────────────────

// Returns the most-common band from a bandDistribution object.
// Used for aggregated subscale results so we propagate Python-computed
// bands rather than re-deriving them from an averaged score.
function modalBand(dist: Record<string, number>): string {
  const entries = Object.entries(dist);
  if (entries.length === 0) return "Unknown";
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

// Kept for use outside this service (e.g. one-off computations where the
// assessment type is unknown). Prefer modalBand() for aggregated results.
export function genericBand(score: number): string {
  if (score >= 68) return "Good";
  if (score >= 51) return "Moderate";
  if (score >= 29) return "Below Average";
  return "Low";
}

function round(n: number | null | undefined, dp = 1): number {
  if (n == null) return 0;
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

// ─── Raw SQL helpers ──────────────────────────────────────────────────────────

type BandRow = { subscale: string; band: string; cnt: bigint };
type StddevRow = { subscale: string; stddev: string | null };
type TrendRow = {
  cycle_id: string;
  title: string;
  ends_at: Date;
  closed_at: Date | null;
  respondent_count: bigint;
  avg_total: string | null;
};

// ─── Core aggregation ────────────────────────────────────────────────────────

/**
 * Aggregate all scores for a cycle, optionally filtered to one department.
 * Returns null if there are no submissions.
 */
export async function aggregateCycleScores(
  cycleId: string,
  departmentId?: string
): Promise<CycleAggregate | null> {
  const deptFilter = departmentId
    ? Prisma.sql`AND r.department_id = ${departmentId}`
    : Prisma.sql``;

  // Respondent count
  const countResult = await prisma.respondent.count({
    where: {
      cycleId,
      submittedAt: { not: null },
      ...(departmentId ? { departmentId } : {}),
    },
  });

  if (countResult === 0) return null;

  // Groupby avg/min/max/count per subscale (via Prisma groupBy)
  const grouped = await prisma.score.groupBy({
    by: ["subscale"],
    where: {
      respondent: {
        cycleId,
        submittedAt: { not: null },
        ...(departmentId ? { departmentId } : {}),
      },
    },
    _avg: { scaledScore: true },
    _min: { scaledScore: true },
    _max: { scaledScore: true },
    _count: { id: true },
    orderBy: { subscale: "asc" },
  });

  // Stddev per subscale (raw SQL — Prisma groupBy doesn't expose stddev)
  const stddevRows = await prisma.$queryRaw<StddevRow[]>`
    SELECT s.subscale,
           ROUND(STDDEV(s.scaled_score)::numeric, 2)::text AS stddev
    FROM   scores s
    JOIN   respondents r ON r.id = s.respondent_id
    WHERE  r.cycle_id     = ${cycleId}
      AND  r.submitted_at IS NOT NULL
      ${deptFilter}
    GROUP BY s.subscale
  `;
  const stddevMap: Record<string, number> = {};
  for (const row of stddevRows) {
    stddevMap[row.subscale] = row.stddev != null ? parseFloat(row.stddev) : 0;
  }

  // Band distribution per subscale
  const bandRows = await prisma.$queryRaw<BandRow[]>`
    SELECT s.subscale, s.band, COUNT(*) AS cnt
    FROM   scores s
    JOIN   respondents r ON r.id = s.respondent_id
    WHERE  r.cycle_id     = ${cycleId}
      AND  r.submitted_at IS NOT NULL
      ${deptFilter}
    GROUP BY s.subscale, s.band
    ORDER BY s.subscale, s.band
  `;
  const bandMap: Record<string, Record<string, number>> = {};
  for (const row of bandRows) {
    (bandMap[row.subscale] ??= {})[row.band] = Number(row.cnt);
  }

  // Fetch cycle assessment type for labelling
  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id: cycleId },
    select: { assessment: { select: { type: true } } },
  });

  const subscales: SubscaleAggregate[] = grouped.map((g) => ({
    subscale: g.subscale,
    label: formatSubscaleLabel(g.subscale),
    avg: round(g._avg.scaledScore, 1),
    min: round(g._min.scaledScore, 1),
    max: round(g._max.scaledScore, 1),
    stddev: stddevMap[g.subscale] ?? 0,
    count: g._count.id,
    // Use the modal (most common) Python-computed band across respondents rather
    // than re-deriving from the average, which loses assessment-type context.
    band: modalBand(bandMap[g.subscale] ?? {}),
    bandDistribution: bandMap[g.subscale] ?? {},
  }));

  return {
    cycleId,
    respondentCount: countResult,
    assessmentType: cycle?.assessment.type ?? "UNKNOWN",
    subscales,
  };
}

// ─── Department breakdown ────────────────────────────────────────────────────

/**
 * Returns per-department aggregates, excluding any department with < MIN_DEPT_RESPONDENTS respondents
 * (PDPL / anonymity rule).
 */
export async function aggregateDepartmentScores(
  cycleId: string
): Promise<DepartmentAggregate[]> {
  // Find all departments represented in this cycle with enough respondents
  const deptCounts = await prisma.respondent.groupBy({
    by: ["departmentId"],
    where: { cycleId, submittedAt: { not: null }, departmentId: { not: null } },
    _count: { id: true },
  });

  const eligibleDepts = deptCounts.filter(
    (d) => d.departmentId != null && d._count.id >= MIN_DEPT_RESPONDENTS
  );

  if (eligibleDepts.length === 0) return [];

  // Fetch department names
  const deptIds = eligibleDepts.map((d) => d.departmentId as string);
  const departments = await prisma.department.findMany({
    where: { id: { in: deptIds } },
    select: { id: true, name: true },
  });
  const deptNameMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  // Aggregate scores per department in parallel
  const results = await Promise.all(
    eligibleDepts.map(async (d) => {
      const agg = await aggregateCycleScores(cycleId, d.departmentId as string);
      return {
        departmentId: d.departmentId as string,
        departmentName: deptNameMap[d.departmentId as string] ?? "Unknown",
        respondentCount: d._count.id,
        subscales: agg?.subscales ?? [],
      };
    })
  );

  return results;
}

// ─── Response rate ────────────────────────────────────────────────────────────

export interface ResponseRateResult {
  submitted: number;
  started: number;   // created respondent but not yet submitted
  total: number;     // submitted + started (proxy for link opens)
  submissionRate: number; // 0–100 %
  byDepartment: Array<{
    departmentId: string;
    departmentName: string;
    submitted: number;
    meetsMinimum: boolean;
  }>;
}

export async function getResponseRate(cycleId: string): Promise<ResponseRateResult> {
  const [submitted, total] = await Promise.all([
    prisma.respondent.count({ where: { cycleId, submittedAt: { not: null } } }),
    prisma.respondent.count({ where: { cycleId } }),
  ]);

  // Per-department breakdown
  const deptRows = await prisma.respondent.groupBy({
    by: ["departmentId"],
    where: { cycleId, submittedAt: { not: null }, departmentId: { not: null } },
    _count: { id: true },
  });

  const deptIds = deptRows
    .map((r) => r.departmentId)
    .filter((id): id is string => id != null);

  const departments =
    deptIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
        })
      : [];

  const deptNameMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  const byDepartment = deptRows.map((r) => ({
    departmentId: r.departmentId as string,
    departmentName: deptNameMap[r.departmentId as string] ?? "Unknown",
    submitted: r._count.id,
    meetsMinimum: r._count.id >= MIN_DEPT_RESPONDENTS,
  }));

  return {
    submitted,
    started: total - submitted,
    total,
    submissionRate: total > 0 ? round((submitted / total) * 100, 1) : 0,
    byDepartment,
  };
}

// ─── Cross-cycle trend ────────────────────────────────────────────────────────

/**
 * Returns the "total" subscale avg across the last N closed/active cycles
 * for the same assessment type — used to render trend charts on the dashboard.
 */
export async function getCycleTrend(
  organisationId: string,
  assessmentType: string,
  limit = 12
): Promise<TrendPoint[]> {
  const rows = await prisma.$queryRaw<TrendRow[]>`
    SELECT  ac.id                                AS cycle_id,
            ac.title,
            ac.ends_at,
            ac.closed_at,
            COUNT(DISTINCT r.id)                 AS respondent_count,
            ROUND(AVG(s.scaled_score)::numeric, 1)::text AS avg_total
    FROM    assessment_cycles ac
    JOIN    assessments        a  ON a.id  = ac.assessment_id
    JOIN    respondents        r  ON r.cycle_id = ac.id
    JOIN    scores             s  ON s.respondent_id = r.id
                                 AND s.subscale = 'total'
    WHERE   ac.organisation_id = ${organisationId}
      AND   a.type             = ${assessmentType}::"AssessmentType"
      AND   ac.status         IN ('ACTIVE', 'CLOSED')
      AND   r.submitted_at    IS NOT NULL
    GROUP BY ac.id, ac.title, ac.ends_at, ac.closed_at
    ORDER BY ac.ends_at DESC
    LIMIT   ${limit}
  `;

  return rows.map((row) => ({
    cycleId: row.cycle_id,
    cycleTitle: row.title,
    endsAt: row.ends_at,
    closedAt: row.closed_at,
    respondentCount: Number(row.respondent_count),
    avgTotal: row.avg_total != null ? parseFloat(row.avg_total) : null,
  }));
}

// ─── Snapshot summary (cached into reports.summary_data) ─────────────────────

export async function buildCycleSummary(cycleId: string) {
  const [orgAgg, deptAggs, rateData] = await Promise.all([
    aggregateCycleScores(cycleId),
    aggregateDepartmentScores(cycleId),
    getResponseRate(cycleId),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    respondentCount: rateData.submitted,
    submissionRate: rateData.submissionRate,
    organisationScores: orgAgg,
    departmentScores: deptAggs,
  };
}

// ─── Label helper ─────────────────────────────────────────────────────────────

function formatSubscaleLabel(subscale: string): string {
  const labels: Record<string, string> = {
    // CBI
    personal_burnout: "Personal Burnout",
    work_burnout: "Work-Related Burnout",
    client_burnout: "Client-Related Burnout",
    total: "Overall",
    // Culture
    leadership: "Leadership Effectiveness",
    communication: "Communication & Transparency",
    innovation: "Innovation & Agility",
    psychological_safety: "Psychological Safety",
    inclusion: "Inclusion & Belonging",
    growth: "Growth & Development",
    work_life_balance: "Work-Life Balance",
    recognition: "Recognition & Reward",
    collaboration: "Collaboration & Teamwork",
  };
  return labels[subscale] ?? subscale.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
