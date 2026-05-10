/**
 * WHO-5 Wellbeing Index — SurveyJS Schema + Scoring Rules
 * =========================================================
 * World Health Organization (1998). Mastering Depression in Primary Care.
 * WHO Regional Office for Europe, Frederiksborg.
 *
 * 5 items rated 0–5 (past 2 weeks). Raw score 0–25. Percentage = raw × 4 (0–100).
 * Score ≤ 50 → depression screening recommended.
 */

const WHO5_CHOICES = [
  { value: 5, text: "All of the time" },
  { value: 4, text: "Most of the time" },
  { value: 3, text: "More than half of the time" },
  { value: 2, text: "Less than half of the time" },
  { value: 1, text: "Some of the time" },
  { value: 0, text: "At no time" },
];

export const WHO5_SURVEY_SCHEMA = {
  title: "WHO-5 Wellbeing Index",
  description:
    "Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks. Notice that higher numbers mean better wellbeing.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  pages: [
    {
      name: "who5",
      title: "Over the last two weeks…",
      elements: [
        {
          type: "radiogroup",
          name: "who5_1",
          title: "I have felt cheerful and in good spirits.",
          choices: WHO5_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "who5_2",
          title: "I have felt calm and relaxed.",
          choices: WHO5_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "who5_3",
          title: "I have felt active and vigorous.",
          choices: WHO5_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "who5_4",
          title: "I woke up feeling fresh and rested.",
          choices: WHO5_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "who5_5",
          title: "My daily life has been filled with things that interest me.",
          choices: WHO5_CHOICES,
          isRequired: true,
        },
      ],
    },
  ],
};

export const WHO5_SCORING_RULES = {
  type: "WHO5",
  version: "1.0",
  items: ["who5_1","who5_2","who5_3","who5_4","who5_5"],
  total: {
    method: "sum_then_multiply",
    multiplier: 4,        // raw (0–25) × 4 = percentage (0–100)
    raw_range: { min: 0, max: 25 },
    scaled_range: { min: 0, max: 100 },
  },
  depression_screen_threshold: 50,  // percentage score ≤ 50
  bands: [
    { min: 0,  max: 28,  label: "Low",           description: "Poor wellbeing — depression screening is recommended." },
    { min: 29, max: 50,  label: "Below Average",  description: "Below average wellbeing. Consider speaking to a trusted person or professional." },
    { min: 51, max: 67,  label: "Moderate",       description: "Moderate wellbeing — there is room for improvement." },
    { min: 68, max: 100, label: "Good",            description: "Good wellbeing. Keep nurturing your mental health." },
  ],
};
