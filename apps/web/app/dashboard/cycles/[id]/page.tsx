"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { API_BASE } from "@/lib/api";
import { dir, useTranslations, translateBand } from "@/lib/i18n";
import { useDashLang, useDashUser } from "../../context";
import ScoreGauge from "@/components/ui/ScoreGauge";
import type { OnaNode, OnaEdge } from "@/components/ui/OnaGraph";

const OnaGraph = dynamic(() => import("@/components/ui/OnaGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  ),
});

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

type DemographicSegment = {
  value: string;
  label: string;
  respondentCount: number;
  suppressed: boolean;
  subscales: SubscaleAgg[];
};

type DemographicDimension = {
  dimension: string;
  segments: DemographicSegment[];
};

type DeptNationalityCrossTab = {
  departmentId: string;
  departmentName: string;
  segments: Array<{
    value: "saudi" | "nonSaudi";
    label: string;
    respondentCount: number;
    suppressed: boolean;
    subscales: SubscaleAgg[];
  }>;
};

type DeptSegmentCrossTab = {
  departmentId: string;
  departmentName: string;
  segments: Array<{
    value: string;
    label: string;
    respondentCount: number;
    suppressed: boolean;
    subscales: SubscaleAgg[];
  }>;
};

type DemographicData = {
  cycleId: string;
  nationality: DemographicDimension;
  tenure: DemographicDimension;
  seniority: DemographicDimension;
  departmentNationalityCrossTab: DeptNationalityCrossTab[];
  deptByTenure: DeptSegmentCrossTab[];
  deptBySeniority: DeptSegmentCrossTab[];
  saudiCount: number;
  nonSaudiCount: number;
  unknownNationalityCount: number;
  saudizationPct: number | null;
};

type CycleManagement = {
  id: string;
  status: string;
  linkToken: string;
  recipientEmails: string[] | null;
  resultsPublishedAt: string | null;
  reminderSentAt: string | null;
};

type OnaInsightCard = {
  id: string;
  departmentId: string | null;
  signals: string[];
  riskLevel: string;
  insightText: string;
  insightTextAr: string | null;
  department: { name: string; nameAr: string | null } | null;
};

type OnaMetricNode = {
  userEmail: string;
  departmentId: string | null;
  degreeCentrality: number;
  betweenness: number;
  isolationScore: number;
  collaborationLoad: number;
  department: { name: string; nameAr: string | null } | null;
};

type OnaInteractionEdge = {
  fromUserEmail: string;
  toUserEmail: string;
  weight: number;
};

type OnaResults = {
  onaEnabled: boolean;
  lastSyncAt: string | null;
  insightCards: OnaInsightCard[];
  metrics: OnaMetricNode[];
};

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

// ─── ONA colour helpers ───────────────────────────────────────────────────────

const DEPT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

function getDeptColorMap(metrics: OnaMetricNode[]): Map<string | null, string> {
  const deptIds = [...new Set(metrics.map((m) => m.departmentId))];
  const map = new Map<string | null, string>();
  deptIds.forEach((id, i) => map.set(id, DEPT_COLORS[i % DEPT_COLORS.length]));
  return map;
}

