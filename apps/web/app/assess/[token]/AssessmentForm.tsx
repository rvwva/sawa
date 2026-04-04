"use client";
import { useEffect, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/defaultV2.min.css";

type Props = {
  token: string;
  cycleInfo: {
    cycleId: string;
    assessment: { type: string; name: string };
  };
  onComplete: (results: { sessionToken: string; scores: Record<string, any> }) => void;
};

export default function AssessmentForm({ token, cycleInfo, onComplete }: Props) {
  const [survey, setSurvey] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/assessments/${cycleInfo.assessment.type}/schema`
    )
      .then((r) => r.json())
      .then((data) => {
        const model = new Model(data.surveySchema);
        model.applyTheme({ themeName: "default" });
        setSurvey(model);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load assessment form. Please refresh and try again.");
        setLoading(false);
      });
  }, [cycleInfo.assessment.type]);

  async function handleComplete(sender: Model) {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/responses/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleToken: token,
          responses: sender.data,
          consentGiven: "true",
          consentVersion: "1.0",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Submission failed");
      }

      const result = await res.json();
      onComplete(result);
    } catch (err: any) {
      setError(err.message ?? "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!survey) return null;

  if (submitting) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500 mx-auto mb-4" />
        <p className="text-gray-600">Analysing your responses…</p>
      </div>
    );
  }

  survey.onComplete.add(handleComplete);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{cycleInfo.assessment.name}</h2>
        <p className="text-sm text-gray-500 mt-0.5">Answer honestly — there are no right or wrong answers.</p>
      </div>
      <Survey model={survey} />
    </div>
  );
}
