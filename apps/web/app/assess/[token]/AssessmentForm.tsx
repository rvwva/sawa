"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Lang } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n";
import { makeBilingualSchema } from "@/lib/survey-translations";
import type { CycleInfo, SubmissionResult } from "./page";

// SurveyJS must be loaded client-side only (it accesses window/document)
const SurveyComponent = dynamic(() => import("./SurveyWrapper"), { ssr: false });

type Props = {
  lang: Lang;
  token: string;
  cycleInfo: CycleInfo;
  departmentId?: string;
  onComplete: (result: SubmissionResult) => void;
};

export default function AssessmentForm({
  lang,
  token,
  cycleInfo,
  departmentId,
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
      `${process.env.NEXT_PUBLIC_API_URL}/assessments/${cycleInfo.assessment.type}/schema`
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/responses/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleToken: token,
          departmentId: departmentId ?? null,
          responses: data,
          consentGiven: "true",
          consentVersion: "1.0",
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
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-bold text-gray-900">{assessmentName}</h2>
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
