/**
 * In-process scoring fallback — mirrors the Python scoring service formulas.
 * Used when the Python microservice is unreachable.
 */

type ScoringResult = Record<string, any>;

// ─── Band helper ─────────────────────────────────────────────────────────────

function getBand(bands: [number, number, string][], score: number): string {
  return bands.find(([lo, hi]) => score >= lo && score <= hi)?.[2] ?? bands[bands.length - 1][2];
}

// ─── WHO-5 ──────────────────────────────────────────────────────────────────

const WHO5_ITEMS = Array.from({ length: 5 }, (_, i) => `who5_${i + 1}`);
const WHO5_BANDS: [number, number, string][] = [
  [0, 28, "Low"],
  [29, 50, "Below Average"],
  [51, 67, "Moderate"],
  [68, 100, "Good"],
];

function scoresWHO5(responses: Record<string, number>): ScoringResult {
  const raw = WHO5_ITEMS.reduce((s, k) => s + (responses[k] ?? 0), 0);
  const pct = raw * 4;
  return { total: { raw_score: raw, score: pct, band: getBand(WHO5_BANDS, pct) } };
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

// ─── Public API ─────────────────────────────────────────────────────────────

export function scoreLocal(
  assessmentType: string,
  responses: Record<string, number>,
): ScoringResult {
  switch (assessmentType) {
    case "WHO5":    return scoresWHO5(responses);
    case "CBI":     return scoresCBI(responses);
    case "CULTURE": return scoresCulture(responses);
    default:        return {};
  }
}
