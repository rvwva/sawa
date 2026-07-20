/**
 * Mindlign ONA Correlation Engine
 * =================================
 * Cross-references passive ONA metrics with psychometric scale scores
 * per department to generate triple-signal insight cards.
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const THRESHOLDS = {
  isolation: { urgent: 0.70, moderate: 0.50 },
  burnout: { urgent: 65, moderate: 50 },
  reciprocity: { low: 0.30 },
  collaborationLoad: { overloaded: 0.90 },
  engagement: { healthy: 65 },
};

export async function runOnaCorrelation(orgId: string, cycleId?: string): Promise<void> {
  logger.info(`ONA correlation starting for org ${orgId}`);

  // Get departments with ONA metrics
  const metrics = await prisma.onaMetric.findMany({
    where: { organisationId: orgId, departmentId: { not: null } },
    include: { department: true },
  });

  if (metrics.length === 0) {
    logger.info(`ONA correlation: no metrics found for org ${orgId}`);
    return;
  }

  // Group metrics by department
  const byDept = new Map<string, typeof metrics>();
  for (const m of metrics) {
    if (!m.departmentId) continue;
    const arr = byDept.get(m.departmentId) ?? [];
    arr.push(m);
    byDept.set(m.departmentId, arr);
  }

  // Get latest scale scores per department if cycle provided
  const scaleScores = cycleId
    ? await prisma.score.findMany({
        where: {
          respondent: {
            cycle: { organisationId: orgId, id: cycleId },
            departmentId: { not: null },
          },
        },
        include: { respondent: { select: { departmentId: true } } },
      })
    : [];

  // Group scale scores by department + subscale
  const scoresByDept = new Map<string, Map<string, number[]>>();
  for (const s of scaleScores) {
    const deptId = s.respondent.departmentId!;
    if (!scoresByDept.has(deptId)) scoresByDept.set(deptId, new Map());
    const deptMap = scoresByDept.get(deptId)!;
    const arr = deptMap.get(s.subscale) ?? [];
    arr.push(s.scaledScore);
    deptMap.set(s.subscale, arr);
  }

  // Delete existing insight cards for this org
  await prisma.onaInsightCard.deleteMany({ where: { organisationId: orgId } });

  const cards = [];

  for (const [deptId, deptMetrics] of byDept) {
    const dept = deptMetrics[0].department!;

    // Average ONA metrics for department
    const avgIsolation = avg(deptMetrics.map((m) => m.isolationScore));
    const avgReciprocity = avg(deptMetrics.map((m) => m.reciprocityScore));
    const avgCollabLoad = avg(deptMetrics.map((m) => m.collaborationLoad));

    // Average scale scores
    const deptScores = scoresByDept.get(deptId);
    const avgBurnout = deptScores?.get("total") ? avg(deptScores.get("total")!) : null;
    const avgEngagement = deptScores?.get("total") ? avg(deptScores.get("total")!) : null;

    // Build signals array
    const signals: string[] = [];
    let riskLevel = "healthy";

    if (avgIsolation > THRESHOLDS.isolation.urgent) {
      signals.push("high_isolation");
      riskLevel = "moderate";
    } else if (avgIsolation > THRESHOLDS.isolation.moderate) {
      signals.push("moderate_isolation");
    }

    if (avgBurnout !== null && avgBurnout > THRESHOLDS.burnout.urgent) {
      signals.push("high_burnout");
      riskLevel = "moderate";
    } else if (avgBurnout !== null && avgBurnout > THRESHOLDS.burnout.moderate) {
      signals.push("moderate_burnout");
    }

    if (avgReciprocity < THRESHOLDS.reciprocity.low) {
      signals.push("low_manager_reciprocity");
      riskLevel = "moderate";
    }

    if (avgCollabLoad > THRESHOLDS.collaborationLoad.overloaded) {
      signals.push("collaboration_overload");
    }

    // Triple signal = urgent
    const urgentSignals = signals.filter((s) =>
      ["high_isolation", "high_burnout", "low_manager_reciprocity"].includes(s)
    );
    if (urgentSignals.length >= 2) riskLevel = "urgent";

    // Healthy override
    if (
      signals.length === 0 &&
      avgEngagement !== null &&
      avgEngagement > THRESHOLDS.engagement.healthy
    ) {
      riskLevel = "healthy";
    }

    const insightText = generateInsightText(
      dept.name,
      signals,
      riskLevel,
      avgIsolation,
      avgBurnout,
      avgReciprocity
    );

    const insightTextAr = generateInsightTextAr(
      dept.nameAr ?? dept.name,
      signals,
      riskLevel,
      avgIsolation,
      avgBurnout,
      avgReciprocity
    );

    cards.push({
      organisationId: orgId,
      departmentId: deptId,
      cycleId: cycleId ?? null,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function generateInsightText(
  deptName: string,
  signals: string[],
  riskLevel: string,
  isolation: number,
  burnout: number | null,
  reciprocity: number
): string {
  if (riskLevel === "urgent") {
    const parts: string[] = [];
    if (signals.includes("high_isolation"))
      parts.push("structural isolation from the rest of the organization");
    if (signals.includes("high_burnout")) parts.push("elevated burnout scores");
    if (signals.includes("low_manager_reciprocity"))
      parts.push("low manager communication reciprocity");
    return `${deptName} is showing ${parts.join(", ")}. This combination is associated with high attrition risk and requires immediate attention.`;
  }
  if (riskLevel === "moderate") {
    return `${deptName} shows some early warning signals including ${signals
      .join(", ")
      .replace(/_/g, " ")}. Monitor closely over the next cycle.`;
  }
  return `${deptName} shows healthy collaboration patterns with no critical risk signals detected.`;
}

function generateInsightTextAr(
  deptName: string,
  signals: string[],
  riskLevel: string,
  _isolation: number,
  _burnout: number | null,
  _reciprocity: number
): string {
  if (riskLevel === "urgent") {
    return `يُظهر قسم ${deptName} مؤشرات حرجة تشمل العزلة التنظيمية وارتفاع الإرهاق وضعف التواصل مع المدير. هذا النمط مرتبط بمخاطر دوران عالية ويتطلب تدخلاً فورياً.`;
  }
  if (riskLevel === "moderate") {
    return `يُظهر قسم ${deptName} بعض إشارات الإنذار المبكر. يُنصح بالمتابعة الدقيقة خلال الدورة القادمة.`;
  }
  return `يُظهر قسم ${deptName} أنماط تعاون صحية دون مؤشرات خطر حرجة.`;
}
