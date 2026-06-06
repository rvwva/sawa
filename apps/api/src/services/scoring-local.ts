/**
 * In-process scoring fallback — mirrors the Python scoring service formulas.
 * Used when the Python microservice is unreachable.
 */

type ScoringResult = Record<string, any>;

// ─── Band helper ─────────────────────────────────────────────────────────────

function getBand(bands: [number, number, string][], score: number): string {
  return bands.find(([lo, hi]) => score >= lo && score <= hi)?.[2] ?? bands[bands.length - 1][2];
}

// ─── CBI ────────────────────────────────────────────────────────────────────
// Values arrive pre-mapped to 0/25/50/75/100 by SurveyJS.
// cbi_13 uses DEGREE_CHOICES_REVERSED in SurveyJS — already inverted at the
// choice level — so no additional reversal is applied here.

const CBI_PERSONAL = Array.from({ length: 6 }, (_, i) => `cbi_${i + 1}`);
const CBI_WORK     = Array.from({ length: 7 }, (_, i) => `cbi_${i + 7}`);
const CBI_CLIENT   = Array.from({ length: 6 }, (_, i) => `cbi_${i + 14}`);
const CBI_BANDS: [number, number, string][] = [
  [0, 49, "Low"],
  [50, 74, "Moderate"],
  [75, 100, "High"],
];

function avg(keys: string[], responses: Record<string, number>): number {
  const vals = keys.map(k => responses[k] ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function round1(n: number) { return Math.round(n * 10) / 10; }

function scoresCBI(responses: Record<string, number>): ScoringResult {
  const personal = avg(CBI_PERSONAL, responses);
  const work     = avg(CBI_WORK, responses);
  const client   = avg(CBI_CLIENT, responses);
  const allKeys  = [...CBI_PERSONAL, ...CBI_WORK, ...CBI_CLIENT];
  const total    = avg(allKeys, responses);

  return {
    subscales: {
      personal_burnout: { score: round1(personal), band: getBand(CBI_BANDS, personal) },
      work_burnout:     { score: round1(work),     band: getBand(CBI_BANDS, work) },
      client_burnout:   { score: round1(client),   band: getBand(CBI_BANDS, client) },
    },
    total: { score: round1(total), band: getBand(CBI_BANDS, total) },
  };
}

// ─── Culture ────────────────────────────────────────────────────────────────
// 9 dimensions · 40 items · 1-5 Likert scale.
// Dimension score = (mean − 1) / 4 × 100. Overall = mean of dimension scores.

const CULTURE_DIMS = [
  { key: "leadership",           label: "Leadership Effectiveness",     items: ["culture_1","culture_2","culture_3","culture_4","culture_5"] },
  { key: "communication",        label: "Communication & Transparency", items: ["culture_6","culture_7","culture_8","culture_9","culture_10"] },
  { key: "innovation",           label: "Innovation & Agility",         items: ["culture_11","culture_12","culture_13","culture_14"] },
  { key: "psychological_safety", label: "Psychological Safety",         items: ["culture_15","culture_16","culture_17","culture_18","culture_19"] },
  { key: "inclusion",            label: "Inclusion & Belonging",        items: ["culture_20","culture_21","culture_22","culture_23","culture_24"] },
  { key: "growth",               label: "Growth & Development",         items: ["culture_25","culture_26","culture_27","culture_28"] },
  { key: "work_life_balance",    label: "Work-Life Balance",            items: ["culture_29","culture_30","culture_31","culture_32"] },
  { key: "recognition",          label: "Recognition & Reward",         items: ["culture_33","culture_34","culture_35","culture_36"] },
  { key: "collaboration",        label: "Collaboration & Teamwork",     items: ["culture_37","culture_38","culture_39","culture_40"] },
] as const;

const CULTURE_BANDS: [number, number, string][] = [
  [0, 40, "Needs Attention"],
  [41, 60, "Developing"],
  [61, 80, "Healthy"],
  [81, 100, "Thriving"],
];

function scoresCulture(responses: Record<string, number>): ScoringResult {
  const dims = CULTURE_DIMS.map(({ key, label, items }) => {
    const m = avg(items as unknown as string[], responses);
    const score = round1((m - 1) / 4 * 100);
    return { key, label, score, mean: Math.round(m * 100) / 100, band: getBand(CULTURE_BANDS, score) };
  });
  const overall = round1(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  return {
    dimensions: dims,
    total: { score: overall, band: getBand(CULTURE_BANDS, overall) },
  };
}

// ─── Psychological Safety ────────────────────────────────────────────────────
// 7-point Likert · items 1, 3, 5 are reverse-scored at the choice-value level
// in SurveyJS, so this function simply sums all raw values.

const PSYCH_SAFETY_ITEMS = ["ps_1", "ps_2", "ps_3", "ps_4", "ps_5", "ps_6", "ps_7"];
const PSYCH_SAFETY_BANDS: [number, number, string][] = [
  [0,  49,  "Low"],
  [50, 74,  "Moderate"],
  [75, 100, "Healthy"],
];

function scoresPsychSafety(responses: Record<string, number>): ScoringResult {
  const raw   = PSYCH_SAFETY_ITEMS.reduce((s, k) => s + (responses[k] ?? 0), 0);
  const score = round1((raw - 7) / 42 * 100);
  return { total: { raw_score: raw, score, band: getBand(PSYCH_SAFETY_BANDS, score) } };
}

// ─── Turnover Intention ──────────────────────────────────────────────────────
// 5-point frequency scale (1=Never … 5=Always). Higher = worse.

const TURNOVER_ITEMS = ["ti_1", "ti_2", "ti_3"];
const TURNOVER_BANDS: [number, number, string][] = [
  [0,  29,  "Good"],
  [30, 59,  "Moderate"],
  [60, 100, "High"],
];

function scoresTurnover(responses: Record<string, number>): ScoringResult {
  const raw   = TURNOVER_ITEMS.reduce((s, k) => s + (responses[k] ?? 0), 0);
  const score = round1((raw - 3) / 12 * 100);
  return { total: { raw_score: raw, score, band: getBand(TURNOVER_BANDS, score) } };
}

// ─── LMX-7 ──────────────────────────────────────────────────────────────────
// Mixed per-item response options, all mapped to 1–5.

const LMX7_ITEMS = ["lmx_1", "lmx_2", "lmx_3", "lmx_4", "lmx_5", "lmx_6", "lmx_7"];
const LMX7_BANDS: [number, number, string][] = [
  [0,  44,  "Low"],
  [45, 69,  "Moderate"],
  [70, 100, "Healthy"],
];

function scoresLMX7(responses: Record<string, number>): ScoringResult {
  const raw   = LMX7_ITEMS.reduce((s, k) => s + (responses[k] ?? 0), 0);
  const score = round1((raw - 7) / 28 * 100);
  return { total: { raw_score: raw, score, band: getBand(LMX7_BANDS, score) } };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function scoreLocal(
  assessmentType: string,
  responses: Record<string, number>,
): ScoringResult {
  switch (assessmentType) {
    case "CBI":          return scoresCBI(responses);
    case "CULTURE":      return scoresCulture(responses);
    case "PSYCH_SAFETY": return scoresPsychSafety(responses);
    case "TURNOVER":     return scoresTurnover(responses);
    case "LMX7":         return scoresLMX7(responses);
    default:             return {};
  }
}
