import rawTemplates from "./plan-templates.json";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { MIN_DEPT_RESPONDENTS } from "../scoring";
import { Prisma, PlanPriority, StepOwnerRole, StepVerification } from "@prisma/client";

// ─── Types matching the JSON structure ───────────────────────────────────────

export interface WatchForItem {
  text: string;
  sourceKeys: string[];
}

export interface StepText {
  workstream: string | null;
  when: string;
  title: string;
  body: string;
  who: string;
  output: string;
  evidenceNote: string;
}

export interface StepDef {
  order: number;
  dueOffsetDays: number;
  ownerRole: StepOwnerRole;
  verification: StepVerification;
  evidenceLevel: string;
  sourceKeys: string[];
  en: StepText;
  ar: StepText;
}

export interface TriggerDef {
  all?: string[];
  any?: string[];
  none?: string[];
  missing_scale?: boolean;
  healthy_signals_min?: number;
  risk_signals_max?: number;
  priority: PlanPriority;
  scope?: string;
  note?: string;
}

export interface TemplateDef {
  key: string;
  trigger: TriggerDef;
  title: { en: string; ar: string };
  intro: { en: string; ar: string };
  doneWhen: { en: string; ar: string };
  watchFor: { en: WatchForItem[]; ar: WatchForItem[] };
  steps: StepDef[];
}

// ─── Validation (runs once at module load) ───────────────────────────────────

const OWNER_ROLES = new Set<string>(Object.values(StepOwnerRole));
const VERIFICATIONS = new Set<string>(Object.values(StepVerification));
const PRIORITIES = new Set<string>(Object.values(PlanPriority));
const STEP_TEXT_KEYS: (keyof StepText)[] = ["workstream", "when", "title", "body", "who", "output", "evidenceNote"];

function fail(msg: string): never {
  throw new Error(`plan-templates.json: ${msg}`);
}

function isBilingual(v: unknown): v is { en: string; ar: string } {
  const o = v as Record<string, unknown>;
  return !!o && typeof o.en === "string" && typeof o.ar === "string";
}

export function validateTemplates(data: unknown): TemplateDef[] {
  const list = (data as { templates?: unknown })?.templates;
  if (!Array.isArray(list)) fail("missing 'templates' array");

  for (const t of list as Record<string, any>[]) {
    const k = t.key ?? "?";
    if (typeof t.key !== "string") fail("template without key");
    if (!t.trigger || !PRIORITIES.has(t.trigger.priority)) fail(`${k}: bad trigger.priority`);
    for (const f of ["title", "intro", "doneWhen"]) if (!isBilingual(t[f])) fail(`${k}: ${f} needs en/ar`);
    if (!Array.isArray(t.watchFor?.en) || !Array.isArray(t.watchFor?.ar)) fail(`${k}: watchFor needs en/ar arrays`);
    if (!Array.isArray(t.steps) || t.steps.length === 0) fail(`${k}: no steps`);
    for (const s of t.steps) {
      if (typeof s.order !== "number" || typeof s.dueOffsetDays !== "number") fail(`${k}: step order/dueOffsetDays`);
      if (!OWNER_ROLES.has(s.ownerRole)) fail(`${k} step ${s.order}: bad ownerRole ${s.ownerRole}`);
      if (!VERIFICATIONS.has(s.verification)) fail(`${k} step ${s.order}: bad verification ${s.verification}`);
      if (typeof s.evidenceLevel !== "string" || !Array.isArray(s.sourceKeys)) fail(`${k} step ${s.order}: evidence`);
      for (const lang of ["en", "ar"]) {
        for (const f of STEP_TEXT_KEYS) {
          if (!(f in (s[lang] ?? {}))) fail(`${k} step ${s.order}: ${lang}.${f} missing`);
        }
      }
    }
  }
  return list as TemplateDef[];
}

export const templates: TemplateDef[] = validateTemplates(rawTemplates);

export function getTemplate(key: string): TemplateDef | undefined {
  return templates.find((t) => t.key === key);
}

// ─── Trigger matching ────────────────────────────────────────────────────────

// Template trigger names that differ from the signal keys the ONA engine writes.
const SIGNAL_ALIASES: Record<string, string> = {
  burnout_elevated: "elevated_burnout",
};

function normalizeSignal(key: string): string {
  return SIGNAL_ALIASES[key] ?? key;
}

const PRIORITY_RANK: Record<PlanPriority, number> = { HIGH: 0, MEDIUM: 1, STANDARD: 2 };

