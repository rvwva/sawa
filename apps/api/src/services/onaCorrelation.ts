/**
 * Mindlign ONA + Cross-Pillar Correlation Engine
 * =================================================
 * Cross-references passive ONA network metrics with psychometric scale
 * scores per department to generate insight cards.
 *
 * ARCHITECTURE NOTE (Aug 2026 rewrite):
 * Each AssessmentCycle is tied to exactly one AssessmentType (schema:
 * AssessmentCycle.assessmentId -> Assessment.type). A department's CBI,
 * PSYCH_SAFETY, TURNOVER, and LMX7 scores therefore come from DIFFERENT
 * cycles administered at different times — there is no single cycle that
 * contains "all" scale scores for a department at once.
 *
 * This engine correlates each department's LATEST CLOSED cycle per
 * assessment type, regardless of date. (Decision: no real client data
 * exists yet, so prioritize the correct sustainable architecture now
 * rather than a same-window filter that would silently drop coverage
 * while the platform is still new.)
 *
 * This rewrite also fixes a real bug in the original implementation:
 * CBI, PSYCH_SAFETY, and TURNOVER all wrote scores under the literal
 * subscale key "total". The old code read `deptScores.get("total")`
 * without checking assessment type, so a burnout value and an
 * "engagement" value (itself checking a UWES scale that doesn't exist
 * in this codebase) were silently the same number under two different
 * names. Scores are now keyed by `${AssessmentType}:${subscale}`, and
 * every scale carries an explicit direction so a "good" LMX7 score can
 * never be misread as a risk signal or vice versa.
 *
 * Adding a new scale (e.g. CULTURE, or UWES if it's ever built) means
 * adding one entry to SCALE_SIGNALS and one to SIGNAL_PHRASES — nothing
 * else in this file needs to change.
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const MIN_DEPT_SIZE_FOR_ONA = 5;

const ONA_METRIC_THRESHOLDS = {
  isolation: { urgent: 0.7, moderate: 0.5 },
  reciprocity: { low: 0.3 },
  collaborationLoad: { overloaded: 0.9 },
};

type Direction = "higher_is_worse" | "higher_is_better";

interface ScaleSignalDef {
  direction: Direction;
  riskThreshold: number; // crossing this in the "bad" direction = risk signal
  healthyThreshold: number; // crossing this in the "good" direction = positive signal
  riskSignalKey: string;
}

// Keyed by `${AssessmentType}:${subscale}` — must match the literal
// subscale keys written by packages/scoring/definitions/*.ts exactly.
const SCALE_SIGNALS: Record<string, ScaleSignalDef> = {
  "CBI:total": {
    direction: "higher_is_worse",
    riskThreshold: 65, // CBI "High" band floor
    healthyThreshold: 40,
    riskSignalKey: "elevated_burnout",
  },
  "PSYCH_SAFETY:total": {
    direction: "higher_is_better",
    riskThreshold: 49, // "Low" band ceiling
    healthyThreshold: 75, // "Healthy" band floor
    riskSignalKey: "low_psych_safety",
  },
  "TURNOVER:total": {
    direction: "higher_is_worse",
    riskThreshold: 60, // "High" band floor
    healthyThreshold: 30,
    riskSignalKey: "high_turnover_intention",
  },
  "LMX7:total": {
    direction: "higher_is_better",
    riskThreshold: 44, // "Low" band ceiling
    healthyThreshold: 70, // "Healthy" band floor
    riskSignalKey: "weak_manager_relationship",
  },
};

const SIGNAL_PHRASES: Record<string, { en: string; ar: string; urgentEligible: boolean }> = {
  high_isolation: {
    en: "structural isolation from the rest of the organization",
    ar: "عزلة هيكلية عن بقية المؤسسة",
    urgentEligible: true,
  },
  moderate_isolation: {
    en: "early signs of network isolation",
    ar: "مؤشرات مبكرة على العزلة الشبكية",
    urgentEligible: false,
  },
  low_manager_reciprocity: {
    en: "low manager communication reciprocity",
    ar: "ضعف التواصل المتبادل مع المدير",
    urgentEligible: true,
  },
  collaboration_overload: {
    en: "collaboration overload",
    ar: "زيادة العبء التعاوني",
    urgentEligible: false,
  },
  elevated_burnout: {
    en: "elevated burnout scores",
    ar: "ارتفاع مستويات الإرهاق",
    urgentEligible: true,
  },
  low_psych_safety: {
    en: "low psychological safety",
    ar: "انخفاض الأمان النفسي",
    urgentEligible: true,
  },
  high_turnover_intention: {
    en: "high turnover intention",
    ar: "ارتفاع نية ترك العمل",
    urgentEligible: true,
  },
  weak_manager_relationship: {
    en: "a weak manager relationship (LMX-7)",
    ar: "علاقة ضعيفة مع المدير (LMX-7)",
    urgentEligible: true,
  },
};

export async function runOnaCorrelation(orgId: string, triggeredByCycleId?: string): Promise<void> {
  logger.info(`ONA correlation starting for org ${orgId}`);

  // ── ONA network metrics ───────────────────────────────────────────────
  const metrics = await prisma.onaMetric.findMany({
    where: { organisationId: orgId, departmentId: { not: null } },
    include: { department: true },
  });

  if (metrics.length === 0) {
    logger.info(`ONA correlation: no metrics found for org ${orgId}`);
    return;
  }

  const byDept = new Map<string, typeof metrics>();
  for (const m of metrics) {
    if (!m.departmentId) continue;
    const arr = byDept.get(m.departmentId) ?? [];
    arr.push(m);
    byDept.set(m.departmentId, arr);
  }

  // ── Latest CLOSED cycle per assessment type for this org ─────────────
  const closedCycles = await prisma.assessmentCycle.findMany({
    where: { organisationId: orgId, status: "CLOSED" },
    orderBy: { endsAt: "desc" },
    include: { assessment: { select: { type: true } } },
  });

  const latestCycleByType = new Map<string, (typeof closedCycles)[number]>();
  for (const c of closedCycles) {
    if (!latestCycleByType.has(c.assessment.type)) {
      latestCycleByType.set(c.assessment.type, c);
    }
  }

  const cycleIdToType = new Map<string, string>();
  for (const [type, cycle] of latestCycleByType) {
    cycleIdToType.set(cycle.id, type);
  }
  const relevantCycleIds = [...cycleIdToType.keys()];

  // ── Scale scores across each type's latest closed cycle ──────────────
  const scores = relevantCycleIds.length
    ? await prisma.score.findMany({
        where: {
          respondent: {
            cycleId: { in: relevantCycleIds },
            departmentId: { not: null },
          },
        },
        include: {
          respondent: { select: { departmentId: true, cycleId: true } },
        },
      })
    : [];

  // deptId -> "AssessmentType:subscale" -> number[]
  const scoresByDept = new Map<string, Map<string, number[]>>();
  for (const s of scores) {
    const deptId = s.respondent.departmentId;
    const type = cycleIdToType.get(s.respondent.cycleId);
    if (!deptId || !type) continue;
    const key = `${type}:${s.subscale}`;
    if (!scoresByDept.has(deptId)) scoresByDept.set(deptId, new Map());
    const deptMap = scoresByDept.get(deptId)!;
    const arr = deptMap.get(key) ?? [];
    arr.push(s.scaledScore);
    deptMap.set(key, arr);
  }

  await prisma.onaInsightCard.deleteMany({ where: { organisationId: orgId } });

  const cards = [];

  for (const [deptId, deptMetrics] of byDept) {
    if (deptMetrics.length < MIN_DEPT_SIZE_FOR_ONA) {
      logger.info(
        `ONA correlation: skipping dept ${deptMetrics[0].department?.name} — only ${deptMetrics.length} employees (min ${MIN_DEPT_SIZE_FOR_ONA})`
      );
      continue;
    }

    const dept = deptMetrics[0].department!;
    const avgIsolation = avg(deptMetrics.map((m) => m.isolationScore));
    const avgReciprocity = avg(deptMetrics.map((m) => m.reciprocityScore));
    const avgCollabLoad = avg(deptMetrics.map((m) => m.collaborationLoad));
    const deptScores = scoresByDept.get(deptId);

    const signals: string[] = [];
    const urgentEligible: string[] = [];
    let riskLevel: "healthy" | "moderate" | "urgent" = "healthy";
    let hasPositiveSignal = false;

    // ── ONA network signals ──────────────────────────────────────────
    if (avgIsolation > ONA_METRIC_THRESHOLDS.isolation.urgent) {
      signals.push("high_isolation");
      urgentEligible.push("high_isolation");
      riskLevel = "moderate";
    } else if (avgIsolation > ONA_METRIC_THRESHOLDS.isolation.moderate) {
      signals.push("moderate_isolation");
      riskLevel = "moderate";
    }

    if (avgReciprocity < ONA_METRIC_THRESHOLDS.reciprocity.low) {
      signals.push("low_manager_reciprocity");
      urgentEligible.push("low_manager_reciprocity");
      riskLevel = "moderate";
    }

    if (avgCollabLoad > ONA_METRIC_THRESHOLDS.collaborationLoad.overloaded) {
      signals.push("collaboration_overload");
      riskLevel = "moderate";
    }

    // ── Scale signals — type-qualified, direction-aware ──────────────
    for (const [scaleKey, def] of Object.entries(SCALE_SIGNALS)) {
      const values = deptScores?.get(scaleKey);
      if (!values || values.length === 0) continue;
      const scaleAvg = avg(values);

      const isRisk =
        def.direction === "higher_is_worse" ? scaleAvg > def.riskThreshold : scaleAvg < def.riskThreshold;

      if (isRisk) {
        signals.push(def.riskSignalKey);
        riskLevel = "moderate";
        if (SIGNAL_PHRASES[def.riskSignalKey]?.urgentEligible) {
          urgentEligible.push(def.riskSignalKey);
        }
        continue;
      }

      const isHealthy =
        def.direction === "higher_is_worse" ? scaleAvg < def.healthyThreshold : scaleAvg > def.healthyThreshold;
      if (isHealthy) hasPositiveSignal = true;
    }

    // Two or more urgent-eligible signals together = urgent
    if (urgentEligible.length >= 2) riskLevel = "urgent";

    const insightText = generateInsightText(dept.name, signals, riskLevel, hasPositiveSignal);
    const insightTextAr = generateInsightTextAr(
      dept.nameAr ?? dept.name,
      signals,
      riskLevel,
      hasPositiveSignal
    );

    cards.push({
      organisationId: orgId,
      departmentId: deptId,
      // No longer "the cycle whose scores were used" (scores now span
      // several cycles across types) — this is the cycle, if any, whose
      // closing triggered this recompute. Purely for provenance/audit.
      cycleId: triggeredByCycleId ?? null,
      signals,
      riskLevel,
      insightText,
      insightTextAr,
    });
  }

  await prisma.onaInsightCard.createMany({ data: cards });
  logger.info(
    `ONA correlation complete — ${cards.length} insight cards generated for org ${orgId}`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function joinPhrasesEn(phrases: string[]): string {
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

function joinPhrasesAr(phrases: string[]): string {
  return phrases.join("، ");
}

function generateInsightText(
  deptName: string,
  signals: string[],
  riskLevel: string,
  hasPositiveSignal: boolean
): string {
  if (signals.length === 0) {
    return hasPositiveSignal
      ? `${deptName} shows healthy collaboration and scale-score patterns with no critical risk signals detected.`
      : `${deptName} shows no critical risk signals, though limited scale-score data is currently available for this department.`;
  }

  const phrases = signals.map((s) => SIGNAL_PHRASES[s]?.en ?? s.replace(/_/g, " "));

  if (riskLevel === "urgent") {
    return `${deptName} is showing ${joinPhrasesEn(
      phrases
    )}. This combination is associated with high attrition risk and requires immediate attention.`;
  }

  return `${deptName} shows early warning signals including ${joinPhrasesEn(
    phrases
  )}. Monitor closely over the next cycle.`;
}

function generateInsightTextAr(
  deptName: string,
  signals: string[],
  riskLevel: string,
  hasPositiveSignal: boolean
): string {
  if (signals.length === 0) {
    return hasPositiveSignal
      ? `يُظهر قسم ${deptName} أنماط تعاون ونتائج مقاييس صحية دون مؤشرات خطر حرجة.`
      : `لا تظهر على قسم ${deptName} مؤشرات خطر حرجة، مع محدودية بيانات المقاييس المتاحة حالياً لهذا القسم.`;
  }

  const phrases = signals.map((s) => SIGNAL_PHRASES[s]?.ar ?? s);

  if (riskLevel === "urgent") {
    return `يُظهر قسم ${deptName} مؤشرات حرجة تشمل ${joinPhrasesAr(
      phrases
    )}. هذا النمط مرتبط بمخاطر دوران عالية ويتطلب تدخلاً فورياً.`;
  }

  return `يُظهر قسم ${deptName} إشارات إنذار مبكر تشمل ${joinPhrasesAr(
    phrases
  )}. يُنصح بالمتابعة الدقيقة خلال الدورة القادمة.`;
}
