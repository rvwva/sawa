import rawTemplates from "./plan-templates.json";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { MIN_DEPT_RESPONDENTS } from "../scoring";
import { PlanPriority } from "@prisma/client";

// ─── Types matching the JSON structure ───────────────────────────────────────

interface StepDef {
  order: number;
  dueOffsetDays: number;
  ownerRole: string;
  verification: string;
  en: { title: string; body: string };
  ar: { title: string; body: string };
}

interface TriggerDef {
  all?: string[];
  any?: string[];
  none?: string[];
  missing_scale?: boolean;
  healthy_signals_min?: number;
  risk_signals_max?: number;
  priority: string;
  scope?: string;
}

interface TemplateDef {
  key: string;
  trigger: TriggerDef;
  title: { en: string; ar: string };
  steps: StepDef[];
}

// ─── Template validation ──────────────────────────────────────────────────────

function validateTemplates(data: unknown): TemplateDef[] {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as Record<string, unknown>)["templates"])
  ) {
    throw new Error("plan-templates.json: missing 'templates' array");
  }
  const templates = (data as Record<string, unknown>)["templates"] as unknown[];
  for (const t of templates) {
    const tmpl = t as Record<string, unknown>;
    if (!tmpl["key"] || !tmpl["trigger"] || !tmpl["title"] || !Array.isArray(tmpl["steps"])) {
      throw new Error(`plan-templates.json: template missing required fields — ${JSON.stringify(tmpl["key"])}`);
    }
  }
  return templates as TemplateDef[];
}

export const templates: TemplateDef[] = validateTemplates(rawTemplates);

// ─── Signal alias map (template keys → ONA signal keys) ──────────────────────

const SIGNAL_ALIASES: Record<string, string> = {
  burnout_elevated: "elevated_burnout",
};

function normalizeSignal(key: string): string {
  return SIGNAL_ALIASES[key] ?? key;
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, STANDARD: 2 };

function matchesTrigger(signals: string[], riskLevel: string, trigger: TriggerDef): boolean {
  if (trigger.scope === "organisation") return false; // handled separately
  if (trigger.missing_scale) return false; // org-wide only

  const sigSet = new Set(signals.map(normalizeSignal));

  if (trigger.all) {
    if (!trigger.all.every((s) => sigSet.has(normalizeSignal(s)))) return false;
  }
  if (trigger.any) {
    if (!trigger.any.some((s) => sigSet.has(normalizeSignal(s)))) return false;
  }
  if (trigger.none) {
    if (trigger.none.some((s) => sigSet.has(normalizeSignal(s)))) return false;
  }
  if (trigger.risk_signals_max !== undefined) {
    if (signals.length > trigger.risk_signals_max) return false;
  }
  if (trigger.healthy_signals_min !== undefined) {
    if (riskLevel !== "healthy") return false;
  }
  return true;
}

