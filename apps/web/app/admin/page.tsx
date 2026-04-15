"use client";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminLang } from "./context";
import { useTranslations } from "@/lib/i18n";

type DashData = {
  totalOrgs:        number;
  activeCycles:     number;
  totalRespondents: number;
  recentLogs:       Array<{
    id:         string;
    action:     string;
    entityType: string | null;
    createdAt:  string;
    user:       { email: string; firstName: string; lastName: string } | null;
  }>;
};

// ─── Action colour map ────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  CYCLE_ACTIVATED: "text-green-600 bg-green-50",
  CYCLE_CLOSED:    "text-blue-600 bg-blue-50",
  CYCLE_CREATED:   "text-brand-600 bg-brand-50",
  USER_CREATED:    "text-purple-600 bg-purple-50",
  USER_DELETED:    "text-red-600 bg-red-50",
  RESPONSE_SUBMITTED: "text-sage-600 bg-sage-50",
  DATA_EXPORT:     "text-amber-600 bg-amber-50",
};

function actionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function relativeTime(iso: string, lang: "en" | "ar"): string {
  const rtf  = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", { numeric: "auto" });
  const diff = new Date(iso).getTime() - Date.now(); // negative = in the past
  const secs  = Math.round(diff / 1000);
  const mins  = Math.round(secs / 60);
  const hours = Math.round(mins / 60);
  const days  = Math.round(hours / 24);
  if (Math.abs(days)  >= 1) return rtf.format(days,  "day");
  if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
  if (Math.abs(mins)  >= 1) return rtf.format(mins,  "minute");
  return rtf.format(secs, "second");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminHomePage() {
  const lang = useAdminLang();
  const t    = useTranslations(lang);

  const [data, setData]       = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mindlign_token");
    fetch(`${API_BASE}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error("error"); return r.json(); })
      .then(setData)
      .catch(() => setError(t("admin_error")))
      .finally(() => setLoading(false));
  }, []);  // eslint-disable-line

  if (loading) return <Spinner />;
  if (error)   return <p className="text-red-500 text-sm">{error}</p>;
  if (!data)   return null;

  const stats = [
    { label: t("admin_stat_orgs"),         value: data.totalOrgs,        icon: "🏢", href: "/admin/organisations" },
    { label: t("admin_stat_active"),        value: data.activeCycles,     icon: "🔄", href: "/admin/organisations" },
    { label: t("admin_stat_respondents"),   value: data.totalRespondents, icon: "👥", href: null },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("admin_dashboard")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mindlign · Platform Overview</p>
        </div>
        <Link
          href="/admin/organisations/new"
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
        >
          {t("admin_new_client")}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon, href }) => {
          const inner = (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <span className="text-2xl">{icon}</span>
                {href && (
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-3">{value.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          );
          return href
            ? <Link key={label} href={href}>{inner}</Link>
            : <div key={label}>{inner}</div>;
        })}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t("admin_recent_activity")}</h2>
          <Link href="/admin/audit" className="text-sm text-brand-600 hover:text-brand-800 font-medium">
            {lang === "ar" ? "عرض الكل" : "View all"} →
          </Link>
        </div>
        {data.recentLogs.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.recentLogs.map((log) => (
              <li key={log.id} className="px-6 py-3 flex items-center gap-4">
                <span
                  className={[
                    "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                    ACTION_COLOR[log.action] ?? "text-gray-600 bg-gray-100",
                  ].join(" ")}
                >
                  {actionLabel(log.action)}
                </span>
                <span className="text-sm text-gray-600 flex-1 truncate">
                  {log.user
                    ? `${log.user.firstName} ${log.user.lastName} · ${log.user.email}`
                    : log.entityType ?? "—"}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{relativeTime(log.createdAt, lang)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  );
}
