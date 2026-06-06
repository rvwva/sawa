"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Lang } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";
import { makeBilingualSchema } from "@/lib/survey-translations";
import type { CycleInfo, SubmissionResult } from "./page";
import type { DemographicAnswers } from "./DemographicScreen";

const DEFINITIONS: Record<string, { en: string; ar: string; source: string }> = {
  CBI: {
    en:     "Burnout is a state of prolonged physical and mental exhaustion related to work or personal demands. It is not a disease, but a natural response to sustained stress.",
    ar:     "الاحتراق الوظيفي هو حالة من الإرهاق الجسدي والنفسي المطوّل الناتج عن ضغوط العمل أو المتطلبات الشخصية. وهو ليس مرضاً، بل استجابة طبيعية للضغط المستمر.",
    source: "Kristensen TS, et al. (2005). The Copenhagen Burnout Inventory. Work & Stress, 19(3), 192–207.",
  },
  CULTURE: {
    en:     "Organizational culture refers to the shared values, behaviors, and practices that shape how work gets done. This assessment measures how your workplace culture is experienced across nine key dimensions.",
    ar:     "تشير ثقافة المنظمة إلى القيم والسلوكيات والممارسات المشتركة التي تحدد كيفية إنجاز العمل. يقيس هذا التقييم تجربتك لثقافة بيئة عملك عبر تسعة أبعاد رئيسية.",
    source: "Mindlign Culture Assessment (2026). Mindlign Platform.",
  },
  PSYCH_SAFETY: {
    en:     "Psychological safety is the shared belief that team members can speak up, ask questions, or admit mistakes without fear of punishment or humiliation. It is a key driver of team learning and performance.",
    ar:     "السلامة النفسية هي الاعتقاد المشترك بأن أعضاء الفريق يستطيعون التعبير عن آرائهم أو طرح الأسئلة أو الاعتراف بالأخطاء دون خوف من العقاب أو الإهانة. وهي محرّك رئيسي لتعلم الفريق وأدائه.",
    source: "Edmondson, A. (1999). Psychological safety and learning behavior in work teams. Administrative Science Quarterly, 44(2), 350–383.",
  },
  TURNOVER: {
    en:     "Turnover intention measures how frequently employees think about leaving their current job or organisation. Higher scores reflect a greater likelihood of departure in the near future.",
    ar:     "تقيس نية ترك العمل مدى تكرار تفكير الموظفين في مغادرة وظيفتهم أو مؤسستهم الحالية. تعكس الدرجات الأعلى احتمالية أكبر للمغادرة في المستقبل القريب.",
    source: "Mobley, W. H. (1977). Intermediate linkages in the relationship between job satisfaction and employee turnover. Journal of Applied Psychology, 62(2).",
  },
  LMX7: {
    en:     "Leader-Member Exchange (LMX) theory describes the quality of the relationship between a manager and each of their direct reports. High-quality LMX relationships are characterised by trust, respect, and mutual obligation.",
    ar:     "تصف نظرية التبادل بين القائد والعضو (LMX) جودة العلاقة بين المدير وكل من مرؤوسيه المباشرين. تتسم علاقات LMX عالية الجودة بالثقة والاحترام والالتزام المتبادل.",
    source: "Graen, G. B., & Uhl-Bien, M. (1995). Relationship-based approach to leadership: Development of leader-member exchange theory. The Leadership Quarterly, 6(2).",
  },
};

// SurveyJS must be loaded client-side only (it accesses window/document)
const SurveyComponent = dynamic(() => import("./SurveyWrapper"), { ssr: false });

type Props = {
  lang: Lang;
  token: string;
  cycleInfo: CycleInfo;
  departmentId?: string;
  departmentLinkToken?: string;
  demographicAnswers?: DemographicAnswers;
  onComplete: (result: SubmissionResult) => void;
};

export default function AssessmentForm({
  lang,
  token,
  cycleInfo,
  departmentId,
  departmentLinkToken,
  demographicAnswers,
  onComplete,
}: Props) {
  const t = useTranslations(lang);
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const assessmentName =
    lang === "ar" && cycleInfo.assessment.nameAr
      ? cycleInfo.assessment.nameAr
      : cycleInfo.assessment.name;

  // Fetch schema, transform to bilingual
  useEffect(() => {
    fetch(
      `${API_BASE}/assessments/${cycleInfo.assessment.type}/schema`
    )
      .then((r) => {
        if (!r.ok) throw new Error("schema fetch failed");
        return r.json();
      })
      .then((data) => {
        const bilingual = makeBilingualSchema(
          data.surveySchema,
          cycleInfo.assessment.type
        );
        setSchema(bilingual);
      })
      .catch(() => setLoadError(t("form_error_load")));
  }, [cycleInfo.assessment.type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSurveyComplete(data: Record<string, number>) {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE}/responses/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleToken: token,
          departmentId: departmentId ?? null,
          departmentLinkToken: departmentLinkToken ?? null,
          responses: data,
          consentGiven: "true",
          consentVersion: "1.0",
          isSaudiNational:  demographicAnswers?.isSaudiNational ?? null,
          tenureRange:      demographicAnswers?.tenureRange ?? null,
          seniorityLevel:   demographicAnswers?.seniorityLevel ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("error_submit"));
      }
      const result: SubmissionResult = await res.json();
      onComplete(result);
    } catch (err: any) {
      setSubmitError(err.message ?? t("error_submit"));
      setSubmitting(false);
    }
  }

  // Submitting overlay
  if (submitting) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-14 flex flex-col items-center gap-5 text-center">
        <div className="w-14 h-14 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
        <div>
          <p className="font-semibold text-gray-800">{t("form_submitting")}</p>
          <p className="text-sm text-gray-500 mt-1">
            {lang === "ar" ? "يُرجى الانتظار…" : "This will only take a moment."}
          </p>
        </div>
      </div>
    );
  }

  // Load error
  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        {loadError}
      </div>
    );
  }

  // Schema loading
  if (!schema) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Intro banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-2.5 items-start">
        <span className="text-blue-500 text-base mt-0.5" aria-hidden>ℹ</span>
        <div>
          <p className="text-sm text-blue-800 font-medium">{t("form_intro")}</p>
          <p className="text-xs text-blue-600 mt-0.5">{t("form_required")}</p>
        </div>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* SurveyJS form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 space-y-3">
          <h2 className="font-bold text-gray-900">{assessmentName}</h2>
          {DEFINITIONS[cycleInfo.assessment.type] && (() => {
            const def = DEFINITIONS[cycleInfo.assessment.type];
            return (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
                <p className="text-sm text-gray-700 leading-relaxed">{def.en}</p>
                <p className="text-sm text-gray-600 leading-relaxed text-right" dir="rtl">{def.ar}</p>
                <p className="text-xs text-gray-400 italic">{def.source}</p>
              </div>
            );
          })()}
        </div>
        <SurveyComponent
          schema={schema}
          lang={lang}
          onComplete={handleSurveyComplete}
        />
      </div>
    </div>
  );
}
