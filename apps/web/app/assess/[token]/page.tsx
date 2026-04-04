"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConsentScreen from "./ConsentScreen";
import AssessmentForm from "./AssessmentForm";
import ResultsScreen from "./ResultsScreen";

type CycleInfo = {
  cycleId: string;
  title: string;
  endsAt: string;
  assessment: { type: string; name: string; nameAr: string; description: string; itemCount: number };
  organisation: { name: string; nameAr?: string; logoUrl?: string };
};

type Results = {
  sessionToken: string;
  scores: Record<string, any>;
};

type Stage = "loading" | "error" | "consent" | "form" | "results";

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>("loading");
  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/cycles/by-token/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Assessment not available");
        }
        return res.json();
      })
      .then((data: CycleInfo) => {
        setCycleInfo(data);
        setStage("consent");
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStage("error");
      });
  }, [token]);

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Assessment Unavailable</h1>
          <p className="text-gray-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-bold text-brand-600 text-xl">Sawa · سواء</span>
          {cycleInfo && (
            <span className="text-sm text-gray-500 hidden sm:block">
              {cycleInfo.organisation.name}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {stage === "consent" && cycleInfo && (
          <ConsentScreen
            cycleInfo={cycleInfo}
            onAccept={() => setStage("form")}
          />
        )}
        {stage === "form" && cycleInfo && (
          <AssessmentForm
            token={token}
            cycleInfo={cycleInfo}
            onComplete={(res) => {
              setResults(res);
              setStage("results");
            }}
          />
        )}
        {stage === "results" && results && cycleInfo && (
          <ResultsScreen
            scores={results.scores}
            sessionToken={results.sessionToken}
            assessmentType={cycleInfo.assessment.type}
            assessmentName={cycleInfo.assessment.name}
          />
        )}
      </main>
    </div>
  );
}
