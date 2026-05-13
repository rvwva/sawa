"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { useTranslations, dir } from "@/lib/i18n";
import LanguageToggle from "@/components/ui/LanguageToggle";
import ConsentScreen from "./ConsentScreen";
import DepartmentSelector from "./DepartmentSelector";
import AssessmentForm from "./AssessmentForm";
import ResultsScreen from "./ResultsScreen";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CycleInfo = {
  cycleId: string;
  title: string;
  endsAt: string;
  assessment: {
    type: string;
    name: string;
    nameAr: string;
    description: string;
    itemCount: number;
  };
  organisation: {
    name: string;
    nameAr?: string;
    logoUrl?: string;
  };
  departments: Array<{ id: string; name: string; nameAr?: string }>;
};

export type SubmissionResult = {
  sessionToken: string;
  scores: Record<string, any>;
};

type Stage = "loading" | "error" | "consent" | "department" | "form" | "results";

const STEPS = ["consent", "department", "form", "results"] as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  stage,
  lang,
  hasDepts,
}: {
  stage: Stage;
  lang: Lang;
  hasDepts: boolean;
}) {
  const t = useTranslations(lang);
  const steps = [
    t("step_consent"),
    t("step_assessment"),
    t("step_results"),
  ];
  const stageIndex =
    stage === "consent"    ? 0
    : stage === "department" || stage === "form" ? 1
    : stage === "results"  ? 2
    : -1;

  if (stageIndex < 0) return null;

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={[
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                i < stageIndex
                  ? "bg-brand-500 text-white"
                  : i === stageIndex
                  ? "bg-brand-500 text-white ring-4 ring-brand-100"
                  : "bg-gray-200 text-gray-500",
              ].join(" ")}
            >
              {i < stageIndex ? "✓" : i + 1}
            </div>
            <span
              className={[
                "text-xs mt-1.5 font-medium whitespace-nowrap",
                i === stageIndex ? "text-brand-600" : "text-gray-400",
              ].join(" ")}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={[
                "h-0.5 w-12 sm:w-20 mx-1 mb-5 rounded transition-colors",
                i < stageIndex ? "bg-brand-500" : "bg-gray-200",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>();
  const [lang, setLang] = useState<Lang>("en");
  const [stage, setStage] = useState<Stage>("loading");
  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>();
  const [respondentEmail, setRespondentEmail] = useState<string | undefined>();

  const [errorMsg, setErrorMsg] = useState("");

  const t = useTranslations(lang);

  useEffect(() => {
    fetch(`${API_BASE}/assessments/cycles/by-token/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? t("error_not_found"));
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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDepts = (cycleInfo?.departments?.length ?? 0) > 0;

  function handleConsentAccepted(email?: string) {
    setRespondentEmail(email);
    setStage(hasDepts ? "department" : "form");
  }

  function handleDeptSelected(deptId: string | undefined) {
    setSelectedDeptId(deptId);
    setStage("form");
  }

  function handleFormComplete(_res: SubmissionResult) {
    setStage("results");
  }

  const orgName =
    lang === "ar" && cycleInfo?.organisation.nameAr
      ? cycleInfo.organisation.nameAr
      : cycleInfo?.organisation.name;

  return (
    <div
      dir={dir(lang)}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {cycleInfo?.organisation.logoUrl ? (
              <img
                src={cycleInfo.organisation.logoUrl}
                alt={orgName}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-black text-brand-600 text-lg tracking-tight">Mindlign</span>
                <span className="text-gray-300">·</span>
                <span className="font-bold text-gray-700 text-sm truncate">{orgName}</span>
              </div>
            )}
          </div>
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-8 pb-20">
        {/* Step indicator */}
        {(stage === "consent" || stage === "department" || stage === "form" || stage === "results") && (
          <StepIndicator stage={stage} lang={lang} hasDepts={hasDepts} />
        )}

        {/* Loading */}
        {stage === "loading" && (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
            <p className="text-gray-500 text-sm">{t("loading")}</p>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t("error_title")}</h1>
            <p className="text-gray-600 mb-6">{errorMsg || t("error_generic")}</p>
          </div>
        )}

        {/* Consent */}
        {stage === "consent" && cycleInfo && (
          <ConsentScreen
            lang={lang}
            cycleInfo={cycleInfo}
            onAccept={handleConsentAccepted}
          />
        )}

        {/* Department */}
        {stage === "department" && cycleInfo && (
          <DepartmentSelector
            lang={lang}
            departments={cycleInfo.departments}
            onSelect={handleDeptSelected}
          />
        )}

        {/* Form */}
        {stage === "form" && cycleInfo && (
          <AssessmentForm
            lang={lang}
            token={token}
            cycleInfo={cycleInfo}
            departmentId={selectedDeptId}
            respondentEmail={respondentEmail}
            onComplete={handleFormComplete}
          />
        )}

        {/* Results */}
        {stage === "results" && cycleInfo && (
          <ResultsScreen
            lang={lang}
            organisationName={orgName ?? ""}
          />
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur border-t border-gray-100 py-2 text-center">
        <p className="text-xs text-gray-400">{t("poweredBy")}</p>
      </footer>
    </div>
  );
}
