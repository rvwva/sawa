/**
 * Psychological Safety Scale — SurveyJS Schema + Scoring Rules
 * =============================================================
 * Edmondson, A. (1999). Psychological safety and learning behavior in work teams.
 * Administrative Science Quarterly, 44(2), 350–383.
 *
 * 7 items on a 7-point Likert scale (1 = Strongly Disagree, 7 = Strongly Agree).
 * Items 1, 3, and 5 are negatively worded — their choice values are reversed so
 * the scoring function requires no additional transformation.
 * Raw sum range: 7–49. Scaled to 0–100 as (sum − 7) / 42 × 100.
 */

// Forward-scored choices (higher agreement = higher safety)
const PSYCH_LIKERT = [
  { value: 7, text: "Strongly Agree" },
  { value: 6, text: "Agree" },
  { value: 5, text: "Somewhat Agree" },
  { value: 4, text: "Neutral" },
  { value: 3, text: "Somewhat Disagree" },
  { value: 2, text: "Disagree" },
  { value: 1, text: "Strongly Disagree" },
];

// Reverse-scored choices (higher agreement = lower safety; values are inverted)
const PSYCH_LIKERT_REVERSED = [
  { value: 1, text: "Strongly Agree" },
  { value: 2, text: "Agree" },
  { value: 3, text: "Somewhat Agree" },
  { value: 4, text: "Neutral" },
  { value: 5, text: "Somewhat Disagree" },
  { value: 6, text: "Disagree" },
  { value: 7, text: "Strongly Disagree" },
];

export const PSYCH_SAFETY_SURVEY_SCHEMA = {
  title: "Psychological Safety Scale",
  description:
    "The following questions ask about your experience on your immediate team. Please answer based on how things currently are, not how you think they should be.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  pages: [
    {
      name: "psych_safety",
      title: "In your current team…",
      elements: [
        {
          type: "radiogroup",
          name: "ps_1",
          title: "If you make a mistake on this team, it is often held against you.",
          choices: PSYCH_LIKERT_REVERSED,  // reverse: agreeing = lower safety
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ps_2",
          title: "Members of this team are able to bring up problems and tough issues.",
          choices: PSYCH_LIKERT,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ps_3",
          title: "People on this team sometimes reject others for being different.",
          choices: PSYCH_LIKERT_REVERSED,  // reverse: agreeing = lower safety
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ps_4",
          title: "It is safe to take a risk on this team.",
          choices: PSYCH_LIKERT,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ps_5",
          title: "It is difficult to ask other members of this team for help.",
          choices: PSYCH_LIKERT_REVERSED,  // reverse: agreeing = lower safety
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ps_6",
          title:
            "No one on this team would deliberately act in a way that undermines my efforts.",
          choices: PSYCH_LIKERT,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "ps_7",
          title:
            "Working with members of this team, my unique skills and talents are valued and utilized.",
          choices: PSYCH_LIKERT,
          isRequired: true,
        },
      ],
    },
  ],
};

export const PSYCH_SAFETY_SCORING_RULES = {
  type: "PSYCH_SAFETY",
  version: "1.0",
  items: ["ps_1", "ps_2", "ps_3", "ps_4", "ps_5", "ps_6", "ps_7"],
  reversed_items: ["ps_1", "ps_3", "ps_5"], // encoded in choice values; no runtime reversal needed
  total: {
    method: "sum_then_scale",
    raw_min: 7,
    raw_max: 49,
    scaled_range: { min: 0, max: 100 },
  },
  bands: [
    { min: 0,  max: 49,  label: "Low",      description: "Psychological safety needs attention" },
    { min: 50, max: 74,  label: "Moderate",  description: "Some safety concerns present" },
    { min: 75, max: 100, label: "Healthy",   description: "Psychologically safe environment" },
  ],
};
