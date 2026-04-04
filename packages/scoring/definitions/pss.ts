/**
 * Perceived Stress Scale — 10-item version (PSS-10) — SurveyJS Schema + Scoring Rules
 * ======================================================================================
 * Cohen, Kamarck & Mermelstein (1983). Journal of Health and Social Behavior, 24, 385–396.
 *
 * 10 items. Items 4, 5, 7, 8 are positively worded and must be reverse-scored.
 * Scale: 0 (Never) → 4 (Very Often). Total range: 0–40.
 */

const PSS_CHOICES = [
  { value: 0, text: "Never" },
  { value: 1, text: "Almost Never" },
  { value: 2, text: "Sometimes" },
  { value: 3, text: "Fairly Often" },
  { value: 4, text: "Very Often" },
];

// Positive items displayed with the same scale but reverse-scored during computation
const PSS_CHOICES_POSITIVE = PSS_CHOICES; // displayed identically; reversal done in scoring

export const PSS_SURVEY_SCHEMA = {
  title: "Perceived Stress Scale (PSS-10)",
  description:
    "The questions in this scale ask you about your feelings and thoughts during the last month. In each case, please indicate how often you felt or thought a certain way.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  questionsOnPageMode: "singlePage",
  pages: [
    {
      name: "pss",
      title: "In the last month, how often have you…",
      elements: [
        {
          type: "radiogroup",
          name: "pss_1",
          title: "…been upset because of something that happened unexpectedly?",
          choices: PSS_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_2",
          title: "…felt that you were unable to control the important things in your life?",
          choices: PSS_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_3",
          title: "…felt nervous and stressed?",
          choices: PSS_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_4",
          title: "…felt confident about your ability to handle your personal problems?",
          description: "This item is reverse-scored.",
          choices: PSS_CHOICES_POSITIVE,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_5",
          title: "…felt that things were going your way?",
          description: "This item is reverse-scored.",
          choices: PSS_CHOICES_POSITIVE,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_6",
          title: "…found that you could not cope with all the things that you had to do?",
          choices: PSS_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_7",
          title: "…been able to control irritations in your life?",
          description: "This item is reverse-scored.",
          choices: PSS_CHOICES_POSITIVE,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_8",
          title: "…felt that you were on top of things?",
          description: "This item is reverse-scored.",
          choices: PSS_CHOICES_POSITIVE,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_9",
          title: "…been angered because of things that were outside of your control?",
          choices: PSS_CHOICES,
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "pss_10",
          title:
            "…felt difficulties were piling up so high that you could not overcome them?",
          choices: PSS_CHOICES,
          isRequired: true,
        },
      ],
    },
  ],
};

export const PSS_SCORING_RULES = {
  type: "PSS",
  version: "1.0",
  items: {
    negative: ["pss_1","pss_2","pss_3","pss_6","pss_9","pss_10"],
    positive: ["pss_4","pss_5","pss_7","pss_8"],  // reverse-scored
  },
  total: {
    method: "sum",
    range: { min: 0, max: 40 },
  },
  bands: [
    { min: 0,  max: 13, label: "Low",      description: "Low perceived stress." },
    { min: 14, max: 26, label: "Moderate", description: "Moderate perceived stress. Monitor stress levels and use coping strategies." },
    { min: 27, max: 40, label: "High",     description: "High perceived stress. Consider speaking with a healthcare professional." },
  ],
};
