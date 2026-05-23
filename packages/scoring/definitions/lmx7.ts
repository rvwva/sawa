/**
 * LMX-7 (Leader-Member Exchange) — SurveyJS Schema + Scoring Rules
 * ==================================================================
 * Graen, G. B., & Uhl-Bien, M. (1995). Relationship-based approach to leadership:
 * Development of leader-member exchange theory. The Leadership Quarterly, 6(2).
 *
 * 7 items with mixed response options, each mapped to values 1–5.
 * Higher score = better manager-employee relationship.
 * Raw sum range: 7–35. Scaled to 0–100 as (sum − 7) / 28 × 100.
 */

export const LMX7_SURVEY_SCHEMA = {
  title: "Leader-Member Exchange (LMX-7)",
  description:
    "The following questions ask about your professional relationship with your immediate manager. Please answer honestly.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  pages: [
    {
      name: "lmx7",
      title: "Your relationship with your manager",
      elements: [
        {
          type: "radiogroup",
          name: "lmx_1",
          title: "How well does your manager understand your job problems and needs?",
          choices: [
            { value: 1, text: "Not at all" },
            { value: 2, text: "A little" },
            { value: 3, text: "A fair amount" },
            { value: 4, text: "Quite a bit" },
            { value: 5, text: "A great deal" },
          ],
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "lmx_2",
          title: "How well does your manager recognize your potential?",
          choices: [
            { value: 1, text: "Not at all" },
            { value: 2, text: "A little" },
            { value: 3, text: "Moderately" },
            { value: 4, text: "Mostly" },
            { value: 5, text: "Fully" },
          ],
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "lmx_3",
          title:
            "Regardless of how much formal authority your manager has, what are the chances that they would use their power to help you solve problems in your work?",
          choices: [
            { value: 1, text: "None" },
            { value: 2, text: "Small" },
            { value: 3, text: "Moderate" },
            { value: 4, text: "High" },
            { value: 5, text: "Very high" },
          ],
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "lmx_4",
          title:
            "Again, regardless of the amount of formal authority your manager has, to what extent would they 'bail you out' at their expense?",
          choices: [
            { value: 1, text: "None" },
            { value: 2, text: "A little" },
            { value: 3, text: "A fair amount" },
            { value: 4, text: "Quite a bit" },
            { value: 5, text: "A great deal" },
          ],
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "lmx_5",
          title:
            "I have enough confidence in my manager that I would defend and justify their decisions if they were not present to do so.",
          choices: [
            { value: 1, text: "Strongly Disagree" },
            { value: 2, text: "Disagree" },
            { value: 3, text: "Neutral" },
            { value: 4, text: "Agree" },
            { value: 5, text: "Strongly Agree" },
          ],
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "lmx_6",
          title: "How would you characterize your working relationship with your manager?",
          choices: [
            { value: 1, text: "Extremely ineffective" },
            { value: 2, text: "Worse than average" },
            { value: 3, text: "Average" },
            { value: 4, text: "Better than average" },
            { value: 5, text: "Extremely effective" },
          ],
          isRequired: true,
        },
        {
          type: "radiogroup",
          name: "lmx_7",
          title: "How well does your manager understand your personal circumstances?",
          choices: [
            { value: 1, text: "Not at all" },
            { value: 2, text: "A little" },
            { value: 3, text: "A fair amount" },
            { value: 4, text: "Quite a bit" },
            { value: 5, text: "A great deal" },
          ],
          isRequired: true,
        },
      ],
    },
  ],
};

export const LMX7_SCORING_RULES = {
  type: "LMX7",
  version: "1.0",
  items: ["lmx_1", "lmx_2", "lmx_3", "lmx_4", "lmx_5", "lmx_6", "lmx_7"],
  total: {
    method: "sum_then_scale",
    raw_min: 7,
    raw_max: 35,
    scaled_range: { min: 0, max: 100 },
  },
  bands: [
    { min: 0,  max: 44,  label: "Low",      description: "Weak manager relationship — leadership attention needed" },
    { min: 45, max: 69,  label: "Moderate",  description: "Average manager relationship" },
    { min: 70, max: 100, label: "Healthy",   description: "Strong manager relationship" },
  ],
};
