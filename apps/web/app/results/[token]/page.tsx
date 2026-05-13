"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { dir } from "@/lib/i18n";
import LanguageToggle from "@/components/ui/LanguageToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscaleAgg = {
  subscale: string;
  label: string;
  avg: number;
  band: string;
  count: number;
  bandDistribution: Record<string, number>;
};

type DeptAgg = {
  departmentId: string;
  departmentName: string;
  respondentCount: number;
  subscales: SubscaleAgg[];
};

type ResultsData = {
  cycleId: string;
  cycleTitle: string;
  assessmentType: string;
  assessmentName: string;
  assessmentNameAr: string | null;
  organisationName: string;
  organisationNameAr: string | null;
  logoUrl: string | null;
  respondentCount: number;
  publishedAt: string;
  organisation: { subscales: SubscaleAgg[]; respondentCount: number } | null;
  departments: DeptAgg[];
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const SUBSCALE_AR: Record<string, string> = {
  // CBI
  personal_burnout:    "الاحتراق الشخصي",
  work_burnout:        "احتراق العمل",
  client_burnout:      "احتراق التعامل مع العملاء",
  total:               "الإجمالي",
  // Culture
  leadership:          "فاعلية القيادة",
  communication:       "التواصل والشفافية",
  innovation:          "الابتكار والرشاقة",
  psychological_safety:"السلامة النفسية",
  inclusion:           "الشمول والانتماء",
  growth:              "النمو والتطوير",
  work_life_balance:   "التوازن بين العمل والحياة",
  recognition:         "التقدير والمكافأة",
  collaboration:       "التعاون والعمل الجماعي",
};

const BAND_AR: Record<string, string> = {
  "Good":            "جيد",
  "Thriving":        "متميز",
  "Healthy":         "صحي",
  "Moderate":        "متوسط",
  "Developing":      "في تطور",
  "Below Average":   "دون المتوسط",
  "Low":             "منخفض",
  "High":            "مرتفع",
  "Needs Attention": "يحتاج اهتماماً",
  "Unknown":         "غير محدد",
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function bandColor(band: string): string {
  if (band === "Good" || band === "Thriving" || band === "Healthy") return "text-green-600";
  if (band === "Moderate") return "text-amber-600";
  if (band === "Developing" || band === "Below Average") return "text-orange-500";
  return "text-red-500"; // Low, High, Needs Attention
}

function bandBg(band: string): string {
  if (band === "Good" || band === "Thriving" || band === "Healthy") return "bg-green-50 border-green-200 text-green-700";
  if (band === "Moderate") return "bg-amber-50 border-amber-200 text-amber-700";
  if (band === "Developing" || band === "Below Average") return "bg-orange-50 border-orange-200 text-orange-700";
  return "bg-red-50 border-red-200 text-red-700";
}

function barColor(band: string): string {
  if (band === "Good" || band === "Thriving" || band === "Healthy") return "bg-green-500";
  if (band === "Moderate") return "bg-amber-500";
  if (band === "Developing" || band === "Below Average") return "bg-orange-500";
  return "bg-red-500";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubscaleRow({ sub, lang, deptAvg }: { sub: SubscaleAgg; lang: Lang; deptAvg?: SubscaleAgg }) {
  const label = lang === "ar" ? (SUBSCALE_AR[sub.subscale] ?? sub.label) : sub.label;
  const bandLabel = lang === "ar" ? (BAND_AR[sub.band] ?? sub.band) : sub.band;

  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <span className="text-sm text-gray-700 font-medium flex-1 min-w-0 truncate">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {deptAvg && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              {lang === "ar" ? "القسم:" : "Dept:"}{" "}
              <span className={`font-semibold ${bandColor(deptAvg.band)}`}>{deptAvg.avg}</span>
            </span>
          )}
          <span className="text-sm font-bold text-gray-900 w-8 text-end">{sub.avg}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${bandBg(sub.band)}`}>
            {bandLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(sub.band)}`}
            style={{ width: `${sub.avg}%` }}
          />
        </div>
        {deptAvg && (
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden sm:hidden">
            <div
              className={`h-full rounded-full ${barColor(deptAvg.band)} opacity-60`}
              style={{ width: `${deptAvg.avg}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { token } = useParams<{ token: string }>();
  const [lang, setLang] = useState<Lang>("en");
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/assessments/cycles/results/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load results");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  const orgName =
    lang === "ar" && data?.organisationNameAr
      ? data.organisationNameAr
      : data?.organisationName ?? "";

  const assessmentName =
    lang === "ar" && data?.assessmentNameAr
      ? data.assessmentNameAr
      : data?.assessmentName ?? "";

  const orgSubscales = (data?.organisation?.subscales ?? []).filter((s) => s.subscale !== "total");
  const orgTotal     = data?.organisation?.subscales.find((s) => s.subscale === "total");

  return (
    <div dir={dir(lang)} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {data?.logoUrl ? (
              <img src={data.logoUrl} alt={orgName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-black text-brand-600 text-lg tracking-tight">Mindlign</span>
                {orgName && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="font-bold text-gray-700 text-sm truncate">{orgName}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 pb-20 space-y-6">

        {/* Loading */}
        {!data && !error && (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
            <p className="text-gray-500 text-sm">{lang === "ar" ? "جارٍ التحميل…" : "Loading results…"}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-10 text-center mt-10">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {lang === "ar" ? "النتائج غير متاحة" : "Results unavailable"}
            </h1>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Hero */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
                {lang === "ar" ? "نتائج التقييم" : "Assessment Results"}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.cycleTitle}</h1>
              <p className="text-sm text-gray-500 mb-4">{assessmentName} · {orgName}</p>

              <div className="flex flex-wrap gap-4">
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-center min-w-[90px]">
                  <p className="text-2xl font-black text-brand-600">{data.respondentCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lang === "ar" ? "مشارك" : "Respondents"}
                  </p>
                </div>
                {orgTotal && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-center min-w-[90px]">
                    <p className={`text-2xl font-black ${bandColor(orgTotal.band)}`}>{orgTotal.avg}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lang === "ar" ? "الدرجة الإجمالية" : "Overall Score"}
                    </p>
                  </div>
                )}
                {orgTotal && (
                  <div className={`rounded-xl px-4 py-3 text-center border min-w-[90px] ${bandBg(orgTotal.band)}`}>
                    <p className="text-sm font-bold">
                      {lang === "ar" ? (BAND_AR[orgTotal.band] ?? orgTotal.band) : orgTotal.band}
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {lang === "ar" ? "المستوى" : "Band"}
                    </p>
                  </div>
                )}
              </div>

              {/* Privacy note */}
              <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <span className="text-blue-400 mt-0.5 text-sm">🔒</span>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {lang === "ar"
                    ? "جميع النتائج المعروضة هي متوسطات جماعية مجهولة الهوية. لا تُعرض أي بيانات فردية."
                    : "All scores shown are anonymous group averages. No individual data is included."}
                </p>
              </div>
            </div>

            {/* Organisation scores */}
            {orgSubscales.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-4">
                  {lang === "ar" ? "نتائج المؤسسة" : "Company Results"}
                </h2>
                {orgSubscales.map((sub) => (
                  <SubscaleRow key={sub.subscale} sub={sub} lang={lang} />
                ))}
              </div>
            )}

            {/* If only one subscale (PSS / WHO-5 — just "total") show it */}
            {orgSubscales.length === 0 && orgTotal && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-4">
                  {lang === "ar" ? "نتائج المؤسسة" : "Company Results"}
                </h2>
                <SubscaleRow sub={orgTotal} lang={lang} />
              </div>
            )}

            {/* Department breakdown */}
            {data.departments.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-1">
                  {lang === "ar" ? "مقارنة الأقسام" : "Department Comparison"}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {lang === "ar"
                    ? "تُعرض الأقسام التي لديها مشارك واحد أو أكثر فقط."
                    : "Only departments with 1 or more respondents are shown."}
                </p>

                <div className="space-y-6">
                  {data.departments.map((dept) => {
                    const deptTotal = dept.subscales.find((s) => s.subscale === "total");
                    const deptSubs  = dept.subscales.filter((s) => s.subscale !== "total");
                    const displaySubs = deptSubs.length > 0 ? deptSubs : dept.subscales;

                    return (
                      <div key={dept.departmentId} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3 gap-3">
                          <h3 className="font-semibold text-gray-800 truncate">{dept.departmentName}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-400">
                              {dept.respondentCount} {lang === "ar" ? "مشارك" : "respondents"}
                            </span>
                            {deptTotal && (
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${bandBg(deptTotal.band)}`}>
                                {lang === "ar" ? (BAND_AR[deptTotal.band] ?? deptTotal.band) : deptTotal.band}
                              </span>
                            )}
                          </div>
                        </div>
                        {displaySubs.map((sub) => {
                          const orgSub = (data.organisation?.subscales ?? []).find((s) => s.subscale === sub.subscale);
                          return (
                            <SubscaleRow key={sub.subscale} sub={sub} lang={lang} deptAvg={orgSub} />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No departments note */}
            {data.departments.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-2">
                {lang === "ar"
                  ? "لا توجد أقسام تستوفي الحد الأدنى من المشاركين (1) لعرض نتائجها."
                  : "No departments met the minimum respondent threshold (1) for display."}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur border-t border-gray-100 py-2 text-center">
        <p className="text-xs text-gray-400">
          {lang === "ar"
            ? "مدعوم بواسطة Mindlign · منصة صحة المؤسسات"
            : "Powered by Mindlign · Workplace Wellbeing Platform"}
        </p>
      </footer>
    </div>
  );
}