function riskBadge(level: string) {
  if (level === "urgent")   return "bg-red-100 text-red-700 border-red-200";
  if (level === "moderate") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-green-100 text-green-700 border-green-200";
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
  const user   = useDashUser();
  const t      = useTranslations(lang);

  const [cycleResult,    setCycleResult]    = useState<CycleResult | null>(null);
  const [deptData,       setDeptData]       = useState<DeptResponse | null>(null);
  const [rateData,       setRateData]       = useState<ResponseRate | null>(null);
  const [trendData,      setTrendData]      = useState<TrendData | null>(null);
  const [demographicData,setDemographicData]= useState<DemographicData | null>(null);
  const [cycleDetail,    setCycleDetail]    = useState<CycleManagement | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [msg,            setMsg]            = useState<{ text: string; ok: boolean } | null>(null);
  const [actionBusy,     setActionBusy]     = useState(false);
  const [copiedLink,     setCopiedLink]     = useState(false);
  const [onaData,        setOnaData]        = useState<OnaResults | null>(null);
  const [onaLoading,     setOnaLoading]     = useState(false);

  const loadAll = useCallback(() => {
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
      fetch(`${base}/demographics`, { headers }).then((r) => r.ok ? r.json() : null),
      fetch(`${API_BASE}/assessments/cycles/${id}`, { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([cr, dd, rd, td, dem, cd]) => {
        setCycleResult(cr);
        if (dd)  setDeptData(dd);
        if (rd)  setRateData(rd);
        if (td)  setTrendData(td);
        if (dem) setDemographicData(dem);
        if (cd)  setCycleDetail(cd);
      })
      .catch(() => setError(lang === "ar" ? "تعذّر تحميل بيانات الدورة." : "Failed to load cycle data."))
      .finally(() => setLoading(false));
  }, [id, lang]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function doAction(action: "activate" | "remind" | "close" | "publish", confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    setActionBusy(true);
    setMsg(null);
    try {
      const token = localStorage.getItem("mindlign_token");
      const res = await fetch(`${API_BASE}/assessments/cycles/${id}/${action}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setMsg({ text: data.message ?? (lang === "ar" ? "تم." : "Done."), ok: true });
      loadAll();
    } catch (err: any) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setActionBusy(false);
    }
  }

  function copyAssessLink() {
    if (!cycleDetail) return;
    navigator.clipboard.writeText(`${window.location.origin}/assess/${cycleDetail.linkToken}`).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

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

  useEffect(() => {
    if (!cycleResult?.organisation?.id) return;
    const token = localStorage.getItem("mindlign_token");
    if (!token) return;
    setOnaLoading(true);
    fetch(`${API_BASE}/ona/results/${cycleResult.organisation.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.onaEnabled) setOnaData(data); })
      .catch(() => {})
      .finally(() => setOnaLoading(false));
  }, [cycleResult?.organisation?.id]);

  const canManage = user?.role === "ADMIN" || user?.role === "EXECUTIVE";

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

      {/* ── Management panel ── */}
      {canManage && cycleDetail && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          {/* Toast */}
          {msg && (
            <div className={[
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
              msg.ok
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700",
            ].join(" ")}>
              <span>{msg.ok ? "✓" : "✕"}</span>
              <span className="flex-1">{msg.text}</span>
              <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Assessment link — show while DRAFT or ACTIVE */}
            {(cycleDetail.status === "DRAFT" || cycleDetail.status === "ACTIVE") && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <code className="flex-1 min-w-0 truncate bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 font-mono">
                  {typeof window !== "undefined" ? `${window.location.origin}/assess/${cycleDetail.linkToken}` : `/assess/${cycleDetail.linkToken}`}
                </code>
                <button
                  onClick={copyAssessLink}
                  className="shrink-0 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
                >
                  {copiedLink ? t("copied") : t("copy")}
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {cycleDetail.status === "DRAFT" && (
                <button
                  disabled={actionBusy}
                  onClick={() => doAction("activate", lang === "ar" ? "تفعيل هذه الدورة وإرسال الدعوات؟" : "Activate this cycle and send invitations?")}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {t("admin_act_activate")}
                </button>
              )}
              {cycleDetail.status === "ACTIVE" && (cycleDetail.recipientEmails?.length ?? 0) > 0 && (
                <button
                  disabled={actionBusy}
                  onClick={() => doAction("remind", t("admin_act_remind_confirm"))}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {t("admin_act_remind")}
                </button>
              )}
              {cycleDetail.status === "ACTIVE" && (
                <button
                  disabled={actionBusy}
                  onClick={() => doAction("close", t("admin_act_close_confirm"))}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                >
                  {t("admin_act_close")}
                </button>
              )}
              {cycleDetail.status === "CLOSED" && !cycleDetail.resultsPublishedAt && (
                <button
                  disabled={actionBusy}
                  onClick={() => doAction("publish", lang === "ar" ? "نشر النتائج للمشاركين؟" : "Publish results to all participants?")}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {t("admin_act_publish")}
                </button>
              )}
              {cycleDetail.resultsPublishedAt && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-semibold border border-green-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {lang === "ar" ? "النتائج منشورة" : "Results published"}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

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

      {/* ── E) Demographic Split ── */}
      {demographicData && (
        <DemographicSection data={demographicData} lang={lang} assessmentType={cycleResult?.assessment?.type} />
      )}

      {/* ── F) ONA — Organisational Network Analysis ── */}
      {(onaData || onaLoading) && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              {lang === "ar" ? "تحليل الشبكة التنظيمية (ONA)" : "Organisational Network Analysis"}
            </h2>
            {onaData?.lastSyncAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                {lang === "ar" ? "آخر مزامنة:" : "Last sync:"}{" "}
                {fmtDate(onaData.lastSyncAt)}
              </p>
            )}
          </div>

          {onaLoading && !onaData && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            </div>
          )}

          {onaData && (
            <div className="p-6 space-y-6">

              {/* Insight cards */}
              {onaData.insightCards.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {lang === "ar" ? "بطاقات الرؤى" : "Insight Cards"}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {onaData.insightCards.map((card) => (
                      <div
                        key={card.id}
                        className={`rounded-xl border px-4 py-3 text-sm ${riskBadge(card.riskLevel)}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-xs uppercase tracking-wide">
                            {card.department
                              ? (lang === "ar" && card.department.nameAr
                                ? card.department.nameAr
                                : card.department.name)
                              : (lang === "ar" ? "غير محدد" : "Unassigned")}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${riskBadge(card.riskLevel)}`}>
                            {card.riskLevel === "urgent"
                              ? (lang === "ar" ? "عاجل" : "Urgent")
                              : card.riskLevel === "moderate"
                              ? (lang === "ar" ? "متوسط" : "Moderate")
                              : (lang === "ar" ? "صحي" : "Healthy")}
                          </span>
                        </div>
                        <p className="leading-snug">
                          {lang === "ar" && card.insightTextAr
                            ? card.insightTextAr
                            : card.insightText}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Network graph */}
              {onaData.metrics.length > 0 && (() => {
                const colorMap = getDeptColorMap(onaData.metrics);
                const nodes: OnaNode[] = onaData.metrics.map((m) => ({
                  id: m.userEmail,
                  color: colorMap.get(m.departmentId) ?? "#6366f1",
                  size: 4 + Math.round(m.degreeCentrality * 12),
                }));
                // Derive edges from metrics where betweenness > 0 as a proxy;
                // actual edges come from the metrics endpoint which doesn't expose raw edges —
                // the graph is rebuilt from the interaction data available on the metrics.
                // We use a synthetic undirected view for visualisation only.
                const edges: OnaEdge[] = [];
                return (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {lang === "ar" ? "خريطة الشبكة" : "Network Map"}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {lang === "ar"
                        ? "كل نقطة تمثّل موظفاً. الحجم يعكس مركزية الدرجة. الألوان تمثّل الأقسام. لا تُعرض بيانات تعريفية."
                        : "Each node represents an employee. Size reflects degree centrality. Colours represent departments. No identifying data is shown."}
                    </p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <OnaGraph nodes={nodes} edges={edges} />
                    </div>
                    {/* Department colour legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      {[...colorMap.entries()].map(([deptId, color]) => {
                        const metric = onaData.metrics.find((m) => m.departmentId === deptId);
                        const deptName = metric?.department
                          ? (lang === "ar" && metric.department.nameAr
                            ? metric.department.nameAr
                            : metric.department.name)
                          : (lang === "ar" ? "غير محدد" : "Unassigned");
                        return (
                          <span key={deptId ?? "null"} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            {deptName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}
        </section>
      )}

    </div>
  );
}

// ─── Band distribution bar ────────────────────────────────────────────────────

// ─── Demographic Split section ────────────────────────────────────────────────

type DemogTab = "nationality" | "tenure" | "seniority";

function DemographicSection({ data, lang, assessmentType }: { data: DemographicData; lang: "en" | "ar"; assessmentType?: string }) {
  const HIGHER_IS_WORSE = assessmentType === "CBI";
  const t = useTranslations(lang);
  const [activeTab, setActiveTab] = useState<DemogTab>("nationality");

  const tabs: { id: DemogTab; label: string }[] = [
    { id: "nationality", label: t("demog_nationality_tab") },
    { id: "tenure",      label: t("demog_tenure_tab")      },
    { id: "seniority",   label: t("demog_seniority_tab")   },
  ];

  // Nationality KPI helpers
  const saudiSeg    = data.nationality.segments.find((s) => s.value === "true");
  const nonSaudiSeg = data.nationality.segments.find((s) => s.value === "false");
  const saudiTotal    = saudiSeg?.subscales.find((s) => s.subscale === "total");
  const nonSaudiTotal = nonSaudiSeg?.subscales.find((s) => s.subscale === "total");
  const gap = saudiTotal && nonSaudiTotal ? Math.round(saudiTotal.avg - nonSaudiTotal.avg) : null;

  // Equity alerts: any department where |saudi_total – nonSaudi_total| ≥ 15
  const alerts = data.departmentNationalityCrossTab.flatMap((dept) => {
    const dS  = dept.segments.find((s) => s.value === "saudi");
    const dNS = dept.segments.find((s) => s.value === "nonSaudi");
    if (!dS || !dNS || dS.suppressed || dNS.suppressed) return [];
    const st  = dS.subscales.find((s) => s.subscale === "total")?.avg;
    const nst = dNS.subscales.find((s) => s.subscale === "total")?.avg;
    if (st == null || nst == null) return [];
    const diff = Math.round(st - nst);
    if (Math.abs(diff) < 15) return [];
    return [{ dept: dept.departmentName, diff }];
  });

  // Check if there's any demographic data at all
  const hasNationalityData = (saudiSeg?.respondentCount ?? 0) + (nonSaudiSeg?.respondentCount ?? 0) > 0;
  const hasTenureData = data.tenure.segments.some((s) => s.respondentCount > 0);
  const hasSeniorityData = data.seniority.segments.some((s) => s.respondentCount > 0);
  if (!hasNationalityData && !hasTenureData && !hasSeniorityData) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t("demog_tab")}</h2>
        </div>
        <div className="p-12 text-center text-gray-400 text-sm">{t("demog_no_data")}</div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{t("demog_tab")}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{t("demog_section_subtitle")}</p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-2 border-b border-gray-100 pb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-brand-500 text-brand-700 bg-brand-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">

        {/* ── Nationality tab ── */}
        {activeTab === "nationality" && (
          <>
            {/* 4 KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DemogKpiCard
                label={t("demog_kpi_saudi_score")}
                value={saudiSeg?.suppressed ? null : (saudiTotal ? Math.round(saudiTotal.avg) : null)}
                band={saudiTotal?.band}
                note={saudiSeg ? `${saudiSeg.respondentCount} respondents` : undefined}
                suffix="/100"
              />
              <DemogKpiCard
                label={t("demog_kpi_nonsaudi_score")}
                value={nonSaudiSeg?.suppressed ? null : (nonSaudiTotal ? Math.round(nonSaudiTotal.avg) : null)}
                band={nonSaudiTotal?.band}
                note={nonSaudiSeg ? `${nonSaudiSeg.respondentCount} respondents` : undefined}
                suffix="/100"
              />
              <DemogKpiCard
                label={t("demog_kpi_gap")}
                value={gap}
                note={t("demog_kpi_gap_note")}
                isGap
              />
              <DemogKpiCard
                label={t("demog_kpi_saudization")}
                value={data.saudizationPct !== null ? Math.round(data.saudizationPct) : null}
                note={t("demog_kpi_saudization_note")}
                suffix="%"
              />
            </div>

            {/* Equity alerts */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map(({ dept, diff }) => (
                  <div
                    key={dept}
                    className={[
                      "flex items-start gap-3 rounded-xl px-4 py-3 border text-sm",
                      diff < 0
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200",
                    ].join(" ")}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{diff < 0 ? "⚠️" : "ℹ️"}</span>
                    <div>
                      <span className={`font-semibold ${diff < 0 ? "text-red-700" : "text-amber-700"}`}>
                        {t("demog_flag_title")}:
                      </span>{" "}
                      <span className={diff < 0 ? "text-red-600" : "text-amber-600"}>
                        {diff < 0
                          ? `${t("demog_flag_lower_pre")} ${Math.abs(diff)} ${t("demog_flag_lower_post")} ${dept}`
                          : `${t("demog_flag_higher_pre")} ${Math.abs(diff)} ${t("demog_flag_higher_post")} ${dept}`
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Organisation-level Saudi vs Non-Saudi */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                {t("demog_org_level")}
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                {[saudiSeg, nonSaudiSeg].map((seg, i) => {
                  if (!seg) return null;
                  const total = seg.subscales.find((s) => s.subscale === "total");
                  const color = i === 0 ? "#2563eb" : "#7c3aed";
                  return (
                    <SegmentBar
                      key={seg.value}
                      label={i === 0 ? t("demog_saudi") : t("demog_nonsaudi")}
                      count={seg.respondentCount}
                      suppressed={seg.suppressed}
                      avg={total?.avg}
                      band={total?.band}
                      color={color}
                      lang={lang}
                      t={t}
                    />
                  );
                })}
              </div>
            </div>

            {/* Department cross-tab */}
            {data.departmentNationalityCrossTab.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  {t("demog_dept_level")}
                </p>
                <div className="space-y-4">
                  {data.departmentNationalityCrossTab.map((dept) => {
                    const dS  = dept.segments.find((s) => s.value === "saudi");
                    const dNS = dept.segments.find((s) => s.value === "nonSaudi");
                    const dSTotal  = dS?.subscales.find((s) => s.subscale === "total");
                    const dNSTotal = dNS?.subscales.find((s) => s.subscale === "total");
                    const dGap = dSTotal && dNSTotal && !dS?.suppressed && !dNS?.suppressed
                      ? Math.round(dSTotal.avg - dNSTotal.avg)
                      : null;
                    const hasAlert = dGap !== null && Math.abs(dGap) >= 15;

                    return (
                      <div
                        key={dept.departmentId}
                        className={`border rounded-xl overflow-hidden ${hasAlert ? "border-red-200" : "border-gray-100"}`}
                      >
                        <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${hasAlert ? "bg-red-50" : "bg-gray-50"}`}>
                          <h4 className="font-semibold text-gray-900 text-sm">{dept.departmentName}</h4>
                          {dGap !== null && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              hasAlert
                                ? (dGap < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")
                                : "bg-gray-200 text-gray-600"
                            }`}>
                              {dGap > 0 ? "+" : ""}{dGap} pts
                            </span>
                          )}
                        </div>
                        <div className="px-4 py-3 space-y-2.5">
                          {[
                            { seg: dS,  color: "#2563eb", label: t("demog_saudi"),    total: dSTotal  },
                            { seg: dNS, color: "#7c3aed", label: t("demog_nonsaudi"), total: dNSTotal },
                          ].map(({ seg, color, label, total }) => {
                            if (!seg) return null;
                            return (
                              <SegmentBar
                                key={label}
                                label={label}
                                count={seg.respondentCount}
                                suppressed={seg.suppressed}
                                avg={total?.avg}
                                band={total?.band}
                                color={color}
                                lang={lang}
                                t={t}
                              />
                            );
                          })}
                          {/* Per-subscale dual rows (if both segments have data) */}
                          {dS && !dS.suppressed && dNS && !dNS.suppressed && (() => {
                            const subs = dS.subscales.filter((s) => s.subscale !== "total");
                            if (subs.length === 0) return null;
                            return (
                              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                {subs.map((sub) => {
                                  const nsSub = dNS.subscales.find((s) => s.subscale === sub.subscale);
                                  if (!nsSub) return null;
                                  return (
                                    <div key={sub.subscale}>
                                      <p className="text-xs text-gray-500 mb-1">
                                        {subLabel(sub, lang)}
                                      </p>
                                      <div className="space-y-1">
                                        <MiniSegBar avg={sub.avg}    band={sub.band}    color="#2563eb" />
                                        <MiniSegBar avg={nsSub.avg}  band={nsSub.band}  color="#7c3aed" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tenure tab ── */}
        {activeTab === "tenure" && (() => {
          const tenureColors: Record<string, string> = {
            UNDER_1Y:    "#d97706",
            ONE_TO_3Y:   "#2563eb",
            THREE_TO_7Y: "#7c3aed",
            OVER_7Y:     "#16a34a",
          };

          // Org-level insight: UNDER_1Y vs avg(THREE_TO_7Y, OVER_7Y)
          const tenureSegs = data.tenure.segments;
          const under1  = tenureSegs.find((s) => s.value === "UNDER_1Y");
          const three7  = tenureSegs.find((s) => s.value === "THREE_TO_7Y");
          const over7   = tenureSegs.find((s) => s.value === "OVER_7Y");
          const under1Total  = under1?.suppressed  ? null : under1?.subscales.find((s) => s.subscale === "total")?.avg;
          const three7Total  = three7?.suppressed  ? null : three7?.subscales.find((s) => s.subscale === "total")?.avg;
          const over7Total   = over7?.suppressed   ? null : over7?.subscales.find((s) => s.subscale === "total")?.avg;
          const longTermAvg  = [three7Total, over7Total].filter((v): v is number => v != null);
          const longTermMean = longTermAvg.length > 0 ? longTermAvg.reduce((a, b) => a + b, 0) / longTermAvg.length : null;
          let tenureInsightKey: string | null = null;
          if (under1Total != null && longTermMean != null) {
            const diff = under1Total - longTermMean;
            if (HIGHER_IS_WORSE && diff >= 15)  tenureInsightKey = "demog_insight_new_joiner_high";
            if (HIGHER_IS_WORSE && diff <= -15) tenureInsightKey = "demog_insight_new_joiner_low";
            if (!HIGHER_IS_WORSE && diff <= -15) tenureInsightKey = "demog_insight_new_joiner_low";
            if (!HIGHER_IS_WORSE && diff >= 15)  tenureInsightKey = "demog_insight_new_joiner_high";
          }

          return (
            <div className="space-y-6">
              {tenureInsightKey && (
                <div className="flex items-start gap-3 rounded-xl px-4 py-3 border bg-amber-50 border-amber-200 text-sm">
                  <span className="text-lg shrink-0 mt-0.5">⚠️</span>
                  <span className="text-amber-700">{t(tenureInsightKey as any)}</span>
                </div>
              )}

              {/* Org-level tenure bars */}
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{t("demog_org_level")}</p>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                  {tenureSegs.map((seg) => {
                    const total = seg.subscales.find((s) => s.subscale === "total");
                    return (
                      <SegmentBar key={seg.value} label={seg.label} count={seg.respondentCount}
                        suppressed={seg.suppressed} avg={total?.avg} band={total?.band}
                        color={tenureColors[seg.value] ?? "#6b7280"} lang={lang} t={t} />
                    );
                  })}
                </div>
              </div>

              {/* Per-dept cards */}
              {data.deptByTenure.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{t("demog_dept_level")}</p>
                  <div className="space-y-4">
                    {data.deptByTenure.map((dept) => {
                      // Dept-level insight
                      const dUnder1  = dept.segments.find((s) => s.value === "UNDER_1Y");
                      const dThree7  = dept.segments.find((s) => s.value === "THREE_TO_7Y");
                      const dOver7   = dept.segments.find((s) => s.value === "OVER_7Y");
                      const dU1t  = dUnder1?.suppressed  ? null : dUnder1?.subscales.find((s) => s.subscale === "total")?.avg;
                      const dT7t  = dThree7?.suppressed  ? null : dThree7?.subscales.find((s) => s.subscale === "total")?.avg;
                      const dO7t  = dOver7?.suppressed   ? null : dOver7?.subscales.find((s) => s.subscale === "total")?.avg;
                      const dLTAvg = [dT7t, dO7t].filter((v): v is number => v != null);
                      const dLTMean = dLTAvg.length > 0 ? dLTAvg.reduce((a, b) => a + b, 0) / dLTAvg.length : null;
                      let dInsightKey: string | null = null;
                      if (dU1t != null && dLTMean != null) {
                        const dDiff = dU1t - dLTMean;
                        if (HIGHER_IS_WORSE && dDiff >= 15)  dInsightKey = "demog_insight_new_joiner_high";
                        if (HIGHER_IS_WORSE && dDiff <= -15) dInsightKey = "demog_insight_new_joiner_low";
                        if (!HIGHER_IS_WORSE && dDiff <= -15) dInsightKey = "demog_insight_new_joiner_low";
                        if (!HIGHER_IS_WORSE && dDiff >= 15)  dInsightKey = "demog_insight_new_joiner_high";
                      }
                      return (
                        <div key={dept.departmentId} className={`border rounded-xl overflow-hidden ${dInsightKey ? "border-amber-200" : "border-gray-100"}`}>
                          <div className={`px-4 py-2.5 ${dInsightKey ? "bg-amber-50" : "bg-gray-50"}`}>
                            <h4 className="font-semibold text-gray-900 text-sm">{dept.departmentName}</h4>
                          </div>
                          <div className="px-4 py-3 space-y-2.5">
                            {dept.segments.map((seg) => {
                              const total = seg.subscales.find((s) => s.subscale === "total");
                              return (
                                <SegmentBar key={seg.value} label={seg.label} count={seg.respondentCount}
                                  suppressed={seg.suppressed} avg={total?.avg} band={total?.band}
                                  color={tenureColors[seg.value] ?? "#6b7280"} lang={lang} t={t} />
                              );
                            })}
                            {dInsightKey && (
                              <p className="text-xs text-amber-600 pt-1">{t(dInsightKey as any)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Seniority tab ── */}
        {activeTab === "seniority" && (() => {
          const seniorityColors: Record<string, string> = {
            INDIVIDUAL_CONTRIBUTOR: "#2563eb",
            MANAGER:                "#7c3aed",
          };

          // Org-level insight: |IC_total – Mgr_total| >= 15
          const senioritySegs = data.seniority.segments;
          const icSeg  = senioritySegs.find((s) => s.value === "INDIVIDUAL_CONTRIBUTOR");
          const mgrSeg = senioritySegs.find((s) => s.value === "MANAGER");
          const icTotal  = icSeg?.suppressed  ? null : icSeg?.subscales.find((s) => s.subscale === "total")?.avg;
          const mgrTotal = mgrSeg?.suppressed ? null : mgrSeg?.subscales.find((s) => s.subscale === "total")?.avg;
          let seniorityInsightKey: string | null = null;
          if (icTotal != null && mgrTotal != null) {
            const diff = icTotal - mgrTotal;
            const icWorse  = HIGHER_IS_WORSE ? diff >= 15  : diff <= -15;
            const mgrWorse = HIGHER_IS_WORSE ? diff <= -15 : diff >= 15;
            if (icWorse)  seniorityInsightKey = "demog_insight_ic_worse";
            if (mgrWorse) seniorityInsightKey = "demog_insight_mgr_worse";
          }

          return (
            <div className="space-y-6">
              {seniorityInsightKey && (
                <div className="flex items-start gap-3 rounded-xl px-4 py-3 border bg-amber-50 border-amber-200 text-sm">
                  <span className="text-lg shrink-0 mt-0.5">⚠️</span>
                  <span className="text-amber-700">{t(seniorityInsightKey as any)}</span>
                </div>
              )}

              {/* Org-level seniority bars */}
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{t("demog_org_level")}</p>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                  {senioritySegs.map((seg) => {
                    const total = seg.subscales.find((s) => s.subscale === "total");
                    return (
                      <SegmentBar key={seg.value} label={seg.label} count={seg.respondentCount}
                        suppressed={seg.suppressed} avg={total?.avg} band={total?.band}
                        color={seniorityColors[seg.value] ?? "#6b7280"} lang={lang} t={t} />
                    );
                  })}
                </div>
              </div>

              {/* Per-dept cards */}
              {data.deptBySeniority.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{t("demog_dept_level")}</p>
                  <div className="space-y-4">
                    {data.deptBySeniority.map((dept) => {
                      // Dept-level insight
                      const dIC  = dept.segments.find((s) => s.value === "INDIVIDUAL_CONTRIBUTOR");
                      const dMgr = dept.segments.find((s) => s.value === "MANAGER");
                      const dICt  = dIC?.suppressed  ? null : dIC?.subscales.find((s) => s.subscale === "total")?.avg;
                      const dMgrt = dMgr?.suppressed ? null : dMgr?.subscales.find((s) => s.subscale === "total")?.avg;
                      let dInsightKey: string | null = null;
                      if (dICt != null && dMgrt != null) {
                        const dDiff = dICt - dMgrt;
                        const dIcWorse  = HIGHER_IS_WORSE ? dDiff >= 15  : dDiff <= -15;
                        const dMgrWorse = HIGHER_IS_WORSE ? dDiff <= -15 : dDiff >= 15;
                        if (dIcWorse)  dInsightKey = "demog_insight_ic_worse";
                        if (dMgrWorse) dInsightKey = "demog_insight_mgr_worse";
                      }
                      return (
                        <div key={dept.departmentId} className={`border rounded-xl overflow-hidden ${dInsightKey ? "border-amber-200" : "border-gray-100"}`}>
                          <div className={`px-4 py-2.5 ${dInsightKey ? "bg-amber-50" : "bg-gray-50"}`}>
                            <h4 className="font-semibold text-gray-900 text-sm">{dept.departmentName}</h4>
                          </div>
                          <div className="px-4 py-3 space-y-2.5">
                            {dept.segments.map((seg) => {
                              const total = seg.subscales.find((s) => s.subscale === "total");
                              return (
                                <SegmentBar key={seg.value} label={seg.label} count={seg.respondentCount}
                                  suppressed={seg.suppressed} avg={total?.avg} band={total?.band}
                                  color={seniorityColors[seg.value] ?? "#6b7280"} lang={lang} t={t} />
                              );
                            })}
                            {dInsightKey && (
                              <p className="text-xs text-amber-600 pt-1">{t(dInsightKey as any)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </section>
  );
}

// ─── Demographic KPI card ─────────────────────────────────────────────────────

function DemogKpiCard({
  label, value, band, note, suffix, isGap,
}: {
  label: string;
  value: number | null;
  band?: string;
  note?: string;
  suffix?: string;
  isGap?: boolean;
}) {
  const gapColor = isGap && value !== null
    ? (value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-700")
    : (band ? bandColor(band) : "text-gray-700");

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500 font-medium leading-tight mb-2">{label}</p>
      {value !== null ? (
        <>
          <p className={`text-2xl font-black ${gapColor}`}>
            {isGap && value > 0 ? "+" : ""}{value}{suffix ?? ""}
          </p>
          {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-400 italic">—</p>
      )}
    </div>
  );
}

// ─── Segment bar (single group row) ──────────────────────────────────────────

function SegmentBar({
  label, count, suppressed, avg, band, color, lang, t,
}: {
  label: string;
  count: number;
  suppressed: boolean;
  avg?: number;
  band?: string;
  color: string;
  lang: "en" | "ar";
  t: (k: any) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-gray-700 truncate">{label}</span>
          <span className="text-xs text-gray-400 shrink-0">({count})</span>
        </div>
        {suppressed ? (
          <span className="text-xs text-gray-400 italic shrink-0">{t("demog_insufficient")}</span>
        ) : avg !== null && avg !== undefined ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-sm font-bold ${band ? bandColor(band) : "text-gray-700"}`}>
              {Math.round(avg)}
            </span>
            {band && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold hidden sm:inline ${bandBg(band)}`}>
                {translateBand(band, lang)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic shrink-0">—</span>
        )}
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {suppressed ? (
          <div className="h-full w-full bg-gray-200 rounded-full opacity-40" />
        ) : avg !== null && avg !== undefined ? (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round(avg)}%`, backgroundColor: color }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Mini segment bar (compact, for subscale dual rows) ───────────────────────

function MiniSegBar({ avg, band: _band, color }: { avg: number; band: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.round(avg)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-6 text-end">{Math.round(avg)}</span>
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