export function matchesTrigger(signals: string[], riskLevel: string, trigger: TriggerDef): boolean {
  if (trigger.scope === "organisation" || trigger.missing_scale) return false;

  const sigSet = new Set(signals.map(normalizeSignal));
  if (trigger.all && !trigger.all.every((s) => sigSet.has(normalizeSignal(s)))) return false;
  if (trigger.any && !trigger.any.some((s) => sigSet.has(normalizeSignal(s)))) return false;
  if (trigger.none && trigger.none.some((s) => sigSet.has(normalizeSignal(s)))) return false;
  if (trigger.risk_signals_max !== undefined && signals.length > trigger.risk_signals_max) return false;
  // Insight cards only store risk signals, so a "healthy" risk level stands in for healthy-signal counts.
  if (trigger.healthy_signals_min !== undefined && riskLevel !== "healthy") return false;
  return true;
}

export function pickTemplate(signals: string[], riskLevel: string): TemplateDef | null {
  let best: TemplateDef | null = null;
  for (const t of templates) {
    if (!matchesTrigger(signals, riskLevel, t.trigger)) continue;
    if (!best || PRIORITY_RANK[t.trigger.priority] < PRIORITY_RANK[best.trigger.priority]) best = t;
  }
  return best;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

export interface PlaceholderNames {
  department: { en: string; ar: string };
  partner: { en: string; ar: string };
}

function fill(text: string, names: PlaceholderNames, lang: "en" | "ar"): string {
  return text
    .replace(/\{department\}/g, names.department[lang])
    .replace(/\{partner_department\}/g, names.partner[lang]);
}

function fillOpt(text: string | null, names: PlaceholderNames, lang: "en" | "ar"): string | null {
  return text === null ? null : fill(text, names, lang);
}

function fillWatchFor(items: WatchForItem[], names: PlaceholderNames, lang: "en" | "ar"): WatchForItem[] {
  return items.map((i) => ({ text: fill(i.text, names, lang), sourceKeys: [...i.sourceKeys] }));
}

/** All placeholder-bearing plan text fields. */
export function renderPlanText(t: TemplateDef, names: PlaceholderNames) {
  return {
    titleEn: fill(t.title.en, names, "en"),
    titleAr: fill(t.title.ar, names, "ar"),
    introEn: fill(t.intro.en, names, "en"),
    introAr: fill(t.intro.ar, names, "ar"),
    doneWhenEn: fill(t.doneWhen.en, names, "en"),
    doneWhenAr: fill(t.doneWhen.ar, names, "ar"),
    watchForEn: fillWatchFor(t.watchFor.en, names, "en") as unknown as Prisma.InputJsonValue,
    watchForAr: fillWatchFor(t.watchFor.ar, names, "ar") as unknown as Prisma.InputJsonValue,
  };
}

/** All placeholder-bearing step text fields. */
export function renderStepText(s: StepDef, names: PlaceholderNames) {
  return {
    workstreamEn: fillOpt(s.en.workstream, names, "en"),
    workstreamAr: fillOpt(s.ar.workstream, names, "ar"),
    whenEn: fill(s.en.when, names, "en"),
    whenAr: fill(s.ar.when, names, "ar"),
    titleEn: fill(s.en.title, names, "en"),
    titleAr: fill(s.ar.title, names, "ar"),
    bodyEn: fill(s.en.body, names, "en"),
    bodyAr: fill(s.ar.body, names, "ar"),
    whoEn: fill(s.en.who, names, "en"),
    whoAr: fill(s.ar.who, names, "ar"),
    outputEn: fill(s.en.output, names, "en"),
    outputAr: fill(s.ar.output, names, "ar"),
    evidenceNoteEn: fill(s.en.evidenceNote, names, "en"),
    evidenceNoteAr: fill(s.ar.evidenceNote, names, "ar"),
  };
}

export function buildPlanData(
  t: TemplateDef,
  ctx: {
    organisationId: string;
    departmentId: string | null;
    partnerDepartmentId: string | null;
    names: PlaceholderNames;
    signalsSnapshot: Prisma.InputJsonValue;
  }
): Prisma.ActionPlanUncheckedCreateInput {
  return {
    organisationId: ctx.organisationId,
    departmentId: ctx.departmentId,
    partnerDepartmentId: ctx.partnerDepartmentId,
    templateKey: t.key,
    priority: t.trigger.priority,
    signalsSnapshot: ctx.signalsSnapshot,
    ...renderPlanText(t, ctx.names),
    steps: {
      create: t.steps.map((s) => ({
        order: s.order,
        dueOffsetDays: s.dueOffsetDays,
        ownerRole: s.ownerRole,
        verification: s.verification,
        evidenceLevel: s.evidenceLevel,
        sourceKeys: [...s.sourceKeys],
        ...renderStepText(s, ctx.names),
      })),
    },
  };
}

// ─── Generation ──────────────────────────────────────────────────────────────

const REQUIRED_SCALES = ["CBI", "PSYCH_SAFETY", "LMX7", "TURNOVER"];

export async function generatePlans(organisationId: string): Promise<number> {
  const cards = await prisma.onaInsightCard.findMany({
    where: { organisationId },
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });
  const cardByDept = new Map<string, (typeof cards)[number]>();
  for (const c of cards) if (!cardByDept.has(c.departmentId)) cardByDept.set(c.departmentId, c);

  const departments = await prisma.department.findMany({ where: { organisationId } });
  const deptById = new Map(departments.map((d) => [d.id, d]));

  // Average isolation per department, for the default {partner_department}.
  const metrics = await prisma.onaMetric.findMany({
    where: { organisationId, departmentId: { not: null } },
    select: { departmentId: true, isolationScore: true },
  });
  const iso = new Map<string, { sum: number; n: number }>();
  for (const m of metrics) {
    const e = iso.get(m.departmentId!) ?? { sum: 0, n: 0 };
    e.sum += m.isolationScore;
    e.n += 1;
    iso.set(m.departmentId!, e);
  }

  // Latest closed cycle per scale, and per-department averages (only for groups ≥ MIN_DEPT_RESPONDENTS).
  const closedCycles = await prisma.assessmentCycle.findMany({
    where: { organisationId, status: "CLOSED" },
    orderBy: { endsAt: "desc" },
    include: { assessment: { select: { type: true } } },
  });
  const latestByType = new Map<string, string>();
  for (const c of closedCycles) if (!latestByType.has(c.assessment.type)) latestByType.set(c.assessment.type, c.id);
  const typeByCycle = new Map([...latestByType].map(([t, id]) => [id, t]));

  const scores = typeByCycle.size
    ? await prisma.score.findMany({
        where: { subscale: "total", respondent: { cycleId: { in: [...typeByCycle.keys()] }, departmentId: { not: null } } },
        select: { scaledScore: true, respondent: { select: { departmentId: true, cycleId: true } } },
      })
    : [];
  const scaleVals = new Map<string, Map<string, number[]>>();
  for (const s of scores) {
    const d = s.respondent.departmentId!;
    const type = typeByCycle.get(s.respondent.cycleId)!;
    if (!scaleVals.has(d)) scaleVals.set(d, new Map());
    const arr = scaleVals.get(d)!.get(type) ?? [];
    arr.push(s.scaledScore);
    scaleVals.get(d)!.set(type, arr);
  }

  function scaleAverages(deptId: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [type, vals] of scaleVals.get(deptId) ?? []) {
      if (vals.length < MIN_DEPT_RESPONDENTS) continue;
      out[type] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
    return out;
  }

  function defaultPartner(deptId: string): string | null {
    let best: string | null = null;
    let bestAvg = -1;
    for (const [id, { sum, n }] of iso) {
      if (id === deptId || !deptById.has(id)) continue;
      if (sum / n > bestAvg) {
        bestAvg = sum / n;
        best = id;
      }
    }
    return best;
  }

  function names(deptId: string | null, partnerId: string | null): PlaceholderNames {
    const d = deptId ? deptById.get(deptId) : undefined;
    const p = partnerId ? deptById.get(partnerId) : undefined;
    return {
      department: { en: d?.name ?? "", ar: d?.nameAr ?? d?.name ?? "" },
      partner: { en: p?.name ?? "", ar: p?.nameAr ?? p?.name ?? "" },
    };
  }

  const toCreate: Prisma.ActionPlanUncheckedCreateInput[] = [];

  for (const [deptId, card] of cardByDept) {
    const respondents = await prisma.respondent.count({
      where: { departmentId: deptId, cycleId: { in: [...typeByCycle.keys()] }, submittedAt: { not: null } },
    });
    if (respondents < MIN_DEPT_RESPONDENTS) {
      logger.info(`generatePlans: skipping dept ${deptId} — ${respondents} respondents`);
      continue;
    }

    const signals = card.signals as string[];
    const tmpl = pickTemplate(signals, card.riskLevel);
    if (!tmpl) continue;

    const partnerId = defaultPartner(deptId);
    toCreate.push(
      buildPlanData(tmpl, {
        organisationId,
        departmentId: deptId,
        partnerDepartmentId: partnerId,
        names: names(deptId, partnerId),
        signalsSnapshot: {
          insightCardId: card.id,
          riskLevel: card.riskLevel,
          signals,
          scaleAverages: scaleAverages(deptId),
        },
      })
    );
  }

  const missing = REQUIRED_SCALES.filter((t) => !latestByType.has(t));
  const gap = templates.find((t) => t.trigger.missing_scale);
  if (gap && missing.length > 0) {
    toCreate.push(
      buildPlanData(gap, {
        organisationId,
        departmentId: null,
        partnerDepartmentId: null,
        names: names(null, null),
        signalsSnapshot: { missingScales: missing },
      })
    );
  }

  for (const data of toCreate) await prisma.actionPlan.create({ data });
  logger.info(`generatePlans: created ${toCreate.length} plans for org ${organisationId}`);
  return toCreate.length;
}
