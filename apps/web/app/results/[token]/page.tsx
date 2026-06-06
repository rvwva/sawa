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
  /** Set when the token is dept-scoped; the API has already filtered to 1 dept. */
  departmentView?: string;
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const SUBSCALE_AR: Record<string, string> = {
  personal_burnout:     "الاحتراق الشخصي",
  work_burnout:         "احتراق العمل",
  client_burnout:       "احتراق التعامل مع العملاء",
  total:                "الإجمالي",
  leadership:           "فاعلية القيادة",
  communication:        "التواصل والشفافية",
  innovation:           "الابتكار والرشاقة",
  psychological_safety: "السلامة النفسية",
  inclusion:            "الشمول والانتماء",
  growth:               "النمو والتطوير",
  work_life_balance:    "التوازن بين العمل والحياة",
  recognition:          "التقدير والمكافأة",
  collaboration:        "التعاون والعمل الجماعي",
};

const BAND_AR: Record<string, string> = {
  "Good":          "جيد",
  "Thriving":      "متميز",
  "Healthy":       "صحي",
  "Moderate":      "متوسط",
  "Developing":    "في تطور",
  "Below Average": "دون المتوسط",
  "Low":           "منخفض",
  "High":          "مرتفع",
  "Needs Attention":"يحتاج اهتماماً",
  "Unknown":       "غير محدد",
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function bandColor(band: string) {
  if (["Good","Thriving","Healthy"].includes(band)) return "text-emerald-600";
  if (band === "Moderate") return "text-amber-500";
  if (["Developing","Below Average"].includes(band)) return "text-orange-500";
  return "text-red-500";
}

function bandBg(band: string) {
  if (["Good","Thriving","Healthy"].includes(band))
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (band === "Moderate")
    return "bg-amber-50 border-amber-200 text-amber-700";
  if (["Developing","Below Average"].includes(band))
    return "bg-orange-50 border-orange-200 text-orange-700";
  return "bg-red-50 border-red-200 text-red-700";
}

function barFill(band: string) {
  if (["Good","Thriving","Healthy"].includes(band)) return "bg-emerald-500";
  if (band === "Moderate") return "bg-amber-400";
  if (["Developing","Below Average"].includes(band)) return "bg-orange-400";
  return "bg-red-500";
}

// ─── Score gauge (overall big number + bar) ───────────────────────────────────

function ScoreGauge({ sub, lang }: { sub: SubscaleAgg; lang: Lang }) {
  const bandLabel = lang === "ar" ? (BAND_AR[sub.band] ?? sub.band) : sub.band;
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={["Good","Thriving","Healthy"].includes(sub.band) ? "#10b981"
              : sub.band === "Moderate" ? "#f59e0b"
              : ["Developing","Below Average"].includes(sub.band) ? "#f97316"
              : "#ef4444"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - sub.avg / 100)}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="text-center">
          <span className={`text-4xl font-black ${bandColor(sub.band)}`}>{sub.avg}</span>
          <span className="block text-xs text-gray-400 font-medium">/100</span>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-bold border ${bandBg(sub.band)}`}>
        {bandLabel}
      </span>
    </div>
  );
}

// ─── Horizontal bar row ───────────────────────────────────────────────────────

function ScoreBar({
  sub, orgSub, lang,
}: {
  sub: SubscaleAgg;
  orgSub?: SubscaleAgg;  // company average shown as comparison line
  lang: Lang;
}) {
  const label     = lang === "ar" ? (SUBSCALE_AR[sub.subscale] ?? sub.label) : sub.label;
  const bandLabel = lang === "ar" ? (BAND_AR[sub.band] ?? sub.band) : sub.band;

  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {orgSub && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              {lang === "ar" ? "الشركة:" : "Co.:"}{" "}
              <span className={`font-semibold ${bandColor(orgSub.band)}`}>{orgSub.avg}</span>
            </span>
          )}
          <span className={`text-base font-black ${bandColor(sub.band)}`}>{sub.avg}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${bandBg(sub.band)}`}>
            {bandLabel}
          </span>
        </div>
      </div>

      {/* Dept bar + optional company marker */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barFill(sub.band)}`}
          style={{ width: `${sub.avg}%` }}
        />
        {/* Company average tick line */}
        {orgSub && (
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-500/40 rounded"
            style={{ left: `${orgSub.avg}%` }}
            title={`Company: ${orgSub.avg}`}
          />
        )}
      </div>

      {orgSub && (
        <div className="mt-1 flex items-center gap-1 sm:hidden">
          <div className="w-3 h-0.5 bg-gray-400 rounded" />
          <span className="text-xs text-gray-400">
            {lang === "ar" ? `الشركة: ${orgSub.avg}` : `Company avg: ${orgSub.avg}`}
          </span>
        </div>
      )}
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

  const allOrgSubscales = data?.organisation?.subscales ?? [];
  const orgTotal        = allOrgSubscales.find((s) => s.subscale === "total");
  const orgSubscales    = allOrgSubscales.filter((s) => s.subscale !== "total");

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

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-5">

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
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {lang === "ar" ? "النتائج غير متاحة" : "Results unavailable"}
            </h1>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* ── Hero card ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-5">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
                  {lang === "ar" ? "نتائج التقييم" : "Assessment Results"}
                </p>
                <h1 className="text-white text-xl font-bold leading-snug">{data.cycleTitle}</h1>
                <p className="text-white/70 text-sm mt-0.5">{assessmentName} · {orgName}</p>
              </div>

              <div className="px-6 py-5">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Respondent count */}
                  <div className="text-center min-w-[72px]">
                    <p className="text-3xl font-black text-brand-600">{data.respondentCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                      {lang === "ar" ? "مشارك" : "Respondents"}
                    </p>
                  </div>

                  {/* Overall score gauge */}
                  {orgTotal && (
                    <div className="flex-1 min-w-[200px]">
                      <ScoreGauge sub={orgTotal} lang={lang} />
                    </div>
                  )}

                  {/* No scores yet */}
                  {!orgTotal && (
                    <p className="text-sm text-gray-400 flex-1">
                      {lang === "ar" ? "لا توجد نتائج كافية بعد." : "No aggregated scores yet."}
                    </p>
                  )}
                </div>

                {/* Privacy note */}
                <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <span className="text-blue-400 mt-0.5 shrink-0">🔒</span>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    {lang === "ar"
                      ? "جميع النتائج المعروضة هي متوسطات جماعية مجهولة الهوية. لا تُعرض أي بيانات فردية."
                      : "All scores are anonymous group averages. No individual responses are ever shown."}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Company subscale breakdown ─────────────────────────────── */}
            {orgSubscales.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-1">
                  {lang === "ar" ? "نتائج المؤسسة" : "Company Results"}
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  {lang === "ar" ? "المتوسطات حسب المحور — 0 إلى 100" : "Subscale averages — scored 0 to 100"}
                </p>
                {orgSubscales.map((sub) => (
                  <ScoreBar key={sub.subscale} sub={sub} lang={lang} />
                ))}
              </div>
            )}

            {/* Single-subscale assessments: show the total as a standalone bar */}
            {orgSubscales.length === 0 && orgTotal && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-4">
                  {lang === "ar" ? "نتائج المؤسسة" : "Company Results"}
                </h2>
                <ScoreBar sub={orgTotal} lang={lang} />
              </div>
            )}

            {/* ── Department comparison ──────────────────────────────────── */}
            {data.departments.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-1">
                  {data.departmentView
                    ? (lang === "ar" ? "نتائج قسمك" : "Your Department Results")
                    : (lang === "ar" ? "مقارنة الأقسام" : "Department Comparison")}
                </h2>
                <p className="text-xs text-gray-400 mb-5">
                  {lang === "ar"
                    ? "الخط الرأسي على كل شريط يمثّل متوسط الشركة"
                    : "The vertical tick on each bar marks the company average"}
                </p>

                <div className="space-y-5">
                  {data.departments.map((dept) => {
                    const deptTotal = dept.subscales.find((s) => s.subscale === "total");
                    const deptSubs  = dept.subscales.filter((s) => s.subscale !== "total");
                    const displaySubs = deptSubs.length > 0 ? deptSubs : (deptTotal ? [deptTotal] : []);

                    return (
                      <div key={dept.departmentId} className="border border-gray-100 rounded-xl overflow-hidden">
                        {/* Dept header */}
                        <div className={`px-4 py-3 flex items-center justify-between gap-3 ${
                          deptTotal ? bandBg(deptTotal.band).replace("text-", "").replace("bg-","bg-").split(" ")[0] + " bg-opacity-40" : "bg-gray-50"
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{dept.departmentName}</h3>
                            <span className="text-xs text-gray-500 shrink-0">
                              · {dept.respondentCount} {lang === "ar" ? "مشارك" : dept.respondentCount === 1 ? "respondent" : "respondents"}
                            </span>
                          </div>
                          {deptTotal && (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xl font-black ${bandColor(deptTotal.band)}`}>
                                {deptTotal.avg}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${bandBg(deptTotal.band)}`}>
                                {lang === "ar" ? (BAND_AR[deptTotal.band] ?? deptTotal.band) : deptTotal.band}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Subscale bars */}
                        {displaySubs.length > 0 && (
                          <div className="px-4 py-2">
                            {displaySubs.map((sub) => {
                              const orgSub = allOrgSubscales.find((s) => s.subscale === sub.subscale);
                              return (
                                <ScoreBar key={sub.subscale} sub={sub} orgSub={orgSub} lang={lang} />
                              );
                            })}
                          </div>
                        )}

                        {displaySubs.length === 0 && (
                          <p className="px-4 py-3 text-xs text-gray-400">
                            {lang === "ar" ? "لا توجد بيانات كافية." : "Not enough data to display scores."}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No departments */}
            {data.departments.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">
                  {data.departmentView
                    ? (lang === "ar"
                        ? "لا يوجد عدد كافٍ من المشاركين في قسمك لعرض النتائج بشكل مجهول الهوية."
                        : "Your department doesn't have enough respondents yet to display results anonymously.")
                    : (lang === "ar"
                        ? "لا توجد أقسام تستوفي الحد الأدنى من المشاركين لعرض نتائجها."
                        : "No departments have enough respondents for breakdown display yet.")}
                </p>
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
