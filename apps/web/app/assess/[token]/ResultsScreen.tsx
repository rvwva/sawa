"use client";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { useTranslations, translateBand } from "@/lib/i18n";
import ScoreGauge from "@/components/ui/ScoreGauge";
import BandCard from "@/components/ui/BandCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscaleScore  = { score: number; band: string };
type DimensionScore = { key: string; label: string; score: number; band: string };

type Scores = {
  // CBI
  subscales?: Record<string, SubscaleScore>;
  // PSS / WHO-5
  total?: {
    score: number;
    band: string;
    raw_score?: number;
    depression_screen_recommended?: boolean;
  };
  // Culture
  dimensions?: DimensionScore[];
};

type Comparison = {
  [subscale: string]: { avg: number; band: string };
};

type Props = {
  lang: Lang;
  scores: Scores;
  sessionToken: string;
  assessmentType: string;
  assessmentName: string;
  organisationName: string;
};

// ─── Guidance map ────────────────────────────────────────────────────────────

function getBurnoutGuidanceKey(band: string): string {
  if (band === "Low")      return "guidance_burnout_low";
  if (band === "Moderate") return "guidance_burnout_moderate";
  return                          "guidance_burnout_high";
}
function getStressGuidanceKey(band: string): string {
  if (band === "Low")      return "guidance_stress_low";
  if (band === "Moderate") return "guidance_stress_moderate";
  return                          "guidance_stress_high";
}
function getWho5GuidanceKey(band: string): string {
  if (band === "Good")         return "guidance_who5_good";
  if (band === "Moderate")     return "guidance_who5_moderate";
  if (band === "Below Average") return "guidance_who5_below_avg";
  return                               "guidance_who5_low";
}
function getCultureGuidanceKey(band: string): string {
  if (band === "Thriving")        return "guidance_culture_thriving";
  if (band === "Healthy")         return "guidance_culture_healthy";
  if (band === "Developing")      return "guidance_culture_developing";
  return                                 "guidance_culture_needs_attn";
}

// ─── Mini score bar (for subscales / dimensions) ───────────────────────────

