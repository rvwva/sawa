"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { API_BASE } from "@/lib/api";
import { dir, useTranslations, translateBand } from "@/lib/i18n";
import { useDashLang } from "../../context";
import ScoreGauge from "@/components/ui/ScoreGauge";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscaleAgg = {
  subscale: string;
  label: string;
  avg: number;
  band: string;
  bandDistribution: Record<string, number>;
  count: number;
};

type CycleResult = {
  cycleId: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  closedAt?: string;
  assessment: { type: string; name: string; nameAr?: string };
  organisation: { id: string; name: string };
  respondentCount: number;
  subscales: SubscaleAgg[];
  overall: SubscaleAgg | null;
};

type DeptResult = {
  departmentId: string;
  departmentName: string;
  respondentCount: number;
  subscales: SubscaleAgg[];
};

type DeptResponse = {
  cycleId: string;
  minimumRespondentsRequired: number;
  organisation: { respondentCount: number; subscales: SubscaleAgg[] };
  departments: DeptResult[];
};

type ResponseRate = {
  submitted: number;
  started: number;
  submissionRate: number;
  byDepartment: Array<{
    departmentId: string;
    departmentName: string;
    submitted: number;
    meetsMinimum: boolean;
  }>;
};

type TrendPoint = { cycleId: string; cycleTitle: string; endsAt: string; respondentCount: number; avgTotal: number | null };
type TrendData  = { assessmentType: string; assessmentName: string; dataPoints: TrendPoint[] };

// ─── Label maps ───────────────────────────────────────────────────────────────

const subscaleAr: Record<string, string> = {
  personal_burnout:     "الإرهاق الشخصي",
  work_burnout:         "الإرهاق المهني",
  client_burnout:       "إرهاق العميل",
  total:                "الإجمالي",
  leadership:           "القيادة الفعّالة",
  communication:        "التواصل والشفافية",
  innovation:           "الابتكار والمرونة",
  psychological_safety: "السلامة النفسية",
  inclusion:            "الشمول والانتماء",
  growth:               "النمو والتطوير",
  work_life_balance:    "التوازن بين العمل والحياة",
  recognition:          "التقدير والمكافأة",
  collaboration:        "التعاون والعمل الجماعي",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  DRAFT:    "bg-gray-100 text-gray-600",
  CLOSED:   "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

const STATUS_AR: Record<string, string> = {
  ACTIVE: "نشط", DRAFT: "مسودة", CLOSED: "مغلق", ARCHIVED: "مؤرشف",
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function bandColor(band: string) {
  if (["Good","Thriving","Healthy"].includes(band)) return "text-green-600";
  if (band === "Moderate") return "text-amber-600";
  if (["Below Average","Developing"].includes(band)) return "text-orange-500";
  return "text-red-600";
}

function bandBg(band: string) {
  if (["Good","Thriving","Healthy"].includes(band)) return "bg-green-50 border-green-200 text-green-700";
  if (band === "Moderate") return "bg-amber-50 border-amber-200 text-amber-700";
  if (["Below Average","Developing"].includes(band)) return "bg-orange-50 border-orange-200 text-orange-500";
  return "bg-red-50 border-red-200 text-red-600";
}

function scoreBarColor(band: string) {
  if (["Good","Thriving","Healthy"].includes(band)) return "#16a34a";
  if (band === "Moderate") return "#d97706";
  if (["Below Average","Developing"].includes(band)) return "#f97316";
  return "#dc2626";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SA", {
    year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Riyadh",
  });
}

// ─── Sub-label helper ─────────────────────────────────────────────────────────

function subLabel(sub: SubscaleAgg, lang: "en" | "ar") {
  return lang === "ar" ? (subscaleAr[sub.subscale] ?? sub.label) : sub.label;
}

// ─── Subscale bar row ─────────────────────────────────────────────────────────

