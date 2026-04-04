/**
 * Copenhagen Burnout Inventory (CBI) — SurveyJS Schema + Scoring Rules
 * ======================================================================
 * 19 items across 3 subscales.
 * Validated instrument: Kristensen et al. (2005), Work & Stress, 19(3).
 *
 * Response values are pre-mapped to CBI integers (0/25/50/75/100) by SurveyJS.
 */

// ─── Shared answer choices ────────────────────────────────────────────────

const FREQUENCY_CHOICES = [
  { value: 100, text: "Always" },
  { value: 75,  text: "Often" },
  { value: 50,  text: "Sometimes" },
  { value: 25,  text: "Seldom" },
  { value: 0,   text: "Never / Almost never" },
];

const DEGREE_CHOICES = [
  { value: 100, text: "To a very high degree" },
  { value: 75,  text: "To a high degree" },
  { value: 50,  text: "Somewhat" },
  { value: 25,  text: "To a low degree" },
  { value: 0,   text: "To a very low degree" },
];

// Item 13 reversed degree choices
const DEGREE_CHOICES_REVERSED = [
  { value: 0,   text: "To a very high degree" },
  { value: 25,  text: "To a high degree" },
  { value: 50,  text: "Somewhat" },
  { value: 75,  text: "To a low degree" },
  { value: 100, text: "To a very low degree" },
];

// ─── SurveyJS schema ──────────────────────────────────────────────────────

export const CBI_SURVEY_SCHEMA = {
  title: "Copenhagen Burnout Inventory",
  description:
    "The following questions ask about how you have been feeling recently. Please choose the answer that best describes your experience.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  questionsOnPageMode: "singlePage",
  pages: [
    {
      name: "personal_burnout",
      title: "Personal Burnout",
      description: "These questions are about how you feel in general.",
      elements: [
        { type: "radiogroup", name: "cbi_1",  title: "How often do you feel tired?",                                choices: FREQUENCY_CHOICES, isRequired: true },
        { type: "radiogroup", name: "cbi_2",  title: "How often are you physically exhausted?",                    choices: FREQUENCY_CHOICES, isRequired: true },
        { type: "radiogroup", name: "cbi_3",  title: "How often are you emotionally exhausted?",                   choices: FREQUENCY_CHOICES, isRequired: true },
        { type: "radiogroup", name: "cbi_4",  title: 'How often do you think "I can\'t take it anymore"?',         choices: FREQUENCY_CHOICES, isRequired: true },
        { type: "radiogroup", name: "cbi_5",  title: "How often do you feel worn out?",                            choices: FREQUENCY_CHOICES, isRequired: true },
        { type: "radiogroup", name: "cbi_6",  title: "How often do you feel weak and susceptible to illness?",     choices: FREQUENCY_CHOICES, isRequired: true },
      ],
    },
    {
      name: "work_burnout",
      title: "Work-Related Burnout",
      description: "These questions are about your work and how you feel about it.",
      elements: [
        { type: "radiogroup", name: "cbi_7",  title: "Is your work emotionally exhausting?",                                         choices: DEGREE_CHOICES,          isRequired: true },
        { type: "radiogroup", name: "cbi_8",  title: "Do you feel burnt out because of your work?",                                   choices: DEGREE_CHOICES,          isRequired: true },
        { type: "radiogroup", name: "cbi_9",  title: "Does your work frustrate you?",                                                 choices: DEGREE_CHOICES,          isRequired: true },
        { type: "radiogroup", name: "cbi_10", title: "Do you feel worn out at the end of the working day?",                           choices: DEGREE_CHOICES,          isRequired: true },
        { type: "radiogroup", name: "cbi_11", title: "Are you exhausted in the morning at the thought of another day at work?",       choices: DEGREE_CHOICES,          isRequired: true },
        { type: "radiogroup", name: "cbi_12", title: "Do you feel that every working hour is tiring for you?",                        choices: DEGREE_CHOICES,          isRequired: true },
        { type: "radiogroup", name: "cbi_13", title: "Do you have enough energy for family and friends during leisure time?",          choices: DEGREE_CHOICES_REVERSED, isRequired: true },
      ],
    },
    {
      name: "client_burnout",
      title: "Client-Related Burnout",
      description: "These questions are about your work with the people you interact with professionally (clients, customers, patients, or similar).",
      elements: [
        { type: "radiogroup", name: "cbi_14", title: "Do you find it hard to work with clients?",                                                  choices: DEGREE_CHOICES,  isRequired: true },
        { type: "radiogroup", name: "cbi_15", title: "Does it drain your energy to work with clients?",                                             choices: DEGREE_CHOICES,  isRequired: true },
        { type: "radiogroup", name: "cbi_16", title: "Do you find it frustrating to work with clients?",                                            choices: DEGREE_CHOICES,  isRequired: true },
        { type: "radiogroup", name: "cbi_17", title: "Do you feel that you give more than you get back when you work with clients?",                 choices: DEGREE_CHOICES,  isRequired: true },
        { type: "radiogroup", name: "cbi_18", title: "Are you tired of working with clients?",                                                      choices: FREQUENCY_CHOICES, isRequired: true },
        { type: "radiogroup", name: "cbi_19", title: "Do you sometimes wonder how long you will be able to continue working with clients?",          choices: FREQUENCY_CHOICES, isRequired: true },
      ],
    },
  ],
};

// ─── Scoring rules (used by API and Python service) ───────────────────────

export const CBI_SCORING_RULES = {
  type: "CBI",
  version: "1.0",
  subscales: {
    personal_burnout: {
      items: ["cbi_1","cbi_2","cbi_3","cbi_4","cbi_5","cbi_6"],
      reversed: [],
      method: "mean",       // mean of pre-mapped values (0/25/50/75/100)
    },
    work_burnout: {
      items: ["cbi_7","cbi_8","cbi_9","cbi_10","cbi_11","cbi_12","cbi_13"],
      reversed: ["cbi_13"], // encoded in choices; already reversed in schema
      method: "mean",
    },
    client_burnout: {
      items: ["cbi_14","cbi_15","cbi_16","cbi_17","cbi_18","cbi_19"],
      reversed: [],
      method: "mean",
    },
  },
  total: {
    method: "mean_of_all",
  },
  bands: [
    { min: 0,  max: 49,  label: "Low",      description: "Burnout is not a significant problem." },
    { min: 50, max: 74,  label: "Moderate",  description: "Some burnout present — monitor and take preventive steps." },
    { min: 75, max: 100, label: "High",      description: "High burnout — intervention is recommended." },
  ],
};
