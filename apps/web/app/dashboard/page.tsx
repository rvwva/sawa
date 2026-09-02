"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { API_BASE } from "@/lib/api";
import { dir, useTranslations, Lang } from "@/lib/i18n";
import { useDashLang, useDashUser } from "./context";

const OnaGraph = dynamic(() => import("@/components/ui/OnaGraph"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type DashStats = {
  totalCycles: number;
  activeCycles: number;
  totalRespondents: number;
  avgScore: number | null;
  scoreAssessmentType?: string | null;
  participationRate?: number | null;
};

type Cycle = {
  id: string;
  title: string;
  status: string;
  assessment: { type: string; name: string; nameAr?: string };
  _count: { respondents: number };
  startsAt: string;
  endsAt: string;
  closedAt?: string;
  resultsPublishedAt?: string;
};

type OnaInsightCardData = {
  id: string;
  departmentId: string;
  department: { name: string; nameAr?: string | null };
  riskLevel: string;
  insightText: string;
  insightTextAr?: string | null;
  signals: string[];
};

type OnaMetricData = {
  id: string;
  userEmail: string;
  departmentId: string | null;
  isolationScore: number;
};

type OnaResults = {
  onaEnabled: boolean;
  lastSyncAt: string | null;
  insightCards: OnaInsightCardData[];
  metrics: OnaMetricData[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 text-green-700",
  DRAFT:    "bg-gray-100 text-gray-600",
  CLOSED:   "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

const STATUS_AR: Record<string, string> = {
  ACTIVE: "نشط", DRAFT: "مسودة", CLOSED: "مغلق", ARCHIVED: "مؤرشف",
};

const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0, CLOSED: 1, ARCHIVED: 2, DRAFT: 3,
};

const RISK_BADGE: Record<string, string> = {
  urgent:   "bg-red-100 text-red-700",
  moderate: "bg-amber-100 text-amber-700",
  healthy:  "bg-green-100 text-green-700",
};

const RISK_BORDER: Record<string, string> = {
  urgent:   "border-red-200",
  moderate: "border-amber-200",
  healthy:  "border-green-200",
};

const RISK_LABEL_AR: Record<string, string> = {
  urgent: "عاجل", moderate: "متوسط", healthy: "صحي",
};

const DEPT_PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6"];

function colorForDept(deptId: string | null): string {
  if (!deptId) return "#94a3b8";
  let hash = 0;
  for (let i = 0; i < deptId.length; i++) hash = (hash * 31 + deptId.charCodeAt(i)) >>> 0;
  return DEPT_PALETTE[hash % DEPT_PALETTE.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string, lang: Lang): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "bg-brand-500 border-brand-600 text-white"
          : "bg-white border-gray-200"
      }`}
    >
      <p className={`text-sm ${highlight ? "text-brand-100" : "text-gray-500"}`}>
        {label}
      </p>
      <p
        className={`text-3xl font-bold mt-1 ${
          highlight ? "text-white" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── New-cycle modal ──────────────────────────────────────────────────────────

const ASSESSMENT_TYPES = ["CBI", "CULTURE", "PSYCH_SAFETY", "TURNOVER", "LMX7"] as const;

function NewCycleModal({
  lang,
  onClose,
  onCreated,
}: {
  lang: Lang;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations(lang);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    assessmentType: "CBI",
    title: "",
    startsAt: "",
    endsAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("mindlign_token");
      const res = await fetch(`${API_BASE}/assessments/cycles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? (lang === "ar" ? "فشل الإنشاء" : "Failed to create cycle"));
        return;
      }
      onCreated();
    } catch {
      setErr(lang === "ar" ? "خطأ في الشبكة" : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t("admin_new_cycle")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{err}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_cycle_type")}</label>
            <select
              value={form.assessmentType}
              onChange={(e) => setForm((f) => ({ ...f, assessmentType: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {ASSESSMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_cycle_title_f")}</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={lang === "ar" ? "مثال: دورة Q3 2026" : "e.g. Q3 2026 Cycle"}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_cycle_starts")}</label>
              <input
                type="date"
                required
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("admin_cycle_ends")}</label>
              <input
                type="date"
                required
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {submitting ? (lang === "ar" ? "جاري الإنشاء…" : "Creating…") : t("admin_create_cycle")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardOverviewPage() {
  const lang = useDashLang();
  const user = useDashUser();
  const t    = useTranslations(lang);

  const [stats, setStats]         = useState<DashStats | null>(null);
  const [cycles, setCycles]       = useState<Cycle[]>([]);
  const [onaResults, setOnaResults] = useState<OnaResults | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showNewCycle, setShowNewCycle] = useState(false);

  const loadData = (orgId: string, token: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`${API_BASE}/reports/dashboard/${orgId}`, { headers }).then(
        (r) => (r.ok ? r.json() : null)
      ),
      fetch(`${API_BASE}/assessments/cycles?organisationId=${orgId}`, { headers }).then(
        (r) => (r.ok ? r.json() : [])
      ),
      fetch(`${API_BASE}/ona/results/${orgId}`, { headers }).then(
        (r) => (r.ok ? r.json() : null)
      ),
    ])
      .then(([s, c, o]) => {
        if (s) setStats(s);
        const list: Cycle[] = Array.isArray(c) ? c : [];
        list.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
        setCycles(list);
        if (o) setOnaResults(o);
      })
      .catch(() => {
        setError(lang === "ar" ? "تعذّر تحميل بيانات لوحة التحكم." : "Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("mindlign_token");
    if (!token) return;
    loadData(user.organisationId, token);
  }, [user, lang]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
          <p className="text-sm text-gray-500">{t("loading_results")}</p>
        </div>
      </div>
    );
  }

  const canView = (_status: string) => true;

  return (
    <div dir={dir(lang)} className="max-w-6xl mx-auto space-y-8">

      {/* ── Page heading ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("exec_title")}</h1>
          <p className="text-gray-500 mt-1">
            {t("exec_welcome")}, {user.firstName}.
          </p>
        </div>
        {(user.role === "ADMIN" || user.role === "EXECUTIVE") && (
          <button
            onClick={() => setShowNewCycle(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            {t("exec_new_cycle")}
          </button>
        )}
      </div>

      {/* ── New Cycle modal ── */}
      {showNewCycle && (
        <NewCycleModal
          lang={lang}
          onClose={() => setShowNewCycle(false)}
          onCreated={() => {
            setShowNewCycle(false);
            const token = localStorage.getItem("mindlign_token");
            if (token && user) loadData(user.organisationId, token);
          }}
        />
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── KPI stat cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t("stat_total_cycles")}  value={stats.totalCycles} />
          <StatCard label={t("stat_active_cycles")} value={stats.activeCycles} highlight />
          <StatCard label={t("stat_respondents")}   value={stats.totalRespondents} />
          {stats.scoreAssessmentType ? (
            <StatCard
              label={`${stats.scoreAssessmentType} · ${t("stat_avg_score")}`}
              value={stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
            />
          ) : (
            <StatCard
              label={t("stat_participation")}
              value={stats.participationRate != null ? `${stats.participationRate}%` : "—"}
            />
          )}
        </div>
      )}

      {/* ── Assessment Cycles ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {t("section_cycles")}
        </h2>

        {cycles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center space-y-3">
            <p className="text-gray-500">{t("cycle_no_cycles")}</p>
            <p className="text-sm text-gray-400">{t("cycle_create_first")}</p>
            {(user.role === "ADMIN" || user.role === "EXECUTIVE") && (
              <button
                onClick={() => setShowNewCycle(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors mt-2"
              >
                {t("exec_new_cycle")}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-start px-5 py-3 font-medium text-gray-500">
                      {t("cycle_col_title")}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500 hidden md:table-cell">
                      {t("cycle_col_type")}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500">
                      {t("cycle_col_status")}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">
                      {t("cycle_col_n")}
                    </th>
                    <th className="text-start px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">
                      {t("cycle_col_closes")}
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => (
                    <tr
                      key={cycle.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        {cycle.title}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">
                        {lang === "ar" && cycle.assessment?.nameAr
                          ? cycle.assessment.nameAr
                          : cycle.assessment?.name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            STATUS_COLORS[cycle.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {lang === "ar"
                            ? (STATUS_AR[cycle.status] ?? cycle.status)
                            : cycle.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">
                        {cycle._count?.respondents ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 hidden lg:table-cell">
                        {cycle.closedAt
                          ? formatDate(cycle.closedAt, lang)
                          : formatDate(cycle.endsAt, lang)}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {canView(cycle.status) ? (
                          <Link
                            href={`/dashboard/cycles/${cycle.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition-colors"
                          >
                            {t("cycle_view")}
                            <svg
                              className={`w-3.5 h-3.5 ${lang === "ar" ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 text-xs font-semibold cursor-not-allowed">
                            {t("cycle_view")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Organizational Network Analysis (ONA) ── */}
      {onaResults && onaResults.insightCards.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {lang === "ar" ? "تحليل الشبكة التنظيمية" : "Organizational Network Analysis"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {onaResults.insightCards.map((card) => (
              <div
                key={card.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm ${
                  RISK_BORDER[card.riskLevel] ?? "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {lang === "ar" && card.department.nameAr
                      ? card.department.nameAr
                      : card.department.name}
                  </h3>
                  <span
                    className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      RISK_BADGE[card.riskLevel] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {lang === "ar"
                      ? (RISK_LABEL_AR[card.riskLevel] ?? card.riskLevel)
                      : card.riskLevel}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {lang === "ar" && card.insightTextAr ? card.insightTextAr : card.insightText}
                </p>
              </div>
            ))}
          </div>

          {onaResults.metrics.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-3">
                {lang === "ar"
                  ? "خريطة الشبكة — حجم النقطة يعكس درجة العزلة. خطوط الاتصال ستظهر بعد أول مزامنة حقيقية مع Microsoft 365."
                  : "Network map — dot size reflects isolation score. Connection lines appear after the first real Microsoft 365 sync."}
              </p>
              <OnaGraph
                nodes={onaResults.metrics.map((m) => ({
                  id: m.userEmail,
                  size: 4 + m.isolationScore * 10,
                  color: colorForDept(m.departmentId),
                }))}
                edges={[]}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