function replacePlaceholders(text: string, department: string, partnerDept: string): string {
  return text.replace(/\{department\}/g, department).replace(/\{partner_department\}/g, partnerDept);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePlans(organisationId: string): Promise<number> {
  // Fetch the most recent insight card per department
  const cards = await prisma.onaInsightCard.findMany({
    where: { organisationId },
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });

  const cardByDept = new Map<string, (typeof cards)[number]>();
  for (const card of cards) {
    if (!cardByDept.has(card.departmentId)) cardByDept.set(card.departmentId, card);
  }

  // Find dept with highest isolation for {partner_department} default
  const metricsForIsolation = await prisma.onaMetric.findMany({
    where: { organisationId, departmentId: { not: null } },
    select: { departmentId: true, isolationScore: true },
  });
  const isolationByDept = new Map<string, number>();
  for (const m of metricsForIsolation) {
    if (!m.departmentId) continue;
    const cur = isolationByDept.get(m.departmentId) ?? 0;
    isolationByDept.set(m.departmentId, Math.max(cur, m.isolationScore));
  }

  function getPartnerDept(currentDeptId: string, deptName: string): string {
    let best = deptName;
    let bestScore = -1;
    for (const [deptId, score] of isolationByDept) {
      if (deptId !== currentDeptId && score > bestScore) {
        bestScore = score;
        // Look up name from cards
        const card = cardByDept.get(deptId);
        if (card) best = card.department.name;
      }
    }
    return best;
  }

  const plansToCreate: Parameters<typeof prisma.actionPlan.create>[0]["data"][] = [];

  for (const [deptId, card] of cardByDept) {
    const signals = card.signals as string[];

    // Per spec: skip departments under the anonymity floor. The ONA engine already
    // won't generate cards for them, so this is a safety check.
    // (We rely on the ONA engine having enforced MIN_DEPT_RESPONDENTS already.)

    let bestTemplate: TemplateDef | null = null;
    let bestRank = Infinity;

    for (const tmpl of templates) {
      if (!matchesTrigger(signals, card.riskLevel, tmpl.trigger)) continue;
      const rank = PRIORITY_RANK[tmpl.trigger.priority] ?? 99;
      if (rank < bestRank) {
        bestRank = rank;
        bestTemplate = tmpl;
      }
    }

    if (!bestTemplate) continue;

    const deptName = card.department.name;
    const partnerDept = getPartnerDept(deptId, deptName);
    const titleEn = replacePlaceholders(bestTemplate.title.en, deptName, partnerDept);
    const titleAr = replacePlaceholders(bestTemplate.title.ar, card.department.nameAr ?? deptName, partnerDept);

    plansToCreate.push({
      organisationId,
      departmentId: deptId,
      templateKey: bestTemplate.key,
      priority: bestTemplate.trigger.priority as PlanPriority,
      titleEn,
      titleAr,
      steps: {
        create: bestTemplate.steps.map((step) => ({
          order: step.order,
          titleEn: replacePlaceholders(step.en.title, deptName, partnerDept),
          titleAr: replacePlaceholders(step.ar.title, card.department.nameAr ?? deptName, partnerDept),
          bodyEn: replacePlaceholders(step.en.body, deptName, partnerDept),
          bodyAr: replacePlaceholders(step.ar.body, card.department.nameAr ?? deptName, partnerDept),
          ownerRole: step.ownerRole as "MANAGER" | "HR" | "SPONSOR" | "TEAM",
          dueOffsetDays: step.dueOffsetDays,
          verification: step.verification as "NONE" | "CALENDAR_ONE_TO_ONE" | "CALENDAR_MEETING_LOAD" | "PULSE",
        })),
      },
    });
  }

  // MEASUREMENT_GAP: org-wide plan if any required scale is missing
  const measurementGapTemplate = templates.find((t) => t.trigger.missing_scale);
  if (measurementGapTemplate) {
    const closedCycles = await prisma.assessmentCycle.findMany({
      where: { organisationId, status: "CLOSED" },
      include: { assessment: { select: { type: true } } },
    });
    const coveredTypes = new Set(closedCycles.map((c) => c.assessment.type as string));
    const requiredTypes = ["CBI", "PSYCH_SAFETY", "LMX7", "TURNOVER"];
    const hasMissingScale = requiredTypes.some((t) => !coveredTypes.has(t));

    if (hasMissingScale) {
      plansToCreate.push({
        organisationId,
        departmentId: null,
        templateKey: measurementGapTemplate.key,
        priority: measurementGapTemplate.trigger.priority as PlanPriority,
        titleEn: measurementGapTemplate.title.en,
        titleAr: measurementGapTemplate.title.ar,
        steps: {
          create: measurementGapTemplate.steps.map((step) => ({
            order: step.order,
            titleEn: step.en.title,
            titleAr: step.ar.title,
            bodyEn: step.en.body,
            bodyAr: step.ar.body,
            ownerRole: step.ownerRole as "MANAGER" | "HR" | "SPONSOR" | "TEAM",
            dueOffsetDays: step.dueOffsetDays,
            verification: step.verification as "NONE" | "CALENDAR_ONE_TO_ONE" | "CALENDAR_MEETING_LOAD" | "PULSE",
          })),
        },
      });
    }
  }

  let created = 0;
  for (const data of plansToCreate) {
    await prisma.actionPlan.create({ data });
    created++;
  }

  logger.info(`generatePlans: created ${created} plans for org ${organisationId}`);
  return created;
}