function ScoreBar({
  label,
  score,
  band,
  lang,
}: {
  label: string;
  score: number;
  band: string;
  lang: Lang;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setWidth(score), 80);
    return () => clearTimeout(id);
  }, [score]);

  const barColor =
    score >= 68 ? "#16a34a"
    : score >= 51 ? "#d97706"
    : score >= 29 ? "#f59e0b"
    : "#dc2626";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700 font-medium leading-tight">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <BandCard band={band} score={score} compact lang={lang} />
          <span className="text-sm font-bold text-gray-800 w-12 text-end">
            {Math.round(score)}<span className="text-gray-400 font-normal text-xs">/100</span>
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function ComparisonRow({
  label,
  myScore,
  orgAvg,
  deptAvg,
  t,
  lang,
}: {
  label: string;
  myScore: number;
  orgAvg: number | null;
  deptAvg: number | null;
  t: ReturnType<typeof useTranslations>;
  lang: Lang;
}) {
  const items = [
    { label: t("results_my_score"),  score: myScore,        color: "#d97c2a" },
    { label: t("results_org_avg"),   score: orgAvg,         color: "#6b7280" },
    ...(deptAvg != null
      ? [{ label: t("results_dept_avg"), score: deptAvg, color: "#5e875e" }]
      : []),
  ].filter((x) => x.score != null) as { label: string; score: number; color: string }[];

  return (
    <div className="space-y-1.5 py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-32 shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.score}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 w-8 text-end">
              {Math.round(item.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResultsScreen({
  lang,
  scores,
  sessionToken,
  assessmentType,
  assessmentName,
  organisationName,
}: Props) {
  const t = useTranslations(lang);
  const [copied, setCopied]           = useState(false);
  const [comparison, setComparison]   = useState<Comparison | null>(null);
  const [deptComparison, setDeptComparison] = useState<Comparison | null>(null);
  const [showToken, setShowToken]     = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "pending" | "done" | "error">("idle");

  // Fetch comparison data (org avg + dept avg)
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/responses/my-score/${sessionToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.orgAverage)  setComparison(data.orgAverage);
        if (data?.departmentAverage) setDeptComparison(data.departmentAverage);
      })
      .catch(() => {});
  }, [sessionToken]);

  function copyToken() {
    navigator.clipboard.writeText(sessionToken).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  // ── Derive overall score and band ─────────────────────────────────────────

  const overall = scores.total;
  const overallScore = overall?.score ?? null;
  const overallBand  = overall?.band  ?? null;

  // Guidance text based on type + band
  const guidanceKey: string | null =
    !overallBand ? null
    : assessmentType === "CBI"     ? getBurnoutGuidanceKey(overallBand)
    : assessmentType === "PSS"     ? getStressGuidanceKey(overallBand)
    : assessmentType === "WHO5"    ? getWho5GuidanceKey(overallBand)
    : assessmentType === "CULTURE" ? getCultureGuidanceKey(overallBand)
    : null;

  const guidance = guidanceKey ? t(guidanceKey as any) : null;

  const hasCBISubscales  = !!scores.subscales && Object.keys(scores.subscales).length > 0;
  const hasDimensions    = (scores.dimensions?.length ?? 0) > 0;
  const hasComparison    = comparison && Object.keys(comparison).length > 0;

  // Subscale label translations (English fallback)
  const subscaleLabels: Record<string, Record<Lang, string>> = {
    personal_burnout: { en: "Personal Burnout",       ar: "الإرهاق الشخصي" },
    work_burnout:     { en: "Work-Related Burnout",    ar: "الإرهاق المرتبط بالعمل" },
    client_burnout:   { en: "Client-Related Burnout",  ar: "الإرهاق المرتبط بالعملاء" },
    total:            { en: "Overall",                 ar: "الإجمالي" },
  };

  return (
    <div className="space-y-4 animate-fade-in print:space-y-6">

      {/* ── Print header (hidden on screen) ──────────────────── */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">{t("print_title")}</h1>
        <p className="text-sm text-gray-600">
          {t("print_org")}: {organisationName} ·{" "}
          {t("print_date")}: {new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
        </p>
        <p className="text-sm text-gray-600">{assessmentName}</p>
        <hr className="my-3" />
      </div>

      {/* ── Success badge + overall ──────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold">{t("results_title")}</h1>
            <p className="text-brand-100 text-sm mt-0.5">{assessmentName}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full">
            <span>✓</span> {t("results_submitted")}
          </span>
        </div>

        <div className="px-6 py-6">
          {overallScore !== null && overallBand ? (
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="shrink-0">
                <p className="text-xs text-gray-500 font-medium text-center mb-2">
                  {t("results_overall")}
                </p>
                <ScoreGauge score={overallScore} size={150} animate />
              </div>
              <div className="flex-1 w-full">
                {guidance && (
                  <BandCard
                    band={overallBand}
                    score={overallScore}
                    guidance={guidance}
                    lang={lang}
                  />
                )}
                {/* WHO-5 depression screen alert */}
                {assessmentType === "WHO5" && overall?.depression_screen_recommended && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-800 font-medium leading-relaxed">
                      {lang === "ar"
                        ? "⚠ تشير درجتك إلى احتمال وجود اكتئاب. يُرجى استشارة متخصص في الرعاية الصحية."
                        : "⚠ Your WHO-5 score suggests possible depression. Please consult a healthcare professional."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              {lang === "ar" ? "لا توجد نتائج متاحة." : "No scores available."}
            </p>
          )}
        </div>
      </div>

      {/* ── CBI subscales ────────────────────────────────────── */}
      {hasCBISubscales && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5">
          <h2 className="font-bold text-gray-900 mb-4">{t("results_subscales")}</h2>
          <div className="space-y-4">
            {Object.entries(scores.subscales!).map(([key, val]) => {
              const label =
                subscaleLabels[key]?.[lang] ??
                key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <ScoreBar
                  key={key}
                  label={label}
                  score={val.score}
                  band={val.band}
                  lang={lang}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Culture dimensions ───────────────────────────────── */}
      {hasDimensions && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5">
          <h2 className="font-bold text-gray-900 mb-4">{t("results_dimensions")}</h2>
          <div className="space-y-4">
            {scores.dimensions!.map((dim) => (
              <ScoreBar
                key={dim.key}
                label={dim.label}
                score={dim.score}
                band={dim.band}
                lang={lang}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Comparison ───────────────────────────────────────── */}
      {hasComparison && overallScore !== null && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5">
          <h2 className="font-bold text-gray-900 mb-1">{t("results_comparison")}</h2>
          <p className="text-xs text-gray-500 mb-4">
            {lang === "ar"
              ? "تُعرض نتائج الأقسام فقط عند مشاركة 5 أشخاص أو أكثر."
              : "Department averages shown only when 5+ people respond."}
          </p>
          <ComparisonRow
            label={t("results_overall")}
            myScore={overallScore}
            orgAvg={comparison?.["total"]?.avg ?? null}
            deptAvg={deptComparison?.["total"]?.avg ?? null}
            t={t}
            lang={lang}
          />
        </div>
      )}

      {/* ── Disclaimer ───────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-500 leading-relaxed">{t("results_disclaimer")}</p>
      </div>

      {/* ── Actions (download + token) ───────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5 space-y-4">
        {/* Download */}
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-200 text-brand-600 font-semibold text-sm hover:bg-brand-50 transition-colors print:hidden"
        >
          <span aria-hidden>⬇</span> {t("download")}
        </button>

        {/* Session token */}
        <div>
          <button
            onClick={() => setShowToken(!showToken)}
            className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span>{t("results_token_title")}</span>
            <span className="text-gray-400">{showToken ? "▲" : "▼"}</span>
          </button>

          {showToken && (
            <div className="pt-2 space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                {t("results_token_desc")}
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2.5 text-xs text-gray-700 font-mono break-all leading-relaxed">
                  {sessionToken}
                </code>
                <button
                  onClick={copyToken}
                  className="shrink-0 px-3 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
                >
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>

              <div className="flex gap-2">
                {/* Access data: shows instructions (no automated export endpoint) */}
                <button
                  type="button"
                  className="flex-1 text-center py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(sessionToken).catch(() => {});
                    alert(lang === "ar"
                      ? `لطلب نسخة من بياناتك، أرسل رمز جلستك إلى فريق الدعم:\n${sessionToken}`
                      : `To request a copy of your data, send your session token to the support team:\n${sessionToken}`);
                  }}
                >
                  {t("results_access_data")}
                </button>

                {/* Delete data: calls API */}
                {deleteState === "done" ? (
                  <span className="flex-1 text-center py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                    {lang === "ar" ? "تم الحذف ✓" : "Deleted ✓"}
                  </span>
                ) : deleteState === "error" ? (
                  <span className="flex-1 text-center py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {lang === "ar" ? "فشل الحذف" : "Delete failed"}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={deleteState === "pending"}
                    className="flex-1 text-center py-2 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    onClick={() => {
                      const confirmed = window.confirm(
                        lang === "ar"
                          ? "هل أنت متأكد من رغبتك في حذف جميع بياناتك؟ لا يمكن التراجع عن هذا الإجراء."
                          : "Are you sure you want to delete all your data? This cannot be undone."
                      );
                      if (!confirmed) return;
                      setDeleteState("pending");
                      fetch(`${process.env.NEXT_PUBLIC_API_URL}/data-rights/delete`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionToken }),
                      })
                        .then((r) => setDeleteState(r.ok ? "done" : "error"))
                        .catch(() => setDeleteState("error"));
                    }}
                  >
                    {deleteState === "pending"
                      ? (lang === "ar" ? "جارٍ الحذف…" : "Deleting…")
                      : t("results_delete_data")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
