/**
 * Turnover Intention Scale — SurveyJS Schema + Scoring Rules
 * ===========================================================
 * Mobley, W. H. (1977). Intermediate linkages in the relationship between
 * job satisfaction and employee turnover. Journal of Applied Psychology, 62(2).
 *
 * 3 items on a 5-point frequency scale (1 = Never, 5 = Always).
 * Higher score = higher turnover intention (higher = worse).
 * Raw sum range: 3–15. Scaled to 0–100 as (sum − 3) / 12 × 100.
 */

const TURNOVER_CHOICES = [
  { value: 5, text: "Always" },
  { value: 4, text: "Often" },
  { value: 3, text: "Sometimes" },
  { value: 2, text: "Rarely" },
  { value: 1, text: "Never" },
];

export const TURNOVER_SURVEY_SCHEMA = {
  title: "Turnover Intention",
  description:
    "The following questions ask about your thoughts regarding your current employment. Please answer honestly based on the last few months.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  pages: [
    {
      name: "turnover",
      title: "Over the past few months, how often have you…",
      elements: [
        {
          type: "radiogroup",
          name: "ti_1",
          title: "I think about quitting my current job.",
          choices: TURNOVER_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ti_2",
          title: "I am actively looking for another job outside this organization.",
          choices: TURNOVER_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ti_3",
          title: "I will likely look for a new job in the next 12 months.",
          choices: TURNOVER_CHOICES,
          isRequired: true,
        },
      ],
    },
  ],
};

export const TURNOVER_SCORING_RULES = {
  type: "TURNOVER",
  version: "1.0",
  items: ["ti_1", "ti_2", "ti_3"],
  total: {
    method: "sum_then_scale",
    raw_min: 3,
    raw_max: 15,
    scaled_range: { min: 0, max: 100 },
  },
  bands: [
    { min: 0,  max: 29,  label: "Good",     description: "Low flight risk" },
    { min: 30, max: 59,  label: "Moderate",  description: "Moderate flight risk" },
    { min: 60, max: 100, label: "High",      description: "High flight risk" },
  ],
};