function SubBar({
  sub, orgSub, lang, compact,
}: {
  sub: SubscaleAgg;
  orgSub?: SubscaleAgg;
  lang: "en" | "ar";
  compact?: boolean;
}) {
  const pct = Math.round(sub.avg);
  return (
    <div className={compact ? "py-1.5" : "py-2.5 border-b border-gray-50 last:border-0"}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`${compact ? "text-xs" : "text-sm"} text-gray-700 flex-1 min-w-0 truncate`}>
          {subLabel(sub, lang)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {orgSub && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              {lang === "ar" ? "الشركة:" : "Co.:"}{" "}
              <span className={`font-semibold ${bandColor(orgSub.band)}`}>{Math.round(orgSub.avg)}</span>
            </span>
          )}
          <span className={`${compact ? "text-sm" : "text-base"} font-bold ${bandColor(sub.band)}`}>{pct}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold hidden sm:inline ${bandBg(sub.band)}`}>
            {translateBand(sub.band, lang)}
          </span>
        </div>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: scoreBarColor(sub.band) }}
        />
        {orgSub && (
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-500/40 rounded"
            style={{ left: `${Math.round(orgSub.avg)}%` }}
            title={`Company avg: ${Math.round(orgSub.avg)}`}
          />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const lang   = useDashLang();
  const t      = useTranslations(lang);

  const [cycleResult, setCycleResult] = useState<CycleResult | null>(null);
  const [deptData,    setDeptData]    = useState<DeptResponse | null>(null);
  const [rateData,    setRateData]    = useState<ResponseRate | null>(null);
  const [trendData,   setTrendData]   = useState<TrendData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mindlign_token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const base    = `${API_BASE}/results/cycle/${id}`;

    setLoading(true);
    setError("");

    Promise.all([
      fetch(base, { headers }).then((r) => { if (!r.ok) throw new Error("cycle"); return r.json(); }),
      fetch(`${base}/departments`, { headers }).then((r) => r.ok ? r.json() : null),
      fetch(`${base}/response-rate`, { headers }).then((r) => r.ok ? r.json() : null),
      fetch(`${base}/trend`, { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([cr, dd, rd, td]) => {
        setCycleResult(cr);
        if (dd) setDeptData(dd);
        if (rd) setRateData(rd);
        if (td) setTrendData(td);
      })
      .catch(() => setError(lang === "ar" ? "تعذّر تحميل بيانات الدورة." : "Failed to load cycle data."))
      .finally(() => setLoading(false));
  }, [id, lang]);

  // Poll response rate every 30 s while ACTIVE
  useEffect(() => {
    if (cycleResult?.status !== "ACTIVE") return;
    const token = localStorage.getItem("mindlign_token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const iv = setInterval(() => {
      fetch(`${API_BASE}/results/cycle/${id}/response-rate`, { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((rd) => { if (rd) setRateData(rd); })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, [cycleResult?.status, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
          <p className="text-sm text-gray-500">{t("loading_results")}</p>
        </div>
      </div>
    );
  }

  if (error || !cycleResult) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <Link href="/dashboard" className="text-sm text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 mb-6">
          <svg className={`w-4 h-4 ${lang === "ar" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {lang === "ar" ? "العودة" : "Back"}
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-8 text-center">
          <p className="text-red-700 font-medium">{error || (lang === "ar" ? "دورة غير موجودة" : "Cycle not found")}</p>
        </div>
      </div>
    );
  }

  const overall       = cycleResult.overall ?? cycleResult.subscales.find((s) => s.subscale === "total");
  const companySubs   = cycleResult.subscales.filter((s) => s.subscale !== "total");
  const orgTotal      = deptData?.organisation.subscales.find((s) => s.subscale === "total");
  const orgSubs       = deptData?.organisation.subscales.filter((s) => s.subscale !== "total") ?? [];
  const assessName    = lang === "ar" && cycleResult.assessment.nameAr ? cycleResult.assessment.nameAr : cycleResult.assessment.name;

  // Trend chart data
  const trendChartData = trendData
    ? [...trendData.dataPoints]
        .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
        .map((p) => ({
          name:  p.cycleTitle.length > 14 ? p.cycleTitle.slice(0, 14) + "…" : p.cycleTitle,
          score: p.avgTotal,
          n:     p.respondentCount,
        }))
    : [];

  // Risk flag: score dropped ≥10 pts vs previous cycle
  const riskDrop = (() => {
    if (!trendData || trendData.dataPoints.length < 2) return null;
    const pts  = [...trendData.dataPoints].sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime());
    const curr = pts[0]?.avgTotal;
    const prev = pts[1]?.avgTotal;
    if (curr == null || prev == null) return null;
    const drop = Math.round(prev - curr);
    return drop >= 10 ? drop : null;
  })();

  return (
    <div dir={dir(lang)} className="max-w-5xl mx-auto space-y-6">

      {/* ── Back link ── */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
      >
        <svg className={`w-4 h-4 ${lang === "ar" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {lang === "ar" ? "نظرة عامة" : "Overview"}
      </Link>

      {/* ── Hero header ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
                {assessName}
              </p>
              <h1 className="text-white text-xl font-bold">{cycleResult.title}</h1>
              <p className="text-white/70 text-sm mt-1">{cycleResult.organisation.name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border-0 mt-0.5 ${STATUS_COLORS[cycleResult.status] ?? "bg-white/20 text-white"}`}>
              {lang === "ar" ? (STATUS_AR[cycleResult.status] ?? cycleResult.status) : cycleResult.status}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 flex flex-wrap gap-6 text-sm text-gray-600">
          <span>
            <span className="font-medium text-gray-800">{cycleResult.respondentCount}</span>{" "}
            {lang === "ar" ? "مشارك" : "respondents"}
          </span>
          <span>{lang === "ar" ? "البداية:" : "Started:"} {fmtDate(cycleResult.startsAt)}</span>
          <span>
            {cycleResult.closedAt
              ? (lang === "ar" ? "أُغلق:" : "Closed:")
              : (lang === "ar" ? "ينتهي:" : "Ends:")}
            {" "}{fmtDate(cycleResult.closedAt ?? cycleResult.endsAt)}
          </span>
        </div>
      </div>

      {/* ── Risk flag ── */}
      {riskDrop !== null && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <span className="text-2xl mt-0.5 shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-red-700">{t("risk_title")}</p>
            <p className="text-sm text-red-600 mt-0.5">
              {t("risk_desc_pre")} <strong>{riskDrop}</strong> {t("risk_desc_post")}
            </p>
          </div>
        </div>
      )}

      {/* ── A) Overall score ── */}
      {cycleResult.respondentCount === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400 text-sm">
          {t("no_submissions")}
        </div>
      ) : (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{t("section_scores")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{assessName} · {cycleResult.respondentCount} respondents</p>
          </div>
          <div className="p-6">
            {/* Overall gauge */}
            {overall && (
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 mb-6 border-b border-gray-100">
                <ScoreGauge score={overall.avg} size={160} />
                <div className="flex-1 space-y-1.5">
                  <p className="text-lg font-bold text-gray-900">{t("overall_score")}</p>
                  <p className={`text-sm font-semibold ${bandColor(overall.band)}`}>
                    {translateBand(overall.band, lang)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {Math.round(overall.avg)} / 100
                  </p>
                  {/* Band distribution */}
                  <BandDist distribution={overall.bandDistribution} lang={lang} />
                </div>
              </div>
            )}
            {/* Subscales */}
            {companySubs.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">{t("subscales_title")}</p>
                <div className="space-y-1">
                  {companySubs.map((s) => (
                    <SubBar key={s.subscale} sub={s} lang={lang} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── B) Participation ── */}
      {rateData && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{t("section_participation")}</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Ring */}
              <div className="flex flex-col items-center gap-2">
                {(() => {
                  const pct   = rateData.submissionRate;
                  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
                  const circ  = 2 * Math.PI * 44;
                  return (
                    <svg width="110" height="110" viewBox="0 0 110 110" className="overflow-visible">
                      <circle cx="55" cy="55" r="44" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle
                        cx="55" cy="55" r="44" fill="none" stroke={color} strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
                        strokeDashoffset={circ * 0.25}
                        style={{ transition: "stroke-dasharray 0.8s ease" }}
                      />
                      <text x="55" y="50" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">
                        {Math.round(pct)}%
                      </text>
                      <text x="55" y="66" textAnchor="middle" fontSize="10" fill="#9ca3af">
                        {t("part_rate")}
                      </text>
                    </svg>
                  );
                })()}
              </div>
              {/* Counts */}
              <div className="flex flex-col justify-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{rateData.submitted}</p>
                    <p className="text-xs text-gray-500">{t("part_submitted")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-300 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{rateData.started}</p>
                    <p className="text-xs text-gray-500">{t("part_started")}</p>
                  </div>
                </div>
              </div>
              {/* By dept */}
              {rateData.byDepartment.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">{t("part_by_dept")}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rateData.byDepartment.map((d) => (
                      <div key={d.departmentId} className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${d.meetsMinimum ? "bg-green-500" : "bg-gray-300"}`} />
                        <span className="text-xs text-gray-700 truncate flex-1">{d.departmentName}</span>
                        <span className={`text-xs font-semibold shrink-0 ${d.meetsMinimum ? "text-green-600" : "text-gray-400"}`}>
                          {d.submitted}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    {t("part_meets_min")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── C) Department comparison ── */}
      {deptData && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{t("section_departments")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t("dept_suppressed")}</p>
          </div>
          <div className="p-6 space-y-5">
            {deptData.departments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("dept_no_data")}</p>
            ) : (
              <>
                {/* Company average reference row */}
                {orgTotal && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-600 italic">
                        {lang === "ar" ? "متوسط المؤسسة" : "Company Average"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${bandColor(orgTotal.band)}`}>
                          {Math.round(orgTotal.avg)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${bandBg(orgTotal.band)}`}>
                          {translateBand(orgTotal.band, lang)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(orgTotal.avg)}%`, backgroundColor: scoreBarColor(orgTotal.band) }}
                      />
                    </div>
                  </div>
                )}

                {/* Department cards */}
                {deptData.departments.map((dept) => {
                  const deptTotal = dept.subscales.find((s) => s.subscale === "total");
                  const deptSubs  = dept.subscales.filter((s) => s.subscale !== "total");
                  return (
                    <div key={dept.departmentId} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Dept header */}
                      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{dept.departmentName}</h3>
                          <span className="text-xs text-gray-400 shrink-0">
                            · {dept.respondentCount}{" "}
                            {lang === "ar" ? "مشارك" : dept.respondentCount === 1 ? "respondent" : "respondents"}
                          </span>
                        </div>
                        {deptTotal && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xl font-black ${bandColor(deptTotal.band)}`}>
                              {Math.round(deptTotal.avg)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${bandBg(deptTotal.band)}`}>
                              {translateBand(deptTotal.band, lang)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total score bar vs company avg */}
                      {deptTotal && orgTotal && (
                        <div className="px-4 py-2 border-b border-gray-50">
                          <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.round(deptTotal.avg)}%`, backgroundColor: scoreBarColor(deptTotal.band) }}
                            />
                            <div
                              className="absolute top-0 h-full w-0.5 bg-gray-500/50 rounded"
                              style={{ left: `${Math.round(orgTotal.avg)}%` }}
                              title={`Company avg: ${Math.round(orgTotal.avg)}`}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                            {lang === "ar" ? "الشريط الرأسي = متوسط الشركة" : "Tick = company average"}
                          </p>
                        </div>
                      )}

                      {/* Subscale breakdown */}
                      {deptSubs.length > 0 && (
                        <div className="px-4 py-2">
                          {deptSubs.map((sub) => {
                            const orgSub = orgSubs.find((s) => s.subscale === sub.subscale);
                            return (
                              <SubBar key={sub.subscale} sub={sub} orgSub={orgSub} lang={lang} compact />
                            );
                          })}
                        </div>
                      )}

                      {deptTotal && deptSubs.length === 0 && !orgTotal && (
                        <div className="px-4 py-3">
                          <SubBar sub={deptTotal} lang={lang} compact />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── D) Trend chart ── */}
      {trendData && trendChartData.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{t("section_trend")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{trendData.assessmentName}</p>
          </div>
          <div className="p-6">
            {trendChartData.every((p) => p.score == null) ? (
              <p className="text-sm text-gray-400 text-center py-8">{t("trend_no_data")}</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                      formatter={(v: any) => [`${v}/100`, t("trend_score")]}
                    />
                    <ReferenceLine y={68} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <ReferenceLine y={51} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <ReferenceLine y={29} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#d97c2a"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#d97c2a", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#c56220" }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" />≥68 Good</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" />51–67 Moderate</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" />29–50 Below Avg</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" />&lt;29 Low</span>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

// ─── Band distribution bar ────────────────────────────────────────────────────

function BandDist({ distribution, lang }: { distribution: Record<string, number>; lang: "en" | "ar" }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const segments = Object.entries(distribution).map(([band, cnt]) => ({ band, pct: (cnt / total) * 100 }));
  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-gray-100">
        {segments.map(({ band, pct }) => (
          <div key={band} style={{ width: `${pct}%`, backgroundColor: scoreBarColor(band) }} title={`${translateBand(band, lang)}: ${Math.round(pct)}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map(({ band, pct }) => (
          <span key={band} className={`text-xs ${bandColor(band)}`}>
            {translateBand(band, lang)} {Math.round(pct)}%
          </span>
        ))}
      </div>
    </div>
  );
}
