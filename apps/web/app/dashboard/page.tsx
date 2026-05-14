"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api";
import { dir, useTranslations, Lang } from "@/lib/i18n";
import { useDashLang, useDashUser } from "./context";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashStats = {
  totalCycles: number;
  activeCycles: number;
  totalRespondents: number;
  avgScore: number | null;
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardOverviewPage() {
  const lang = useDashLang();
  const user = useDashUser();
  const t    = useTranslations(lang);

  const [stats, setStats]     = useState<DashStats | null>(null);
  const [cycles, setCycles]   = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("mindlign_token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    setLoading(true);
    setError("");

    Promise.all([
      fetch(`${API_BASE}/reports/dashboard/${user.organisationId}`, { headers }).then(
        (r) => (r.ok ? r.json() : null)
      ),
      fetch(
        `${API_BASE}/assessments/cycles?organisationId=${user.organisationId}`,
        { headers }
      ).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([s, c]) => {
        if (s) setStats(s);
        const list: Cycle[] = Array.isArray(c) ? c : [];
        // Sort: ACTIVE → CLOSED → ARCHIVED → DRAFT
        list.sort(
          (a, b) =>
            (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
        );
        setCycles(list);
      })
      .catch(() => {
        setError(
          lang === "ar"
            ? "تعذّر تحميل بيانات لوحة التحكم."
            : "Failed to load dashboard data."
        );
      })
      .finally(() => setLoading(false));
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

  const canView = (status: string) =>
    status === "ACTIVE" || status === "CLOSED" || status === "ARCHIVED";

  return (
    <div dir={dir(lang)} className="max-w-6xl mx-auto space-y-8">

      {/* ── Page heading ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("exec_title")}</h1>
        <p className="text-gray-500 mt-1">
          {t("exec_welcome")}, {user.firstName}.
        </p>
      </div>

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
          <StatCard
            label={t("stat_avg_score")}
            value={stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
          />
        </div>
      )}

      {/* ── Assessment Cycles ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {t("section_cycles")}
        </h2>

        {cycles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center space-y-2">
            <p className="text-gray-500">{t("cycle_no_cycles")}</p>
            <p className="text-sm text-gray-400">{t("cycle_create_first")}</p>
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
    </div>
  );
}
