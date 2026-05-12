/**
 * Mindlign Proprietary Culture Assessment — SurveyJS Schema + Scoring Rules
 * ========================================================================
 * 9 dimensions · 40 items · 5-point Likert scale.
 *
 * Dimensions:
 *   1. Leadership Effectiveness        (items 1–5)
 *   2. Communication & Transparency    (items 6–10)
 *   3. Innovation & Agility            (items 11–14)
 *   4. Psychological Safety            (items 15–19)
 *   5. Inclusion & Belonging           (items 20–24)
 *   6. Growth & Development            (items 25–28)
 *   7. Work-Life Balance               (items 29–32)
 *   8. Recognition & Reward            (items 33–36)
 *   9. Collaboration & Teamwork        (items 37–40)
 *
 * Scoring: dimension_score = (mean_likert − 1) / 4 × 100  →  0–100
 * Bands: 0–40 Needs Attention | 41–60 Developing | 61–80 Healthy | 81–100 Thriving
 */

const LIKERT_CHOICES = [
  { value: 1, text: "Strongly Disagree" },
  { value: 2, text: "Disagree" },
  { value: 3, text: "Neutral" },
  { value: 4, text: "Agree" },
  { value: 5, text: "Strongly Agree" },
];

function item(name: string, title: string) {
  return { type: "radiogroup", name, title, choices: LIKERT_CHOICES, isRequired: true };
}

export const CULTURE_SURVEY_SCHEMA = {
  title: "Mindlign Culture Assessment",
  description:
    "This assessment measures nine dimensions of your workplace culture. Please rate each statement based on your actual experience at work — not how you think things should be.",
  logoPosition: "right",
  showProgressBar: "top",
  showQuestionNumbers: "on",
  pages: [
    {
      name: "leadership",
      title: "Leadership Effectiveness",
      description: "Rate statements about leadership in your organisation.",
      elements: [
        item("culture_1",  "My manager provides clear direction and goals."),
        item("culture_2",  "Senior leadership communicates a compelling vision for the organisation."),
        item("culture_3",  "I trust the decisions made by our leadership team."),
        item("culture_4",  "Leaders in this organisation lead by example and model the values they promote."),
        item("culture_5",  "My manager actively supports my professional growth and development."),
      ],
    },
    {
      name: "communication",
      title: "Communication & Transparency",
      description: "Rate how openly and effectively information flows in your organisation.",
      elements: [
        item("culture_6",  "Important information is shared openly across the organisation."),
        item("culture_7",  "I feel well-informed about changes that affect my work."),
        item("culture_8",  "Leadership is transparent about the challenges the organisation faces."),
        item("culture_9",  "I feel comfortable sharing my opinions and ideas with my team."),
        item("culture_10", "We have effective channels to give and receive honest feedback."),
      ],
    },
    {
      name: "innovation",
      title: "Innovation & Agility",
      description: "Rate how your organisation approaches new ideas and change.",
      elements: [
        item("culture_11", "This organisation encourages creative thinking and new ideas."),
        item("culture_12", "We adapt quickly and effectively when circumstances change."),
        item("culture_13", "Calculated risks are welcomed when pursuing better ways of working."),
        item("culture_14", "Mistakes are treated as learning opportunities rather than failures to punish."),
      ],
    },
    {
      name: "psychological_safety",
      title: "Psychological Safety",
      description: "Rate how safe you feel to speak up and be yourself at work.",
      elements: [
        item("culture_15", "I feel safe to speak up about problems or concerns without fear of retaliation."),
        item("culture_16", "I can make mistakes without fear of being penalised unfairly."),
        item("culture_17", "Team members are comfortable asking for help when they need it."),
        item("culture_18", "Diverse perspectives and opinions are genuinely welcomed on my team."),
        item("culture_19", "I can raise difficult topics without damaging my relationships at work."),
      ],
    },
    {
      name: "inclusion",
      title: "Inclusion & Belonging",
      description: "Rate how inclusive and welcoming your workplace feels.",
      elements: [
        item("culture_20", "I feel like I truly belong in this organisation."),
        item("culture_21", "People from all backgrounds have equal opportunities to succeed here."),
        item("culture_22", "My contributions are valued regardless of my background or identity."),
        item("culture_23", "I experience a genuine sense of community and connection at work."),
        item("culture_24", "This organisation actively works to ensure everyone feels included."),
      ],
    },
    {
      name: "growth",
      title: "Growth & Development",
      description: "Rate the learning and career development opportunities available to you.",
      elements: [
        item("culture_25", "I have access to the learning and development resources I need to grow."),
        item("culture_26", "I can see a clear path for career advancement in this organisation."),
        item("culture_27", "My manager actively helps me identify and develop new skills."),
        item("culture_28", "This organisation makes meaningful investments in employee development."),
      ],
    },
    {
      name: "work_life_balance",
      title: "Work-Life Balance",
      description: "Rate how well your organisation supports a healthy balance between work and personal life.",
      elements: [
        item("culture_29", "I am able to maintain a healthy balance between my work and personal life."),
        item("culture_30", "My workload is manageable and sustainable over the long term."),
        item("culture_31", "This organisation respects my time and boundaries outside of working hours."),
        item("culture_32", "I can take breaks and time off without feeling guilty or penalised."),
      ],
    },
    {
      name: "recognition",
      title: "Recognition & Reward",
      description: "Rate how fairly and consistently good work is recognised in your organisation.",
      elements: [
        item("culture_33", "I feel recognised and appreciated for the work I do."),
        item("culture_34", "Good performance is consistently acknowledged in this organisation."),
        item("culture_35", "Our compensation and benefits are fair compared to similar organisations."),
        item("culture_36", "People are rewarded based on merit and actual contribution."),
      ],
    },
    {
      name: "collaboration",
      title: "Collaboration & Teamwork",
      description: "Rate how well people work together across your organisation.",
      elements: [
        item("culture_37", "Teams across the organisation work well together toward shared goals."),
        item("culture_38", "We share knowledge and resources freely within my team."),
        item("culture_39", "There is a strong sense of teamwork and mutual support in my workplace."),
        item("culture_40", "We resolve conflicts in a constructive and respectful way."),
      ],
    },
  ],
};

export const CULTURE_SCORING_RULES = {
  type: "CULTURE",
  version: "1.0",
  scale: { min: 1, max: 5 },
  normalization: "((mean - 1) / 4) * 100",
  dimensions: [
    {
      key: "leadership",
      label: "Leadership Effectiveness",
      items: ["culture_1","culture_2","culture_3","culture_4","culture_5"],
    },
    {
      key: "communication",
      label: "Communication & Transparency",
      items: ["culture_6","culture_7","culture_8","culture_9","culture_10"],
    },
    {
      key: "innovation",
      label: "Innovation & Agility",
      items: ["culture_11","culture_12","culture_13","culture_14"],
    },
    {
      key: "psychological_safety",
      label: "Psychological Safety",
      items: ["culture_15","culture_16","culture_17","culture_18","culture_19"],
    },
    {
      key: "inclusion",
      label: "Inclusion & Belonging",
      items: ["culture_20","culture_21","culture_22","culture_23","culture_24"],
    },
    {
      key: "growth",
      label: "Growth & Development",
      items: ["culture_25","culture_26","culture_27","culture_28"],
    },
    {
      key: "work_life_balance",
      label: "Work-Life Balance",
      items: ["culture_29","culture_30","culture_31","culture_32"],
    },
    {
      key: "recognition",
      label: "Recognition & Reward",
      items: ["culture_33","culture_34","culture_35","culture_36"],
    },
    {
      key: "collaboration",
      label: "Collaboration & Teamwork",
      items: ["culture_37","culture_38","culture_39","culture_40"],
    },
  ],
  overall: {
    method: "mean_of_dimension_scores",
  },
  bands: [
    { min: 0,  max: 40,  label: "Needs Attention", description: "Significant issues present — immediate focus required." },
    { min: 41, max: 60,  label: "Developing",       description: "Some foundations present but meaningful gaps remain." },
    { min: 61, max: 80,  label: "Healthy",           description: "A solid culture with clear strengths to build on." },
    { min: 81, max: 100, label: "Thriving",           description: "An exemplary cultural environment — maintain and model it." },
  ],
};
